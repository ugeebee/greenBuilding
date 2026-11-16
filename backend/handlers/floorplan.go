package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ============================================================================
// DATA MODELS
// ============================================================================

type FPOpening struct {
	ID        string  `json:"id"`
	Type      string  `json:"type"`      // "door" or "window"
	Wall      string  `json:"wall"`      // "N", "S", "E", "W"
	Position  float64 `json:"position"`  // distance in meters from wall start
	Width     float64 `json:"width"`     // width in meters
	FlipHinge bool    `json:"flipHinge,omitempty"`
	FlipSwing bool    `json:"flipSwing,omitempty"`
}

type FPRoomConfig struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Type          string      `json:"type,omitempty"` // "living", "bedroom", "kitchen", "bathroom", "dining", "balcony", "corridor", "office", etc.
	X             float64     `json:"x"`              // meters from plan origin
	Y             float64     `json:"y"`              // meters from plan origin
	Breadth       float64     `json:"breadth"`        // X-axis dimension in meters
	Length        float64     `json:"length"`         // Y-axis dimension in meters
	WallThickness float64     `json:"wallThickness,omitempty"`
	Openings      []FPOpening `json:"openings"`
}

type FPMultiRoomConfig struct {
	Name                  string         `json:"name"`
	ExteriorWallThickness float64        `json:"exteriorWallThickness"`
	InteriorWallThickness float64        `json:"interiorWallThickness"`
	Rooms                 []FPRoomConfig `json:"rooms"`
}

type FPRoomScheduleItem struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	Type              string  `json:"type"`
	X                 float64 `json:"x"`
	Y                 float64 `json:"y"`
	Breadth           float64 `json:"breadth"`
	Length            float64 `json:"length"`
	AreaSqm           float64 `json:"area_sqm"`
	AreaSqft          float64 `json:"area_sqft"`
	PerimeterM        float64 `json:"perimeter_m"`
	WindowAreaSqm     float64 `json:"window_area_sqm"`
	DaylightRatio     float64 `json:"daylight_ratio_percent"`
	DaylightCompliant bool    `json:"daylight_compliant"`
}

type FPMultiRoomMetrics struct {
	TotalCarpetAreaSqm   float64              `json:"total_carpet_area_sqm"`
	TotalCarpetAreaSqft  float64              `json:"total_carpet_area_sqft"`
	GrossBuiltUpAreaSqm  float64              `json:"gross_built_up_area_sqm"`
	GrossBuiltUpAreaSqft float64              `json:"gross_built_up_area_sqft"`
	BoundingWidthM       float64              `json:"bounding_width_m"`
	BoundingHeightM      float64              `json:"bounding_height_m"`
	RoomCount            int                  `json:"room_count"`
	EfficiencyPercent    float64              `json:"efficiency_percent"`
	Schedule             []FPRoomScheduleItem `json:"schedule"`
	Warnings             []string             `json:"warnings"`
}

type FPMultiRoomValidationResponse struct {
	Status    string             `json:"status"`
	Metrics   FPMultiRoomMetrics `json:"metrics"`
	FloorPlan FPMultiRoomConfig  `json:"floorPlan"`
}

type FPRoomMetrics struct {
	GrossAreaSqm       float64  `json:"gross_area_sqm"`
	GrossAreaSqft      float64  `json:"gross_area_sqft"`
	WallPerimeterM     float64  `json:"wall_perimeter_m"`
	TotalWindowAreaSqm float64  `json:"total_window_area_sqm"`
	DaylightRatio      float64  `json:"daylight_ratio_percent"`
	DaylightCompliant  bool     `json:"daylight_compliant"`
	Warnings           []string `json:"warnings"`
}

type FPValidationResponse struct {
	Status  string        `json:"status"`
	Metrics FPRoomMetrics `json:"metrics"`
	Room    FPRoomConfig  `json:"room"`
}

