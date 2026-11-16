package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFloorPlanPresetsHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/floorplan/presets", nil)
	w := httptest.NewRecorder()

	FloorPlanPresetsHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var presets []FPRoomConfig
	if err := json.NewDecoder(w.Body).Decode(&presets); err != nil {
		t.Fatalf("failed to decode presets: %v", err)
	}

	if len(presets) == 0 {
		t.Fatalf("expected at least 1 preset, got 0")
	}
}

func TestFloorPlanMultiRoomPresetsHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/floorplan/multi-room-presets", nil)
	w := httptest.NewRecorder()

	FloorPlanMultiRoomPresetsHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var multiPresets []FPMultiRoomConfig
	if err := json.NewDecoder(w.Body).Decode(&multiPresets); err != nil {
		t.Fatalf("failed to decode multi-presets: %v", err)
	}

	if len(multiPresets) == 0 {
		t.Fatalf("expected at least 1 multi-room preset, got 0")
	}
}

func TestFloorPlanValidateHandler(t *testing.T) {
	room := FPRoomConfig{
		Breadth: 5.0,
		Length:  4.0,
		Openings: []FPOpening{
			{ID: "w1", Type: "window", Wall: "N", Position: 1.0, Width: 1.5},
			{ID: "d1", Type: "door", Wall: "S", Position: 0.5, Width: 0.9},
		},
	}

	body, _ := json.Marshal(room)
	req := httptest.NewRequest("POST", "/api/floorplan/validate", bytes.NewReader(body))
	w := httptest.NewRecorder()

	FloorPlanValidateHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp FPValidationResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode validation response: %v", err)
	}

	if resp.Metrics.GrossAreaSqm != 20.0 {
		t.Errorf("expected gross area 20.0, got %.2f", resp.Metrics.GrossAreaSqm)
	}
	if resp.Metrics.WallPerimeterM != 18.0 {
		t.Errorf("expected perimeter 18.0, got %.2f", resp.Metrics.WallPerimeterM)
	}
}

func TestFloorPlanValidateMultiRoomHandler(t *testing.T) {
	plan := FPMultiRoomConfig{
		Name:                  "Test Plan",
		ExteriorWallThickness: 0.20,
		InteriorWallThickness: 0.10,
		Rooms: []FPRoomConfig{
			{
				ID:      "r1",
				Name:    "Living",
				Type:    "living",
				X:       0,
				Y:       0,
				Breadth: 5,
				Length:  4,
				Openings: []FPOpening{
					{ID: "w1", Type: "window", Wall: "N", Position: 1.0, Width: 2.0},
				},
			},
			{
				ID:      "r2",
				Name:    "Bed",
				Type:    "bedroom",
				X:       5,
				Y:       0,
				Breadth: 4,
				Length:  4,
				Openings: []FPOpening{
					{ID: "w2", Type: "window", Wall: "N", Position: 1.0, Width: 1.5},
				},
			},
		},
	}

	body, _ := json.Marshal(plan)
	req := httptest.NewRequest("POST", "/api/floorplan/validate-multi-room", bytes.NewReader(body))
	w := httptest.NewRecorder()

	FloorPlanValidateMultiRoomHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp FPMultiRoomValidationResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode multi-room response: %v", err)
	}

	if resp.Metrics.TotalCarpetAreaSqm != 36.0 {
		t.Errorf("expected total carpet area 36.0, got %.2f", resp.Metrics.TotalCarpetAreaSqm)
	}
	if resp.Metrics.RoomCount != 2 {
		t.Errorf("expected room count 2, got %d", resp.Metrics.RoomCount)
	}
}

func TestFloorPlanSamplesHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/floorplan/samples", nil)
	w := httptest.NewRecorder()

	FloorPlanSamplesHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var samples []FPSampleItem
	if err := json.NewDecoder(w.Body).Decode(&samples); err != nil {
		t.Fatalf("failed to decode samples: %v", err)
	}

	if len(samples) < 4 {
		t.Fatalf("expected at least 4 sample blueprints, got %d", len(samples))
	}
}

func TestFloorPlanAnalyzeHandler(t *testing.T) {
	reqBody := map[string]interface{}{
		"sample": "sample_1bhk.png",
		"method": "hybrid",
		"pixels_per_meter": 59.45,
	}
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/floorplan/analyze", bytes.NewReader(body))
	w := httptest.NewRecorder()

	FloorPlanAnalyzeHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["status"] != "success" {
		t.Errorf("expected status 'success', got %v", resp["status"])
	}
}
