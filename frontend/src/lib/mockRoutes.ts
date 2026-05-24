import type { MissionRoute } from "@/types/orebit";

/** Client-only demo route id — keep in sync with DEMO_ROUTE in demoScenario.ts */
export const DEMO_ROUTE_ID = "route-demo-rare-earth";

/** Fallback route when Agent 3 / Gemini returns no routes — IDs match public/data/asteroids.json */
export const MOCK_ROUTE: MissionRoute = {
  id: "route-mock-cobalt-urgency",
  label: "Cobalt Urgency Run",
  color_hex: "#22d3ee",
  urgency_score: 0.82,
  urgency_reason: "DRC supply disruption — cobalt priority",
  mineral_focus: ["cobalt", "nickel"],
  is_default: true,
  scenario_driven: false,
  stops: [
    { order: 0, body: "Earth", delta_v_to_next_km_s: 5.82, departure_year: 2027 },
    {
      order: 1,
      body: "16 Psyche",
      asteroid_id: "20000016",
      mineral_target: "cobalt",
      extractable_value_usd: 1.02e13,
      stay_duration_days: 180,
      delta_v_to_next_km_s: 2.8,
      departure_year: 2028,
    },
    {
      order: 2,
      body: "2 Pallas",
      asteroid_id: "20000002",
      mineral_target: "nickel",
      extractable_value_usd: 4.5e11,
      stay_duration_days: 120,
      delta_v_to_next_km_s: 3.1,
      departure_year: 2029,
    },
    { order: 3, body: "Earth", delta_v_to_next_km_s: 0 },
  ],
  totals: {
    total_value_usd: 1.065e13,
    total_cost_usd: 8.5e10,
    net_return_usd: 1.056e13,
    roi_pct: 1242,
    duration_years: 4.8,
    total_delta_v_km_s: 11.72,
    minerals_covered: ["cobalt", "nickel"],
  },
  route_reasoning:
    "High-urgency cobalt and nickel targets with accessible Δv — Earth → Psyche → Pallas → Earth.",
};

export const MOCK_ROUTE_ID = MOCK_ROUTE.id;
