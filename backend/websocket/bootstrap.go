package websocket

import (
	"encoding/json"
	"log"

	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
)

// PushDBSnapshot sends latest prices and rankings from Postgres/memory to one client.
func PushDBSnapshot(store *db.Store, client *Client) {
	if store == nil || client == nil {
		return
	}

	prices, err := store.GetLatestPrices()
	if err != nil {
		log.Printf("[WS] Bootstrap prices error: %v", err)
	} else if len(prices) > 0 {
		payload, err := json.Marshal(map[string]interface{}{
			"type":   "market_update",
			"prices": prices,
		})
		if err == nil {
			select {
			case client.send <- payload:
				log.Printf("[WS] Bootstrap sent %d prices to new client", len(prices))
			default:
				log.Println("[WS] Bootstrap prices dropped — client send buffer full")
			}
		}
	}

	ranking, err := store.GetLatestStrategicRanking()
	if err != nil {
		log.Printf("[WS] Bootstrap rankings error: %v", err)
	} else if ranking != nil && len(ranking.Rankings) > 0 {
		payload, err := json.Marshal(map[string]interface{}{
			"type":     "rankings_update",
			"rankings": ranking.Rankings,
			"routes":   ranking.Routes,
		})
		if err == nil {
			select {
			case client.send <- payload:
				log.Printf("[WS] Bootstrap sent %d rankings, %d routes to new client",
					len(ranking.Rankings), len(ranking.Routes))
			default:
				log.Println("[WS] Bootstrap rankings dropped — client send buffer full")
			}
		}
	}
}
