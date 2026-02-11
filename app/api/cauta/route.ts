import { NextResponse } from 'next/server';
import Amadeus from 'amadeus';
import OpenAI from 'openai';

const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_API_KEY,
    clientSecret: process.env.AMADEUS_API_SECRET,
});

const perplexity = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
});

function addDays(dateStr: string, days: number): string {
    const result = new Date(dateStr);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
}

function extractIATA(text: string | null): string {
    if (!text) return 'FCO';
    const match = text.match(/[A-Za-z]{3}/);
    return match ? match[0].toUpperCase() : 'FCO';
}

export async function POST(request: Request) {
    const { tipCautare, origine, destinatie, vibe, buget, dataInput, tipData, flexibil, nrNopti } = await request.json();

    try {
        console.log(`🚀 Mod: ${tipCautare} | Data: ${dataInput} | Nopti: ${nrNopti || 0}`);

        let targetIATA = '';
        let targetNume = '';
        let dataPlecare = '';
        let dataIntoarcere = '';
        let motivatieAI = '';

        // --- 1. CALCULARE DATĂ ---
        if (tipData === 'luna') {
            const datePrompt = `Utilizator vrea zbor în luna ${dataInput}. Destinație/Vibe: ${destinatie || vibe}. Găsește cea mai ieftină dată de plecare. Răspunde DOAR format YYYY-MM-DD.`;
            const aiDate = await perplexity.chat.completions.create({
                model: 'sonar', messages: [{ role: 'user', content: datePrompt }]
            });
            const matchDate = aiDate.choices[0].message.content?.match(/\d{4}-\d{2}-\d{2}/);
            dataPlecare = matchDate ? matchDate[0] : `${dataInput}-15`;
        } else {
            dataPlecare = dataInput;
        }

        // Calculăm întoarcerea DOAR dacă avem nrNopti
        if (nrNopti && parseInt(nrNopti) > 0) {
            dataIntoarcere = addDays(dataPlecare, parseInt(nrNopti));
        }

        // --- 2. DESTINAȚIE (Exact, Global, Vibe, Ruletă) ---
        if (tipCautare === 'exact') {
            const iataPrompt = `Cod IATA aeroport principal pentru "${destinatie}". Doar codul.`;
            const aiResp = await perplexity.chat.completions.create({
                model: 'sonar', messages: [{ role: 'user', content: iataPrompt }]
            });
            targetIATA = extractIATA(aiResp.choices[0].message.content);
            targetNume = destinatie;
        } else {
            // Logica pentru Global / Vibe / Ruletă
            let context = "";
            if (tipCautare === 'global') context = `Caută ORIUNDE ÎN LUME o destinație cu vibe "${vibe}".`;
            else if (tipCautare === 'vibe') context = `Caută o destinație în Europa cu vibe "${vibe}".`;
            else context = `Caută o destinație "Hidden Gem" surpriză.`; // Ruletă

            if (buget) context += ` Zborul trebuie să fie sub ${buget} EUR.`;

            const strategyPrompt = `Expert logistică. ${context} Plecare: ${origine}, Data: ${dataPlecare}. Alege O SINGURĂ destinație. Răspunde JSON: { "oras": "Nume", "iata": "COD", "motiv": "..." }`;

            const aiStrategy = await perplexity.chat.completions.create({
                model: 'sonar', messages: [{ role: 'user', content: strategyPrompt }]
            });

            let choice: any = {};
            try {
                let txt = aiStrategy.choices[0].message.content?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
                choice = JSON.parse(txt);
            } catch(e) { choice = { iata: 'NAP', oras: 'Napoli' }; }

            targetIATA = extractIATA(choice.iata);
            targetNume = choice.oras;
            motivatieAI = choice.motiv;
        }

        // --- 3. CĂUTARE ZBOR (DUS sau DUS-ÎNTORS) ---
        let zbor = null;
        let searchParams: any = {
            originLocationCode: origine,
            destinationLocationCode: targetIATA,
            departureDate: dataPlecare,
            adults: 1,
            max: 3,
            currencyCode: 'EUR'
        };

        // Adăugăm retur doar dacă s-au cerut nopți
        if (dataIntoarcere) {
            searchParams.returnDate = dataIntoarcere;
        }

        // Buget maxim pentru zbor (dacă e setat)
        if (buget && parseInt(buget) > 0) {
            // Dacă e pachet, alocăm aprox 40% din buget pt zbor, altfel tot bugetul
            const limit = dataIntoarcere ? parseInt(buget) * 0.6 : parseInt(buget);
            searchParams.maxPrice = Math.floor(limit);
        }

        try {
            const flightResp = await amadeus.shopping.flightOffersSearch.get(searchParams);
            if (flightResp.data.length > 0) {
                flightResp.data.sort((a: any, b: any) => parseFloat(a.price.total) - parseFloat(b.price.total));
                zbor = flightResp.data[0];
            }
        } catch (err) { console.error("Amadeus:", err); }

        if (!zbor) {
            return NextResponse.json({ status: 'no_data', message: `Nu am găsit zboruri spre ${targetNume} (${targetIATA}).` });
        }

        // --- 4. CALCUL HOTEL (Doar dacă avem nopți și buget) ---
        const pretZbor = parseFloat(zbor.price.total);
        let hotelInfo = { nume: "Caută pe Booking", pret_total: "-" };

        if (dataIntoarcere && buget) {
            const bugetRamas = parseFloat(buget) - pretZbor;
            if (bugetRamas > 0) {
                const hotelPrompt = `
                Destinație: ${targetNume}. Buget rămas pt cazare: ${bugetRamas} EUR pentru ${nrNopti} nopți.
                Găsește un hotel/airbnb real în acest preț.
                Răspunde JSON: { "nume": "Hotel X", "pret_total": "XY EUR" }
            `;
                const aiHotel = await perplexity.chat.completions.create({
                    model: 'sonar', messages: [{ role: 'user', content: hotelPrompt }]
                });
                try {
                    let txt = aiHotel.choices[0].message.content?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
                    hotelInfo = JSON.parse(txt);
                } catch(e) {}
            }
        }

        // --- 5. TIKTOK CONTENT ---
        const itinerariu = zbor.itineraries[0];
        const nrEscale = itinerariu.segments.length - 1;

        const oferta = {
            origine, destinatie: targetNume, aeroport_sosire: targetIATA,
            data: dataPlecare,
            data_intors: dataIntoarcere || null,
            pret: pretZbor, moneda: zbor.price.currency,
            nr_nopti: nrNopti || 0,
            durata: itinerariu.duration.replace('PT', '').toLowerCase(),
            escale: nrEscale === 0 ? "Direct" : `${nrEscale} escale`,
            flexibil_msg: flexibil ? "(Flexibil)" : ""
        };

        const scriptPrompt = `
        TikTok Viral. Zbor ${oferta.origine}-${oferta.destinatie}. Preț: ${oferta.pret} EUR.
        ${motivatieAI ? "Context: " + motivatieAI : ""}
        ${oferta.nr_nopti > 0 ? `Include mențiunea că e pachet de ${oferta.nr_nopti} nopți!` : ""}
        
        JSON strict: { "hook_vizual": "...", "descriere": "...", "sunet": "...", "script_audio": "...", "hotel_nume": "${hotelInfo.nume}" }
    `;

        const aiContent = await perplexity.chat.completions.create({
            model: 'sonar', messages: [{ role: 'user', content: scriptPrompt }]
        });

        let contentJson = { hook_vizual: "OFERTĂ!", hotel_nume: hotelInfo.nume };
        try {
            let txt = aiContent.choices[0].message.content?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
            contentJson = { ...contentJson, ...JSON.parse(txt) };
        } catch (e) { }

        // Punem datele despre hotel în content dacă le avem
        if(dataIntoarcere && buget) {
            (contentJson as any).hotel_math = hotelInfo;
        }

        return NextResponse.json({ status: 'success', oferta, content: contentJson });

    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}