package db

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Store holds the DB connection pool and in-memory fallback state
type Store struct {
	pool    *pgxpool.Pool
	useMem  bool

	// In-memory fallback stores
	memPrices    []MarketPrice
	memAsteroids map[string]AsteroidValuation
	memRankings  []StrategicRanking
	memReports   map[string]MissionReport
	memScenarios []Scenario
}

// New creates a Store. If DATABASE_URL is not set or connection fails, falls back to in-memory.
func New() *Store {
	s := &Store{
		memAsteroids: make(map[string]AsteroidValuation),
		memReports:   make(map[string]MissionReport),
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("[DB] DATABASE_URL not set — using in-memory storage (no persistence)")
		s.useMem = true
		return s
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Printf("[DB] Connection failed: %v — using in-memory storage", err)
		s.useMem = true
		return s
	}

	if err := pool.Ping(context.Background()); err != nil {
		log.Printf("[DB] Ping failed: %v — using in-memory storage", err)
		s.useMem = true
		return s
	}

	s.pool = pool
	log.Printf("[DB] Connected to PostgreSQL: %s", dbURL)

	if err := s.migrate(); err != nil {
		log.Printf("[DB] Migration failed: %v — using in-memory storage", err)
		s.useMem = true
		s.pool.Close()
		s.pool = nil
	}

	return s
}

func (s *Store) migrate() error {
	log.Println("[DB] Running migrations")
	queries := []string{
		`CREATE TABLE IF NOT EXISTS market_prices (
			id          SERIAL PRIMARY KEY,
			mineral     TEXT NOT NULL,
			price_usd   NUMERIC(20,6) NOT NULL,
			trend       TEXT,
			urgency     NUMERIC(5,4),
			change_pct  NUMERIC(8,4),
			disruption  TEXT,
			source_url  TEXT,
			category    TEXT,
			criticality INT,
			scenario_adjusted BOOLEAN DEFAULT FALSE,
			fetched_at  TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_market_mineral_time ON market_prices(mineral, fetched_at DESC)`,
		`CREATE TABLE IF NOT EXISTS asteroid_valuations (
			id               TEXT PRIMARY KEY,
			name             TEXT NOT NULL,
			spec_type        TEXT,
			diameter_km      NUMERIC(12,4),
			mass_kg          NUMERIC(30,4),
			composition      JSONB,
			valuation        JSONB,
			orbital          JSONB,
			risk             JSONB,
			research_summary TEXT,
			prices_snapshot  JSONB,
			scenario_impact  NUMERIC(8,4) DEFAULT 0,
			computed_at      TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS strategic_rankings (
			id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			rankings     JSONB NOT NULL,
			routes       JSONB NOT NULL,
			urgency_map  JSONB,
			generated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS mission_reports (
			id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			asteroid_id      TEXT NOT NULL,
			route_id         TEXT,
			report           JSONB NOT NULL,
			asteroid_render  TEXT,
			composition_map  TEXT,
			route_map        TEXT,
			physical_profile TEXT,
			generated_at     TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(asteroid_id, route_id)
		)`,
		`CREATE TABLE IF NOT EXISTS market_scenarios (
			id                TEXT PRIMARY KEY,
			description       TEXT NOT NULL,
			affected_minerals TEXT[],
			severity          NUMERIC(4,3) DEFAULT 0.9,
			active            BOOLEAN DEFAULT TRUE,
			created_at        TIMESTAMPTZ DEFAULT NOW(),
			expires_at        TIMESTAMPTZ
		)`,
		// Raw asteroid records — seeded from disk JSON on first boot
		`CREATE TABLE IF NOT EXISTS raw_asteroids (
			id        TEXT PRIMARY KEY,
			name      TEXT,
			spec_type TEXT,
			value_usd NUMERIC(30,2),
			data      JSONB NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_raw_asteroids_value ON raw_asteroids(value_usd DESC)`,
	}

	for _, q := range queries {
		if _, err := s.pool.Exec(context.Background(), q); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	log.Println("[DB] Migrations complete")
	return nil
}

func (s *Store) Close() {
	if s.pool != nil {
		s.pool.Close()
		log.Println("[DB] Connection pool closed")
	}
}
