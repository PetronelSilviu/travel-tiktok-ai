import { NextResponse } from 'next/server';
import Amadeus from 'amadeus';
import OpenAI from 'openai';

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: getCorsHeaders() });
}

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
    if (!text) return 'OTP'; 
    const match = text.match(/[A-Za-z]{3}/);
    return match ? match[0].toUpperCase() : 'OTP';
}

function extractPrice(text: string): number {
    if (!text) return 0;
    const match = text.match(/(\d+)/); 
    return match ? parseInt(match[0]) : 0;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tipCautare, origine, destinatie, vibe, buget, dataInput, tipData, flexibil, nrNopti, monedaPreferred } = body;
        const moneda = monedaPreferred || 'EUR';

        console.log(`🚀 Start Căutare: ${origine} -> ${destinatie} | Moneda: ${moneda}`);

        let codPlecare = origine;
        let targetIATA = '';
        let targetNume = '';
        let dataPlecare = '';
        let dataIntoarcere = '';
        let motivatieAI = '';

        // --- 0. PRELUCRARE ORIGINE ---
        // Dacă e mai lung de 3 litere, convertim în cod IATA
        if (origine.length > 3) {
             const originPrompt = `Care este codul IATA al aeroportului din orașul "${origine}"? Răspunde DOAR cu codul de 3 litere (Ex: IAS).`;
             const aiOrigin = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: originPrompt }] });
             codPlecare = extractIATA(aiOrigin.choices[0].message.content);
             console.log(`✅ Origine detectată: ${origine} -> ${codPlecare}`);
        } else {
            codPlecare = origine.toUpperCase();
        }

        // --- 1. DATA ---
        if (tipData === 'luna') {
            const datePrompt = `Utilizator vrea zbor în luna ${dataInput}. Plecare: ${codPlecare}. Destinație: ${destinatie || vibe}. Găsește cea mai ieftină dată de plecare. Răspunde DOAR format YYYY-MM-DD.`;
            const aiDate = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: datePrompt }] });
            const matchDate = aiDate.choices[0].message.content?.match(/\d{4}-\d{2}-\d{2}/);
            dataPlecare = matchDate ? matchDate[0] : `${dataInput}-15`;
        } else {
            dataPlecare = dataInput;
        }

        if (nrNopti && parseInt(nrNopti) > 0) {
            dataIntoarcere = addDays(dataPlecare, parseInt(nrNopti));
        }

        // --- 2. DESTINAȚIE ---
        if (tipCautare === 'exact') {
            const iataPrompt = `Găsește codul IATA generic de ORAȘ (Metropolitan Area) pentru "${destinatie}". Ex: Milano -> MIL. Răspunde DOAR cu codul de 3 litere.`;
            const aiResp = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: iataPrompt }] });
            targetIATA = extractIATA(aiResp.choices[0].message.content);
            targetNume = destinatie;
        } else {
            let context = "";
            if (tipCautare === 'global') context = `Caută ORIUNDE ÎN LUME o destinație cu vibe "${vibe}".`;
            else if (tipCautare === 'vibe') context = `Caută o destinație în Europa cu vibe "${vibe}".`;
            else context = `Caută o destinație "Hidden Gem" surpriză.`;

            if (buget) context += ` Zborul trebuie să fie sub ${buget} ${moneda}.`;

            const strategyPrompt = `Expert logistică. ${context} Plecare: ${codPlecare}, Data: ${dataPlecare}. Alege O SINGURĂ destinație. Răspunde JSON: { "oras": "Nume", "iata": "COD", "motiv": "..." }`;
            const aiStrategy = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: strategyPrompt }] });

            let choice: any = {};
            try {
                let txt = aiStrategy.choices[0].message.content?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
                const jsonMatch = txt.match(/\{[\s\S]*\}/);
                if (jsonMatch) txt = jsonMatch[0];
                choice = JSON.parse(txt);
            } catch(e) { choice = { iata: 'NAP', oras: 'Napoli' }; }

            targetIATA = extractIATA(choice.iata);
            targetNume = choice.oras;
            motivatieAI = choice.motiv;
        }

        // --- 3. ZBOR ---
        let zbor = null;
        let searchParams: any = {
            originLocationCode: codPlecare,
            destinationLocationCode: targetIATA,
            departureDate: dataPlecare,
            adults: 1,
            max: 5,
            currencyCode: moneda
        };
        if (dataIntoarcere) searchParams.returnDate = dataIntoarcere;

        try {
            const flightResp = await amadeus.shopping.flightOffersSearch.get(searchParams);
            if (flightResp.data.length > 0) {
                flightResp.data.sort((a: any, b: any) => parseFloat(a.price.total) - parseFloat(b.price.total));
                zbor = flightResp.data[0];
            }
        } catch (err) { console.error("Amadeus:", err); }

        if (!zbor) {
            return NextResponse.json({ status: 'no_data', message: `Nu am găsit zboruri din ${origine} spre ${targetNume}.` }, { headers: getCorsHeaders() });
        }

        const pretZbor = parseFloat(zbor.price.total);

        // --- 4. HOTEL & TOTAL ---
        let hotelInfo = { nume: "Caută pe Booking", pret_total: "0" };
        let pretHotelNum = 0;

        if (dataIntoarcere && nrNopti) {
            const hotelPrompt = `Destinație: ${targetNume}. Cât costă un hotel mediu (3 stele) pentru ${nrNopti} nopți în ${moneda}? Răspunde JSON: { "nume": "Hotel Estimat", "pret_total": "NUMAR" }`;
            const aiHotel = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: hotelPrompt }] });
            try {
                let txt = aiHotel.choices[0].message.content?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
                const jsonMatch = txt.match(/\{[\s\S]*\}/);
                if (jsonMatch) txt = jsonMatch[0];
                hotelInfo = JSON.parse(txt);
                pretHotelNum = extractPrice(hotelInfo.pret_total);
            } catch(e) {}
        }

        const totalVacanta = Math.floor(pretZbor + pretHotelNum);

        // --- 5. TIKTOK CONTENT ---
        const itinerariu = zbor.itineraries[0];
        const nrEscale = itinerariu.segments.length - 1;
        const aeroportFinal = itinerariu.segments[itinerariu.segments.length - 1].arrival.iataCode;

        const oferta = {
            origine: origine.toUpperCase(), // Numele afisat (ex: Iasi)
            aeroport_plecare: codPlecare,   // CODUL IATA (ex: IAS) - IMPORTANT PENTRU LINK!
            destinatie: targetNume, 
            aeroport_sosire: aeroportFinal,
            data: dataPlecare,
            data_intors: dataIntoarcere || null,
            pret: pretZbor, 
            moneda: moneda,
            nr_nopti: nrNopti || 0,
            pret_hotel_num: pretHotelNum,
            total_vacanta: totalVacanta,
            durata: itinerariu.duration.replace('PT', '').toLowerCase(),
            escale: nrEscale === 0 ? "Direct" : `${nrEscale} escale`,
        };

        const scriptPrompt = `
        TikTok Viral. Zbor ${oferta.origine}-${oferta.destinatie} (${oferta.aeroport_sosire}).
        Preț Total Pachet: ${oferta.total_vacanta} ${moneda}.
        ${motivatieAI ? "Motivație: " + motivatieAI : ""}
        Răspunde JSON valid: { "hook_vizual": "...", "descriere": "...", "sunet": "...", "script_audio": "..." }
        `;

        const aiContent = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: scriptPrompt }] });
        
        let contentJson = { 
            hook_vizual: `VACANȚĂ: ${oferta.destinatie.toUpperCase()}`, 
            descriere: `Pachet complet ${oferta.destinatie} la doar ${oferta.total_vacanta} ${moneda}!`,
            sunet: "Travel Vibes",
            script_audio: `Nu rata oferta asta! ${oferta.nr_nopti} nopți în ${oferta.destinatie} cu zbor inclus la doar ${oferta.total_vacanta} ${moneda}.`,
            hotel_nume: hotelInfo.nume 
        };

        try {
            let txt = aiContent.choices[0].message.content || "{}";
            txt = txt.replace(/```json/g, '').replace(/```/g, '');
            const jsonMatch = txt.match(/\{[\s\S]*\}/);
            if (jsonMatch) txt = jsonMatch[0];
            contentJson = { ...contentJson, ...JSON.parse(txt) };
        } catch (e) {}

        return NextResponse.json({ status: 'success', oferta, content: contentJson }, { headers: getCorsHeaders() });

    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500, headers: getCorsHeaders() });
    }
}