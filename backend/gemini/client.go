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
	// May 2026 Interactions API schema (steps[] instead of top-level output_text)
	APIRevision = "2026-05-20"
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

type interactionContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type interactionStepRaw struct {
	Type    string          `json:"type"`
	Content json.RawMessage `json:"content"`
	Text    string          `json:"text"`
}

type interactionOutput struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// interactionRaw captures both legacy and May 2026 Interactions API response shapes.
type interactionRaw struct {
	OutputText  string               `json:"output_text"`
	Steps       []interactionStepRaw `json:"steps"`
	Outputs     []interactionOutput  `json:"outputs"`
	Interaction *interactionRaw      `json:"interaction"`
}

// parseInteractionResponse extracts model text from output_text, steps[], or legacy outputs[].
// REST responses do not populate output_text (SDK-only sugar); text lives under steps or outputs.
func parseInteractionResponse(respBytes []byte) (*InteractionResponse, error) {
	payload := unwrapInteractionPayload(respBytes)

	var raw interactionRaw
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	text := strings.TrimSpace(raw.OutputText)
	if text == "" {
		text = extractTextFromSteps(raw.Steps)
	}
	if text == "" {
		text = extractTextFromOutputs(raw.Outputs)
	}
	if text == "" {
		text = extractTextRecursive(json.RawMessage(payload))
	}

	var result InteractionResponse
	_ = json.Unmarshal(payload, &result)
	result.OutputText = text
	return &result, nil
}

// unwrapInteractionPayload returns the interaction object if the body is wrapped.
func unwrapInteractionPayload(respBytes []byte) []byte {
	var wrap struct {
		Interaction json.RawMessage `json:"interaction"`
	}
	if err := json.Unmarshal(respBytes, &wrap); err == nil && len(wrap.Interaction) > 0 {
		return wrap.Interaction
	}
	return respBytes
}

func extractTextFromSteps(steps []interactionStepRaw) string {
	var last string
	for _, step := range steps {
		if step.Type != "model_output" {
			continue
		}
		if t := strings.TrimSpace(step.Text); t != "" {
			last = t
			continue
		}
		if t := extractTextFromContentRaw(step.Content); t != "" {
			last = t
		}
	}
	return last
}

func extractTextFromContentRaw(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}

	var items []interactionContent
	if err := json.Unmarshal(raw, &items); err == nil {
		return joinTextContent(items)
	}

	var one interactionContent
	if err := json.Unmarshal(raw, &one); err == nil {
		return joinTextContent([]interactionContent{one})
	}

	// Thought summaries and other nested content blocks.
	var nested map[string]json.RawMessage
	if err := json.Unmarshal(raw, &nested); err == nil {
		if summary, ok := nested["summary"]; ok {
			if t := extractTextFromContentRaw(summary); t != "" {
				return t
			}
		}
		if content, ok := nested["content"]; ok {
			if t := extractTextFromContentRaw(content); t != "" {
				return t
			}
		}
	}

	return extractTextRecursive(raw)
}

func joinTextContent(items []interactionContent) string {
	var parts []string
	for _, c := range items {
		if strings.TrimSpace(c.Text) == "" {
			continue
		}
		if c.Type == "text" || c.Type == "" {
			parts = append(parts, c.Text)
		}
	}
	return strings.TrimSpace(strings.Join(parts, ""))
}

func extractTextFromOutputs(outputs []interactionOutput) string {
	var last string
	for _, o := range outputs {
		if (o.Type == "text" || o.Type == "") && strings.TrimSpace(o.Text) != "" {
			last = strings.TrimSpace(o.Text)
		}
	}
	return last
}

// extractTextRecursive walks arbitrary JSON for text blocks (last-resort extraction).
func extractTextRecursive(raw json.RawMessage) string {
	var v interface{}
	if err := json.Unmarshal(raw, &v); err != nil {
		return ""
	}
	var candidates []string
	collectTextValues(v, &candidates)
	if len(candidates) == 0 {
		return ""
	}
	return strings.TrimSpace(candidates[len(candidates)-1])
}

