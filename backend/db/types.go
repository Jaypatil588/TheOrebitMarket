package db

import "time"

// MarketPrice is one mineral's price snapshot from Agent 2
type MarketPrice struct {
	ID               int       `json:"id,omitempty"`
	Mineral          string    `json:"mineral"`
	PriceUSD         float64   `json:"price_usd"`
	Trend            string    `json:"trend"`
	Urgency          float64   `json:"urgency"`
	ChangePct        float64   `json:"change_pct"`
	Disruption       string    `json:"disruption"`
	SourceURL        string    `json:"source_url"`
	Category         string    `json:"category"`
	Criticality      int       `json:"criticality"`
	ScenarioAdjusted bool      `json:"scenario_adjusted"`
	FetchedAt        time.Time `json:"fetched_at"`
}

// AsteroidValuation is the enriched asteroid record produced by Agent 1
type AsteroidValuation struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	SpecType        string                 `json:"spec_type"`
	DiameterKm      float64                `json:"diameter_km"`
	MassKg          float64                `json:"mass_kg"`
	Composition     map[string]interface{} `json:"composition"`
	Valuation       map[string]interface{} `json:"valuation"`
	Orbital         map[string]interface{} `json:"orbital"`
	Risk            map[string]interface{} `json:"risk"`
	ResearchSummary string                 `json:"research_summary"`
	PricesSnapshot  map[string]float64     `json:"prices_snapshot"`
	ScenarioImpact  float64                `json:"scenario_impact"`
	ComputedAt      time.Time              `json:"computed_at"`
}

// StrategicRanking is Agent 3's output — rankings + routes
type StrategicRanking struct {
	ID          string                 `json:"id,omitempty"`
	Rankings    []RankedAsteroid       `json:"rankings"`
	Routes      []MissionRoute         `json:"routes"`
	UrgencyMap  map[string]float64     `json:"urgency_map"`
	GeneratedAt time.Time              `json:"generated_at"`
}

type RankedAsteroid struct {
	Rank             int     `json:"rank"`
	AsteroidID       string  `json:"asteroid_id"`
	Name             string  `json:"name"`
	SpecType         string  `json:"spec_type"`
	CompositeScore   float64 `json:"composite_score"`
	NetValueUSD      float64 `json:"net_value_usd"`
	ROI              float64 `json:"roi"`
	TopMineral       string  `json:"top_mineral"`
	MineralUrgency   float64 `json:"mineral_urgency"`
	DeltaVKmS        float64 `json:"delta_v_km_s"`
	LaunchWindowYear int     `json:"launch_window_year"`
	Confidence       float64 `json:"confidence"`
	ScenarioBoosted  bool    `json:"scenario_boosted"`
	Reasoning        string  `json:"reasoning"`
	Trend            string  `json:"trend"`
}

type MissionRoute struct {
	ID             string       `json:"id"`
	Label          string       `json:"label"`
	ColorHex       string       `json:"color_hex"`
	UrgencyScore   float64      `json:"urgency_score"`
	UrgencyReason  string       `json:"urgency_reason"`
	MineralFocus   []string     `json:"mineral_focus"`
	IsDefault      bool         `json:"is_default"`
	ScenarioDriven bool         `json:"scenario_driven"`
	Stops          []RouteStop  `json:"stops"`
	Totals         RouteTotals  `json:"totals"`
	RouteReasoning string       `json:"route_reasoning"`
}

type RouteStop struct {
	Order               int     `json:"order"`
	Body                string  `json:"body"`
	AsteroidID          string  `json:"asteroid_id,omitempty"`
	MineralTarget       string  `json:"mineral_target,omitempty"`
	ExtractableValueUSD float64 `json:"extractable_value_usd,omitempty"`
	StayDurationDays    int     `json:"stay_duration_days,omitempty"`
	DeltaVToNextKmS     float64 `json:"delta_v_to_next_km_s"`
	DepartureYear       int     `json:"departure_year,omitempty"`
}

type RouteTotals struct {
	TotalValueUSD   float64  `json:"total_value_usd"`
	TotalCostUSD    float64  `json:"total_cost_usd"`
	NetReturnUSD    float64  `json:"net_return_usd"`
	ROIPct          float64  `json:"roi_pct"`
	DurationYears   float64  `json:"duration_years"`
	TotalDeltaVKmS  float64  `json:"total_delta_v_km_s"`
	MineralsCovered []string `json:"minerals_covered"`
}

// MissionReport is Agent 4's output — cached per asteroid+route
type MissionReport struct {
	ID              string                 `json:"id,omitempty"`
	AsteroidID      string                 `json:"asteroid_id"`
	RouteID         string                 `json:"route_id"`
	Report          map[string]interface{} `json:"report"`
	AsteroidRender  string                 `json:"asteroid_render"`
	CompositionMap  string                 `json:"composition_map"`
	RouteMap        string                 `json:"route_map"`
	PhysicalProfile string                 `json:"physical_profile"`
	GeneratedAt     time.Time              `json:"generated_at"`
}

// Scenario is a user-injected market disruption
type Scenario struct {
	ID               string    `json:"id"`
	Description      string    `json:"description"`
	AffectedMinerals []string  `json:"affected_minerals"`
	Severity         float64   `json:"severity"`
	Active           bool      `json:"active"`
	CreatedAt        time.Time `json:"created_at"`
}

// ScenarioEffect describes impact per mineral
type ScenarioEffect struct {
	Mineral         string  `json:"mineral"`
	BaseUrgency     float64 `json:"base_urgency"`
	NewUrgency      float64 `json:"new_urgency"`
	UrgencyDelta    float64 `json:"urgency_delta"`
	ValuationImpact float64 `json:"valuation_impact_pct"`
}
