package engine

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sort"

	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
)

const maxSeededAsteroids = 5000

// Engine wraps asteroid data loading and provides sorted views.
type Engine struct {
	asteroids []Asteroid
}

// NewEngine loads asteroids. When a DB store is provided it uses PostgreSQL
// (seeding from disk on first boot); otherwise it reads from disk directly.
func NewEngine(store *db.Store) *Engine {
	e := &Engine{}
	e.load(store)
	return e
}

func (e *Engine) load(store *db.Store) {
	// Try PostgreSQL first
	if store != nil {
		count, err := store.CountRawAsteroids()
		if err != nil {
			log.Printf("[ENGINE] DB count error: %v — falling back to disk", err)
		} else if count == 0 {
			log.Println("[ENGINE] raw_asteroids table empty — seeding from disk")
			e.seedToDB(store)
			count, _ = store.CountRawAsteroids()
		}

		if count > 0 {
			if data, err := store.GetAllRawAsteroidsJSON(); err == nil && len(data) > 2 {
				var asteroids []Asteroid
				if err := json.Unmarshal(data, &asteroids); err == nil && len(asteroids) > 0 {
					e.asteroids = asteroids
					log.Printf("[ENGINE] Loaded %d asteroids from PostgreSQL", len(asteroids))
					return
				}
				log.Printf("[ENGINE] DB unmarshal error: %v", err)
			} else {
				log.Printf("[ENGINE] DB read error: %v", err)
			}
		}
	}

	// Disk fallback
	e.loadFromDisk()
}

func (e *Engine) seedToDB(store *db.Store) {
	data, path := e.readDiskData()
	if data == nil {
		log.Println("[ENGINE] No disk data found to seed")
		return
	}
	log.Printf("[ENGINE] Seeding DB from %s", path)
	if err := store.SeedAsteroidsJSON(data, maxSeededAsteroids); err != nil {
		log.Printf("[ENGINE] Seed error: %v", err)
	}
}

func (e *Engine) loadFromDisk() {
	data, path := e.readDiskData()
	if data == nil {
		log.Println("[ENGINE] WARNING: No asteroid dataset found on disk or in DB")
		return
	}
	var asteroids []Asteroid
	if err := json.Unmarshal(data, &asteroids); err != nil {
		log.Printf("[ENGINE] Disk parse error: %v", err)
		return
	}
	e.asteroids = asteroids
	log.Printf("[ENGINE] Loaded %d asteroids from %s", len(asteroids), path)
}

func (e *Engine) readDiskData() ([]byte, string) {
	paths := []string{
		filepath.Join("backend", "data", "all_asteroids_processed.json"),
		filepath.Join("backend", "data", "processed_asteroids.json"),
		filepath.Join("frontend", "public", "data", "asteroids.json"),
	}
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err == nil {
			return data, path
		}
	}
	return nil, ""
}

// GetTop500 returns the top 500 asteroids sorted by estimated value.
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

// GetAll returns all loaded asteroids.
func (e *Engine) GetAll() []Asteroid {
	return e.asteroids
}

// GetByID finds a single asteroid by SPK-ID.
func (e *Engine) GetByID(id string) *Asteroid {
	for i := range e.asteroids {
		if e.asteroids[i].ID == id {
			return &e.asteroids[i]
		}
	}
	return nil
}

// Count returns the total number of loaded asteroids.
func (e *Engine) Count() int {
	return len(e.asteroids)
}
