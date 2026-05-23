package db

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
)

// InsertScenario saves a new market scenario
func (s *Store) InsertScenario(sc Scenario) error {
	if s.useMem {
		sc.CreatedAt = time.Now()
		s.memScenarios = append(s.memScenarios, sc)
		log.Printf("[DB-MEM] InsertScenario: id=%s desc=%q minerals=%v", sc.ID, sc.Description, sc.AffectedMinerals)
		return nil
	}
	q := `INSERT INTO market_scenarios (id, description, affected_minerals, severity, active, created_at)
		VALUES ($1,$2,$3,$4,TRUE,NOW())`
	_, err := s.pool.Exec(context.Background(), q,
		sc.ID, sc.Description, sc.AffectedMinerals, sc.Severity)
	if err != nil {
		log.Printf("[DB] InsertScenario ERROR: %v", err)
	}
	return err
}

// GetActiveScenarios returns all active (non-expired) scenarios
func (s *Store) GetActiveScenarios() ([]Scenario, error) {
	if s.useMem {
		var result []Scenario
		for _, sc := range s.memScenarios {
			if sc.Active {
				result = append(result, sc)
			}
		}
		log.Printf("[DB-MEM] GetActiveScenarios: %d active", len(result))
		return result, nil
	}
	q := `SELECT id, description, affected_minerals, severity, active, created_at
		FROM market_scenarios
		WHERE active=TRUE AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC`
	rows, err := s.pool.Query(context.Background(), q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Scenario
	for rows.Next() {
		var sc Scenario
		if err := rows.Scan(&sc.ID, &sc.Description, &sc.AffectedMinerals, &sc.Severity, &sc.Active, &sc.CreatedAt); err != nil {
			continue
		}
		result = append(result, sc)
	}
	log.Printf("[DB] GetActiveScenarios: %d active", len(result))
	return result, nil
}

// DeactivateScenario marks a scenario as inactive
func (s *Store) DeactivateScenario(id string) error {
	if s.useMem {
		for i, sc := range s.memScenarios {
			if sc.ID == id {
				s.memScenarios[i].Active = false
				log.Printf("[DB-MEM] DeactivateScenario: id=%s", id)
				return nil
			}
		}
		return pgx.ErrNoRows
	}
	q := `UPDATE market_scenarios SET active=FALSE WHERE id=$1`
	_, err := s.pool.Exec(context.Background(), q, id)
	if err != nil {
		log.Printf("[DB] DeactivateScenario ERROR: %v", err)
	}
	return err
}

// GetAllScenarios returns all scenarios (for API listing)
func (s *Store) GetAllScenarios() ([]Scenario, error) {
	if s.useMem {
		return s.memScenarios, nil
	}
	q := `SELECT id, description, affected_minerals, severity, active, created_at
		FROM market_scenarios ORDER BY created_at DESC`
	rows, err := s.pool.Query(context.Background(), q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []Scenario
	for rows.Next() {
		var sc Scenario
		rows.Scan(&sc.ID, &sc.Description, &sc.AffectedMinerals, &sc.Severity, &sc.Active, &sc.CreatedAt)
		result = append(result, sc)
	}
	return result, nil
}
