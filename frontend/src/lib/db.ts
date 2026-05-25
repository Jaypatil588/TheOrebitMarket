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
    { mineral: 'platinum', price_usd: 31240.0, urgency: 0.65, trend: 'up', change_pct: 2.1, disruption: 'None', source_url: '', category: 'Platinum Group', criticality: 4 },
    { mineral: 'cobalt', price_usd: 33800.0, urgency: 0.82, trend: 'up', change_pct: 3.5, disruption: 'DRC mine flooding', source_url: '', category: 'Battery Metals', criticality: 5 },
    { mineral: 'nickel', price_usd: 16400.0, urgency: 0.55, trend: 'down', change_pct: -0.4, disruption: 'None', source_url: '', category: 'Battery Metals', criticality: 3 },
    { mineral: 'rare_earths', price_usd: 85000.0, urgency: 0.72, trend: 'up', change_pct: 1.2, disruption: 'Export controls', source_url: '', category: 'Rare Earths', criticality: 5 },
    { mineral: 'water_ice', price_usd: 500.0, urgency: 0.40, trend: 'stable', change_pct: 0.0, disruption: 'None', source_url: '', category: 'Propellants', criticality: 2 }
  ],
  scenarios: [] as any[],
  rankings: [] as any[],
  routes: [] as any[],
  reports: new Map<string, any>(),
  valuations: new Map<string, any>()
};
