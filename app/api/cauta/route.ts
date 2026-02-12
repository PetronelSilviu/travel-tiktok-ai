import { NextResponse } from 'next/server';
import Amadeus from 'amadeus';
import OpenAI from 'openai';

// --- FUNCTII AJUTATOARE (CORECTATE) ---

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

// Extrage strict 3 litere mari dintr-un text
function extractIATA(text: string | null): string {
    if (!text) return 'OTP';
    const match = text.match(/\b[A-Z]{3}\b/);
    if (match) return match[0];
    const matchAny = text.match(/[A-Za-z]{3}/);
    return matchAny ? matchAny[0].toUpperCase() : 'OTP';
}

function extractPrice(text: string): number {
    if (!text) return 0;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[0]) : 0;
}

function addDays(dateStr: string, days: number): string {
    const result = new Date(dateStr);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
}

// --- CONFIGURARE API ---

const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_API_KEY,
    clientSecret: process.env.AMADEUS_API_SECRET,
});

const perplexity = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
});

// --- LOGICA DE CONVERSIE IATA ---

async function getIataCode(oras: string): Promise<string> {
    const numeCurat = oras.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const quickMap: { [key: string]: string } = {
        'bucuresti': 'OTP', 'iasi': 'IAS', 'cluj': 'CLJ', 'timisoara': 'TSR',
        'suceava': 'SCV', 'sibiu': 'SBZ', 'london': 'LON', 'londra': 'LON',
        'paris': 'PAR', 'roma': 'ROM', 'rome': 'ROM', 'madrid': 'MAD', 'barcelona': 'BCN'
    };

    if (quickMap[numeCurat]) return quickMap[numeCurat];

    try {
        const response = await perplexity.chat.completions.create({
            model: 'sonar',
            messages: [
                { role: 'system', content: 'You are an IATA expert. Return ONLY the 3-letter airport code for the city provided. No explanation, just the code.' },
                { role: 'user', content: `What is the IATA code for ${oras}?` }
            ]
        });
        return extractIATA(response.choices[0].message.content);
    } catch (e) {
        console.error("AI IATA Error:", e);
        return 'OTP';
    }
}

// --- HANDLER PRINCIPAL ---

