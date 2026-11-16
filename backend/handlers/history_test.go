package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"greenbuilding-backend/database"
)

func TestHistoryWithRealDatabase(t *testing.T) {
	os.Setenv("APP_ENV", "development")
	os.Setenv("DB_DRIVER", "sqlite3")
	os.Setenv("DB_NAME", ":memory:")
	os.Setenv("JWT_SECRET", "test-secret-key-1234567890")

	InitConfig()
	database.InitDB()

	// 1. Save history for user "utkarsh"
	calcData := map[string]interface{}{
		"room": map[string]interface{}{
			"length":  5.0,
			"breadth": 4.0,
			"height":  3.0,
		},
		"totalHeatGain": 3520.5,
	}
	body, _ := json.Marshal(calcData)

	req := httptest.NewRequest("POST", "/api/save", bytes.NewReader(body))
	ctx := context.WithValue(req.Context(), "username", "utkarsh")
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	SaveHistoryHandler(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	// 2. Retrieve history for user "utkarsh"
	getReq := httptest.NewRequest("GET", "/api/history", nil)
	getReq = getReq.WithContext(ctx)
	getW := httptest.NewRecorder()

	GetHistoryHandler(getW, getReq)
	if getW.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", getW.Code, getW.Body.String())
	}

	var historyItems []map[string]interface{}
	if err := json.NewDecoder(getW.Body).Decode(&historyItems); err != nil {
		t.Fatalf("failed to decode history: %v", err)
	}

	if len(historyItems) != 1 {
		t.Fatalf("expected 1 history item in database, got %d", len(historyItems))
	}
}

