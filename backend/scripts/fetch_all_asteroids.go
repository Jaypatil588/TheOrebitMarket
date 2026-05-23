package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/engine"
)

// JPLResponse matches the structure of the JPL Small-Body Database Query API response
type JPLResponse struct {
	Signature struct {
		Source  string `json:"source"`
		Version string `json:"version"`
	} `json:"signature"`
	Fields []string        `json:"fields"`
	Data   [][]interface{} `json:"data"`
	Count  int             `json:"count"`
}

func main() {
	fmt.Println("==================================================")
	fmt.Println(" Starting FULL Small-Body Dataset Acquisition (1.54M Asteroids)")
	fmt.Println("==================================================")

	// API parameters
	fields := []string{"spkid", "full_name", "name", "e", "a", "i", "moid", "class", "diameter", "H", "spec_B", "spec_T"}
	fieldsStr := strings.Join(fields, ",")

	// We'll perform paginated fetching of the entire Solar System database (no filters on groups)
	// Page size is set to 150,000 records
	pageSize := 150000
	totalCount := 1547235 // Known count from our skip test
	totalPages := int(math.Ceil(float64(totalCount) / float64(pageSize)))

	var allProcessedAsteroids []engine.Asteroid
	var allRawRows [][]interface{}

	client := &http.Client{
		Timeout: 60 * time.Second, // Large timeout for huge queries
	}

	for page := 0; page < totalPages; page++ {
		limitFrom := page * pageSize
		fmt.Printf("[%d/%d] Fetching records starting at %d (Limit: %d)...\n", page+1, totalPages, limitFrom, pageSize)

		params := url.Values{}
		params.Set("fields", fieldsStr)
		params.Set("limit", fmt.Sprintf("%d", pageSize))
		params.Set("limit-from", fmt.Sprintf("%d", limitFrom))

		apiURL := fmt.Sprintf("https://ssd-api.jpl.nasa.gov/sbdb_query.api?%s", params.Encode())

		// Safety delay between queries to adhere to NASA's Fair Use Policy
		if page > 0 {
			time.Sleep(1000 * time.Millisecond)
		}

		req, err := http.NewRequest("GET", apiURL, nil)
		if err != nil {
			fmt.Printf("Error building request for page %d: %v\n", page, err)
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (AstroHedge Full Acquisition Agent)")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("HTTP Request failed on page %d: %v\n. Retrying in 5 seconds...", page, err)
			time.Sleep(5 * time.Second)
			resp, err = client.Do(req)
			if err != nil {
				fmt.Printf("Retry failed. Skipping page %d.\n", page)
				continue
			}
		}

		if resp.StatusCode != http.StatusOK {
			fmt.Printf("API returned non-200 status code %d on page %d\n", resp.StatusCode, page)
			resp.Body.Close()
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			fmt.Printf("Failed to read response body on page %d: %v\n", page, err)
			continue
		}

		var payload JPLResponse
		if err := json.Unmarshal(body, &payload); err != nil {
			fmt.Printf("JSON Unmarshal failed on page %d: %v\n", page, err)
			continue
		}

		fmt.Printf("  Received %d rows. Processing physics...\n", len(payload.Data))
		allRawRows = append(allRawRows, payload.Data...)

		// Map fields index
		fieldIdx := make(map[string]int)
		for idx, f := range payload.Fields {
			fieldIdx[f] = idx
		}

		for _, row := range payload.Data {
			spkid := ""
			if v, ok := row[fieldIdx["spkid"]].(float64); ok {
				spkid = fmt.Sprintf("%.0f", v)
			} else if v, ok := row[fieldIdx["spkid"]].(string); ok {
				spkid = v
			}

			fullName := ""
			if v, ok := row[fieldIdx["full_name"]].(string); ok {
				fullName = strings.TrimSpace(v)
			}

			name := ""
			if v, ok := row[fieldIdx["name"]].(string); ok {
				name = strings.TrimSpace(v)
			}

			if name == "" {
				name = strings.Split(fullName, "(")[0]
				name = strings.TrimSpace(name)
				parts := strings.Fields(name)
				if len(parts) > 1 {
					name = strings.Join(parts[1:], " ")
				}
			}

			e := engine.ParseFloatSafe(row[fieldIdx["e"]])
			a := engine.ParseFloatSafe(row[fieldIdx["a"]])
			i := engine.ParseFloatSafe(row[fieldIdx["i"]])
			moid := engine.ParseFloatSafe(row[fieldIdx["moid"]])
			class := ""
			if v, ok := row[fieldIdx["class"]].(string); ok {
				class = v
			}

			specType := engine.SanitizeSpecType(row[fieldIdx["spec_B"]], row[fieldIdx["spec_T"]])
			hVal := engine.ParseFloatSafe(row[fieldIdx["H"]])

			// Parse diameter
			diameter := engine.ParseFloatSafe(row[fieldIdx["diameter"]])

			// IMPORTANT: If cataloged diameter is missing, estimate it from Absolute Magnitude H
			if diameter <= 0 {
				// Estimate albedo based on spectral class
				albedo := 0.15
				switch specType {
				case "C":
					albedo = 0.05
				case "S":
					albedo = 0.20
				case "M":
					albedo = 0.15
				}
				diameter = engine.EstimateDiameterFromH(hVal, albedo)
			}

			// Deterministic calculations
			mass := engine.EstimateMass(diameter, specType)
			comp := engine.CalculateComposition(spkid, specType)
			valueUSD := engine.CalculateValueUSD(mass, comp)

			ast := engine.Asteroid{
				ID:         spkid,
				Name:       name,
				FullName:   fullName,
				Class:      class,
				DiameterKm: math.Round(diameter*10000) / 10000,
				H:          math.Round(hVal*100) / 100,
				MassKg:     math.Round(mass*100) / 100,
				Orbital: engine.OrbitalParameters{
					E:      math.Round(e*1000000) / 1000000,
					A:      math.Round(a*1000000) / 1000000,
					I:      math.Round(i*1000000) / 1000000,
					MoidAu: math.Round(moid*1000000) / 1000000,
				},
				SpecType:    specType,
				Composition: comp,
				ValueUSD:    math.Round(valueUSD*100) / 100,
			}

			allProcessedAsteroids = append(allProcessedAsteroids, ast)
		}
	}

	fmt.Println("Acquisition complete! Compiling master database...")

	// Create data directory
	os.MkdirAll(filepath.Join("backend", "data"), 0755)

	// 1. Save all raw JSON
	rawPath := filepath.Join("backend", "data", "all_asteroids_raw.json")
	rawFile, err := os.Create(rawPath)
	if err != nil {
		fmt.Printf("Error creating raw file: %v\n", err)
	} else {
		defer rawFile.Close()
		// Save simplified raw array of arrays
		rawPayload := map[string]interface{}{
			"fields": fields,
			"data":   allRawRows,
		}
		encoder := json.NewEncoder(rawFile)
		if err := encoder.Encode(rawPayload); err != nil {
			fmt.Printf("Error encoding raw payload: %v\n", err)
		} else {
			fmt.Printf("Successfully wrote %d raw entries to %s\n", len(allRawRows), rawPath)
		}
	}

	// 2. Sort by valuation descending
	sort.Slice(allProcessedAsteroids, func(i, j int) bool {
		return allProcessedAsteroids[i].ValueUSD > allProcessedAsteroids[j].ValueUSD
	})

	// 3. Save all processed JSON
	processedPath := filepath.Join("backend", "data", "all_asteroids_processed.json")
	processedFile, err := os.Create(processedPath)
	if err != nil {
		fmt.Printf("Error creating processed file: %v\n", err)
	} else {
		defer processedFile.Close()
		encoder := json.NewEncoder(processedFile)
		if err := encoder.Encode(allProcessedAsteroids); err != nil {
			fmt.Printf("Error encoding processed payload: %v\n", err)
		} else {
			fmt.Printf("Successfully processed and wrote %d sorted entries to %s\n", len(allProcessedAsteroids), processedPath)
		}
	}

	// 4. Cache Top 500 richest, sorted by distance from Earth, clustered into 50 orbits (10 per orbit)
	frontendPath := filepath.Join("frontend", "public", "data", "asteroids.json")
	limit := 500
	if len(allProcessedAsteroids) < limit {
		limit = len(allProcessedAsteroids)
	}
	top500 := allProcessedAsteroids[:limit]

	// Sort by Earth MOID (Distance from Earth) so that rings expand out logically by distance
	sort.Slice(top500, func(i, j int) bool {
		return top500[i].Orbital.MoidAu < top500[j].Orbital.MoidAu
	})

	// Pre-cluster and assign orbital dynamics parameters
	for idx := 0; idx < len(top500); idx++ {
		ringIndex := idx / 10
		angleIndex := idx % 10
		hVal := engine.SimpleHash(top500[idx].ID)

		// Distribute 10 asteroids evenly around the ring, with minor angle jitter
		angle := (float64(angleIndex) * 2.0 * math.Pi / 10.0) + (float64(hVal%100)/500.0 - 0.1)

		// Keplerian-style speed (closer rings spin faster)
		speed := (0.015 + (float64(hVal%50) / 2500.0)) * (1.0 / math.Sqrt(float64(ringIndex+1)))
		if hVal%2 == 0 {
			speed = -speed // Retrograde vs Prograde rotation variety
		}

		// Scientific Logarithmic sizing scale to maintain high visual fidelity on-screen
		size := 0.08 + math.Log10(top500[idx].DiameterKm+1.0)*0.1
		if size < 0.08 {
			size = 0.08
		}
		if size > 0.28 {
			size = 0.28
		}

		top500[idx].RingIndex = ringIndex
		top500[idx].Angle = angle
		top500[idx].OrbitSpeed = speed
		top500[idx].Size = size
	}

	topBytes, err := json.MarshalIndent(top500, "", "  ")
	if err != nil {
		fmt.Printf("Failed to marshal frontend sample: %v\n", err)
	} else {
		if err := os.WriteFile(frontendPath, topBytes, 0644); err != nil {
			fmt.Printf("Failed to write frontend cache: %v\n", err)
		} else {
			fmt.Printf("Saved top %d distance-clustered asteroids to frontend cache: %s\n", len(top500), frontendPath)
		}
	}
}
