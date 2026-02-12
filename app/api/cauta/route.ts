import { NextResponse } from 'next/server';
import Amadeus from 'amadeus';
import OpenAI from 'openai';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_API_KEY,
    clientSecret: process.env.AMADEUS_API_SECRET,
});

const perplexity = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
});

async function getIataCode(oras: string): Promise<string> {
    const raw = oras.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (raw.length === 3) return raw;

    try {
        const res = await perplexity.chat.completions.create({
            model: 'sonar',
            messages: [{ role: 'system', content: 'Return ONLY the 3-letter IATA code.' }, { role: 'user', content: `IATA for ${oras}` }]
        });
        const code = res.choices[0].message.content?.match(/[A-Z]{3}/)?.[0];
        return code || 'OTP';
    } catch { return 'OTP'; }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { origine, dataInput, tipData, nrNopti, vibe, tipCautare, monedaPreferred } = body;

        const iataPlecare = await getIataCode(origine);
        const dataPlecare = tipData === 'luna' ? `${dataInput}-15` : dataInput;

        const flightResp = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: iataPlecare,
            destinationLocationCode: 'TIA', // Hardcoded de test sa vedem daca merge
            departureDate: dataPlecare,
            adults: 1,
            currencyCode: monedaPreferred || 'EUR'
        });

        return NextResponse.json({
            status: 'success',
            oferta: { pret: flightResp.data[0]?.price.total || 0 }
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error("Server Error:", error.message);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 200, headers: corsHeaders });
    }
}