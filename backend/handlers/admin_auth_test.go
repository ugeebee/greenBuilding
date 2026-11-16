package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestAdminLoginFlow(t *testing.T) {
	_ = os.Chdir("..")
	InitConfig()

	// 1. Success case
	reqBody, _ := json.Marshal(AdminLoginRequest{
		Username: "utkarsh",
		Password: "utkarsh",
		Code:     "000000",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", bytes.NewReader(reqBody))
	rec := httptest.NewRecorder()
	AdminLoginHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d, body: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	if resp["token"] == "" {
		t.Fatalf("Expected token in response, got: %+v", resp)
	}

	// 2. Wrong password case
	wrongPwdBody, _ := json.Marshal(AdminLoginRequest{
		Username: "utkarsh",
		Password: "wrongpassword",
		Code:     "000000",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/admin/login", bytes.NewReader(wrongPwdBody))
	rec2 := httptest.NewRecorder()
	AdminLoginHandler(rec2, req2)
	if rec2.Code != http.StatusUnauthorized {
		t.Fatalf("Expected 401 on wrong password, got %d", rec2.Code)
	}

	// 3. Wrong 2FA code case
	wrongCodeBody, _ := json.Marshal(AdminLoginRequest{
		Username: "utkarsh",
		Password: "utkarsh",
		Code:     "999999",
	})
	req3 := httptest.NewRequest(http.MethodPost, "/api/admin/login", bytes.NewReader(wrongCodeBody))
	rec3 := httptest.NewRecorder()
	AdminLoginHandler(rec3, req3)
	if rec3.Code != http.StatusUnauthorized {
		t.Fatalf("Expected 401 on wrong 2FA code, got %d", rec3.Code)
	}

	t.Logf("All admin authentication scenarios verified successfully!")
}
