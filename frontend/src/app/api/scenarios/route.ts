import { NextResponse } from 'next/server';
import { getDbPool, memStore } from '@/lib/db';

export async function GET() {
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ scenarios: memStore.scenarios });
  }

  try {
    const result = await pool.query('SELECT * FROM market_scenarios WHERE active = true');
    const scenarios = result.rows.map((row) => ({
      id: row.id,
      description: row.description,
      affectedMinerals: row.affected_minerals || [],
      severity: Number(row.severity),
      active: row.active,
      createdAt: row.created_at,
    }));
    return NextResponse.json({ scenarios });
  } catch (err) {
    console.error('[API] GET /scenarios error:', err);
    return NextResponse.json({ scenarios: memStore.scenarios });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, description, affectedMinerals, severity } = body;

    const pool = getDbPool();
    if (!pool) {
      const scenario = {
        id,
        description,
        affectedMinerals,
        severity: Number(severity),
        active: true,
        createdAt: new Date().toISOString(),
      };
      memStore.scenarios = [scenario, ...memStore.scenarios.filter((s) => s.id !== id)];
      return NextResponse.json({ status: 'ok', scenario });
    }

    await pool.query(
      `INSERT INTO market_scenarios (id, description, affected_minerals, severity, active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO UPDATE 
       SET description = EXCLUDED.description, 
           affected_minerals = EXCLUDED.affected_minerals, 
           severity = EXCLUDED.severity, 
           active = true`,
      [id, description, affectedMinerals, severity]
    );

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('[API] POST /scenarios error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop() || '';

    const pool = getDbPool();
    if (!pool) {
      memStore.scenarios = memStore.scenarios.filter((s) => s.id !== id);
      return NextResponse.json({ status: 'ok' });
    }

    await pool.query('UPDATE market_scenarios SET active = false WHERE id = $1', [id]);
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('[API] DELETE /scenarios error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
