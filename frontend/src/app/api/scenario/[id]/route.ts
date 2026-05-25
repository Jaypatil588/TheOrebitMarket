import { NextResponse } from 'next/server';
import { getDbPool, memStore } from '@/lib/db';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const pool = getDbPool();
    if (!pool) {
      memStore.scenarios = memStore.scenarios.filter((s) => s.id !== id);
      return NextResponse.json({ status: 'ok' });
    }

    await pool.query('UPDATE market_scenarios SET active = false WHERE id = $1', [id]);
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('[API] DELETE /api/scenario/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
