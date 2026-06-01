import { NextResponse } from 'next/server';
import { getDbPool, memStore } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mark as dynamic since we want fresh generation every time it's polled
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const isLocalDev = process.env.NODE_ENV === 'development';
  const apiKey = req.headers.get('x-gemini-api-key') || (isLocalDev ? process.env.GEMINI_API_KEY : null);

  const pool = getDbPool();

  if (!apiKey) {
    console.error('[API] /prices: GEMINI_API_KEY not provided');
    return NextResponse.json({ error: 'GEMINI_API_KEY not provided' }, { status: 401 });
  }

  try {
    let basePrices = memStore.prices;
    if (pool) {
      const result = await pool.query(`SELECT DISTINCT ON (mineral) * FROM market_prices ORDER BY mineral, fetched_at DESC`);
      if (result.rows.length > 0) {
        basePrices = result.rows.map(r => ({
          mineral: r.mineral, price_usd: Number(r.price_usd), trend: r.trend, urgency: Number(r.urgency), change_pct: Number(r.change_pct), disruption: r.disruption, source_url: r.source_url, category: r.category, criticality: Number(r.criticality)
        }));
      }
    }

    console.log('[API] /prices: Querying Gemini for live market update...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0.9 }
    });

    const systemInstruction = `
You are the "Market Intelligence Agent" (Agent 2) for The Orebit Market, an advanced deep-space asteroid mining commodity exchange.
Your job is to generate a realistic market update for 12 critical space-mined commodities based on simulated real-world supply chain constraints, defense stockpiles, and geopolitical events.

Current Time/Seed: ${new Date().toISOString()} (Use this to ensure your news and reasoning are entirely unique from previous updates).

Current base prices for reference:
${JSON.stringify(basePrices.map(p => ({ mineral: p.mineral, price: p.price_usd, urgency: p.urgency })))}

Return a strict JSON object exactly matching this schema:
{
  "prices": [
    {
      "mineral": "string (must exactly match one of: cobalt, platinum, palladium, neodymium, dysprosium, rhodium, nickel, lithium, iridium, rare_earths, water_ice, silicon)",
      "price_usd": number (fluctuated slightly from the base price),
      "trend": "string (rising, falling, or stable)",
      "change_pct": number,
      "urgency": number (0.0 to 1.0 representing market demand urgency),
      "disruption": "string (A brief 1-sentence news headline of a supply disruption, or empty string)",
      "source_url": "",
      "category": "string (e.g., Battery Metals, Platinum Group, Rare Earths)",
      "criticality": number (1 to 5)
    }
    // MUST INCLUDE ALL 12 MINERALS
  ],
  "agent_logs": [
    "string",
    "string"
  ]
}

For the "agent_logs" array:
Provide 3-6 strings that look like terminal outputs of your AI thought process as you scrape the web.
Example:
"[AGENT2] Scraping global commodity intelligence feeds..."
"[AGENT2] HTTP GET https://www.lme.com/api/v1/prices/cobalt → 200 OK"
"[AGENT2] Disruption detected: DRC Katanga mine flooding — 40% supply chain halt"
"[AGENT2] SHIFT: cobalt urgency 0.720 -> 0.880 ⚠ CRITICAL"
"[AGENT2] Market data broadcast updated | 12 prices"
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "Generate the next 15-second tick of the live market data feed." }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const responseText = result.response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[API] /prices: Gemini returned invalid JSON.', e);
      return NextResponse.json(
        { error: 'Gemini returned invalid JSON', raw: responseText },
        { status: 502 }
      );
    }

    if (!data.prices || !Array.isArray(data.prices)) {
      throw new Error("Missing prices array in Gemini response");
    }

    const newPrices = data.prices.map((p: any) => ({
      ...p,
      fetched_at: new Date().toISOString()
    }));

    if (pool) {
      await Promise.all(
        newPrices.map((p: any) =>
          pool.query(
            `INSERT INTO market_prices (mineral, price_usd, trend, urgency, change_pct, disruption, source_url, category, criticality, fetched_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [p.mineral, p.price_usd, p.trend, p.urgency, p.change_pct, p.disruption, p.source_url, p.category, p.criticality]
          )
        )
      );
      console.log(`[API] /prices: saved ${newPrices.length} market_prices rows to Neon`);
    } else {
      memStore.prices = newPrices;
    }

    return NextResponse.json({
      prices: newPrices,
      agent_logs: data.agent_logs || []
    });

  } catch (err) {
    console.error('[API] GET /prices error:', err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
