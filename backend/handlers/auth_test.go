package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"greenbuilding-backend/database"
	"greenbuilding-backend/models"
)

func TestAuthWithRealDatabase(t *testing.T) {
	os.Setenv("APP_ENV", "development")
	os.Setenv("DB_DRIVER", "sqlite3")
	os.Setenv("DB_NAME", ":memory:")
	os.Setenv("JWT_SECRET", "test-secret-key-1234567890")

	InitConfig()
	database.InitDB()

	// 1. Signup a new user
	signupBody, _ := json.Marshal(models.Credentials{
		Username: "testuser",
		Password: "password123",
		FullName: "Test User",
		Email:    "test@example.com",
	})
	signupReq := httptest.NewRequest("POST", "/api/signup", bytes.NewReader(signupBody))
	signupW := httptest.NewRecorder()

	SignupHandler(signupW, signupReq)
	if signupW.Code != http.StatusCreated {
		t.Fatalf("expected status 201 on signup, got %d: %s", signupW.Code, signupW.Body.String())
	}

	// 2. Login with correct credentials
	loginBody, _ := json.Marshal(models.Credentials{
		Username: "testuser",
		Password: "password123",
	})
	loginReq := httptest.NewRequest("POST", "/api/login", bytes.NewReader(loginBody))
	loginW := httptest.NewRecorder()

	LoginHandler(loginW, loginReq)
	if loginW.Code != http.StatusOK {
		t.Fatalf("expected status 200 on login, got %d: %s", loginW.Code, loginW.Body.String())
	}

	var loginResp map[string]string
	json.NewDecoder(loginW.Body).Decode(&loginResp)
	if loginResp["token"] == "" {
		t.Fatalf("expected token in login response, got empty")
	}

	// 3. Login with wrong password
	badLoginBody, _ := json.Marshal(models.Credentials{
		Username: "testuser",
		Password: "wrongpassword",
	})
	badLoginReq := httptest.NewRequest("POST", "/api/login", bytes.NewReader(badLoginBody))
	badLoginW := httptest.NewRecorder()

	LoginHandler(badLoginW, badLoginReq)
	if badLoginW.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 on bad password, got %d", badLoginW.Code)
	}
}

