import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool | null {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[DB] DATABASE_URL not set — using in-memory/JSON store fallback');
    return null;
  }

  try {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech') 
        ? { rejectUnauthorized: false } 
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client', err);
    });

    return pool;
  } catch (err) {
    console.error('[DB] Failed to initialize pg Pool:', err);
    return null;
  }
}

// In-memory fallback stores (matching Go backend fallback)
export const memStore = {
  prices: [
    { mineral: 'cobalt', price_usd: 33800.0, urgency: 0.82, trend: 'up', change_pct: 3.5, disruption: 'DRC mine flooding — 40% supply disruption', source_url: '', category: 'Battery Metals', criticality: 5 },
    { mineral: 'platinum', price_usd: 31240.0, urgency: 0.78, trend: 'up', change_pct: 2.1, disruption: 'Autocatalyst demand surge — Euro 7 standards', source_url: '', category: 'Platinum Group', criticality: 4 },
    { mineral: 'palladium', price_usd: 42180.0, urgency: 0.74, trend: 'up', change_pct: 1.8, disruption: 'PGM stockpile drawdown below critical threshold', source_url: '', category: 'Platinum Group', criticality: 4 },
    { mineral: 'neodymium', price_usd: 210.0, urgency: 0.72, trend: 'up', change_pct: 5.2, disruption: 'Export controls tightening — allocation reduced 15%', source_url: '', category: 'Rare Earths', criticality: 5 },
    { mineral: 'dysprosium', price_usd: 480.0, urgency: 0.68, trend: 'up', change_pct: 8.1, disruption: 'Defense stockpile below 6-month threshold', source_url: '', category: 'Rare Earths', criticality: 5 },
    { mineral: 'rhodium', price_usd: 145200.0, urgency: 0.68, trend: 'up', change_pct: 4.3, disruption: 'None', source_url: '', category: 'Platinum Group', criticality: 4 },
    { mineral: 'nickel', price_usd: 16400.0, urgency: 0.55, trend: 'down', change_pct: -0.4, disruption: 'None', source_url: '', category: 'Battery Metals', criticality: 3 },
    { mineral: 'lithium', price_usd: 24500.0, urgency: 0.52, trend: 'up', change_pct: 1.1, disruption: 'None', source_url: '', category: 'Battery Metals', criticality: 4 },
    { mineral: 'iridium', price_usd: 156000.0, urgency: 0.48, trend: 'stable', change_pct: 0.3, disruption: 'None', source_url: '', category: 'Platinum Group', criticality: 3 },
    { mineral: 'rare_earths', price_usd: 85000.0, urgency: 0.72, trend: 'up', change_pct: 1.2, disruption: 'Export controls', source_url: '', category: 'Rare Earths', criticality: 5 },
    { mineral: 'water_ice', price_usd: 500.0, urgency: 0.40, trend: 'stable', change_pct: 0.0, disruption: 'None', source_url: '', category: 'Propellants', criticality: 2 },
    { mineral: 'silicon', price_usd: 2800.0, urgency: 0.32, trend: 'down', change_pct: -0.8, disruption: 'None', source_url: '', category: 'Industrial', criticality: 2 },
  ],
  scenarios: [] as any[],
  rankings: [] as any[],
  routes: [] as any[],
  reports: new Map<string, any>(),
  valuations: new Map<string, any>()
};
