// Shared Orebit domain types — no hooks or live-data imports (avoids circular deps).

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "telemetry" | "discovery";
  agentId: string;
  message: string;
  meta?: unknown;
}

export interface MarketPrice {
  mineral: string;
  price_usd: number;
  trend: string;
  change_pct: number;
  urgency: number;
  disruption: string;
  source_url: string;
  category: string;
  criticality: number;
  scenario_adjusted: boolean;
  fetched_at: string;
}

export interface RankedAsteroid {
  rank: number;
  asteroid_id: string;
  name: string;
  spec_type: string;
  composite_score: number;
  net_value_usd: number;
  roi: number;
  top_mineral: string;
  mineral_urgency: number;
  delta_v_km_s: number;
  launch_window_year: number;
  confidence: number;
  scenario_boosted: boolean;
  reasoning: string;
  trend: string;
}

export interface RouteStop {
  order: number;
  body: string;
  asteroid_id?: string;
  mineral_target?: string;
  extractable_value_usd?: number;
  stay_duration_days?: number;
  delta_v_to_next_km_s: number;
  departure_year?: number;
}

export interface RouteTotals {
  total_value_usd: number;
  total_cost_usd: number;
  net_return_usd: number;
  roi_pct: number;
  duration_years: number;
  total_delta_v_km_s: number;
  minerals_covered: string[];
}

export interface MissionRoute {
  id: string;
  label: string;
  color_hex: string;
  urgency_score: number;
  urgency_reason: string;
  mineral_focus: string[];
  is_default: boolean;
  scenario_driven: boolean;
  stops: RouteStop[];
  totals: RouteTotals;
  route_reasoning: string;
}

export interface AgentStatus {
  agent: string;
  status: string;
  message: string;
  asteroid_id?: string;
}

export interface MissionReportData {
  asteroid_id: string;
  cached: boolean;
  report: Record<string, unknown>;
  timestamp: string;
}

export interface Scenario {
  id: string;
  description: string;
  affected_minerals: string[];
  severity: number;
  active: boolean;
  created_at: string;
}
