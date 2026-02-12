import { NextResponse } from 'next/server';
import Amadeus from 'amadeus';
import OpenAI from 'openai';

// --- CONFIGURARE API ---
const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_API_KEY,
    clientSecret: process.env.AMADEUS_API_SECRET,
});

const perplexity = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
});

// --- FUNCTII AJUTATOARE ---

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

// Extrage strict 3 litere mari dintr-un text (ex: "Codul este OTP" -> "OTP")
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

// Conversie nume oras -> Cod IATA (Ex: Bucuresti -> OTP)
async function getIataCode(oras: string): Promise<string> {
    const numeCurat = oras.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Dicționar rapid pentru cele mai căutate orașe
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
                { role: 'system', content: 'You are an IATA expert. Return ONLY the 3-letter airport code. No explanation.' },
                { role: 'user', content: `What is the IATA code for ${oras}?` }
            ]
        });
        return extractIATA(response.choices[0].message.content);
    } catch (e) {
        console.error("AI IATA Error:", e);
        return 'OTP'; // Fallback
    }
}

// --- HANDLERS ---

export async function OPTIONS() {
    return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("📥 DATE PRIMITE DE LA TELEFON:", JSON.stringify(body));

        const { tipCautare, origine, destinatie, vibe, buget, dataInput, tipData, nrNopti, monedaPreferred } = body;
        const moneda = monedaPreferred || 'EUR';

        if (!origine || !dataInput) {
            return NextResponse.json({ status: 'no_data', message: "Alege orașul de plecare și data." }, { headers: getCorsHeaders() });
        }

        // --- 1. CONVERSIE IATA (SIGURANȚĂ MAXIMĂ) ---
        const iataPlecare = await getIataCode(origine);
        console.log(`✅ CONVERSIE REUȘITĂ: ${origine} -> ${iataPlecare}`);

        let iataSosire = '';
        let numeDestinatie = '';
        let motivatieAI = '';

        // --- 2. STABILIRE DESTINAȚIE ---
        if (tipCautare === 'exact' && destinatie) {
            iataSosire = await getIataCode(destinatie);
            numeDestinatie = destinatie;
        } else {
            let context = tipCautare === 'global' ? `anywhere in the world with vibe "${vibe}"` : `in Europe with vibe "${vibe}"`;
            const strategyPrompt = `Pick ONE travel destination for ${context}. Departure ${iataPlecare}, Date ${dataInput}. Return JSON: { "oras": "Name", "iata": "3-LETTER-CODE", "motiv": "Short reason" }`;

            const aiStrategy = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: strategyPrompt }] });

            try {
                const jsonMatch = aiStrategy.choices[0].message.content?.match(/\{[\s\S]*\}/);
                const choice = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
                iataSosire = extractIATA(choice.iata);
                numeDestinatie = choice.oras;
                motivatieAI = choice.motiv;
            } catch(e) {
                iataSosire = 'NAP'; numeDestinatie = 'Napoli';
            }
        }
        console.log(`🎯 Destinație: ${numeDestinatie} (${iataSosire})`);

        // --- 3. PROCESARE DATE ZBOR ---
        const dataPlecare = tipData === 'luna' ? `${dataInput}-15` : dataInput;
        let dataIntoarcere = '';
        if (nrNopti && parseInt(nrNopti) > 0) {
            dataIntoarcere = addDays(dataPlecare, parseInt(nrNopti));
        }

        // --- 4. CĂUTARE AMADEUS ---
        let zbor = null;
        const searchParams: any = {
            originLocationCode: iataPlecare, // FOLOSIM CODUL DE 3 LITERE
            destinationLocationCode: iataSosire,
            departureDate: dataPlecare,
            adults: 1,
            max: 3,
            currencyCode: moneda
        };
        if (dataIntoarcere) searchParams.returnDate = dataIntoarcere;

        console.log(`✈️ Cerere Amadeus: ${searchParams.originLocationCode} -> ${searchParams.destinationLocationCode}`);

        try {
            const flightResp = await amadeus.shopping.flightOffersSearch.get(searchParams);
            if (flightResp.data && flightResp.data.length > 0) {
                zbor = flightResp.data[0];
            }
        } catch (err: any) {
            console.error("❌ EROARE AMADEUS:", err.response?.body || err.message);
        }

        if (!zbor) {
            return NextResponse.json({
                status: 'no_data',
                message: `Nu am găsit zboruri din ${iataPlecare} spre ${numeDestinatie}.`
            }, { headers: getCorsHeaders() });
        }

        const pretZbor = parseFloat(zbor.price.total);

        // --- 5. HOTEL (OPȚIONAL) ---
        let pretHotelNum = 0;
        let hotelNume = "Hotel mediu";
        if (dataIntoarcere && nrNopti) {
            try {
                const hotelPrompt = `Cost for 3* hotel in ${numeDestinatie} for ${nrNopti} nights in ${moneda}. JSON: { "nume": "Hotel Name", "pret_total": "150" }`;
                const aiHotel = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: hotelPrompt }] });
                const jsonMatch = aiHotel.choices[0].message.content?.match(/\{[\s\S]*\}/);
                const hData = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
                hotelNume = hData.nume || hotelNume;
                pretHotelNum = extractPrice(hData.pret_total.toString());
            } catch(e) {}
        }

        const totalVacanta = Math.floor(pretZbor + pretHotelNum);

        // --- 6. GENERARE CONȚINUT TIKTOK ---
        const scriptPrompt = `TikTok Script trip to ${numeDestinatie}. Total: ${totalVacanta} ${moneda}. JSON: { "hook_vizual": "...", "descriere": "...", "sunet": "...", "script_audio": "..." }`;
        const aiContent = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: scriptPrompt }] });

        let contentJson = {
            hook_vizual: `VACANȚĂ ${numeDestinatie.toUpperCase()}`,
            descriere: `Pachet complet la doar ${totalVacanta} ${moneda}!`,
            sunet: "Trending Travel Sound",
            script_audio: `Nu rata oferta asta pentru ${numeDestinatie}!`,
            hotel_nume: hotelNume
        };

        try {
            const jsonMatch = aiContent.choices[0].message.content?.match(/\{[\s\S]*\}/);
            if (jsonMatch) contentJson = { ...contentJson, ...JSON.parse(jsonMatch[0]) };
        } catch (e) {}

        console.log("✅ Succes final!");
        return NextResponse.json({
            status: 'success',
            oferta: {
                origine: origine.toUpperCase(),
                aeroport_plecare: iataPlecare,
                destinatie: numeDestinatie,
                aeroport_sosire: iataSosire,
                data: dataPlecare,
                data_intors: dataIntoarcere || null,
                pret: pretZbor,
                moneda: moneda,
                nr_nopti: nrNopti || 0,
                pret_hotel_num: pretHotelNum,
                total_vacanta: totalVacanta
            },
            content: contentJson
        }, { headers: getCorsHeaders() });

    } catch (error: any) {
        console.error("🔥 EROARE CRITICĂ SERVER:", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500, headers: getCorsHeaders() });
    }
}