// Sample Blueprint Item
type FPSampleItem struct {
	ID          string  `json:"id"`
	Filename    string  `json:"filename"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Tag         string  `json:"tag"`
	RoomsCount  int     `json:"rooms_count"`
	PPM         float64 `json:"ppm"`
}

// ============================================================================
// HANDLERS
// ============================================================================

// FloorPlanPresetsHandler returns built-in presets
func FloorPlanPresetsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	presets := []FPRoomConfig{
		{
			ID:            "single-mb",
			Name:          "Master Bedroom Suite",
			Type:          "bedroom",
			Breadth:       5.5,
			Length:        4.5,
			WallThickness: 0.20,
			Openings: []FPOpening{
				{ID: "mb-d1", Type: "door", Wall: "S", Position: 0.8, Width: 0.9, FlipHinge: false, FlipSwing: false},
				{ID: "mb-w1", Type: "window", Wall: "N", Position: 1.8, Width: 1.8},
				{ID: "mb-w2", Type: "window", Wall: "E", Position: 1.2, Width: 1.2},
			},
		},
		{
			ID:            "single-st",
			Name:          "Studio Living & Work",
			Type:          "living",
			Breadth:       6.5,
			Length:        5.0,
			WallThickness: 0.20,
			Openings: []FPOpening{
				{ID: "st-d1", Type: "door", Wall: "W", Position: 0.6, Width: 0.95, FlipHinge: true, FlipSwing: false},
				{ID: "st-w1", Type: "window", Wall: "E", Position: 1.0, Width: 2.2},
				{ID: "st-w2", Type: "window", Wall: "N", Position: 2.0, Width: 1.6},
			},
		},
		{
			ID:            "single-kd",
			Name:          "Modern Kitchen & Dining",
			Type:          "kitchen",
			Breadth:       4.8,
			Length:        3.6,
			WallThickness: 0.20,
			Openings: []FPOpening{
				{ID: "kd-d1", Type: "door", Wall: "S", Position: 0.6, Width: 0.9, FlipHinge: false, FlipSwing: false},
				{ID: "kd-w1", Type: "window", Wall: "N", Position: 1.4, Width: 2.0},
			},
		},
	}

	json.NewEncoder(w).Encode(presets)
}

// FloorPlanMultiRoomPresetsHandler returns multi-room templates
func FloorPlanMultiRoomPresetsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	multiPresets := []FPMultiRoomConfig{
		{
			Name:                  "1-BHK Urban Residence",
			ExteriorWallThickness: 0.20,
			InteriorWallThickness: 0.10,
			Rooms: []FPRoomConfig{
				{
					ID:      "1bhk-living",
					Name:    "Living & Dining",
					Type:    "living",
					X:       0.0,
					Y:       0.0,
					Breadth: 5.0,
					Length:  4.5,
					Openings: []FPOpening{
						{ID: "1bhk-main-door", Type: "door", Wall: "W", Position: 0.6, Width: 1.0, FlipHinge: false, FlipSwing: false},
						{ID: "1bhk-liv-w1", Type: "window", Wall: "N", Position: 1.5, Width: 2.0},
						{ID: "1bhk-liv-bed-door", Type: "door", Wall: "E", Position: 1.0, Width: 0.9, FlipHinge: false, FlipSwing: true},
					},
				},
				{
					ID:      "1bhk-bed",
					Name:    "Master Bedroom",
					Type:    "bedroom",
					X:       5.0,
					Y:       0.0,
					Breadth: 4.0,
					Length:  3.5,
					Openings: []FPOpening{
						{ID: "1bhk-bed-w1", Type: "window", Wall: "N", Position: 1.0, Width: 1.8},
						{ID: "1bhk-bed-w2", Type: "window", Wall: "E", Position: 1.0, Width: 1.4},
					},
				},
				{
					ID:      "1bhk-kitchen",
					Name:    "Kitchen",
					Type:    "kitchen",
					X:       0.0,
					Y:       4.5,
					Breadth: 3.0,
					Length:  2.5,
					Openings: []FPOpening{
						{ID: "1bhk-k-d1", Type: "door", Wall: "N", Position: 0.6, Width: 0.85, FlipHinge: false, FlipSwing: true},
						{ID: "1bhk-k-w1", Type: "window", Wall: "S", Position: 0.8, Width: 1.4},
					},
				},
				{
					ID:      "1bhk-bath",
					Name:    "Bathroom",
					Type:    "bathroom",
					X:       3.0,
					Y:       4.5,
					Breadth: 2.0,
					Length:  2.5,
					Openings: []FPOpening{
						{ID: "1bhk-b-d1", Type: "door", Wall: "N", Position: 0.5, Width: 0.75, FlipHinge: false, FlipSwing: true},
						{ID: "1bhk-b-w1", Type: "window", Wall: "S", Position: 0.6, Width: 0.8},
					},
				},
				{
					ID:      "1bhk-foyer",
					Name:    "Balcony & Foyer",
					Type:    "balcony",
					X:       5.0,
					Y:       3.5,
					Breadth: 4.0,
					Length:  2.0,
					Openings: []FPOpening{
						{ID: "1bhk-f-w1", Type: "window", Wall: "E", Position: 0.5, Width: 2.5},
					},
				},
			},
		},
		{
			Name:                  "2-BHK Contemporary Apartment",
			ExteriorWallThickness: 0.20,
			InteriorWallThickness: 0.10,
			Rooms: []FPRoomConfig{
				{
					ID:      "2bhk-living",
					Name:    "Living & Dining Room",
					Type:    "living",
					X:       0.0,
					Y:       0.0,
					Breadth: 6.0,
					Length:  4.5,
					Openings: []FPOpening{
						{ID: "2bhk-main", Type: "door", Wall: "W", Position: 0.8, Width: 1.0, FlipHinge: false, FlipSwing: false},
						{ID: "2bhk-liv-w", Type: "window", Wall: "N", Position: 1.5, Width: 2.4},
						{ID: "2bhk-d-mb", Type: "door", Wall: "E", Position: 1.0, Width: 0.9, FlipHinge: false, FlipSwing: true},
					},
				},
				{
					ID:      "2bhk-master",
					Name:    "Master Suite",
					Type:    "bedroom",
					X:       6.0,
					Y:       0.0,
					Breadth: 4.5,
					Length:  4.5,
					Openings: []FPOpening{
						{ID: "2bhk-mb-w", Type: "window", Wall: "N", Position: 1.2, Width: 2.0},
						{ID: "2bhk-mb-e", Type: "window", Wall: "E", Position: 1.5, Width: 1.6},
						{ID: "2bhk-d-ensuite", Type: "door", Wall: "S", Position: 2.8, Width: 0.8, FlipHinge: false, FlipSwing: true},
					},
				},
				{
					ID:      "2bhk-kitchen",
					Name:    "Kitchen & Utility",
					Type:    "kitchen",
					X:       0.0,
					Y:       4.5,
					Breadth: 3.0,
					Length:  3.5,
					Openings: []FPOpening{
						{ID: "2bhk-k-d", Type: "door", Wall: "N", Position: 0.8, Width: 0.85, FlipHinge: false, FlipSwing: true},
						{ID: "2bhk-k-w", Type: "window", Wall: "W", Position: 1.0, Width: 1.4},
						{ID: "2bhk-k-s", Type: "window", Wall: "S", Position: 0.8, Width: 1.4},
					},
				},
				{
					ID:      "2bhk-bath2",
					Name:    "Common Restroom",
					Type:    "bathroom",
					X:       3.0,
					Y:       4.5,
					Breadth: 1.8,
					Length:  2.5,
					Openings: []FPOpening{
						{ID: "2bhk-b2-d", Type: "door", Wall: "N", Position: 0.5, Width: 0.75, FlipHinge: false, FlipSwing: true},
						{ID: "2bhk-b2-w", Type: "window", Wall: "S", Position: 0.5, Width: 0.8},
					},
				},
				{
					ID:      "2bhk-bed2",
					Name:    "Guest Bedroom",
					Type:    "bedroom",
					X:       4.8,
					Y:       4.5,
					Breadth: 3.7,
					Length:  3.5,
					Openings: []FPOpening{
						{ID: "2bhk-b2-door", Type: "door", Wall: "N", Position: 0.2, Width: 0.85, FlipHinge: false, FlipSwing: true},
						{ID: "2bhk-b2-w", Type: "window", Wall: "S", Position: 1.0, Width: 1.8},
					},
				},
				{
					ID:      "2bhk-ensuite",
					Name:    "En-Suite Bath",
					Type:    "bathroom",
					X:       8.5,
					Y:       4.5,
					Breadth: 2.0,
					Length:  2.5,
					Openings: []FPOpening{
						{ID: "2bhk-es-w", Type: "window", Wall: "S", Position: 0.6, Width: 0.8},
					},
				},
			},
		},
		{
			Name:                  "Executive Office Suite",
			ExteriorWallThickness: 0.25,
			InteriorWallThickness: 0.10,
			Rooms: []FPRoomConfig{
				{
					ID:      "off-rec",
					Name:    "Reception & Lobby",
					Type:    "office",
					X:       0.0,
					Y:       0.0,
					Breadth: 5.0,
					Length:  4.0,
					Openings: []FPOpening{
						{ID: "off-main-d", Type: "door", Wall: "W", Position: 0.8, Width: 1.2, FlipHinge: false, FlipSwing: false},
						{ID: "off-rec-w", Type: "window", Wall: "N", Position: 1.5, Width: 2.0},
					},
				},
				{
					ID:      "off-conf",
					Name:    "Conference Room",
					Type:    "office",
					X:       5.0,
					Y:       0.0,
					Breadth: 5.5,
					Length:  4.0,
					Openings: []FPOpening{
						{ID: "off-conf-d", Type: "door", Wall: "W", Position: 0.8, Width: 0.95, FlipHinge: false, FlipSwing: true},
						{ID: "off-conf-w", Type: "window", Wall: "N", Position: 1.5, Width: 2.4},
						{ID: "off-conf-w2", Type: "window", Wall: "E", Position: 1.0, Width: 1.8},
					},
				},
				{
					ID:      "off-exec",
					Name:    "Executive Cabin",
					Type:    "office",
					X:       0.0,
					Y:       4.0,
					Breadth: 4.5,
					Length:  3.5,
					Openings: []FPOpening{
						{ID: "off-exec-d", Type: "door", Wall: "N", Position: 0.6, Width: 0.9, FlipHinge: false, FlipSwing: true},
						{ID: "off-exec-w", Type: "window", Wall: "W", Position: 1.0, Width: 1.8},
					},
				},
				{
					ID:      "off-open",
					Name:    "Workstation Floor",
					Type:    "office",
					X:       4.5,
					Y:       4.0,
					Breadth: 6.0,
					Length:  4.8,
					Openings: []FPOpening{
						{ID: "off-work-w1", Type: "window", Wall: "E", Position: 1.5, Width: 2.6},
						{ID: "off-work-w2", Type: "window", Wall: "S", Position: 1.8, Width: 2.4},
					},
				},
				{
					ID:      "off-bath",
					Name:    "Restroom",
					Type:    "bathroom",
					X:       0.0,
					Y:       7.5,
					Breadth: 2.5,
					Length:  2.0,
					Openings: []FPOpening{
						{ID: "off-bath-d", Type: "door", Wall: "N", Position: 0.5, Width: 0.75, FlipHinge: false, FlipSwing: true},
					},
				},
			},
		},
	}

	json.NewEncoder(w).Encode(multiPresets)
}

// FloorPlanValidateHandler validates a single room configuration
func FloorPlanValidateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req FPRoomConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Breadth <= 0 {
		req.Breadth = 5.0
	}
	if req.Length <= 0 {
		req.Length = 4.0
	}
	if req.WallThickness <= 0 {
		req.WallThickness = 0.20
	}

	grossArea := req.Breadth * req.Length
	grossAreaSqft := grossArea * 10.7639
	perimeter := 2 * (req.Breadth + req.Length)

	var totalWindowArea float64
	var warnings []string

	wallOpenings := make(map[string][]FPOpening)
	for _, op := range req.Openings {
		wallOpenings[op.Wall] = append(wallOpenings[op.Wall], op)
		if op.Type == "window" {
			totalWindowArea += op.Width * 1.4
		}
	}

	for wall, ops := range wallOpenings {
		var wallLen float64
		if wall == "N" || wall == "S" {
			wallLen = req.Breadth
		} else {
			wallLen = req.Length
		}

		sort.Slice(ops, func(i, j int) bool {
			return ops[i].Position < ops[j].Position
		})

		for i, op := range ops {
			if op.Position+op.Width > wallLen {
				warnings = append(warnings, fmt.Sprintf("Opening %s on Wall %s exceeds wall length (%.2fm > %.2fm)", op.ID, wall, op.Position+op.Width, wallLen))
			}
			if op.Position < 0.1 {
				warnings = append(warnings, fmt.Sprintf("Opening %s on Wall %s is close to corner (< 0.10m)", op.ID, wall))
			}
			if op.Position+op.Width > wallLen-0.1 {
				warnings = append(warnings, fmt.Sprintf("Opening %s on Wall %s is close to corner (< 0.10m)", op.ID, wall))
			}
			if i+1 < len(ops) {
				next := ops[i+1]
				if op.Position+op.Width > next.Position {
					warnings = append(warnings, fmt.Sprintf("Overlapping openings on Wall %s (%s and %s)", wall, op.ID, next.ID))
				}
			}
		}
	}

	daylightRatio := 0.0
	if grossArea > 0 {
		daylightRatio = (totalWindowArea / grossArea) * 100
	}
	daylightCompliant := daylightRatio >= 10.0

	metrics := FPRoomMetrics{
		GrossAreaSqm:       math.Round(grossArea*100) / 100,
		GrossAreaSqft:      math.Round(grossAreaSqft*10) / 10,
		WallPerimeterM:     math.Round(perimeter*100) / 100,
		TotalWindowAreaSqm: math.Round(totalWindowArea*100) / 100,
		DaylightRatio:      math.Round(daylightRatio*10) / 10,
		DaylightCompliant:  daylightCompliant,
		Warnings:           warnings,
	}

	resp := FPValidationResponse{
		Status:  "success",
		Metrics: metrics,
		Room:    req,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// FloorPlanValidateMultiRoomHandler validates a multi-room floor plan
func FloorPlanValidateMultiRoomHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req FPMultiRoomConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.ExteriorWallThickness <= 0 {
		req.ExteriorWallThickness = 0.20
	}
	if req.InteriorWallThickness <= 0 {
		req.InteriorWallThickness = 0.10
	}

	var totalCarpetSqm float64
	var minX, minY, maxX, maxY float64
	var schedule []FPRoomScheduleItem
	var warnings []string

	if len(req.Rooms) > 0 {
		minX = req.Rooms[0].X
		minY = req.Rooms[0].Y
		maxX = req.Rooms[0].X + req.Rooms[0].Breadth
		maxY = req.Rooms[0].Y + req.Rooms[0].Length
	}

	for i, rm := range req.Rooms {
		rMinX := rm.X
		rMinY := rm.Y
		rMaxX := rm.X + rm.Breadth
		rMaxY := rm.Y + rm.Length

		if rMinX < minX {
			minX = rMinX
		}
		if rMinY < minY {
			minY = rMinY
		}
		if rMaxX > maxX {
			maxX = rMaxX
		}
		if rMaxY > maxY {
			maxY = rMaxY
		}

		areaSqm := rm.Breadth * rm.Length
		totalCarpetSqm += areaSqm
		perimeter := 2 * (rm.Breadth + rm.Length)

		var winArea float64
		for _, op := range rm.Openings {
			if op.Type == "window" {
				winArea += op.Width * 1.4
			}
		}

		dlRatio := 0.0
		if areaSqm > 0 {
			dlRatio = (winArea / areaSqm) * 100
		}
		dlCompliant := dlRatio >= 10.0

		if (rm.Type == "living" || rm.Type == "bedroom") && !dlCompliant {
			warnings = append(warnings, fmt.Sprintf("%s (%s) has %.1f%% daylight ratio (10%% minimum recommended)", rm.Name, rm.Type, dlRatio))
		}

		aspect := rm.Breadth / math.Max(0.1, rm.Length)
		if aspect > 2.5 || aspect < 0.4 {
			warnings = append(warnings, fmt.Sprintf("%s has extreme aspect ratio (%.1f:1)", rm.Name, aspect))
		}

		schedule = append(schedule, FPRoomScheduleItem{
			ID:                rm.ID,
			Name:              rm.Name,
			Type:              rm.Type,
			X:                 rm.X,
			Y:                 rm.Y,
			Breadth:           rm.Breadth,
			Length:            rm.Length,
			AreaSqm:           math.Round(areaSqm*100) / 100,
			AreaSqft:          math.Round(areaSqm*10.7639*10) / 10,
			PerimeterM:        math.Round(perimeter*100) / 100,
			WindowAreaSqm:     math.Round(winArea*100) / 100,
			DaylightRatio:     math.Round(dlRatio*10) / 10,
			DaylightCompliant: dlCompliant,
		})

		for j := i + 1; j < len(req.Rooms); j++ {
			other := req.Rooms[j]
			overlapX := math.Max(0, math.Min(rMaxX, other.X+other.Breadth)-math.Max(rMinX, other.X))
			overlapY := math.Max(0, math.Min(rMaxY, other.Y+other.Length)-math.Max(rMinY, other.Y))
			if overlapX > 0.05 && overlapY > 0.05 {
				warnings = append(warnings, fmt.Sprintf("Room overlap detected between '%s' and '%s'", rm.Name, other.Name))
			}
		}
	}

	boundW := maxX - minX
	boundH := maxY - minY
	grossBuiltUp := (boundW + 2*req.ExteriorWallThickness) * (boundH + 2*req.ExteriorWallThickness)

	efficiency := 0.0
	if grossBuiltUp > 0 {
		efficiency = math.Min(100.0, (totalCarpetSqm/grossBuiltUp)*100.0)
	}

	metrics := FPMultiRoomMetrics{
		TotalCarpetAreaSqm:   math.Round(totalCarpetSqm*100) / 100,
		TotalCarpetAreaSqft:  math.Round(totalCarpetSqm*10.7639*10) / 10,
		GrossBuiltUpAreaSqm:  math.Round(grossBuiltUp*100) / 100,
		GrossBuiltUpAreaSqft: math.Round(grossBuiltUp*10.7639*10) / 10,
		BoundingWidthM:       math.Round(boundW*100) / 100,
		BoundingHeightM:      math.Round(boundH*100) / 100,
		RoomCount:            len(req.Rooms),
		EfficiencyPercent:    math.Round(efficiency*10) / 10,
		Schedule:             schedule,
		Warnings:             warnings,
	}

	resp := FPMultiRoomValidationResponse{
		Status:    "success",
		Metrics:   metrics,
		FloorPlan: req,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// FloorPlanSamplesHandler returns available sample blueprints
func FloorPlanSamplesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	samples := []FPSampleItem{
		{
			ID:          "sample_1bhk",
			Filename:    "sample_1bhk.png",
			Title:       "1-BHK Urban Apartment",
			Description: "Standard 1-bedroom apartment layout with living room, kitchen, bathroom and balcony.",
			Tag:         "Residential",
			RoomsCount:  5,
			PPM:         59.45,
		},
		{
			ID:          "sample_master_suite",
			Filename:    "sample_master_suite.png",
			Title:       "Luxury Master Suite",
			Description: "Spacious master bedroom with en-suite bath and outdoor sun balcony.",
			Tag:         "Residential",
			RoomsCount:  3,
			PPM:         65.0,
		},
		{
			ID:          "executive_office",
			Filename:    "executive-office-suite-2d.png",
			Title:       "Executive Office Suite",
			Description: "Commercial office blueprint with reception, conference room, and executive cabins.",
			Tag:         "Commercial",
			RoomsCount:  5,
			PPM:         75.0,
		},
		{
			ID:          "blueprint_cad",
			Filename:    "blueprint.png",
			Title:       "Architectural CAD Blueprint",
			Description: "Detailed multi-space architectural blueprint with dimension annotations.",
			Tag:         "CAD Blueprint",
			RoomsCount:  7,
			PPM:         70.0,
		},
	}

	json.NewEncoder(w).Encode(samples)
}

// FloorPlanAnalyzeHandler processes an uploaded image or sample
func FloorPlanAnalyzeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	startTime := time.Now()

	// Temp directory for this run
	tempDir, err := os.MkdirTemp("", "fp_analysis_*")
	if err != nil {
		http.Error(w, "Failed to create temp directory", http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tempDir)

	var targetImagePath string
	method := "segmentation"
	var ppmVal float64 = 0.0

	// Check if multipart form
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		err := r.ParseMultipartForm(32 << 20) // 32MB max
		if err != nil {
			http.Error(w, "Error parsing form: "+err.Error(), http.StatusBadRequest)
			return
		}

		if m := r.FormValue("method"); m != "" {
			method = m
		}
		if p := r.FormValue("pixels_per_meter"); p != "" {
			ppmVal, _ = strconv.ParseFloat(p, 64)
		}

		file, header, err := r.FormFile("file")
		if err == nil {
			defer file.Close()
			targetImagePath = filepath.Join(tempDir, header.Filename)
			dst, err := os.Create(targetImagePath)
			if err != nil {
				http.Error(w, "Failed to write uploaded file", http.StatusInternalServerError)
				return
			}
			defer dst.Close()
			io.Copy(dst, file)
		} else {
			// Might be a sample name request
			sampleName := r.FormValue("sample")
			if sampleName != "" {
				targetImagePath = resolveSamplePath(sampleName)
			}
		}
	} else {
		// JSON payload request
		var body struct {
			SampleName     string  `json:"sample"`
			Method         string  `json:"method"`
			PixelsPerMeter float64 `json:"pixels_per_meter"`
			ImageBase64    string  `json:"image_base64"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			if body.Method != "" {
				method = body.Method
			}
			if body.PixelsPerMeter > 0 {
				ppmVal = body.PixelsPerMeter
			}
			if body.SampleName != "" {
				targetImagePath = resolveSamplePath(body.SampleName)
			} else if body.ImageBase64 != "" {
				// decode base64
				b64Data := body.ImageBase64
				if idx := strings.Index(b64Data, ","); idx != -1 {
					b64Data = b64Data[idx+1:]
				}
				bytes, err := base64.StdEncoding.DecodeString(b64Data)
				if err == nil {
					targetImagePath = filepath.Join(tempDir, "input_plan.png")
					os.WriteFile(targetImagePath, bytes, 0644)
				}
			}
		}
	}

	if targetImagePath == "" || !fileExists(targetImagePath) {
		http.Error(w, "No valid floor plan image provided or found", http.StatusBadRequest)
		return
	}

	outJSON := filepath.Join(tempDir, "output.json")
	outOverlay := filepath.Join(tempDir, "output_overlay.png")

	// Find python executable
	pythonBin := findPythonBin()
	if pythonBin == "" {
		http.Error(w, "Python environment not available for floor plan analysis", http.StatusInternalServerError)
		return
	}

	scriptPath := findScriptPath()
	weightsPath := findWeightsPath()

	if scriptPath == "" {
		http.Error(w, "Floor plan analysis script not found", http.StatusInternalServerError)
		return
	}

	cmdArgs := []string{
		scriptPath,
		"--image", targetImagePath,
		"--method", method,
		"--output_json", outJSON,
		"--output_overlay", outOverlay,
	}

	if weightsPath != "" {
		cmdArgs = append(cmdArgs, "--weights_path", weightsPath)
	}
	if ppmVal > 0 {
		cmdArgs = append(cmdArgs, "--pixels_per_meter", fmt.Sprintf("%.2f", ppmVal))
	}

	cmd := exec.Command(pythonBin, cmdArgs...)
	scriptDir := filepath.Dir(scriptPath)
	backendDir := filepath.Dir(scriptDir)
	cmd.Env = append(os.Environ(), "PYTHONPATH="+backendDir+":"+scriptDir)

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Python Analyzer Error: %v\nOutput: %s", err, string(output))
		http.Error(w, fmt.Sprintf("Analysis failed: %s", string(output)), http.StatusInternalServerError)
		return
	}

	// Read generated JSON
	jsonBytes, err := os.ReadFile(outJSON)
	if err != nil {
		http.Error(w, "Failed to read analysis output", http.StatusInternalServerError)
		return
	}

	var parsedResult map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &parsedResult); err != nil {
		http.Error(w, "Failed to parse analysis JSON", http.StatusInternalServerError)
		return
	}

	parsedResult["processing_time_ms"] = time.Since(startTime).Milliseconds()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(parsedResult)
}

