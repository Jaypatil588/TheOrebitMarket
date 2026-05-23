package engine

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sort"
)

// Engine wraps asteroid data loading and provides sorted views
type Engine struct {
	asteroids []Asteroid
}

// NewEngine loads asteroids from disk
func NewEngine() *Engine {
	e := &Engine{}
	e.load()
	return e
}

func (e *Engine) load() {
	paths := []string{
		filepath.Join("backend", "data", "all_asteroids_processed.json"),
		filepath.Join("backend", "data", "processed_asteroids.json"),
		filepath.Join("frontend", "public", "data", "asteroids.json"),
	}
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var asteroids []Asteroid
		if err := json.Unmarshal(data, &asteroids); err != nil {
			continue
		}
		e.asteroids = asteroids
		log.Printf("[ENGINE] Loaded %d asteroids from %s", len(asteroids), path)
		return
	}
	log.Println("[ENGINE] WARNING: No asteroid dataset found")
}

// GetTop500 returns the top 500 asteroids sorted by estimated value
func (e *Engine) GetTop500() ([]Asteroid, error) {
	sorted := make([]Asteroid, len(e.asteroids))
	copy(sorted, e.asteroids)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].ValueUSD > sorted[j].ValueUSD
	})
	if len(sorted) > 500 {
		return sorted[:500], nil
	}
	return sorted, nil
}

// GetAll returns all loaded asteroids
func (e *Engine) GetAll() []Asteroid {
	return e.asteroids
}

// GetByID finds a single asteroid by SPK-ID
func (e *Engine) GetByID(id string) *Asteroid {
	for i := range e.asteroids {
		if e.asteroids[i].ID == id {
			return &e.asteroids[i]
		}
	}
	return nil
}

// Count returns total asteroid count
func (e *Engine) Count() int {
	return len(e.asteroids)
}
