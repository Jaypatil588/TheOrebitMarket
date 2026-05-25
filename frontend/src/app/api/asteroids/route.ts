import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Load static asteroids JSON
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

  if (!pool) {
    // Return static precomputed valuations
    const mapped = staticAsteroids.map((ast: any) => ({
      id: ast.id,
      name: ast.name || ast.full_name || `Asteroid ${ast.id}`,
      specType: ast.spec_type,
      diameterKm: ast.diameter_km,
      massKg: ast.mass_kg,
      composition: ast.composition,
      orbital: ast.orbital,
      valuation: {
        raw_value_usd: ast.valueUSD,
        mission_cost_usd: 2.1e9,
        net_value_usd: ast.valueUSD - 2.1e9,
        roi: ((ast.valueUSD - 2.1e9) / 2.1e9) * 100,
        top_mineral: Object.keys(ast.composition || {}).reduce((a, b) => (ast.composition[a] > ast.composition[b] ? a : b), 'iron'),
      },
      risk: {
        composition_confidence: 0.5,
        data_completeness: 0.6,
      },
      research_summary: 'Computed deterministically from Next.js server.',
      scenario_impact: 0.0,
    }));
    return NextResponse.json({ asteroids: mapped });
  }

  try {
    // Check if seeded
    const countRes = await pool.query('SELECT count(*) FROM raw_asteroids');
    if (Number(countRes.rows[0].count) === 0) {
      // Seed raw asteroids
      console.log('[API] Seeding raw_asteroids into PostgreSQL');
      for (const ast of staticAsteroids) {
        await pool.query(
          `INSERT INTO raw_asteroids (id, name, spec_type, value_usd, data)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [ast.id, ast.name || ast.full_name, ast.spec_type, ast.valueUSD, JSON.stringify(ast)]
        );
      }
    }

    // Check if we have valuations in asteroid_valuations
    const valRes = await pool.query('SELECT * FROM asteroid_valuations LIMIT 500');
    if (valRes.rows.length > 0) {
      const asteroids = valRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        specType: row.spec_type,
        diameterKm: Number(row.diameter_km),
        massKg: Number(row.mass_kg),
        composition: row.composition,
        valuation: row.valuation,
        orbital: row.orbital,
        risk: row.risk,
        research_summary: row.research_summary,
        scenario_impact: Number(row.scenario_impact),
      }));
      return NextResponse.json({ asteroids });
    }

    // Seed valuations from static mapping
    const mapped = staticAsteroids.slice(0, 100).map((ast: any) => ({
      id: ast.id,
      name: ast.name || ast.full_name || `Asteroid ${ast.id}`,
      specType: ast.spec_type,
      diameterKm: ast.diameter_km,
      massKg: ast.mass_kg,
      composition: ast.composition,
      orbital: ast.orbital,
      valuation: {
        raw_value_usd: ast.valueUSD,
        mission_cost_usd: 2.1e9,
        net_value_usd: ast.valueUSD - 2.1e9,
        roi: ((ast.valueUSD - 2.1e9) / 2.1e9) * 100,
        top_mineral: Object.keys(ast.composition || {}).reduce((a, b) => (ast.composition[a] > ast.composition[b] ? a : b), 'iron'),
      },
      risk: {
        composition_confidence: 0.5,
        data_completeness: 0.6,
      },
      research_summary: 'Computed deterministically from Next.js server.',
      scenario_impact: 0.0,
    }));

    for (const v of mapped) {
      await pool.query(
        `INSERT INTO asteroid_valuations (id, name, spec_type, diameter_km, mass_kg, composition, valuation, orbital, risk, research_summary, scenario_impact)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          v.id,
          v.name,
          v.specType,
          v.diameterKm,
          v.massKg,
          JSON.stringify(v.composition),
          JSON.stringify(v.valuation),
          JSON.stringify(v.orbital),
          JSON.stringify(v.risk),
          v.research_summary,
          v.scenario_impact,
        ]
      );
    }

    return NextResponse.json({ asteroids: mapped });
  } catch (err) {
    console.error('[API] GET /asteroids error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
