package db

import (
	"context"
	"log"
	"time"
)

// InsertMarketPrice writes one price row to DB (or memory)
func (s *Store) InsertMarketPrice(p MarketPrice) error {
	if s.useMem {
		s.memPrices = append(s.memPrices, p)
		if len(s.memPrices) > 5000 {
			s.memPrices = s.memPrices[len(s.memPrices)-5000:]
		}
		log.Printf("[DB-MEM] InsertMarketPrice: mineral=%s price=%.4f urgency=%.3f", p.Mineral, p.PriceUSD, p.Urgency)
		return nil
	}

	q := `INSERT INTO market_prices
		(mineral, price_usd, trend, urgency, change_pct, disruption, source_url, category, criticality, scenario_adjusted, fetched_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`
	_, err := s.pool.Exec(context.Background(), q,
		p.Mineral, p.PriceUSD, p.Trend, p.Urgency, p.ChangePct,
		p.Disruption, p.SourceURL, p.Category, p.Criticality, p.ScenarioAdjusted)
	if err != nil {
		log.Printf("[DB] InsertMarketPrice ERROR: %v", err)
		return err
	}
	log.Printf("[DB] InsertMarketPrice: mineral=%s price=%.4f urgency=%.3f scenario=%v",
		p.Mineral, p.PriceUSD, p.Urgency, p.ScenarioAdjusted)
	return nil
}

// GetLatestPrices returns the most recent price row per mineral
func (s *Store) GetLatestPrices() ([]MarketPrice, error) {
	if s.useMem {
		latest := map[string]MarketPrice{}
		for _, p := range s.memPrices {
			if existing, ok := latest[p.Mineral]; !ok || p.FetchedAt.After(existing.FetchedAt) {
				latest[p.Mineral] = p
			}
		}
		result := make([]MarketPrice, 0, len(latest))
		for _, p := range latest {
			result = append(result, p)
		}
		log.Printf("[DB-MEM] GetLatestPrices: %d minerals", len(result))
		return result, nil
	}

	q := `SELECT DISTINCT ON (mineral)
		id, mineral, price_usd, trend, urgency, change_pct, disruption, source_url,
		category, criticality, scenario_adjusted, fetched_at
		FROM market_prices
		ORDER BY mineral, fetched_at DESC`

	rows, err := s.pool.Query(context.Background(), q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prices []MarketPrice
	for rows.Next() {
		var p MarketPrice
		err := rows.Scan(&p.ID, &p.Mineral, &p.PriceUSD, &p.Trend, &p.Urgency, &p.ChangePct,
			&p.Disruption, &p.SourceURL, &p.Category, &p.Criticality, &p.ScenarioAdjusted, &p.FetchedAt)
		if err != nil {
			log.Printf("[DB] GetLatestPrices scan error: %v", err)
			continue
		}
		prices = append(prices, p)
	}
	log.Printf("[DB] GetLatestPrices: %d minerals", len(prices))
	return prices, nil
}

// GetLatestPriceMap returns mineral → price_usd map for valuation calculations
func (s *Store) GetLatestPriceMap() (map[string]float64, error) {
	prices, err := s.GetLatestPrices()
	if err != nil {
		return nil, err
	}
	m := make(map[string]float64)
	for _, p := range prices {
		m[p.Mineral] = p.PriceUSD
	}
	return m, nil
}

// GetLatestUrgencyMap returns mineral → urgency map
func (s *Store) GetLatestUrgencyMap() (map[string]float64, error) {
	prices, err := s.GetLatestPrices()
	if err != nil {
		return nil, err
	}
	m := make(map[string]float64)
	for _, p := range prices {
		m[p.Mineral] = p.Urgency
	}
	return m, nil
}

// CountRecentPrices counts rows inserted in the last N seconds (for tests)
func (s *Store) CountRecentPrices(window time.Duration) (int, error) {
	if s.useMem {
		cutoff := time.Now().Add(-window)
		count := 0
		for _, p := range s.memPrices {
			if p.FetchedAt.After(cutoff) {
				count++
			}
		}
		return count, nil
	}
	var count int
	err := s.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM market_prices WHERE fetched_at > NOW() - $1::interval`,
		window.String()).Scan(&count)
	return count, err
}

// CountDistinctMineralsRecent returns how many distinct minerals were written in last cycle
func (s *Store) CountDistinctMineralsRecent(window time.Duration) (int, error) {
	if s.useMem {
		cutoff := time.Now().Add(-window)
		seen := map[string]bool{}
		for _, p := range s.memPrices {
			if p.FetchedAt.After(cutoff) {
				seen[p.Mineral] = true
			}
		}
		return len(seen), nil
	}
	var count int
	err := s.pool.QueryRow(context.Background(),
		`SELECT COUNT(DISTINCT mineral) FROM market_prices WHERE fetched_at > NOW() - $1::interval`,
		window.String()).Scan(&count)
	return count, err
}
