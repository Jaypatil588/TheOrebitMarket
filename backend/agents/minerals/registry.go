package minerals

// Mineral represents one critical material in the global supply chain
type Mineral struct {
	ID              string   // canonical key used across all agents
	DisplayName     string
	Category        string
	ChinaControlPct float64  // % of global supply controlled by China
	Criticality     int      // 1=most critical, 3=less critical
	DemandDrivers   []string // industries currently driving demand
	AsteroidTypes   []string // spectral types that contain this mineral
	DefaultPriceUSD float64  // fallback price per kg if API unavailable
}

// Registry is the full list of 37 real-world critical minerals
var Registry = []Mineral{
	// ── RARE EARTH ELEMENTS ──────────────────────────────────────────
	{
		ID: "neodymium", DisplayName: "Neodymium", Category: "rare_earth",
		ChinaControlPct: 60, Criticality: 1, DefaultPriceUSD: 210,
		DemandDrivers: []string{"EV motors", "wind turbines", "hard drives", "defense systems"},
		AsteroidTypes: []string{"C", "S"},
	},
	{
		ID: "dysprosium", DisplayName: "Dysprosium", Category: "rare_earth",
		ChinaControlPct: 99, Criticality: 1, DefaultPriceUSD: 480,
		DemandDrivers: []string{"high-temp EV magnets", "defense electronics", "MRI machines"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "praseodymium", DisplayName: "Praseodymium", Category: "rare_earth",
		ChinaControlPct: 85, Criticality: 1, DefaultPriceUSD: 190,
		DemandDrivers: []string{"EV motors", "aircraft engines", "fiber optics"},
		AsteroidTypes: []string{"C", "S"},
	},
	{
		ID: "terbium", DisplayName: "Terbium", Category: "rare_earth",
		ChinaControlPct: 99, Criticality: 1, DefaultPriceUSD: 1900,
		DemandDrivers: []string{"solid-state devices", "EV motors", "defense sonar"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "yttrium", DisplayName: "Yttrium", Category: "rare_earth",
		ChinaControlPct: 70, Criticality: 1, DefaultPriceUSD: 95,
		DemandDrivers: []string{"LEDs", "phosphors", "superconductors", "laser tech"},
		AsteroidTypes: []string{"C", "S"},
	},
	{
		ID: "lanthanum", DisplayName: "Lanthanum", Category: "rare_earth",
		ChinaControlPct: 85, Criticality: 2, DefaultPriceUSD: 7,
		DemandDrivers: []string{"EV batteries", "optics", "petroleum refining"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "cerium", DisplayName: "Cerium", Category: "rare_earth",
		ChinaControlPct: 85, Criticality: 2, DefaultPriceUSD: 4,
		DemandDrivers: []string{"catalytic converters", "glass polishing", "UV filters"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "samarium", DisplayName: "Samarium", Category: "rare_earth",
		ChinaControlPct: 90, Criticality: 2, DefaultPriceUSD: 50,
		DemandDrivers: []string{"permanent magnets", "nuclear reactors", "cancer treatment"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "europium", DisplayName: "Europium", Category: "rare_earth",
		ChinaControlPct: 99, Criticality: 2, DefaultPriceUSD: 560,
		DemandDrivers: []string{"display phosphors", "lasers", "quantum computing"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "gadolinium", DisplayName: "Gadolinium", Category: "rare_earth",
		ChinaControlPct: 90, Criticality: 2, DefaultPriceUSD: 85,
		DemandDrivers: []string{"MRI contrast agents", "nuclear reactor shielding"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "holmium", DisplayName: "Holmium", Category: "rare_earth",
		ChinaControlPct: 99, Criticality: 3, DefaultPriceUSD: 350,
		DemandDrivers: []string{"nuclear reactors", "magnets", "medical lasers"},
		AsteroidTypes: []string{"C"},
	},
	// ── PLATINUM GROUP METALS ────────────────────────────────────────
	{
		ID: "platinum", DisplayName: "Platinum", Category: "platinum_group",
		ChinaControlPct: 0, Criticality: 1, DefaultPriceUSD: 31240,
		DemandDrivers: []string{"hydrogen fuel cells", "catalytic converters", "jewelry"},
		AsteroidTypes: []string{"M", "S"},
	},
	{
		ID: "palladium", DisplayName: "Palladium", Category: "platinum_group",
		ChinaControlPct: 0, Criticality: 1, DefaultPriceUSD: 35000,
		DemandDrivers: []string{"catalytic converters", "hydrogen purification", "electronics"},
		AsteroidTypes: []string{"M"},
	},
	{
		ID: "rhodium", DisplayName: "Rhodium", Category: "platinum_group",
		ChinaControlPct: 0, Criticality: 1, DefaultPriceUSD: 145000,
		DemandDrivers: []string{"catalytic converters", "chemical industry", "electroplating"},
		AsteroidTypes: []string{"M"},
	},
	{
		ID: "iridium", DisplayName: "Iridium", Category: "platinum_group",
		ChinaControlPct: 0, Criticality: 1, DefaultPriceUSD: 52000,
		DemandDrivers: []string{"fuel cell electrodes", "aerospace alloys", "spark plugs"},
		AsteroidTypes: []string{"M"},
	},
	{
		ID: "ruthenium", DisplayName: "Ruthenium", Category: "platinum_group",
		ChinaControlPct: 15, Criticality: 2, DefaultPriceUSD: 14000,
		DemandDrivers: []string{"data storage", "fuel cells", "chip resistors"},
		AsteroidTypes: []string{"M"},
	},
	// ── BATTERY / EV METALS ──────────────────────────────────────────
	{
		ID: "cobalt", DisplayName: "Cobalt", Category: "battery",
		ChinaControlPct: 70, Criticality: 1, DefaultPriceUSD: 33.8,
		DemandDrivers: []string{"EV batteries (NMC)", "aerospace alloys", "defense"},
		AsteroidTypes: []string{"M", "S"},
	},
	{
		ID: "lithium", DisplayName: "Lithium", Category: "battery",
		ChinaControlPct: 60, Criticality: 1, DefaultPriceUSD: 12.8,
		DemandDrivers: []string{"EV batteries", "grid storage", "consumer electronics"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "nickel", DisplayName: "Nickel", Category: "battery",
		ChinaControlPct: 10, Criticality: 1, DefaultPriceUSD: 16.42,
		DemandDrivers: []string{"EV batteries (NMC)", "stainless steel", "aerospace"},
		AsteroidTypes: []string{"M", "S"},
	},
	{
		ID: "manganese", DisplayName: "Manganese", Category: "battery",
		ChinaControlPct: 35, Criticality: 2, DefaultPriceUSD: 3.0,
		DemandDrivers: []string{"EV batteries (NMC)", "steel alloys", "aluminum alloys"},
		AsteroidTypes: []string{"S", "C"},
	},
	{
		ID: "graphite", DisplayName: "Graphite", Category: "battery",
		ChinaControlPct: 65, Criticality: 1, DefaultPriceUSD: 1.2,
		DemandDrivers: []string{"EV battery anodes", "nuclear reactors", "lubricants"},
		AsteroidTypes: []string{"C"},
	},
	// ── SEMICONDUCTOR / TECH METALS (China export restrictions 2023+) ─
	{
		ID: "gallium", DisplayName: "Gallium", Category: "semiconductor",
		ChinaControlPct: 94, Criticality: 1, DefaultPriceUSD: 350,
		DemandDrivers: []string{"5G chips", "semiconductors (GaN)", "solar cells"},
		AsteroidTypes: []string{"C", "S"},
	},
	{
		ID: "germanium", DisplayName: "Germanium", Category: "semiconductor",
		ChinaControlPct: 67, Criticality: 1, DefaultPriceUSD: 1100,
		DemandDrivers: []string{"fiber optics", "semiconductors", "defense IR sensors"},
		AsteroidTypes: []string{"C"},
	},
	{
		ID: "indium", DisplayName: "Indium", Category: "semiconductor",
		ChinaControlPct: 57, Criticality: 2, DefaultPriceUSD: 167,
		DemandDrivers: []string{"touchscreens (ITO)", "solar cells", "LEDs"},
		AsteroidTypes: []string{"C", "S"},
	},
	{
		ID: "tellurium", DisplayName: "Tellurium", Category: "semiconductor",
		ChinaControlPct: 66, Criticality: 2, DefaultPriceUSD: 63,
		DemandDrivers: []string{"thin-film solar (CdTe)", "thermoelectrics"},
		AsteroidTypes: []string{"C"},
	},
	// ── REFRACTORY / SPECIALTY METALS ────────────────────────────────
	{
		ID: "tantalum", DisplayName: "Tantalum", Category: "refractory",
		ChinaControlPct: 0, Criticality: 2, DefaultPriceUSD: 152,
		DemandDrivers: []string{"capacitors", "medical devices", "aerospace turbines"},
		AsteroidTypes: []string{"M"},
	},
	{
		ID: "niobium", DisplayName: "Niobium", Category: "refractory",
		ChinaControlPct: 0, Criticality: 2, DefaultPriceUSD: 42,
		DemandDrivers: []string{"high-strength steel", "superconductors", "jet engines"},
		AsteroidTypes: []string{"M", "S"},
	},
	{
		ID: "tungsten", DisplayName: "Tungsten", Category: "refractory",
		ChinaControlPct: 83, Criticality: 1, DefaultPriceUSD: 35,
		DemandDrivers: []string{"cutting tools", "military munitions", "electronics"},
		AsteroidTypes: []string{"M"},
	},
	{
		ID: "rhenium", DisplayName: "Rhenium", Category: "refractory",
		ChinaControlPct: 0, Criticality: 2, DefaultPriceUSD: 1560,
		DemandDrivers: []string{"jet engine superalloys", "catalysts", "thermocouples"},
		AsteroidTypes: []string{"M"},
	},
	// ── INDUSTRIAL METALS ────────────────────────────────────────────
	{
		ID: "iron", DisplayName: "Iron", Category: "industrial",
		ChinaControlPct: 30, Criticality: 3, DefaultPriceUSD: 0.124,
		DemandDrivers: []string{"steel", "construction", "manufacturing"},
		AsteroidTypes: []string{"M", "S", "C"},
	},
	{
		ID: "chromium", DisplayName: "Chromium", Category: "industrial",
		ChinaControlPct: 25, Criticality: 2, DefaultPriceUSD: 9.5,
		DemandDrivers: []string{"stainless steel", "aerospace alloys", "surface hardening"},
		AsteroidTypes: []string{"M", "S"},
	},
	{
		ID: "molybdenum", DisplayName: "Molybdenum", Category: "refractory",
		ChinaControlPct: 38, Criticality: 2, DefaultPriceUSD: 47,
		DemandDrivers: []string{"high-strength steel", "aircraft engines", "electronics"},
		AsteroidTypes: []string{"M", "S"},
	},
	{
		ID: "vanadium", DisplayName: "Vanadium", Category: "battery",
		ChinaControlPct: 27, Criticality: 2, DefaultPriceUSD: 29,
		DemandDrivers: []string{"grid-scale batteries (VRFB)", "high-strength steel"},
		AsteroidTypes: []string{"M", "S"},
	},
	{
		ID: "titanium", DisplayName: "Titanium", Category: "industrial",
		ChinaControlPct: 5, Criticality: 2, DefaultPriceUSD: 11.4,
		DemandDrivers: []string{"aerospace", "medical implants", "defense"},
		AsteroidTypes: []string{"S", "M"},
	},
	// ── SPACE RESOURCES ──────────────────────────────────────────────
	{
		ID: "water_ice", DisplayName: "Water (Ice)", Category: "space_resource",
		ChinaControlPct: 0, Criticality: 1, DefaultPriceUSD: 250,
		DemandDrivers: []string{"rocket propellant (ISRU)", "life support", "orbital fuel depots"},
		AsteroidTypes: []string{"C", "D"},
	},
	{
		ID: "silicon", DisplayName: "Silicon", Category: "space_resource",
		ChinaControlPct: 25, Criticality: 2, DefaultPriceUSD: 4.0,
		DemandDrivers: []string{"solar panels", "semiconductors", "ISRU construction"},
		AsteroidTypes: []string{"S", "C"},
	},
	{
		ID: "magnesium", DisplayName: "Magnesium", Category: "space_resource",
		ChinaControlPct: 20, Criticality: 3, DefaultPriceUSD: 2.2,
		DemandDrivers: []string{"aerospace alloys", "lightweight structures", "ISRU"},
		AsteroidTypes: []string{"S", "C"},
	},
}

// ByID returns a mineral by its ID key
func ByID(id string) *Mineral {
	for i := range Registry {
		if Registry[i].ID == id {
			return &Registry[i]
		}
	}
	return nil
}

// IDList returns all mineral IDs as a slice
func IDList() []string {
	ids := make([]string, len(Registry))
	for i, m := range Registry {
		ids[i] = m.ID
	}
	return ids
}

// HighChinaControl returns all mineral IDs where China controls > threshold %
func HighChinaControl(threshold float64) []string {
	var result []string
	for _, m := range Registry {
		if m.ChinaControlPct >= threshold {
			result = append(result, m.ID)
		}
	}
	return result
}

// DefaultPriceMap returns a mineral ID → default price map for fallback
func DefaultPriceMap() map[string]float64 {
	m := make(map[string]float64)
	for _, mineral := range Registry {
		m[mineral.ID] = mineral.DefaultPriceUSD
	}
	return m
}
