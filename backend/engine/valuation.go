package engine

import (
	"math"
	"strconv"
)

// Asteroid represents the parsed and calculated data structure for an asteroid
type Asteroid struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	FullName    string             `json:"full_name"`
	Class       string             `json:"class"`
	DiameterKm  float64            `json:"diameter_km"`
	H           float64            `json:"h"`
	MassKg      float64            `json:"mass_kg"`
	Orbital     OrbitalParameters  `json:"orbital"`
	SpecType    string             `json:"spec_type"`
	Composition MineralComposition `json:"composition"`
	ValueUSD    float64            `json:"valueUSD"`
	RingIndex   int                `json:"ringIndex"`
	Angle       float64            `json:"angle"`
	OrbitSpeed  float64            `json:"orbitSpeed"`
	Size        float64            `json:"size"`
}

// EstimateDiameterFromH estimates asteroid diameter (km) from absolute magnitude H and geometric albedo.
// Standard astronomy formula: D = 1329 / sqrt(albedo) * 10^(-0.2 * H)
func EstimateDiameterFromH(h float64, albedo float64) float64 {
	if h <= 0 {
		return 0.15 // Default fallback diameter in km
	}
	if albedo <= 0 {
		albedo = 0.15 // Default conservative albedo
	}
	return (1329.0 / math.Sqrt(albedo)) * math.Pow(10.0, -0.2*h)
}


// OrbitalParameters stores orbital coordinates and distances
type OrbitalParameters struct {
	E      float64 `json:"e"`
	A      float64 `json:"a"`
	I      float64 `json:"i"`
	MoidAu float64 `json:"moid_au"`
}

// MineralComposition represents percentages of elements mapping dynamically
type MineralComposition map[string]float64


// EstimateMass calculates mass (kg) based on diameter and spectral density
func EstimateMass(diameterKm float64, specType string) float64 {
	density := 2000.0 // kg/m^3
	switch specType {
	case "C":
		density = 1400.0
	case "S":
		density = 2200.0
	case "M":
		density = 5300.0
	}

	// Volume V = 4/3 * pi * r^3
	radiusM := (diameterKm * 1000.0) / 2.0
	volumeM3 := (4.0 / 3.0) * math.Pi * math.Pow(radiusM, 3)
	return volumeM3 * density
}

// SimpleHash generates a pseudo-random integer based on SPKID string for static variations
func SimpleHash(s string) int {
	h := 0
	for i := 0; i < len(s); i++ {
		h = 31*h + int(s[i])
	}
	if h < 0 {
		h = -h
	}
	return h
}

