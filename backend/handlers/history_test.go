package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"greenbuilding-backend/database"

	"github.com/golang-jwt/jwt/v5"
)

func TestHistoryWithRealDatabase(t *testing.T) {
	os.Setenv("APP_ENV", "development")
	os.Setenv("DB_DRIVER", "sqlite3")
	os.Setenv("DB_NAME", ":memory:")
	os.Setenv("JWT_SECRET", "test-secret-key-1234567890")

	InitConfig()
	database.InitDB()
	database.DB.Exec("DELETE FROM calculation_history WHERE username = ?", "utkarsh")

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

	// 3. Verify more than 10 history records can be saved (no arbitrary 10-item cap)
	for i := 2; i <= 15; i++ {
		cData := map[string]interface{}{"room": i, "heat": i * 100}
		b, _ := json.Marshal(cData)
		r := httptest.NewRequest("POST", "/api/save", bytes.NewReader(b))
		r = r.WithContext(ctx)
		rw := httptest.NewRecorder()
		SaveHistoryHandler(rw, r)
		if rw.Code != http.StatusCreated {
			t.Fatalf("failed to save item %d: %v", i, rw.Body.String())
		}
	}

	getReq2 := httptest.NewRequest("GET", "/api/history", nil)
	getReq2 = getReq2.WithContext(ctx)
	getW2 := httptest.NewRecorder()
	GetHistoryHandler(getW2, getReq2)
	var allItems []map[string]interface{}
	json.NewDecoder(getW2.Body).Decode(&allItems)
	if len(allItems) != 15 {
		t.Fatalf("expected 15 history items preserved (no 10-item cap), got %d", len(allItems))
	}

	// 4. Test 30-day retention pruning: insert an expired record (35 days old)
	_, err := database.DB.Exec("INSERT INTO calculation_history (username, payload, created_at) VALUES ('utkarsh', '{\"old\":true}', datetime('now', '-35 days'))")
	if err != nil {
		t.Fatalf("failed to insert expired calculation: %v", err)
	}
	_, err = database.DB.Exec("INSERT INTO activity_history (username, activity_type, action_name, description, created_at) VALUES ('utkarsh', 'OLD_ACT', 'Old Action', 'Old Desc', datetime('now', '-35 days'))")
	if err != nil {
		t.Fatalf("failed to insert expired activity: %v", err)
	}

	// Run 30-day retention prune
	if err := database.PruneHistoryOlderThan30Days(); err != nil {
		t.Fatalf("pruning error: %v", err)
	}

	// Ensure expired calculation was pruned
	var expiredCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM calculation_history WHERE created_at < datetime('now', '-30 days')").Scan(&expiredCount)
	if expiredCount != 0 {
		t.Fatalf("expected 0 expired calculations after 30-day prune, got %d", expiredCount)
	}

	// Ensure expired activity was pruned
	var expiredActCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM activity_history WHERE created_at < datetime('now', '-30 days')").Scan(&expiredActCount)
	if expiredActCount != 0 {
		t.Fatalf("expected 0 expired activities after 30-day prune, got %d", expiredActCount)
	}

	// 5. Test user activity retrieval
	actReq := httptest.NewRequest("GET", "/api/user/activities", nil)
	actReq = actReq.WithContext(ctx)
	actW := httptest.NewRecorder()
	GetUserActivitiesHandler(actW, actReq)
	if actW.Code != http.StatusOK {
		t.Fatalf("expected 200 from GetUserActivitiesHandler, got %d", actW.Code)
	}

	var acts []ActivityRecord
	json.NewDecoder(actW.Body).Decode(&acts)
	if len(acts) < 1 {
		t.Fatalf("expected at least 1 tracked activity, got %d", len(acts))
	}

	// 6. Test image saving, hashing and calculation linkage
	testImgData := []byte("fake-png-blueprint-image-data-for-testing")
	imgHash, bpURL, ovURL, err := SaveUploadedImage("utkarsh", "sample_test_blueprint.png", testImgData, nil)
	if err != nil {
		t.Fatalf("SaveUploadedImage failed: %v", err)
	}
	if len(imgHash) != 64 {
		t.Fatalf("expected 64-char SHA-256 hash, got %s (len: %d)", imgHash, len(imgHash))
	}
	if bpURL == "" {
		t.Fatalf("expected non-empty bpURL")
	}
	_ = ovURL

	// Save calculation with image hash and name
	calcWithImage := map[string]interface{}{
		"roomName":   "Living Room",
		"heatGain":   4500,
		"image_hash": imgHash,
		"image_name": "sample_test_blueprint.png",
	}
	bImg, _ := json.Marshal(calcWithImage)
	rImg := httptest.NewRequest("POST", "/api/save", bytes.NewReader(bImg))
	rImg = rImg.WithContext(ctx)
	rwImg := httptest.NewRecorder()
	SaveHistoryHandler(rwImg, rImg)
	if rwImg.Code != http.StatusCreated {
		t.Fatalf("failed to save calculation with image: %s", rwImg.Body.String())
	}

	// Retrieve user history and verify image fields
	getReq3 := httptest.NewRequest("GET", "/api/history", nil)
	getReq3 = getReq3.WithContext(ctx)
	getW3 := httptest.NewRecorder()
	GetHistoryHandler(getW3, getReq3)
	var historyWithImg []map[string]interface{}
	json.NewDecoder(getW3.Body).Decode(&historyWithImg)
	if len(historyWithImg) == 0 {
		t.Fatalf("expected history items, got 0")
	}
	latestItem := historyWithImg[0]
	if latestItem["image_hash"] != imgHash {
		t.Fatalf("expected image_hash %s, got %v", imgHash, latestItem["image_hash"])
	}
	if latestItem["image_name"] != "sample_test_blueprint.png" {
		t.Fatalf("expected image_name 'sample_test_blueprint.png', got %v", latestItem["image_name"])
	}
	if latestItem["image_url"] == nil || latestItem["image_url"] == "" {
		t.Fatalf("expected non-empty image_url")
	}
}

func TestGetUsernameFromRequest(t *testing.T) {
	os.Setenv("APP_ENV", "development")
	os.Setenv("JWT_SECRET", "test-secret-key-1234567890")
	InitConfig()
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &jwt.RegisteredClaims{
		Subject:   "testuser",
		ExpiresAt: jwt.NewNumericDate(expirationTime),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/floorplan/analyze", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)

	username := GetUsernameFromRequest(req)
	if username != "testuser" {
		t.Fatalf("expected username 'testuser', got '%s'", username)
	}

	// Test case 2: Request has expired/invalid cookie, but VALID Authorization header
	req.AddCookie(&http.Cookie{Name: "jwt_token", Value: "invalid-or-expired-cookie-value"})
	usernameWithStaleCookie := GetUsernameFromRequest(req)
	if usernameWithStaleCookie != "testuser" {
		t.Fatalf("expected username 'testuser' from Authorization header when cookie is invalid, got '%s'", usernameWithStaleCookie)
	}
}

