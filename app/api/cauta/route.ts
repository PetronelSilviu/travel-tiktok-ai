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

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

function extractIATA(text: string | null): string {
    if (!text) return 'OTP';
    const match = text.match(/\b[A-Z]{3}\b/);
    return match ? match[0] : 'OTP';
}

function addDays(dateStr: string, days: number): string {
    const result = new Date(dateStr);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
}

async function getIataCode(oras: string): Promise<string> {
    const numeCurat = oras.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const quickMap: { [key: string]: string } = {
        'bucuresti': 'OTP', 'iasi': 'IAS', 'cluj': 'CLJ', 'timisoara': 'TSR', 'londra': 'LON', 'paris': 'PAR'
    };
    if (quickMap[numeCurat]) return quickMap[numeCurat];

    try {
        const res = await perplexity.chat.completions.create({
            model: 'sonar',
            messages: [{ role: 'system', content: 'Return ONLY the 3-letter IATA code.' }, { role: 'user', content: `IATA for ${oras}` }]
        });
        return extractIATA(res.choices[0].message.content);
    } catch (e) { return 'OTP'; }
}

export async function OPTIONS() { return NextResponse.json({}, { headers: getCorsHeaders() }); }

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("📥 Date primite:", JSON.stringify(body));

        const { tipCautare, origine, destinatie, vibe, dataInput, tipData, nrNopti, monedaPreferred } = body;
        const moneda = monedaPreferred || 'EUR';

        const iataPlecare = await getIataCode(origine);
        let iataSosire = '';
        let numeDest = '';

        if (tipCautare === 'exact' && destinatie) {
            iataSosire = await getIataCode(destinatie);
            numeDest = destinatie;
        } else {
            const strategyPrompt = `Pick a destination for vibe "${vibe}". Departure ${iataPlecare}. Return JSON: { "oras": "Name", "iata": "COD" }`;
            const aiRes = await perplexity.chat.completions.create({ model: 'sonar', messages: [{ role: 'user', content: strategyPrompt }] });
            const choice = JSON.parse(aiRes.choices[0].message.content?.match(/\{[\s\S]*\}/)?.[0] || "{}");
            iataSosire = extractIATA(choice.iata);
            numeDest = choice.oras;
        }

        const dataPlecare = tipData === 'luna' ? `${dataInput}-15` : dataInput;
        const params: any = {
            originLocationCode: iataPlecare,
            destinationLocationCode: iataSosire,
            departureDate: dataPlecare,
            adults: 1, max: 3, currencyCode: moneda
        };
        if (nrNopti > 0) params.returnDate = addDays(dataPlecare, Number(nrNopti));

        const flightResp = await amadeus.shopping.flightOffersSearch.get(params);
        if (!flightResp.data || flightResp.data.length === 0) {
            return NextResponse.json({ status: 'no_data', message: "Nu am găsit zboruri." }, { headers: getCorsHeaders() });
        }

        return NextResponse.json({
            status: 'success',
            oferta: {
                origine: origine.toUpperCase(), destinatie: numeDest, pret: flightResp.data[0].price.total, moneda
            },
            content: { hook_vizual: `BINE AI VENIT ÎN ${numeDest.toUpperCase()}!` }
        }, { headers: getCorsHeaders() });

    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500, headers: getCorsHeaders() });
    }
}