package db

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
)

// InsertStrategicRanking saves a new ranking run
func (s *Store) InsertStrategicRanking(r StrategicRanking) error {
	if s.useMem {
		r.GeneratedAt = time.Now()
		s.memRankings = append(s.memRankings, r)
		log.Printf("[DB-MEM] InsertRanking: %d rankings, %d routes", len(r.Rankings), len(r.Routes))
		return nil
	}

	rankJSON, _ := json.Marshal(r.Rankings)
	routesJSON, _ := json.Marshal(r.Routes)
	urgencyJSON, _ := json.Marshal(r.UrgencyMap)

	q := `INSERT INTO strategic_rankings (rankings, routes, urgency_map, generated_at)
		VALUES ($1,$2,$3,NOW())`
	_, err := s.pool.Exec(context.Background(), q, rankJSON, routesJSON, urgencyJSON)
	if err != nil {
		log.Printf("[DB] InsertRanking ERROR: %v", err)
		return err
	}
	log.Printf("[DB] InsertRanking: %d rankings, %d routes", len(r.Rankings), len(r.Routes))
	return nil
}

// GetLatestStrategicRanking returns the most recent ranking run
func (s *Store) GetLatestStrategicRanking() (*StrategicRanking, error) {
	if s.useMem {
		if len(s.memRankings) == 0 {
			return nil, nil
		}
		r := s.memRankings[len(s.memRankings)-1]
		log.Printf("[DB-MEM] GetLatestRanking: %d rankings", len(r.Rankings))
		return &r, nil
	}

	q := `SELECT id, rankings, routes, urgency_map, generated_at
		FROM strategic_rankings ORDER BY generated_at DESC LIMIT 1`

	row := s.pool.QueryRow(context.Background(), q)
	var r StrategicRanking
	var rankRaw, routesRaw, urgencyRaw []byte
	err := row.Scan(&r.ID, &rankRaw, &routesRaw, &urgencyRaw, &r.GeneratedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	json.Unmarshal(rankRaw, &r.Rankings)
	json.Unmarshal(routesRaw, &r.Routes)
	json.Unmarshal(urgencyRaw, &r.UrgencyMap)

	log.Printf("[DB] GetLatestRanking: %d rankings %d routes", len(r.Rankings), len(r.Routes))
	return &r, nil
}

// CountRankingRuns returns total runs stored (for tests)
func (s *Store) CountRankingRuns() (int, error) {
	if s.useMem {
		return len(s.memRankings), nil
	}
	var count int
	err := s.pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM strategic_rankings`).Scan(&count)
	return count, err
}
