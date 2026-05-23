package agents

import (
	"math/rand"
	"time"
)

// LogEntry matches the frontend interface for dynamic logs
type LogEntry struct {
	ID        string      `json:"id"`
	Timestamp string      `json:"timestamp"`
	Type      string      `json:"type"` // "info" | "success" | "warning" | "error" | "telemetry" | "discovery"
	AgentID   string      `json:"agentId"`
	Message   string      `json:"message"`
	Meta      interface{} `json:"meta,omitempty"`
}

// GenerateRandomID yields a simple alphanumeric random string
func GenerateRandomID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, 8)
	for i := range result {
		result[i] = chars[rand.Intn(len(chars))]
	}
	return string(result)
}

// FormatTime formats a time to match telemetry format (HH:MM:SS)
func FormatTime(t time.Time) string {
	return t.Format("15:04:05")
}
