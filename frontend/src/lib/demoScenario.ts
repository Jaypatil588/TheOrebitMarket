/**
 * Ephemeral browser-only demo — triggered by exact phrase match in DemoScenarioInput.
 * Never POST /api/scenario; never written to Postgres. Session React state only.
 */
import type { MarketPrice, MissionRoute, RankedAsteroid, Scenario } from "@/types/orebit";
import { DEMO_ROUTE_ID } from "@/lib/mockRoutes";

const ROUTE_YELLOW = "#facc15";

export const DEMO_ROUTE_ASTEROID_IDS = ["20000001", "20000010"] as const;

/** Stable client id — must not be persisted via /api/scenario */
export const DEMO_SCENARIO_ID = "demo-china-ree-block";

/** Exact phrase — paste or type to trigger the offline demo cascade */
export const DEMO_SCENARIO_PHRASE =
  "China just blocked rare earth material export";

export const RARE_EARTH_MINERALS = [
  "neodymium",
  "dysprosium",
  "praseodymium",
  "terbium",
  "yttrium",
  "lanthanum",
  "cerium",
  "samarium",
  "europium",
  "gadolinium",
  "holmium",
] as const;

const DISRUPTION = "China export block — rare earth supply chain halt";

/** Precomputed post-scenario prices (registry baselines × urgency shock) */
const DEMO_REE_PRICES: Record<
  string,
  { price_usd: number; change_pct: number; urgency: number }
> = {
  neodymium: { price_usd: 378, change_pct: 80.0, urgency: 0.98 },
  dysprosium: { price_usd: 912, change_pct: 90.0, urgency: 0.99 },
  praseodymium: { price_usd: 342, change_pct: 80.0, urgency: 0.96 },
  terbium: { price_usd: 3420, change_pct: 80.0, urgency: 0.99 },
  yttrium: { price_usd: 171, change_pct: 80.0, urgency: 0.94 },
  lanthanum: { price_usd: 12.6, change_pct: 80.0, urgency: 0.88 },
  cerium: { price_usd: 7.2, change_pct: 80.0, urgency: 0.85 },
  samarium: { price_usd: 90, change_pct: 80.0, urgency: 0.91 },
  europium: { price_usd: 1008, change_pct: 80.0, urgency: 0.97 },
  gadolinium: { price_usd: 153, change_pct: 80.0, urgency: 0.92 },
  holmium: { price_usd: 630, change_pct: 80.0, urgency: 0.93 },
};

function buildDemoREEPrice(mineral: string): MarketPrice {
  const shock = DEMO_REE_PRICES[mineral];
  return {
    mineral,
    price_usd: shock.price_usd,
    trend: "rising",
    change_pct: shock.change_pct,
    urgency: shock.urgency,
    disruption: DISRUPTION,
    source_url: "",
    category: "rare_earth",
    criticality: 1,
    scenario_adjusted: true,
    fetched_at: new Date().toISOString(),
  };
}

export const DEMO_SCENARIO: Scenario = {
  id: DEMO_SCENARIO_ID,
  description: DEMO_SCENARIO_PHRASE,
  affected_minerals: [...RARE_EARTH_MINERALS],
  severity: 0.95,
  active: true,
  created_at: new Date().toISOString(),
};