export async function OPTIONS() {
    return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("📥 Date primite:", JSON.stringify(body));

        const { tipCautare, origine, destinatie, vibe, buget, dataInput, tipData, flexibil, nrNopti, monedaPreferred } = body;
        const moneda = monedaPreferred || 'EUR';

        if (!origine || !dataInput) {
            return NextResponse.json({ status: 'no_data', message: "Alege orașul de plecare și data." }, { headers: getCorsHeaders() });
        }

        // --- 0. CONVERSIE IATA (Dovedit că funcționează) ---
        console.log(`🔍 Procesez originea: ${origine}`);
        let codPlecare = await getIataCode(origine);
        console.log(`✅ Cod plecare final: ${codPlecare}`);

        let targetIATA = '';
        let targetNume = '';
        let dataPlecare = '';
        let dataIntoarcere = '';
        let motivatieAI = '';

        // --- 1. PROCESARE DATA ---
        if (tipData === 'luna') {
            const datePrompt = `Find best cheap date in ${dataInput} for flight from ${codPlecare}. Return ONLY YYYY-MM-DD.`;
            const aiDate = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: datePrompt }] });
            const matchDate = aiDate.choices[0].message.content?.match(/\d{4}-\d{2}-\d{2}/);
            dataPlecare = matchDate ? matchDate[0] : `${dataInput}-15`;
        } else {
            dataPlecare = dataInput;
        }

        if (nrNopti && parseInt(nrNopti) > 0) {
            dataIntoarcere = addDays(dataPlecare, parseInt(nrNopti));
        }

        // --- 2. DESTINATIE ---
        if (tipCautare === 'exact') {
            targetIATA = await getIataCode(destinatie);
            targetNume = destinatie;
        } else {
            let context = tipCautare === 'global' ? `anywhere in the world with vibe "${vibe}"` : `in Europe with vibe "${vibe}"`;
            const strategyPrompt = `Pick ONE travel destination for ${context}. Departure ${codPlecare}, Date ${dataPlecare}. Return JSON: { "oras": "Name", "iata": "3-LETTER-CODE", "motiv": "Short reason" }`;
            const aiStrategy = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: strategyPrompt }] });

            let choice: any = {};
            try {
                const jsonMatch = aiStrategy.choices[0].message.content?.match(/\{[\s\S]*\}/);
                choice = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
            } catch(e) { choice = { iata: 'NAP', oras: 'Napoli' }; }

            targetIATA = extractIATA(choice.iata);
            targetNume = choice.oras;
            motivatieAI = choice.motiv;
        }
        console.log(`🎯 Destinație finală: ${targetNume} (${targetIATA})`);

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
            console.log("✈️ Interoghez Amadeus...");
            const flightResp = await amadeus.shopping.flightOffersSearch.get(searchParams);
            if (flightResp.data && flightResp.data.length > 0) {
                zbor = flightResp.data[0];
            }
        } catch (err: any) {
            console.error("❌ Eroare Amadeus:", err.response?.body || err.message);
        }

        if (!zbor) {
            return NextResponse.json({ status: 'no_data', message: `Nu am găsit zboruri din ${codPlecare} spre ${targetNume} la data de ${dataPlecare}.` }, { headers: getCorsHeaders() });
        }

        const pretZbor = parseFloat(zbor.price.total);

        // --- 4. HOTEL ---
        let pretHotelNum = 0;
        let hotelNume = "Hotel local";
        if (dataIntoarcere && nrNopti) {
            try {
                const hotelPrompt = `Cost for 3* hotel in ${targetNume} for ${nrNopti} nights in ${moneda}. JSON: { "nume": "Hotel Name", "pret_total": "150" }`;
                const aiHotel = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: hotelPrompt }] });
                const jsonMatch = aiHotel.choices[0].message.content?.match(/\{[\s\S]*\}/);
                const hData = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
                hotelNume = hData.nume || hotelNume;
                pretHotelNum = extractPrice(hData.pret_total.toString());
            } catch(e) {}
        }

        // --- 5. TIKTOK CONTENT ---
        const oferta = {
            origine: codPlecare, destinatie: targetNume, aeroport_sosire: targetIATA,
            data: dataPlecare, data_intors: dataIntoarcere || null,
            pret: pretZbor, moneda, nr_nopti: nrNopti || 0,
            pret_hotel_num: pretHotelNum, total_vacanta: Math.floor(pretZbor + pretHotelNum)
        };

        const scriptPrompt = `TikTok Viral Script for trip to ${oferta.destinatie}. Total: ${oferta.total_vacanta} ${moneda}. JSON: { "hook_vizual": "...", "descriere": "...", "sunet": "...", "script_audio": "..." }`;
        const aiContent = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: scriptPrompt }] });

        let contentJson = {
            hook_vizual: `VACANȚĂ ${oferta.destinatie.toUpperCase()}`,
            descriere: `Pachet complet la doar ${oferta.total_vacanta} ${moneda}!`,
            sunet: "Trending Music",
            script_audio: `Iată următoarea ta aventură în ${oferta.destinatie}!`,
            hotel_nume: hotelNume
        };

        try {
            const jsonMatch = aiContent.choices[0].message.content?.match(/\{[\s\S]*\}/);
            if (jsonMatch) contentJson = { ...contentJson, ...JSON.parse(jsonMatch[0]) };
        } catch (e) {}

        console.log("✅ Căutare terminată cu succes!");
        return NextResponse.json({ status: 'success', oferta, content: contentJson }, { headers: getCorsHeaders() });

    } catch (error: any) {
        console.error("🔥 Server Error:", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500, headers: getCorsHeaders() });
    }
}