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
    console.error('[API] Failed to read static asteroids.json:', err);
    return [];
  }
}

export async function GET() {
  const pool = getDbPool();
  const staticAsteroids = getStaticAsteroids();

  // 1. Fetch latest prices and active scenarios
  let prices = [
    { mineral: 'platinum', priceUSD: 31240.0, urgency: 0.65 },
    { mineral: 'cobalt', priceUSD: 33800.0, urgency: 0.82 },
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

  // 2. Score and Rank Asteroids (Ported from Go)
  const scored = staticAsteroids.map((ast: any) => {
    // Map composition keys to match backend expected keys
    const composition = ast.composition || {};
    const mappedComp: Record<string, number> = {
      iron: composition.iron || 0,
      nickel: composition.nickel || 0,
      cobalt: composition.cobalt || composition.clayMinerals || 0, // Fallback clay as cobalt proxy for raw values
      platinum: composition.platinum_group || 0,
      rare_earths: composition.rare_earths || 0,
      water_ice: composition.water || composition.waterIce || 0
    };

    // Calculate urgency score
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

    // Accessibility score
    const deltaV = ast.orbital.delta_v_km_s || (ast.orbital.moid_au ? ast.orbital.moid_au * 10 : 6.0);
    const accessibilityScore = 1.0 / (1.0 + deltaV / 10.0);

    // Value score
    const valueUSD = ast.valueUSD || 100000;
    const valueScore = Math.log10(valueUSD) / 20.0;

    // Combined score
    const score = (urgencyScore * 0.5) + (accessibilityScore * 0.3) + (valueScore * 0.2);

    return {
      id: ast.id,
      name: ast.name || ast.full_name || `Asteroid ${ast.id}`,
      specType: ast.spec_type || 'C',
      diameterKm: ast.diameter_km || 0.1,
      massKg: ast.mass_kg || 1e9,
      score: Number(score.toFixed(4)),
      urgencyScore: Number(urgencyScore.toFixed(3)),
      deltaV: Number(deltaV.toFixed(2)),
      roi: Number(((valueUSD - 2.1e9) / 2e7).toFixed(1)), // simple ROI estimate
      estValue: valueUSD,
      topMineral,
      composition: mappedComp,
      orbital: ast.orbital,
      reason: `top=${topMineral}(${topFrac.toFixed(0)}%) urg=${urgencyScore.toFixed(2)} acc=${accessibilityScore.toFixed(2)} val=${valueScore.toFixed(2)}`
    };
  });

  // Sort by score descending
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
    risk: {
      composition_confidence: 0.75,
      data_completeness: 0.8,
    },
    research_summary: `Scored ${s.score} based on high market urgency for ${s.topMineral} and optimal orbital delta-v of ${s.deltaV} km/s.`,
    scenario_impact: 0.0,
  }));

  // 3. Generate standard routes (matching Go backend)
  const generateRouteStops = (focusMineral: string, color: string, label: string) => {
    const candidates = scored
      .filter((s: any) => s.topMineral === focusMineral || s.composition[focusMineral] > 5)
      .slice(0, 3);

    const stops = [
      { order: 0, body: 'Earth', departure: '2028-04-12', delta_v_to_next: 3.2 }
    ];

    let order = 1;
    let totalVal = 0;
    for (const c of candidates) {
      stops.push({
        order,
        asteroid_id: c.id,
        name: c.name,
        mineral_target: focusMineral,
        extractable_value: c.estValue * 0.15, // 15% extraction rate
        stay_duration_days: 120,
        delta_v_to_next: 1.8
      } as any);
      totalVal += c.estValue * 0.15;
      order++;
    }

    stops.push({ order, body: 'Earth', arrival: '2032-11-20' } as any);

    const totalCost = 1.8e9 + candidates.length * 4e8;
    return {
      id: `${focusMineral}_priority`,
      label,
      color,
      urgency_score: urgencyMap[focusMineral] || 0.5,
      urgency_reason: `High demand for ${focusMineral} detected in market feeds.`,
      mineral_focus: [focusMineral],
      stops,
      totals: {
        value: totalVal,
        cost: totalCost,
        net: totalVal - totalCost,
        duration_years: 4.6,
        roi_percent: Number(((totalVal - totalCost) / totalCost * 100).toFixed(1)),
        total_delta_v: 7.2 + candidates.length * 1.5,
        minerals_covered: [focusMineral, 'iron', 'nickel']
      },
      reasoning: `Highly optimized route targetting ${focusMineral} scarcity in current industrial cycles.`
    };
  };

  const routes = [
    generateRouteStops('cobalt', '#3b82f6', 'Cobalt Route'),
    generateRouteStops('platinum', '#94a3b8', 'Platinum Route'),
    generateRouteStops('rare_earths', '#f59e0b', 'Rare Earth Route'),
    generateRouteStops('water_ice', '#14b8a6', 'Propellant (Water) Route'),
  ];

  // Add a Mixed/Best ROI Route
  const bestROIStops = [
    { order: 0, body: 'Earth', departure: '2028-09-15', delta_v_to_next: 3.5 }
  ];
  let roiVal = 0;
  for (let i = 0; i < 3; i++) {
    const c = scored[i];
    bestROIStops.push({
      order: i + 1,
      asteroid_id: c.id,
      name: c.name,
      mineral_target: c.topMineral,
      extractable_value: c.estValue * 0.20,
      stay_duration_days: 150,
      delta_v_to_next: 1.5
    } as any);
    roiVal += c.estValue * 0.20;
  }
  bestROIStops.push({ order: 4, body: 'Earth', arrival: '2033-02-18' } as any);
  const roiCost = 2.5e9;

  routes.push({
    id: 'best_roi',
    label: 'Best ROI Mixed Route',
    color: '#a855f7',
    urgency_score: 0.95,
    urgency_reason: 'Highest overall yield potential across balanced critical mineral vectors.',
    mineral_focus: ['platinum', 'cobalt', 'rare_earths'],
    stops: bestROIStops,
    totals: {
      value: roiVal,
      cost: roiCost,
      net: roiVal - roiCost,
      duration_years: 4.4,
      roi_percent: Number(((roiVal - roiCost) / roiCost * 100).toFixed(1)),
      total_delta_v: 8.5,
      minerals_covered: ['platinum', 'cobalt', 'rare_earths', 'iron']
    },
    reasoning: 'Strategic high-yield route sweeping top market-valued assets in a single launch loop.'
  });

  const responsePayload = {
    rankings,
    routes,
    urgencyMap
  };

  // Cache in NeonDB if possible
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO strategic_rankings (rankings, routes, urgency_map)
         VALUES ($1, $2, $3)`,
        [JSON.stringify(rankings), JSON.stringify(routes), JSON.stringify(urgencyMap)]
      );
    } catch (err) {
      console.error('[API] Failed to cache rankings in NeonDB:', err);
    }
  }

  return NextResponse.json(responsePayload);
}
