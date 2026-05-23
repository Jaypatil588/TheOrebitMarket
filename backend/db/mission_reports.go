package db

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

const MissionReportCacheTTL = 1 * time.Hour

// UpsertMissionReport saves (or replaces) a mission report for asteroid+route
func (s *Store) UpsertMissionReport(r MissionReport) error {
	if s.useMem {
		key := r.AsteroidID + "|" + r.RouteID
		r.GeneratedAt = time.Now()
		s.memReports[key] = r
		log.Printf("[DB-MEM] UpsertMissionReport: asteroid=%s route=%s images=%v",
			r.AsteroidID, r.RouteID, len(r.AsteroidRender) > 0)
		return nil
	}

	reportJSON, _ := json.Marshal(r.Report)
	q := `INSERT INTO mission_reports
		(asteroid_id, route_id, report, asteroid_render, composition_map, route_map, physical_profile, generated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
		ON CONFLICT (asteroid_id, route_id) DO UPDATE SET
			report=EXCLUDED.report,
			asteroid_render=EXCLUDED.asteroid_render,
			composition_map=EXCLUDED.composition_map,
			route_map=EXCLUDED.route_map,
			physical_profile=EXCLUDED.physical_profile,
			generated_at=NOW()`
	_, err := s.pool.Exec(context.Background(), q,
		r.AsteroidID, r.RouteID, reportJSON,
		r.AsteroidRender, r.CompositionMap, r.RouteMap, r.PhysicalProfile)
	if err != nil {
		log.Printf("[DB] UpsertMissionReport ERROR: %v", err)
		return err
	}
	log.Printf("[DB] UpsertMissionReport: asteroid=%s route=%s", r.AsteroidID, r.RouteID)
	return nil
}

// GetMissionReport fetches a cached report if it exists and is within TTL
func (s *Store) GetMissionReport(asteroidID, routeID string) (*MissionReport, error) {
	if s.useMem {
		key := asteroidID + "|" + routeID
		if r, ok := s.memReports[key]; ok {
			if time.Since(r.GeneratedAt) < MissionReportCacheTTL {
				log.Printf("[DB-MEM] GetMissionReport: CACHE HIT asteroid=%s age=%s",
					asteroidID, time.Since(r.GeneratedAt).Round(time.Second))
				return &r, nil
			}
			log.Printf("[DB-MEM] GetMissionReport: CACHE STALE asteroid=%s", asteroidID)
		}
		return nil, fmt.Errorf("not found")
	}

	q := `SELECT id, asteroid_id, route_id, report, asteroid_render, composition_map,
		route_map, physical_profile, generated_at
		FROM mission_reports
		WHERE asteroid_id=$1 AND route_id=$2 AND generated_at > NOW() - INTERVAL '1 hour'`
	row := s.pool.QueryRow(context.Background(), q, asteroidID, routeID)
	var r MissionReport
	var reportRaw []byte
	err := row.Scan(&r.ID, &r.AsteroidID, &r.RouteID, &reportRaw,
		&r.AsteroidRender, &r.CompositionMap, &r.RouteMap, &r.PhysicalProfile, &r.GeneratedAt)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(reportRaw, &r.Report)
	log.Printf("[DB] GetMissionReport: CACHE HIT asteroid=%s age=%s",
		asteroidID, time.Since(r.GeneratedAt).Round(time.Second))
	return &r, nil
}

// GetLatestMissionReport returns the most recently generated report (for tests)
func (s *Store) GetLatestMissionReport() (*MissionReport, error) {
	if s.useMem {
		var latest *MissionReport
		for _, r := range s.memReports {
			rc := r
			if latest == nil || r.GeneratedAt.After(latest.GeneratedAt) {
				latest = &rc
			}
		}
		return latest, nil
	}
	q := `SELECT id, asteroid_id, route_id, report, asteroid_render, composition_map,
		route_map, physical_profile, generated_at
		FROM mission_reports ORDER BY generated_at DESC LIMIT 1`
	row := s.pool.QueryRow(context.Background(), q)
	var r MissionReport
	var reportRaw []byte
	err := row.Scan(&r.ID, &r.AsteroidID, &r.RouteID, &reportRaw,
		&r.AsteroidRender, &r.CompositionMap, &r.RouteMap, &r.PhysicalProfile, &r.GeneratedAt)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(reportRaw, &r.Report)
	return &r, nil
}
