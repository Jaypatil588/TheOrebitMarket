import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import fs from 'fs';
import path from 'path';

function getStaticAsteroids() {
  try {
    const filePath = path.join(process.cwd(), 'public/data/asteroids.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

const staticAsteroids = getStaticAsteroids();

import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const isLocalDev = process.env.NODE_ENV === 'development';
  const apiKey = req.headers.get('x-gemini-api-key') || (isLocalDev ? process.env.GEMINI_API_KEY : null);

  const pool = getDbPool();

  // 1. Fetch Latest Prices and Scenarios
  let prices = [
    { mineral: 'cobalt', priceUSD: 33800.0, urgency: 0.82 },
    { mineral: 'platinum', priceUSD: 31240.0, urgency: 0.78 },
    { mineral: 'palladium', priceUSD: 42180.0, urgency: 0.74 },
    { mineral: 'neodymium', priceUSD: 210.0, urgency: 0.72 },
    { mineral: 'dysprosium', priceUSD: 480.0, urgency: 0.68 },
    { mineral: 'rhodium', priceUSD: 145200.0, urgency: 0.68 },
    { mineral: 'nickel', priceUSD: 16400.0, urgency: 0.55 },
    { mineral: 'rare_earths', priceUSD: 85000.0, urgency: 0.72 },
    { mineral: 'water_ice', priceUSD: 500.0, urgency: 0.40 }
  ];
  let scenarios: any[] = [];

  if (pool) {
    try {
      const priceRes = await pool.query('SELECT DISTINCT ON (mineral) * FROM market_prices ORDER BY mineral, fetched_at DESC');
      if (priceRes.rows.length > 0) {
        prices = priceRes.rows.map((row) => ({
          mineral: row.mineral,
          priceUSD: Number(row.price_usd),
          urgency: Number(row.urgency),
        }));
      }
      const scenarioRes = await pool.query('SELECT * FROM market_scenarios WHERE active = true');
      scenarios = scenarioRes.rows.map((row) => ({
        id: row.id,
        description: row.description,
        affectedMinerals: row.affected_minerals || [],
        severity: Number(row.severity),
      }));
    } catch (err) {
      console.error('[API] Error loading dependencies for rankings:', err);
    }
  }

  // Build price and urgency maps
  const priceMap: Record<string, number> = {};
  const urgencyMap: Record<string, number> = {};
  for (const p of prices) {
    priceMap[p.mineral] = p.priceUSD;
    urgencyMap[p.mineral] = p.urgency;
  }

  // Adjust urgency based on active scenarios
  for (const sc of scenarios) {
    for (const mineral of sc.affectedMinerals) {
      if (urgencyMap[mineral] !== undefined) {
        urgencyMap[mineral] = Math.min(1.0, urgencyMap[mineral] + sc.severity * 0.5);
      }
    }
  }

  // 2. Score and Rank Asteroids deterministically
  const scored = staticAsteroids.map((ast: any) => {
    const composition = ast.composition || {};
    const mappedComp: Record<string, number> = {
      iron: composition.iron || 0,
      nickel: composition.nickel || 0,
      cobalt: composition.cobalt || composition.clayMinerals || 0,
      platinum: composition.platinum_group || 0,
      rare_earths: composition.rare_earths || 0,
      water_ice: composition.water || composition.waterIce || 0
    };

    let urgencyScore = 0;
    let topMineral = 'iron';
    let topFrac = 0;

    for (const [mineral, fraction] of Object.entries(mappedComp)) {
      if (fraction > topFrac) {
        topFrac = fraction;
        topMineral = mineral;
      }
      const u = urgencyMap[mineral] || 0;
      urgencyScore += (fraction / 100.0) * u;
    }

    const deltaV = ast.orbital.delta_v_km_s || (ast.orbital.moid_au ? ast.orbital.moid_au * 10 : 6.0);
    const accessibilityScore = 1.0 / (1.0 + deltaV / 10.0);
    const valueUSD = ast.valueUSD || 100000;
    const valueScore = Math.log10(valueUSD) / 20.0;
    const score = (urgencyScore * 0.5) + (accessibilityScore * 0.3) + (valueScore * 0.2);

    return {
      id: ast.id,
      name: ast.name || ast.full_name || `Asteroid \${ast.id}`,
      specType: ast.spec_type || 'C',
      diameterKm: ast.diameter_km || 0.1,
      massKg: ast.massKg || 1e9,
      score: Number(score.toFixed(4)),
      urgencyScore: Number(urgencyScore.toFixed(3)),
      deltaV: Number(deltaV.toFixed(2)),
      roi: Number(((valueUSD - 2.1e9) / 2e7).toFixed(1)),
      estValue: valueUSD,
      topMineral,
      composition: mappedComp,
      orbital: ast.orbital,
    };
  });

  scored.sort((a: any, b: any) => b.score - a.score);

  const rankings = scored.slice(0, 30).map((s: any, index: any) => ({
    rank: index + 1,
    id: s.id,
    name: s.name,
    specType: s.specType,
    diameterKm: s.diameterKm,
    massKg: s.massKg,
    composition: s.composition,
    valuation: {
      raw_value_usd: s.estValue,
      mission_cost_usd: 2.1e9,
      net_value_usd: s.estValue - 2.1e9,
      roi: s.roi,
      top_mineral: s.topMineral,
    },
    orbital: s.orbital,
    risk: { composition_confidence: 0.75, data_completeness: 0.8 },
    research_summary: `Scored \${s.score} based on high market urgency for \${s.topMineral} and optimal orbital delta-v of \${s.deltaV} km/s.`,
    scenario_impact: 0.0,
  }));

  const generateRouteStops = (focusMineral: string, color: string, label: string) => {
    const candidates = scored.filter((s: any) => s.topMineral === focusMineral || s.composition[focusMineral] > 5).slice(0, 3);
    const stops = [{ order: 0, body: 'Earth', departure: '2028-04-12', delta_v_to_next: 3.2 }];
    let order = 1;
    let totalVal = 0;
    for (const c of candidates) {
      stops.push({ order, asteroid_id: c.id, name: c.name, mineral_target: focusMineral, extractable_value: c.estValue * 0.15, stay_duration_days: 120, delta_v_to_next: 1.8 } as any);
      totalVal += c.estValue * 0.15;
      order++;
    }
    stops.push({ order, body: 'Earth', arrival: '2032-11-20' } as any);
    const totalCost = 1.8e9 + candidates.length * 4e8;
    return {
      id: `\${focusMineral}_priority`, label, color, urgency_score: urgencyMap[focusMineral] || 0.5, urgency_reason: `High demand for \${focusMineral} detected in market feeds.`, mineral_focus: [focusMineral], stops,
      totals: { value: totalVal, cost: totalCost, net: totalVal - totalCost, duration_years: 4.6, roi_percent: Number(((totalVal - totalCost) / totalCost * 100).toFixed(1)), total_delta_v: 7.2 + candidates.length * 1.5, minerals_covered: [focusMineral, 'iron', 'nickel'] },
      reasoning: `Highly optimized route targetting \${focusMineral} scarcity in current industrial cycles.`
    };
  };

  const routes = [
    generateRouteStops('cobalt', '#3b82f6', 'Cobalt Route'),
    generateRouteStops('platinum', '#94a3b8', 'Platinum Route'),
  ];

  let agent_logs: string[] = [];

  // 3. Ask Gemini to generate the logs detailing the strategy rationale
  if (apiKey) {
    try {
      console.log('[API] /rankings: Querying Gemini for strategic ranking logs...');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

      const top3 = rankings.slice(0, 3).map((r: any) => ({ name: r.name, rank: r.rank, top_mineral: r.valuation.top_mineral, score: r.score }));

      const systemInstruction = `
You are the "Strategic Ranker Agent" (Agent 3) for The Orebit Market.
Your job is to generate internal agent reasoning logs that explain why the top 3 asteroids were just ranked the highest.

Current top 3 targets:
\${JSON.stringify(top3)}

Output a strict JSON object:
{
  "agent_logs": [
    "string"
  ]
}

Provide 3-5 strings that look like terminal outputs of your AI thought process.
Example:
"[AGENT3] Recomputing multi-objective Pareto optimal routes..."
"[AGENT3] 16 Psyche retains Rank #1 due to extreme Cobalt urgency."
"[AGENT3] SHIFT: 3554 Amun moved up to Rank #3 on Platinum demand spike."
"[AGENT3] Broadcast sent to frontend | 30 rankings updated."
`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: "Generate the ranking analysis logs." }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
        generationConfig: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(result.response.text());
      agent_logs = parsed.agent_logs || [];
    } catch (e) {
      console.warn('[API] /rankings: Gemini failed to generate logs. Falling back.', e);
      agent_logs = ["[AGENT3] ⚠ AI offline. Strategic ranker updated deterministically."];
    }
  } else {
    // Demo mode logs
    agent_logs = [
      "[AGENT3] No API Key — Running offline deterministic scoring...",
      `[AGENT3] \${rankings[0].name} ranked #1 (Score: \${rankings[0].research_summary.split(' ')[1]})`,
      "[AGENT3] Ranking matrices broadcasted successfully."
    ];
  }

  const responsePayload = {
    rankings,
    routes,
    urgencyMap,
    agent_logs
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO strategic_rankings (rankings, routes, urgency_map) VALUES ($1, $2, $3)`,
        [JSON.stringify(rankings), JSON.stringify(routes), JSON.stringify(urgencyMap)]
      );
    } catch (err) {}
  }

  return NextResponse.json(responsePayload);
}
