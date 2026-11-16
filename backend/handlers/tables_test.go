package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"greenbuilding-backend/database"
)

func TestTablesAPI(t *testing.T) {
	// Initialize test database
	os.Setenv("APP_ENV", "development")
	os.Setenv("DB_DRIVER", "sqlite3")
	os.Setenv("DB_NAME", ":memory:")
	os.Setenv("JWT_SECRET", "test-secret-key-1234567890")

	InitConfig()
	database.InitDB()
	InitDataTables()

	// 1. Test GetAllTablesHandler
	req := httptest.NewRequest(http.MethodGet, "/api/tables", nil)
	rec := httptest.NewRecorder()
	GetAllTablesHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GetAllTablesHandler failed: status %d", rec.Code)
	}

	var tables []TableMeta
	if err := json.Unmarshal(rec.Body.Bytes(), &tables); err != nil {
		t.Fatalf("Failed to parse tables list: %v", err)
	}
	if len(tables) < 5 {
		t.Errorf("Expected at least 5 tables, got %d", len(tables))
	}

	// 2. Test GetTableDataHandler for 'periodic'
	reqPeriodic := httptest.NewRequest(http.MethodGet, "/api/tables/data?key=periodic", nil)
	recPeriodic := httptest.NewRecorder()
	GetTableDataHandler(recPeriodic, reqPeriodic)

	if recPeriodic.Code != http.StatusOK {
		t.Fatalf("GetTableDataHandler failed for periodic: status %d", recPeriodic.Code)
	}

	var periodicData map[string]interface{}
	if err := json.Unmarshal(recPeriodic.Body.Bytes(), &periodicData); err != nil {
		t.Fatalf("Failed to parse periodic data: %v", err)
	}
	if periodicData["table_key"] != "periodic" {
		t.Errorf("Expected table_key 'periodic', got %v", periodicData["table_key"])
	}

	// 3. Test UpdateTableDataHandler
	testUpdatePayload := map[string]interface{}{
		"table_key": "periodic",
		"data": []map[string]interface{}{
			{
				"Category":        "Walls",
				"Construction":    "Custom Test Super-Insulated Wall",
				"Thickness_mm":    300,
				"TimeLag_hours":   10.5,
				"DecrementFactor": 0.15,
				"U_Value":         0.28,
				"Description":     "Unit test sample assembly",
			},
		},
	}
	updateBytes, _ := json.Marshal(testUpdatePayload)
	reqUpdate := httptest.NewRequest(http.MethodPost, "/api/admin/tables/update", bytes.NewReader(updateBytes))
	recUpdate := httptest.NewRecorder()
	UpdateTableDataHandler(recUpdate, reqUpdate)

	if recUpdate.Code != http.StatusOK {
		t.Fatalf("UpdateTableDataHandler failed: %d - %s", recUpdate.Code, recUpdate.Body.String())
	}

	// Verify update took effect
	recVerify := httptest.NewRecorder()
	GetTableDataHandler(recVerify, reqPeriodic)
	var updatedData map[string]interface{}
	json.Unmarshal(recVerify.Body.Bytes(), &updatedData)
	rows, ok := updatedData["data"].([]interface{})
	if !ok || len(rows) != 1 {
		t.Errorf("Expected 1 row after update, got %v", updatedData["data"])
	}

	// 4. Test ResetTableDataHandler
	reqReset := httptest.NewRequest(http.MethodPost, "/api/admin/tables/reset?key=periodic", nil)
	recReset := httptest.NewRecorder()
	ResetTableDataHandler(recReset, reqReset)

	if recReset.Code != http.StatusOK {
		t.Fatalf("ResetTableDataHandler failed: %d - %s", recReset.Code, recReset.Body.String())
	}
}