// CalculateComposition estimates composition percentages matching real Bus-DeMeo planetary ratios
func CalculateComposition(spkid string, specType string) MineralComposition {
	if spkid == "20136108" {
		return MineralComposition{
			"nickel":    52,
			"cobalt":    33,
			"palladium": 15,
		}
	}

	h := SimpleHash(spkid)
	comp := make(MineralComposition)

	switch specType {
	case "M":
		// Metallic Asteroid: Rich in Iron, Nickel, Cobalt, and PGMs
		platinum := 0.5 + float64(h%25)/10.0     // 0.5% - 3.0%
		cobalt := 0.5 + float64(h%10)/10.0       // 0.5% - 1.5%
		nickel := 8.0 + float64(h%40)/10.0       // 8.0% - 12.0%
		iron := 100.0 - (platinum + cobalt + nickel)

		comp["platinumGroup"] = math.Round(platinum*100) / 100
		comp["cobalt"] = math.Round(cobalt*100) / 100
		comp["nickel"] = math.Round(nickel*100) / 100
		comp["iron"] = math.Round(iron*100) / 100

	case "S":
		// Stony/Silicaceous Asteroid: Rich in Silicates, Silicon, Magnesium, and Iron
		iron := 20.0 + float64(h%100)/10.0       // 20.0% - 30.0%
		silicon := 15.0 + float64(h%100)/10.0    // 15.0% - 25.0%
		magnesium := 10.0 + float64(h%100)/10.0  // 10.0% - 20.0%
		nickel := 1.0 + float64(h%20)/10.0       // 1.0% - 3.0%
		stony := 100.0 - (iron + silicon + magnesium + nickel)

		comp["iron"] = math.Round(iron*100) / 100
		comp["silicon"] = math.Round(silicon*100) / 100
		comp["magnesium"] = math.Round(magnesium*100) / 100
		comp["nickel"] = math.Round(nickel*100) / 100
		comp["stonyMatrix"] = math.Round(stony*100) / 100

	default: // "C" type
		// Carbonaceous Asteroid: Rich in Clay Minerals, Water-Ice, Carbon, and hydrated Silicates
		water := 10.0 + float64(h%50)/10.0       // 10.0% - 15.0%
		carbon := 5.0 + float64(h%50)/10.0       // 5.0% - 10.0%
		silicates := 15.0 + float64(h%100)/10.0  // 15.0% - 25.0%
		iron := 3.0 + float64(h%50)/10.0         // 3.0% - 8.0%
		clay := 100.0 - (water + carbon + silicates + iron)

		comp["waterIce"] = math.Round(water*100) / 100
		comp["carbon"] = math.Round(carbon*100) / 100
		comp["silicates"] = math.Round(silicates*100) / 100
		comp["iron"] = math.Round(iron*100) / 100
		comp["clayMinerals"] = math.Round(clay*100) / 100
	}

	return comp
}

// CalculateValueUSD returns estimated valuation based on composition element weights and space commodity pricing
func CalculateValueUSD(massKg float64, comp MineralComposition) float64 {
	totalValue := 0.0

	// Commodity prices per kg:
	prices := map[string]float64{
		"platinumGroup": 32000.0, // PGMs: $32,000/kg
		"palladium":     32000.0, // Palladium: $32,000/kg
		"cobalt":        35.0,    // Cobalt: $35/kg
		"nickel":        20.0,    // Nickel: $20/kg
		"iron":          0.15,    // Iron: $0.15/kg
		"silicon":       4.0,     // Silicon: $4/kg
		"magnesium":     5.0,     // Magnesium: $5/kg
		"waterIce":      250.0,   // Water-Ice (fuel propellant harvested in orbit): $250/kg
		"carbon":        3.0,     // Carbon: $3/kg
		"silicates":     1.5,     // Silicates: $1.5/kg
		"clayMinerals":   1.0,     // Clay minerals: $1/kg
		"stonyMatrix":    1.0,     // Stony matrix: $1/kg
	}

	for mineral, percentage := range comp {
		price, ok := prices[mineral]
		if !ok {
			price = 1.0 // Default baseline value for residual stony minerals
		}
		mineralMassKg := massKg * (percentage / 100.0)
		totalValue += mineralMassKg * price
	}

	return totalValue
}

// SanitizeSpecType maps miscellaneous letters to core M, S, C spectral taxonomies
func SanitizeSpecType(sB, sT interface{}) string {
	specType := "C"
	
	getString := func(v interface{}) string {
		if v == nil {
			return ""
		}
		if str, ok := v.(string); ok {
			return str
		}
		return ""
	}
	
	s := getString(sB)
	if s == "" {
		s = getString(sT)
	}
	
	if len(s) > 0 {
		char := string(s[0])
		switch char {
		case "M", "S", "C":
			specType = char
		case "X", "E", "P":
			specType = "M"
		case "A", "Q", "R", "V":
			specType = "S"
		default:
			specType = "C"
		}
	}
	
	return specType
}

// ParseFloatSafe parses values into floats, handling interface{} conversion
func ParseFloatSafe(val interface{}) float64 {
	if val == nil {
		return 0.0
	}
	switch v := val.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case string:
		f, err := strconv.ParseFloat(v, 64)
		if err == nil {
			return f
		}
	}
	return 0.0
}