/** Yellow mission route — Ceres → Hygiea (C-type REE targets) */
export const DEMO_ROUTE: MissionRoute = {
  id: DEMO_ROUTE_ID,
  label: "Rare Earth Priority",
  color_hex: ROUTE_YELLOW,
  urgency_score: 0.97,
  urgency_reason: "China REE export block — neodymium & dysprosium critical",
  mineral_focus: ["neodymium", "dysprosium", "terbium", "praseodymium", "yttrium"],
  is_default: true,
  scenario_driven: true,
  stops: [
    { order: 0, body: "Earth", delta_v_to_next_km_s: 5.4, departure_year: 2027 },
    {
      order: 1,
      body: "1 Ceres",
      asteroid_id: "20000001",
      mineral_target: "neodymium",
      extractable_value_usd: 8.4e12,
      stay_duration_days: 210,
      delta_v_to_next_km_s: 2.4,
      departure_year: 2028,
    },
    {
      order: 2,
      body: "10 Hygiea",
      asteroid_id: "20000010",
      mineral_target: "dysprosium",
      extractable_value_usd: 2.1e12,
      stay_duration_days: 150,
      delta_v_to_next_km_s: 2.9,
      departure_year: 2029,
    },
    { order: 3, body: "Earth", delta_v_to_next_km_s: 0 },
  ],
  totals: {
    total_value_usd: 1.05e13,
    total_cost_usd: 7.2e10,
    net_return_usd: 1.042e13,
    roi_pct: 1447,
    duration_years: 4.2,
    total_delta_v_km_s: 10.7,
    minerals_covered: ["neodymium", "dysprosium", "terbium", "praseodymium", "yttrium"],
  },
  route_reasoning:
    "C-type carbonaceous targets optimized for rare earth extraction — Earth → Ceres → Hygiea → Earth under China export block scenario.",
};

export function isDemoPhraseMatch(text: string): boolean {
  return text === DEMO_SCENARIO_PHRASE;
}

/** Client-only demo rows — never DELETE/POST to backend */
export function isEphemeralDemoScenario(id: string): boolean {
  return id === DEMO_SCENARIO_ID || id.startsWith("demo-");
}

/** Merge demo REE shocks into live or mock price feeds without touching other minerals */
export function applyDemoPrices(prices: MarketPrice[]): MarketPrice[] {
  const byMineral = new Map<string, MarketPrice>();
  for (const p of prices) byMineral.set(p.mineral, p);
  for (const mineral of RARE_EARTH_MINERALS) {
    byMineral.set(mineral, buildDemoREEPrice(mineral));
  }
  return Array.from(byMineral.values());
}

/** Ensure all REE minerals appear even when the feed only has a subset */
export function buildDemoPriceFeed(basePrices: MarketPrice[]): MarketPrice[] {
  if (basePrices.length === 0) {
    return RARE_EARTH_MINERALS.map((m) => buildDemoREEPrice(m));
  }
  return applyDemoPrices(basePrices);
}

function isDemoRouteTarget(rank: RankedAsteroid): boolean {
  if (DEMO_ROUTE_ASTEROID_IDS.includes(rank.asteroid_id as (typeof DEMO_ROUTE_ASTEROID_IDS)[number])) {
    return true;
  }
  const name = rank.name.toLowerCase();
  return name.includes("ceres") || name.includes("hygiea");
}

/** Boost REE-relevant targets and pin demo route asteroids (Ceres, Hygiea) to #1/#2. */
export function applyDemoRankings(rankings: RankedAsteroid[]): RankedAsteroid[] {
  const reeSet = new Set<string>(RARE_EARTH_MINERALS);
  const boosted = rankings.map((r) => {
    const isRouteTarget = isDemoRouteTarget(r);
    const isREE =
      isRouteTarget ||
      reeSet.has(r.top_mineral) ||
      ["C", "B"].includes(r.spec_type);
    if (!isREE) return r;
    return {
      ...r,
      scenario_boosted: true,
      mineral_urgency: Math.min(
        0.99,
        r.mineral_urgency + (isRouteTarget ? 0.35 : 0.22)
      ),
      trend: "up" as const,
      top_mineral: isRouteTarget && reeSet.has(r.top_mineral) ? r.top_mineral : isRouteTarget ? "neodymium" : r.top_mineral,
      reasoning:
        r.reasoning ||
        (isRouteTarget
          ? "Rare Earth Priority route anchor — China REE export block"
          : "Scenario boost — China REE export block"),
    };
  });

  const routeTargets = boosted
    .filter(isDemoRouteTarget)
    .sort((a, b) => b.mineral_urgency - a.mineral_urgency);
  const others = boosted.filter((r) => !isDemoRouteTarget(r));
  return [...routeTargets, ...others].map((r, i) => ({ ...r, rank: i + 1 }));
}