func collectTextValues(v interface{}, out *[]string) {
	switch x := v.(type) {
	case map[string]interface{}:
		if t, ok := x["text"].(string); ok && strings.TrimSpace(t) != "" {
			if typ, _ := x["type"].(string); typ == "text" || typ == "" {
				*out = append(*out, t)
			}
		}
		for _, child := range x {
			collectTextValues(child, out)
		}
	case []interface{}:
		for _, item := range x {
			collectTextValues(item, out)
		}
	}
}

// logInteractionStructure logs response shape when model text could not be extracted.
func logInteractionStructure(respBytes []byte, context string) {
	payload := unwrapInteractionPayload(respBytes)

	var top map[string]json.RawMessage
	if err := json.Unmarshal(payload, &top); err != nil {
		log.Printf("[GEMINI] WARN: %s | body_len=%d | invalid JSON: %v", context, len(respBytes), err)
		return
	}

	keys := make([]string, 0, len(top))
	for k := range top {
		keys = append(keys, k)
	}

	status := ""
	if s, ok := top["status"]; ok {
		_ = json.Unmarshal(s, &status)
	}

	stepTypes := summarizeStepTypes(top["steps"])
	outputTypes := summarizeOutputTypes(top["outputs"])

	snippet := string(payload)
	if len(snippet) > 600 {
		snippet = snippet[:600] + "…"
	}

	log.Printf("[GEMINI] WARN: %s | body_len=%d | keys=%v | status=%q | step_types=%s | output_types=%s",
		context, len(respBytes), keys, status, stepTypes, outputTypes)
	log.Printf("[GEMINI] WARN: response_snippet=%s", snippet)
}

func summarizeStepTypes(raw json.RawMessage) string {
	if len(raw) == 0 {
		return "none"
	}
	var steps []interactionStepRaw
	if err := json.Unmarshal(raw, &steps); err != nil {
		return "unmarshal_error"
	}
	counts := make(map[string]int)
	for _, s := range steps {
		counts[s.Type]++
	}
	return formatTypeCounts(counts)
}

func summarizeOutputTypes(raw json.RawMessage) string {
	if len(raw) == 0 {
		return "none"
	}
	var outputs []interactionOutput
	if err := json.Unmarshal(raw, &outputs); err != nil {
		return "unmarshal_error"
	}
	counts := make(map[string]int)
	for _, o := range outputs {
		counts[o.Type]++
	}
	return formatTypeCounts(counts)
}

func formatTypeCounts(counts map[string]int) string {
	if len(counts) == 0 {
		return "empty"
	}
	parts := make([]string, 0, len(counts))
	for k, n := range counts {
		parts = append(parts, fmt.Sprintf("%s:%d", k, n))
	}
	return strings.Join(parts, ", ")
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

	result, err := parseInteractionResponse(respBytes)
	if err != nil {
		return nil, err
	}

	log.Printf("[GEMINI] sync done | output_len=%d", len(result.OutputText))
	if len(result.OutputText) == 0 {
		logInteractionStructure(respBytes, "empty sync output after parsing steps/outputs")
	} else {
		log.Printf("[GEMINI] Raw output (first 300 chars): %.300s", result.OutputText)
	}
	return result, nil
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
		req.Header.Set("Api-Revision", APIRevision)

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
			result, err := parseInteractionResponse(pollBytes)
			if err != nil {
				return nil, err
			}
			log.Printf("[GEMINI] async done | output_len=%d", len(result.OutputText))
			if len(result.OutputText) == 0 {
				logInteractionStructure(pollBytes, "empty async output after parsing steps/outputs")
			} else {
				log.Printf("[GEMINI] Raw output (first 300 chars): %.300s", result.OutputText)
			}
			return result, nil
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
	req.Header.Set("Api-Revision", APIRevision)

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
