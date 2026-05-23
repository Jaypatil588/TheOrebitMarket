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
	fmt.Println("Initializing NASA JPL SBDB Asteroid Data fetch in Go...")

	// 1. Configure the API call parameters
	fields := []string{"spkid", "full_name", "name", "e", "a", "i", "moid", "class", "diameter", "spec_B", "spec_T"}
	fieldsStr := strings.Join(fields, ",")

	cdata := map[string][]string{
		"AND": {"diameter|DF"},
	}
	cdataBytes, _ := json.Marshal(cdata)
	cdataStr := string(cdataBytes)

	params := url.Values{}
	params.Set("sb-group", "neo")
	params.Set("fields", fieldsStr)
	params.Set("sb-cdata", cdataStr)

	apiURL := fmt.Sprintf("https://ssd-api.jpl.nasa.gov/sbdb_query.api?%s", params.Encode())
	fmt.Printf("Querying URL: %s\n", apiURL)

	// 2. Perform the HTTP Request
	client := &http.Client{}
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		fmt.Printf("Failed to create request: %v\n", err)
		os.Exit(1)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (AstroHedge Data Acquisition Agent)")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("HTTP Request failed: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("API returned non-200 status code: %d\n", resp.StatusCode)
		os.Exit(1)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Failed to read response body: %v\n", err)
		os.Exit(1)
	}

	// 3. Create necessary folders
	os.MkdirAll(filepath.Join("backend", "data"), 0755)

	// Save raw response
	rawPath := filepath.Join("backend", "data", "raw_asteroids.json")
	if err := os.WriteFile(rawPath, body, 0644); err != nil {
		fmt.Printf("Warning: Failed to save raw file: %v\n", err)
	} else {
		fmt.Printf("Successfully saved raw data to %s\n", rawPath)
	}

	// 4. Parse the payload
	var jplPayload JPLResponse
	if err := json.Unmarshal(body, &jplPayload); err != nil {
		fmt.Printf("JSON Unmarshal of payload failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Processing %d raw asteroid entries...\n", len(jplPayload.Data))

	// Map fields to index
	fieldIdx := make(map[string]int)
	for i, f := range jplPayload.Fields {
		fieldIdx[f] = i
	}

	var processedList []engine.Asteroid

	for _, row := range jplPayload.Data {
		// Map SPKID
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

		diameter := engine.ParseFloatSafe(row[fieldIdx["diameter"]])
		specType := engine.SanitizeSpecType(row[fieldIdx["spec_B"]], row[fieldIdx["spec_T"]])

		// 5. Deterministic Engine Calculations
		mass := engine.EstimateMass(diameter, specType)
		comp := engine.CalculateComposition(spkid, specType)
		valueUSD := engine.CalculateValueUSD(mass, comp)

		// Format values safely
		mass = math.Round(mass*100) / 100

		ast := engine.Asteroid{
			ID:         spkid,
			Name:       name,
			FullName:   fullName,
			Class:      class,
			DiameterKm: math.Round(diameter*10000) / 10000,
			MassKg:     mass,
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

		processedList = append(processedList, ast)
	}

	// 6. Sort by valuation descending
	sort.Slice(processedList, func(i, j int) bool {
		return processedList[i].ValueUSD > processedList[j].ValueUSD
	})

	// Save processed dataset
	processedPath := filepath.Join("backend", "data", "processed_asteroids.json")
	processedBytes, err := json.MarshalIndent(processedList, "", "  ")
	if err != nil {
		fmt.Printf("Failed to marshal processed data: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(processedPath, processedBytes, 0644); err != nil {
		fmt.Printf("Failed to write processed file: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Successfully processed and saved %d asteroids to %s\n", len(processedList), processedPath)

	// Save Top 100 sample to Frontend
	os.MkdirAll(filepath.Join("frontend", "public", "data"), 0755)
	frontendPath := filepath.Join("frontend", "public", "data", "asteroids.json")
	
	limit := 100
	if len(processedList) < limit {
		limit = len(processedList)
	}
	topList := processedList[:limit]
	topBytes, err := json.MarshalIndent(topList, "", "  ")
	if err != nil {
		fmt.Printf("Failed to marshal frontend sample: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(frontendPath, topBytes, 0644); err != nil {
		fmt.Printf("Failed to write frontend cache: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Saved top %d high-value asteroids to frontend: %s\n", limit, frontendPath)
}
