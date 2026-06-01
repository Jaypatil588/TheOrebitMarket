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

/** Demo Route 2: Platinum Group Metals corridor — 3 M-type asteroid sweep */
export const MOCK_ROUTE_PLATINUM: MissionRoute = {
  id: "route-mock-platinum-sweep",
  label: "Platinum Sweep",
  color_hex: "#a78bfa",
  urgency_score: 0.74,
  urgency_reason: "PGM stockpile depletion — catalyst demand surge",
  mineral_focus: ["platinum", "palladium", "rhodium"],
  is_default: false,
  scenario_driven: false,
  stops: [
    { order: 0, body: "Earth", delta_v_to_next_km_s: 4.91, departure_year: 2028 },
    {
      order: 1,
      body: "3554 Amun",
      asteroid_id: "20003554",
      mineral_target: "platinum",
      extractable_value_usd: 6.8e12,
      stay_duration_days: 160,
      delta_v_to_next_km_s: 1.9,
      departure_year: 2029,
    },
    {
      order: 2,
      body: "6178 1986 DA",
      asteroid_id: "20006178",
      mineral_target: "palladium",
      extractable_value_usd: 3.2e12,
      stay_duration_days: 140,
      delta_v_to_next_km_s: 2.3,
      departure_year: 2030,
    },
    {
      order: 3,
      body: "216 Kleopatra",
      asteroid_id: "20000216",
      mineral_target: "rhodium",
      extractable_value_usd: 1.8e12,
      stay_duration_days: 110,
      delta_v_to_next_km_s: 3.4,
      departure_year: 2031,
    },
    { order: 4, body: "Earth", delta_v_to_next_km_s: 0 },
  ],
  totals: {
    total_value_usd: 1.18e13,
    total_cost_usd: 1.2e11,
    net_return_usd: 1.168e13,
    roi_pct: 973,
    duration_years: 5.2,
    total_delta_v_km_s: 12.51,
    minerals_covered: ["platinum", "palladium", "rhodium"],
  },
  route_reasoning:
    "Multi-stop PGM sweep targeting M-type bodies with confirmed metallic signatures — Earth → Amun → 1986 DA → Kleopatra → Earth. Optimized for catalytic converter and hydrogen fuel cell demand.",
};

/** Demo Route 3: Water/Propellant depot route for in-space refueling infrastructure */
export const MOCK_ROUTE_WATER: MissionRoute = {
  id: "route-mock-water-depot",
  label: "Water Depot Run",
  color_hex: "#14b8a6",
  urgency_score: 0.68,
  urgency_reason: "Cislunar propellant depot demand — NASA Artemis contracts",
  mineral_focus: ["water_ice", "silicon"],
  is_default: false,
  scenario_driven: false,
  stops: [
    { order: 0, body: "Earth", delta_v_to_next_km_s: 3.82, departure_year: 2027 },
    {
      order: 1,
      body: "24 Themis",
      asteroid_id: "20000024",
      mineral_target: "water_ice",
      extractable_value_usd: 2.4e11,
      stay_duration_days: 200,
      delta_v_to_next_km_s: 1.6,
      departure_year: 2028,
    },
    {
      order: 2,
      body: "65 Cybele",
      asteroid_id: "20000065",
      mineral_target: "water_ice",
      extractable_value_usd: 1.8e11,
      stay_duration_days: 170,
      delta_v_to_next_km_s: 2.1,
      departure_year: 2029,
    },
    { order: 3, body: "Earth", delta_v_to_next_km_s: 0 },
  ],
  totals: {
    total_value_usd: 4.2e11,
    total_cost_usd: 3.8e10,
    net_return_usd: 3.82e11,
    roi_pct: 1005,
    duration_years: 3.6,
    total_delta_v_km_s: 7.52,
    minerals_covered: ["water_ice", "silicon"],
  },
  route_reasoning:
    "Low Δv corridor targeting C-type bodies with confirmed water ice signatures for cislunar propellant depot infrastructure — Earth → Themis → Cybele → Earth.",
};

export const MOCK_ROUTE_ID = MOCK_ROUTE.id;

/** All demo routes */
export const ALL_MOCK_ROUTES: MissionRoute[] = [
  MOCK_ROUTE,
  MOCK_ROUTE_PLATINUM,
  MOCK_ROUTE_WATER,
];