// Helpers
func findScriptPath() string {
	candidates := []string{
		filepath.Join("floorplan_reader", "api_analyzer.py"),
		filepath.Join("backend", "floorplan_reader", "api_analyzer.py"),
		filepath.Join("..", "floorplan_reader", "api_analyzer.py"),
		filepath.Join("..", "backend", "floorplan_reader", "api_analyzer.py"),
		"/home/utkarsh/Desktop/greenBuilding/backend/floorplan_reader/api_analyzer.py",
	}
	for _, c := range candidates {
		if fileExists(c) {
			abs, err := filepath.Abs(c)
			if err == nil {
				return abs
			}
			return c
		}
	}
	return ""
}

func findWeightsPath() string {
	candidates := []string{
		filepath.Join("weights", "best.pt"),
		filepath.Join("backend", "weights", "best.pt"),
		filepath.Join("..", "weights", "best.pt"),
		filepath.Join("..", "backend", "weights", "best.pt"),
		"/home/utkarsh/Desktop/greenBuilding/backend/weights/best.pt",
	}
	for _, c := range candidates {
		if fileExists(c) {
			abs, err := filepath.Abs(c)
			if err == nil {
				return abs
			}
			return c
		}
	}
	return ""
}

func resolveSamplePath(name string) string {
	candidates := []string{
		filepath.Join("samples", name),
		filepath.Join("backend", "samples", name),
		filepath.Join("..", "samples", name),
		filepath.Join("..", "backend", "samples", name),
		filepath.Join("..", "frontend", "public", "samples", name),
		filepath.Join("frontend", "public", "samples", name),
		filepath.Join("/home/utkarsh/Desktop/greenBuilding/backend/samples", name),
		filepath.Join("/home/utkarsh/Desktop/greenBuilding/frontend/public/samples", name),
	}
	for _, c := range candidates {
		if fileExists(c) {
			abs, err := filepath.Abs(c)
			if err == nil {
				return abs
			}
			return c
		}
	}
	return ""
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && !info.IsDir()
}

func findPythonBin() string {
	known := []string{
		"/home/utkarsh/Desktop/floorPlanReader/.venv/bin/python",
		"python3",
		"python",
	}
	for _, p := range known {
		if _, err := exec.LookPath(p); err == nil {
			return p
		}
		if fileExists(p) {
			return p
		}
	}
	return ""
}
