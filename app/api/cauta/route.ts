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
        console.log("📥 DATE PRIMITE:", JSON.stringify(body));

        const { tipCautare, origine, destinatie, vibe, buget, dataInput, tipData, flexibil, nrNopti, monedaPreferred } = body;
        const moneda = monedaPreferred || 'EUR';

        if (!origine || !dataInput) {
            return NextResponse.json({ status: 'no_data', message: "Lipsește orașul de plecare sau data." }, { headers: getCorsHeaders() });
        }

        let codPlecare = origine;
        let targetIATA = '';
        let targetNume = '';
        let dataPlecare = '';
        let dataIntoarcere = '';
        let motivatieAI = '';

        // --- 0. PRELUCRARE ORIGINE ---
        let codPlecare = origine.trim();

        // Dacă originea nu este deja un cod de 3 litere, întrebăm AI-ul
        if (codPlecare.length !== 3) {
            console.log(`🔍 Conversie nume oraș în IATA pentru: ${codPlecare}`);
            // Curățăm diacriticele manual pentru siguranță înainte de AI
            const origineCurat = codPlecare.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            const originPrompt = `Care este codul IATA al aeroportului principal din orașul "${origineCurat}"? Răspunde DOAR cu codul de 3 litere (Ex: OTP pentru București, IAS pentru Iași).`;

            try {
                const aiOrigin = await perplexity.chat.completions.create({
                    model: 'sonar',
                    messages: [{ role: 'user', content: originPrompt }]
                });
                codPlecare = extractIATA(aiOrigin.choices[0].message.content);
            } catch (aiErr) {
                console.error("Eroare AI Origine:", aiErr);
                codPlecare = "OTP"; // Fallback la București dacă AI-ul crapă
            }
        } else {
            codPlecare = codPlecare.toUpperCase();
        }

        console.log(`✅ Origine finală folosită în Amadeus: ${codPlecare}`);

        // --- 1. DATA ---
        if (tipData === 'luna') {
            const datePrompt = `Utilizator vrea zbor în luna ${dataInput}. Plecare: ${codPlecare}. Găsește cea mai ieftină dată de plecare format YYYY-MM-DD. DOAR DATA.`;
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
            const iataPrompt = `Găsește codul IATA generic pentru "${destinatie}". Răspunde DOAR cu codul de 3 litere.`;
            const aiResp = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: iataPrompt }] });
            targetIATA = extractIATA(aiResp.choices[0].message.content);
            targetNume = destinatie;
        } else {
            let context = tipCautare === 'global' ? `ORIUNDE ÎN LUME vibe "${vibe}"` : `Europa vibe "${vibe}"`;
            if (buget) context += ` Zbor sub ${buget} ${moneda}.`;

            const strategyPrompt = `Alege o destinație de vacanță. Plecare: ${codPlecare}, Data: ${dataPlecare}. Răspunde JSON: { "oras": "Nume", "iata": "COD", "motiv": "..." }`;
            const aiStrategy = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: strategyPrompt }] });

            let choice: any = {};
            try {
                let txt = aiStrategy.choices[0].message.content?.trim() || "{}";
                const jsonMatch = txt.match(/\{[\s\S]*\}/);
                choice = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
            } catch(e) { choice = { iata: 'NAP', oras: 'Napoli' }; }

            targetIATA = extractIATA(choice.iata);
            targetNume = choice.oras;
            motivatieAI = choice.motiv;
        }
        console.log(`🎯 Destinație: ${targetNume} (${targetIATA})`);

        // --- 3. ZBOR (Amadeus) ---
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
            console.log("✈️ Apelez Amadeus...");
            const flightResp = await amadeus.shopping.flightOffersSearch.get(searchParams);
            if (flightResp.data && flightResp.data.length > 0) {
                zbor = flightResp.data[0];
            }
        } catch (err) { console.error("❌ Eroare Amadeus:", err); }

        if (!zbor) {
            console.log("⚠️ Niciun zbor găsit în Amadeus.");
            return NextResponse.json({ status: 'no_data', message: `Nu am găsit zboruri din ${codPlecare} spre ${targetNume} la data de ${dataPlecare}.` }, { headers: getCorsHeaders() });
        }

        const pretZbor = parseFloat(zbor.price.total);

        // --- 4. HOTEL ---
        let pretHotelNum = 0;
        let hotelNume = "Hotel mediu";
        if (dataIntoarcere && nrNopti) {
            try {
                const hotelPrompt = `Cât costă un hotel 3* în ${targetNume} pentru ${nrNopti} nopți în ${moneda}? Răspunde JSON: { "nume": "...", "pret_total": "123" }`;
                const aiHotel = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: hotelPrompt }] });
                const jsonMatch = aiHotel.choices[0].message.content?.match(/\{[\s\S]*\}/);
                const hotelData = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
                hotelNume = hotelData.nume || hotelNume;
                pretHotelNum = extractPrice(hotelData.pret_total.toString());
            } catch(e) {}
        }

        const totalVacanta = Math.floor(pretZbor + pretHotelNum);

        // --- 5. TIKTOK CONTENT ---
        const oferta = {
            origine: codPlecare,
            destinatie: targetNume,
            aeroport_sosire: targetIATA,
            data: dataPlecare,
            data_intors: dataIntoarcere || null,
            pret: pretZbor,
            moneda: moneda,
            nr_nopti: nrNopti || 0,
            pret_hotel_num: pretHotelNum,
            total_vacanta: totalVacanta,
        };

        const scriptPrompt = `TikTok Script. Vacanță ${oferta.destinatie} la ${oferta.total_vacanta} ${moneda}. JSON: { "hook_vizual": "...", "descriere": "...", "sunet": "...", "script_audio": "..." }`;
        const aiContent = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: scriptPrompt }] });

        let contentJson = {
            hook_vizual: `DESTINAȚIE: ${oferta.destinatie.toUpperCase()}`,
            descriere: `Pachet complet la doar ${oferta.total_vacanta} ${moneda}!`,
            sunet: "Vibe de vacanță",
            script_audio: `Iată o super ofertă pentru ${oferta.destinatie}!`,
            hotel_nume: hotelNume
        };

        try {
            const jsonMatch = aiContent.choices[0].message.content?.match(/\{[\s\S]*\}/);
            if (jsonMatch) contentJson = { ...contentJson, ...JSON.parse(jsonMatch[0]) };
        } catch (e) {}

        console.log("✅ Succes! Trimit oferta.");
        return NextResponse.json({ status: 'success', oferta, content: contentJson }, { headers: getCorsHeaders() });

    } catch (error: any) {
        console.error("🔥 EROARE SERVER:", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500, headers: getCorsHeaders() });
    }
}