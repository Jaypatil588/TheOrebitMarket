package gemini

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
)

const (
	BaseURL           = "https://generativelanguage.googleapis.com/v1beta/interactions"
	ImageGenURL       = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict"
	Model             = "gemini-3.5-flash"
	AgentAntigravity  = "antigravity"
	AgentDeepResearch = "deep-research-preview-04-2026"
)

// Client wraps the Gemini Interactions API
type Client struct {
	APIKey string
	HTTP   *http.Client
}

// syncRequest is for model-based agents (e.g. gemini-3.5-flash) — returns immediately
type syncRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

// asyncRequest is for background agents (e.g. deep-research) — returns an interaction ID to poll
type asyncRequest struct {
	Agent      string `json:"agent"`
	Input      string `json:"input"`
	Background bool   `json:"background"`
}

// asyncStartResponse is the initial response from a background interaction
type asyncStartResponse struct {
	ID string `json:"id"`
}

// asyncPollResponse is returned by GET /interactions/{id}
type asyncPollResponse struct {
	ID         string `json:"id"`
	Status     string `json:"status"` // "completed", "failed", running states
	OutputText string `json:"output_text"`
	Error      string `json:"error"`
}

// InteractionResponse is the unified result returned to callers
type InteractionResponse struct {
	OutputText string `json:"output_text"`
	SessionID  string `json:"session_id"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

// NewClient creates a Gemini API client
func NewClient(apiKey string) *Client {
	return &Client{
		APIKey: apiKey,
		HTTP:   &http.Client{Timeout: 120 * time.Second},
	}
}

// Interact dispatches to the correct interaction pattern based on agentType.
// AgentDeepResearch uses background polling; all others use synchronous model inference.
func (c *Client) Interact(agentType, systemInstruction, input string) (*InteractionResponse, error) {
	log.Printf("[GEMINI] ── Interact call ─────────────────────────────────────")

	combinedInput := input
	if systemInstruction != "" {
		combinedInput = systemInstruction + "\n\n" + input
	}

	if agentType == AgentDeepResearch {
		return c.interactAsync(agentType, combinedInput)
	}
	return c.interactSync(combinedInput)
}

// interactSync calls the Interactions API with a model and waits for the response.
func (c *Client) interactSync(input string) (*InteractionResponse, error) {
	log.Printf("[GEMINI] mode=sync model=%s input_len=%d", Model, len(input))

	body, _ := json.Marshal(syncRequest{Model: Model, Input: input})
	respBytes, err := c.post(BaseURL, body)
	if err != nil {
		return nil, err
	}

	var result InteractionResponse
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	log.Printf("[GEMINI] sync done | output_len=%d", len(result.OutputText))
	log.Printf("[GEMINI] Raw output (first 300 chars): %.300s", result.OutputText)
	return &result, nil
}

// interactAsync starts a background interaction and polls until completed or failed.
func (c *Client) interactAsync(agent, input string) (*InteractionResponse, error) {
	log.Printf("[GEMINI] mode=async agent=%s input_len=%d", agent, len(input))

	body, _ := json.Marshal(asyncRequest{Agent: agent, Input: input, Background: true})
	startBytes, err := c.post(BaseURL, body)
	if err != nil {
		return nil, err
	}

	var start asyncStartResponse
	if err := json.Unmarshal(startBytes, &start); err != nil {
		return nil, fmt.Errorf("unmarshal start: %w", err)
	}
	log.Printf("[GEMINI] async started | id=%s", start.ID)

	for {
		time.Sleep(10 * time.Second)

		pollURL := BaseURL + "/" + start.ID + "?key=" + c.APIKey
		req, err := http.NewRequest("GET", pollURL, nil)
		if err != nil {
			return nil, err
		}

		resp, err := c.HTTP.Do(req)
		if err != nil {
			return nil, err
		}
		pollBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != 200 {
			return nil, fmt.Errorf("poll HTTP %d: %s", resp.StatusCode, string(pollBytes[:min(200, len(pollBytes))]))
		}

		var poll asyncPollResponse
		if err := json.Unmarshal(pollBytes, &poll); err != nil {
			return nil, fmt.Errorf("poll unmarshal: %w", err)
		}

		log.Printf("[GEMINI] async poll | id=%s status=%s", poll.ID, poll.Status)

		switch poll.Status {
		case "completed":
			log.Printf("[GEMINI] async done | output_len=%d", len(poll.OutputText))
			log.Printf("[GEMINI] Raw output (first 300 chars): %.300s", poll.OutputText)
			return &InteractionResponse{OutputText: poll.OutputText}, nil
		case "failed":
			return nil, fmt.Errorf("deep-research failed: %s", poll.Error)
		}
	}
}

// post is a helper that POSTs JSON and returns the response body.
func (c *Client) post(url string, body []byte) ([]byte, error) {
	fullURL := url + "?key=" + c.APIKey
	req, err := http.NewRequest("POST", fullURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	log.Printf("[GEMINI] POST %s", url)
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
	return respBytes, nil
}

// ImageGenRequest is the request body for Imagen 3 image generation
type ImageGenRequest struct {
	Instances  []ImageGenInstance `json:"instances"`
	Parameters ImageGenParams     `json:"parameters"`
}

type ImageGenInstance struct {
	Prompt string `json:"prompt"`
}

type ImageGenParams struct {
	SampleCount          int    `json:"sampleCount"`
	AspectRatio          string `json:"aspectRatio,omitempty"`
	SafetyFilterLevel    string `json:"safetyFilterLevel,omitempty"`
	PersonGeneration     string `json:"personGeneration,omitempty"`
	IncludeSafetyAttrs   bool   `json:"includeSafetyAttributes,omitempty"`
	IncludeRAIReason     bool   `json:"includeRaiReason,omitempty"`
	OutputMimeType       string `json:"outputMimeType,omitempty"`
	OutputCompressionQuality int `json:"outputCompressionQuality,omitempty"`
}

type ImageGenResponse struct {
	Predictions []ImagePrediction `json:"predictions"`
}

type ImagePrediction struct {
	BytesBase64Encoded string `json:"bytesBase64Encoded"`
	MimeType           string `json:"mimeType"`
}

// GenerateImage creates an image using Imagen 3 and returns base64 encoded data
func (c *Client) GenerateImage(prompt string) (string, error) {
	log.Printf("[GEMINI] ── GenerateImage call ──────────────────────────────────")
	log.Printf("[GEMINI] prompt_len=%d", len(prompt))

	req := ImageGenRequest{
		Instances: []ImageGenInstance{{Prompt: prompt}},
		Parameters: ImageGenParams{
			SampleCount:            1,
			AspectRatio:            "1:1",
			SafetyFilterLevel:      "block_medium_and_above",
			PersonGeneration:       "dont_allow",
			OutputMimeType:         "image/png",
			OutputCompressionQuality: 80,
		},
	}

	body, _ := json.Marshal(req)
	respBytes, err := c.post(ImageGenURL, body)
	if err != nil {
		log.Printf("[GEMINI] image gen error: %v", err)
		return "", err
	}

	var result ImageGenResponse
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return "", fmt.Errorf("unmarshal image response: %w", err)
	}

	if len(result.Predictions) == 0 {
		return "", fmt.Errorf("no image generated")
	}

	log.Printf("[GEMINI] image generated | size=%d bytes", len(result.Predictions[0].BytesBase64Encoded))
	return result.Predictions[0].BytesBase64Encoded, nil
}

// GenerateRouteImages generates composition heatmap and surface images for a route
func (c *Client) GenerateRouteImages(routeLabel string, mineralFocus []string, asteroids []db.AsteroidValuation) (heatmapB64, surfaceB64 string, err error) {
	log.Printf("[GEMINI] GenerateRouteImages: route=%s minerals=%v asteroids_count=%d", routeLabel, mineralFocus, len(asteroids))

	var asteroidDetailsStr strings.Builder
	for _, ast := range asteroids {
		asteroidDetailsStr.WriteString(fmt.Sprintf("- Asteroid %s (%s-type, Diameter: %.2f km, Mass: %.2e kg):\n", ast.Name, ast.SpecType, ast.DiameterKm, ast.MassKg))
		
		// Parse composition percentages
		var compParts []string
		for mineral, val := range ast.Composition {
			if pct, ok := val.(float64); ok {
				compParts = append(compParts, fmt.Sprintf("%s: %.1f%%", mineral, pct))
			} else if pctStr, ok := val.(string); ok {
				compParts = append(compParts, fmt.Sprintf("%s: %s", mineral, pctStr))
			}
		}
		if len(compParts) > 0 {
			asteroidDetailsStr.WriteString(fmt.Sprintf("  Composition details: %s\n", strings.Join(compParts, ", ")))
		}
	}

	mineralList := "various critical minerals"
	if len(mineralFocus) > 0 {
		mineralList = strings.Join(mineralFocus, ", ")
	}

	heatmapPrompt := fmt.Sprintf(
		"Scientific data visualization spectrographic heatmap overlay showing mineral composition distribution and concentration zones across target asteroid surfaces for a space mining operation.\n"+
			"Target Asteroids:\n%s\n"+
			"Priority Focus Minerals: %s\n"+
			"Visual Style:\n"+
			"- High-contrast false-color thermal and spectral analysis imagery.\n"+
			"- Deep space black background with a detailed grid overlay.\n"+
			"- Glowing concentration hotspots in vibrant neon amber, cyan, cobalt blue, and royal violet representing different mineral concentrations.\n"+
			"- Sleek, futuristic scientific data visualization aesthetic with orbital path lines and telemetric scanning indicators.\n"+
			"- Pure abstract data display. Absolutely no spelling, random letters, text, or alphabetic labels to ensure scientific visual accuracy.",
		asteroidDetailsStr.String(), mineralList,
	)

	surfacePrompt := fmt.Sprintf(
		"Photorealistic high-fidelity asteroid close-up render in deep space, capturing the detailed geological surface of target asteroids with visible resource deposits.\n"+
			"Target Asteroids:\n%s\n"+
			"Mineral Deposits: Prominent geological veins, crystalline formations, and metallic glints of %s.\n"+
			"Visual Style:\n"+
			"- Stunning, highly detailed rocky and cratered asteroid landscapes.\n"+
			"- Stark high-contrast lighting cast by a distant bright sun, creating deep, dramatic shadows on the surface craters.\n"+
			"- Deep space background with a realistic, faint starfield.\n"+
			"- Cinematic space exploration theme, NASA-quality astrophotography style, octane render aesthetic, 4K quality.\n"+
			"- No HUD elements, no overlays, and no text labels.",
		asteroidDetailsStr.String(), mineralList,
	)

	heatmapB64, err = c.GenerateImage(heatmapPrompt)
	if err != nil {
		log.Printf("[GEMINI] heatmap generation failed: %v", err)
		heatmapB64 = ""
	}

	surfaceB64, err = c.GenerateImage(surfacePrompt)
	if err != nil {
		log.Printf("[GEMINI] surface generation failed: %v", err)
		surfaceB64 = ""
	}

	if heatmapB64 == "" && surfaceB64 == "" {
		return "", "", fmt.Errorf("both image generations failed")
	}

	return heatmapB64, surfaceB64, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
