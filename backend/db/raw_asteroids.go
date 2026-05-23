package db

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"

	"github.com/jackc/pgx/v5"
)

// asteroidSeed is used only for sorting during the seed phase
type asteroidSeed struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	SpecType string  `json:"spec_type"`
	ValueUSD float64 `json:"valueUSD"` // matches the JSON tag in engine.Asteroid
}

// CountRawAsteroids returns how many raw asteroids are stored in the DB.
func (s *Store) CountRawAsteroids() (int, error) {
	if s.useMem {
		return 0, nil
	}
	var count int
	err := s.pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM raw_asteroids").Scan(&count)
	return count, err
}

// SeedAsteroidsJSON parses a full JSON array of asteroid records, sorts by value,
// and bulk-inserts the top `limit` records into raw_asteroids.
func (s *Store) SeedAsteroidsJSON(rawJSON []byte, limit int) error {
	if s.useMem {
		return nil
	}

	log.Printf("[DB] Seeding asteroids — parsing %d bytes of JSON", len(rawJSON))

	var rawItems []json.RawMessage
	if err := json.Unmarshal(rawJSON, &rawItems); err != nil {
		return fmt.Errorf("parse error: %w", err)
	}
	log.Printf("[DB] Parsed %d asteroid records", len(rawItems))

	type entry struct {
		raw  json.RawMessage
		meta asteroidSeed
	}

	entries := make([]entry, 0, len(rawItems))
	for _, item := range rawItems {
		var meta asteroidSeed
		if err := json.Unmarshal(item, &meta); err != nil || meta.ID == "" {
			continue
		}
		entries = append(entries, entry{item, meta})
	}

	// Sort by value descending and take top limit
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].meta.ValueUSD > entries[j].meta.ValueUSD
	})
	if len(entries) > limit {
		entries = entries[:limit]
	}
	log.Printf("[DB] Inserting top %d asteroids", len(entries))

	// Build rows for pgx CopyFrom
	rows := make([][]any, len(entries))
	for i, e := range entries {
		rows[i] = []any{e.meta.ID, e.meta.Name, e.meta.SpecType, e.meta.ValueUSD, string(e.raw)}
	}

	n, err := s.pool.CopyFrom(
		context.Background(),
		pgx.Identifier{"raw_asteroids"},
		[]string{"id", "name", "spec_type", "value_usd", "data"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("bulk insert error: %w", err)
	}

	log.Printf("[DB] Seeded %d asteroids to PostgreSQL", n)
	return nil
}

// GetAllRawAsteroidsJSON returns all stored asteroids as a JSON array,
// ordered by value_usd descending.
func (s *Store) GetAllRawAsteroidsJSON() ([]byte, error) {
	if s.useMem {
		return []byte("[]"), nil
	}

	dbRows, err := s.pool.Query(context.Background(),
		"SELECT data FROM raw_asteroids ORDER BY value_usd DESC")
	if err != nil {
		return nil, err
	}
	defer dbRows.Close()

	var records []json.RawMessage
	for dbRows.Next() {
		var data []byte
		if err := dbRows.Scan(&data); err != nil {
			continue
		}
		records = append(records, json.RawMessage(data))
	}

	return json.Marshal(records)
}
