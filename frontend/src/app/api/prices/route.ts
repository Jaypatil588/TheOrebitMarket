import { NextResponse } from 'next/server';
import { getDbPool, memStore } from '@/lib/db';

export async function GET() {
  const pool = getDbPool();

  // Helper to dynamically fluctuate prices slightly to keep the live ticker animated
  const fluctuatePrices = (prices: any[]) => {
    return prices.map((p) => {
      const change = (Math.random() - 0.5) * 0.02; // max +-1% change
      const newPrice = Math.max(1, p.price_usd * (1 + change));
      const changePct = Number(((newPrice - p.price_usd) / p.price_usd * 100).toFixed(2));
      return {
        ...p,
        price_usd: Number(newPrice.toFixed(2)),
        change_pct: changePct,
        trend: changePct >= 0 ? 'up' : 'down'
      };
    });
  };

  if (!pool) {
    memStore.prices = fluctuatePrices(memStore.prices);
    const mapped = memStore.prices.map((p) => ({
      mineral: p.mineral,
      priceUSD: p.price_usd,
      trend: p.trend,
      urgency: p.urgency,
      changePct: p.change_pct,
      disruption: p.disruption,
      sourceUrl: p.source_url,
      category: p.category,
      criticality: p.criticality,
    }));
    return NextResponse.json({ prices: mapped });
  }

  try {
    // Check if table is seeded
    const countRes = await pool.query('SELECT count(*) FROM market_prices');
    const count = Number(countRes.rows[0].count);

    if (count === 0) {
      // Seed initial prices
      for (const p of memStore.prices) {
        await pool.query(
          `INSERT INTO market_prices (mineral, price_usd, trend, urgency, change_pct, disruption, source_url, category, criticality)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [p.mineral, p.price_usd, p.trend, p.urgency, p.change_pct, p.disruption, p.source_url, p.category, p.criticality]
        );
      }
    }

    // Slightly fluctuate prices in NeonDB sometimes to simulate background Go agents
    if (Math.random() > 0.3) {
      const allPrices = await pool.query('SELECT DISTINCT ON (mineral) * FROM market_prices ORDER BY mineral, fetched_at DESC');
      const fluctuated = fluctuatePrices(allPrices.rows);
      for (const p of fluctuated) {
        await pool.query(
          `INSERT INTO market_prices (mineral, price_usd, trend, urgency, change_pct, disruption, source_url, category, criticality, fetched_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [p.mineral, p.price_usd, p.trend, p.urgency, p.change_pct, p.disruption, p.source_url, p.category, p.criticality]
        );
      }
    }

    // Retrieve latest distinct prices per mineral
    const result = await pool.query(`
      SELECT DISTINCT ON (mineral) * 
      FROM market_prices 
      ORDER BY mineral, fetched_at DESC
    `);

    const prices = result.rows.map((row) => ({
      mineral: row.mineral,
      priceUSD: Number(row.price_usd),
      trend: row.trend,
      urgency: Number(row.urgency),
      changePct: Number(row.change_pct),
      disruption: row.disruption,
      sourceUrl: row.source_url,
      category: row.category,
      criticality: Number(row.criticality),
    }));

    return NextResponse.json({ prices });
  } catch (err) {
    console.error('[API] GET /prices error:', err);
    return NextResponse.json({ prices: memStore.prices });
  }
}
