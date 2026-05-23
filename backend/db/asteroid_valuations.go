package db

import (
	"context"
	"encoding/json"
	"log"
	"time"
)

// UpsertAsteroidValuation inserts or updates an asteroid valuation record
func (s *Store) UpsertAsteroidValuation(v AsteroidValuation) error {
	if s.useMem {
		v.ComputedAt = time.Now()
		s.memAsteroids[v.ID] = v
		log.Printf("[DB-MEM] UpsertValuation: id=%s name=%s spec=%s", v.ID, v.Name, v.SpecType)
		return nil
	}

	compJSON, _ := json.Marshal(v.Composition)
	valJSON, _ := json.Marshal(v.Valuation)
	orbJSON, _ := json.Marshal(v.Orbital)
	riskJSON, _ := json.Marshal(v.Risk)
	snapJSON, _ := json.Marshal(v.PricesSnapshot)

	q := `INSERT INTO asteroid_valuations
		(id, name, spec_type, diameter_km, mass_kg, composition, valuation, orbital, risk,
		 research_summary, prices_snapshot, scenario_impact, computed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
		ON CONFLICT (id) DO UPDATE SET
			name=EXCLUDED.name, spec_type=EXCLUDED.spec_type,
			diameter_km=EXCLUDED.diameter_km, mass_kg=EXCLUDED.mass_kg,
			composition=EXCLUDED.composition, valuation=EXCLUDED.valuation,
			orbital=EXCLUDED.orbital, risk=EXCLUDED.risk,
			research_summary=EXCLUDED.research_summary,
			prices_snapshot=EXCLUDED.prices_snapshot,
			scenario_impact=EXCLUDED.scenario_impact,
			computed_at=NOW()`

	_, err := s.pool.Exec(context.Background(), q,
		v.ID, v.Name, v.SpecType, v.DiameterKm, v.MassKg,
		compJSON, valJSON, orbJSON, riskJSON,
		v.ResearchSummary, snapJSON, v.ScenarioImpact)
	if err != nil {
		log.Printf("[DB] UpsertValuation ERROR id=%s: %v", v.ID, err)
		return err
	}
	log.Printf("[DB] UpsertValuation: id=%s name=%s scenario_impact=%.1f%%", v.ID, v.Name, v.ScenarioImpact)
	return nil
}

// GetAsteroidValuation fetches a single asteroid by ID
func (s *Store) GetAsteroidValuation(id string) (*AsteroidValuation, error) {
	if s.useMem {
		if v, ok := s.memAsteroids[id]; ok {
			log.Printf("[DB-MEM] GetAsteroidValuation: id=%s found", id)
			return &v, nil
		}
		return nil, nil
	}

	q := `SELECT id, name, spec_type, diameter_km, mass_kg, composition, valuation, orbital, risk,
		research_summary, prices_snapshot, scenario_impact, computed_at
		FROM asteroid_valuations WHERE id=$1`

	row := s.pool.QueryRow(context.Background(), q, id)
	var v AsteroidValuation
	var compRaw, valRaw, orbRaw, riskRaw, snapRaw []byte
	err := row.Scan(&v.ID, &v.Name, &v.SpecType, &v.DiameterKm, &v.MassKg,
		&compRaw, &valRaw, &orbRaw, &riskRaw,
		&v.ResearchSummary, &snapRaw, &v.ScenarioImpact, &v.ComputedAt)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(compRaw, &v.Composition)
	json.Unmarshal(valRaw, &v.Valuation)
	json.Unmarshal(orbRaw, &v.Orbital)
	json.Unmarshal(riskRaw, &v.Risk)
	json.Unmarshal(snapRaw, &v.PricesSnapshot)

	log.Printf("[DB] GetAsteroidValuation: id=%s name=%s", v.ID, v.Name)
	return &v, nil
}

// GetAllAsteroidValuations returns all valuations ordered by net_value desc
func (s *Store) GetAllAsteroidValuations() ([]AsteroidValuation, error) {
	if s.useMem {
		result := make([]AsteroidValuation, 0, len(s.memAsteroids))
		for _, v := range s.memAsteroids {
			result = append(result, v)
		}
		log.Printf("[DB-MEM] GetAllAsteroidValuations: %d records", len(result))
		return result, nil
	}

	q := `SELECT id, name, spec_type, diameter_km, mass_kg, composition, valuation, orbital, risk,
		research_summary, prices_snapshot, scenario_impact, computed_at
		FROM asteroid_valuations
		ORDER BY (valuation->>'net_value_usd')::numeric DESC NULLS LAST`

	rows, err := s.pool.Query(context.Background(), q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []AsteroidValuation
	for rows.Next() {
		var v AsteroidValuation
		var compRaw, valRaw, orbRaw, riskRaw, snapRaw []byte
		if err := rows.Scan(&v.ID, &v.Name, &v.SpecType, &v.DiameterKm, &v.MassKg,
			&compRaw, &valRaw, &orbRaw, &riskRaw,
			&v.ResearchSummary, &snapRaw, &v.ScenarioImpact, &v.ComputedAt); err != nil {
			continue
		}
		json.Unmarshal(compRaw, &v.Composition)
		json.Unmarshal(valRaw, &v.Valuation)
		json.Unmarshal(orbRaw, &v.Orbital)
		json.Unmarshal(riskRaw, &v.Risk)
		json.Unmarshal(snapRaw, &v.PricesSnapshot)
		result = append(result, v)
	}
	log.Printf("[DB] GetAllAsteroidValuations: %d records", len(result))
	return result, nil
}

// CountAsteroidValuations returns total count (for tests)
func (s *Store) CountAsteroidValuations() (int, error) {
	if s.useMem {
		return len(s.memAsteroids), nil
	}
	var count int
	err := s.pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM asteroid_valuations`).Scan(&count)
	return count, err
}
