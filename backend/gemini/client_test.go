package gemini

import (
	"os"
	"testing"
)

func TestParseInteractionResponse_stepsSchema(t *testing.T) {
	const body = `{
		"id": "int_1",
		"status": "completed",
		"steps": [
			{"type": "thought"},
			{
				"type": "model_output",
				"content": [{"type": "text", "text": "{\"ok\":true}"}]
			}
		]
	}`
	got, err := parseInteractionResponse([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if got.OutputText != `{"ok":true}` {
		t.Fatalf("got %q", got.OutputText)
	}
}

func TestParseInteractionResponse_legacyOutputs(t *testing.T) {
	const body = `{
		"id": "int_2",
		"status": "completed",
		"outputs": [
			{"type": "google_search_call"},
			{"type": "text", "text": "final answer"}
		]
	}`
	got, err := parseInteractionResponse([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if got.OutputText != "final answer" {
		t.Fatalf("got %q", got.OutputText)
	}
}

func TestParseInteractionResponse_wrappedInteraction(t *testing.T) {
	const body = `{
		"interaction": {
			"id": "int_3",
			"steps": [
				{"type": "model_output", "content": {"type": "text", "text": "wrapped"}}
			]
		}
	}`
	got, err := parseInteractionResponse([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if got.OutputText != "wrapped" {
		t.Fatalf("got %q", got.OutputText)
	}
}

func TestParseInteractionResponse_liveCaptures(t *testing.T) {
	for _, path := range []string{
		"/tmp/gemini_test.json",
		"/tmp/gemini_search.json",
		"/tmp/gemini_legacy.json",
		"/tmp/agent2_resp.json",
	} {
		b, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		got, err := parseInteractionResponse(b)
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		if len(got.OutputText) == 0 {
			t.Fatalf("%s: empty output", path)
		}
	}
}
