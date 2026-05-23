package gemini

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

const (
	AgentAntigravity  = "antigravity-preview-05-2026"
	AgentDeepResearch = "deep-research-preview-05-2026"
	BaseURL           = "https://generativelanguage.googleapis.com/v1beta/interactions"
	FallbackURL       = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
)

// Client wraps the Gemini Interactions API
type Client struct {
	APIKey string
	HTTP   *http.Client
}

// InteractionRequest is the body sent to the Interactions API
type InteractionRequest struct {
	Agent             string `json:"agent"`
	Input             string `json:"input"`
	SystemInstruction string `json:"systemInstruction"`
	Environment       string `json:"environment"`
}

// InteractionResponse is what comes back
type InteractionResponse struct {
	OutputText string `json:"outputText"`
	SessionID  string `json:"sessionId"`
	Usage      struct {
		InputTokens  int `json:"inputTokens"`
		OutputTokens int `json:"outputTokens"`
	} `json:"usage"`
}

// FallbackRequest is for standard Gemini generateContent (used if managed agents endpoint unavailable)
type FallbackRequest struct {
	SystemInstruction struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"systemInstruction"`
	Contents []struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"contents"`
	GenerationConfig struct {
		Temperature     float64 `json:"temperature"`
		MaxOutputTokens int     `json:"maxOutputTokens"`
	} `json:"generationConfig"`
}

type FallbackResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

// NewClient creates a Gemini API client
func NewClient(apiKey string) *Client {
	return &Client{
		APIKey: apiKey,
		HTTP:   &http.Client{Timeout: 300 * time.Second},
	}
}

// Interact calls the Gemini Managed Agents Interactions API.
// Falls back to standard Gemini generateContent if the managed agents endpoint fails.
func (c *Client) Interact(agentType, systemInstruction, input string) (*InteractionResponse, error) {
	log.Printf("[GEMINI] ── Interact call ─────────────────────────────────────")
	log.Printf("[GEMINI] agent=%s input_len=%d system_len=%d", agentType, len(input), len(systemInstruction))

	// Try managed agents Interactions API first
	result, err := c.callInteractionsAPI(agentType, systemInstruction, input)
	if err != nil {
		log.Printf("[GEMINI] Interactions API failed: %v — falling back to generateContent", err)
		result, err = c.callFallback(systemInstruction, input)
		if err != nil {
			return nil, fmt.Errorf("both managed agents and fallback failed: %w", err)
		}
		log.Printf("[GEMINI] Fallback succeeded")
	}

	log.Printf("[GEMINI] Response: session=%s tokens_in=%d tokens_out=%d output_len=%d",
		result.SessionID, result.Usage.InputTokens, result.Usage.OutputTokens, len(result.OutputText))
	log.Printf("[GEMINI] Raw output (first 300 chars): %.300s", result.OutputText)
	return result, nil
}

func (c *Client) callInteractionsAPI(agentType, systemInstruction, input string) (*InteractionResponse, error) {
	reqBody := InteractionRequest{
		Agent:             agentType,
		Input:             input,
		SystemInstruction: systemInstruction,
		Environment:       "remote",
	}
	body, _ := json.Marshal(reqBody)

	url := BaseURL + "?key=" + c.APIKey
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	log.Printf("[GEMINI] POST %s", BaseURL)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	log.Printf("[GEMINI] HTTP %d | body_len=%d", resp.StatusCode, len(respBytes))

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBytes[:min(200, len(respBytes))]))
	}

	var result InteractionResponse
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	return &result, nil
}

func (c *Client) callFallback(systemInstruction, input string) (*InteractionResponse, error) {
	var req FallbackRequest
	req.SystemInstruction.Parts = []struct {
		Text string `json:"text"`
	}{{Text: systemInstruction}}
	req.Contents = []struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	}{{Parts: []struct {
		Text string `json:"text"`
	}{{Text: input}}}}
	req.GenerationConfig.Temperature = 0.3
	req.GenerationConfig.MaxOutputTokens = 8192

	body, _ := json.Marshal(req)
	url := FallbackURL + "?key=" + c.APIKey
	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	log.Printf("[GEMINI] Fallback POST %s", FallbackURL)
	resp, err := c.HTTP.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	log.Printf("[GEMINI] Fallback HTTP %d", resp.StatusCode)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fallback HTTP %d: %s", resp.StatusCode, string(respBytes[:min(200, len(respBytes))]))
	}

	var fr FallbackResponse
	if err := json.Unmarshal(respBytes, &fr); err != nil {
		return nil, fmt.Errorf("fallback unmarshal: %w", err)
	}
	if len(fr.Candidates) == 0 || len(fr.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("fallback: empty response")
	}

	return &InteractionResponse{
		OutputText: fr.Candidates[0].Content.Parts[0].Text,
	}, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
