package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"greenbuilding-backend/database"
	"greenbuilding-backend/models"

	"github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

var jwtKey []byte

func InitConfig() {
	env := os.Getenv("APP_ENV")
	if env == "" {
		env = os.Getenv("ENV")
	}

	// 1. Load base .env if present
	_ = godotenv.Load()

	// If APP_ENV was specified in .env, pick it up
	if env == "" {
		env = os.Getenv("APP_ENV")
	}
	if env == "" {
		env = "development"
		_ = os.Setenv("APP_ENV", "development")
	}

	// 2. Load environment-specific file if present: .env.development / .env.staging / .env.production
	envFile := ".env." + strings.ToLower(env)
	if err := godotenv.Overload(envFile); err == nil {
		log.Printf("Loaded environment configuration from %s", envFile)
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable is not set!")
	}
	jwtKey = []byte(secret)

	LoadAdmins()
}

func SignupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var creds models.Credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(creds.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	_, err = database.DB.Exec(
		"INSERT INTO users (username, password_hash, full_name, email) VALUES (?, ?, ?, ?)",
		creds.Username, string(hashedPassword), creds.FullName, creds.Email,
	)
	if err != nil {
		if mysqlErr, ok := err.(*mysql.MySQLError); ok && mysqlErr.Number == 1062 {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		log.Printf("Signup DB error: %v", err)
		http.Error(w, "Database error creating user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	TrackActivityForUser(creds.Username, r, "SIGNUP", "Account Registered", "New user account registered", "")
	json.NewEncoder(w).Encode(map[string]string{"message": "User created successfully"})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var creds models.Credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	var storedHash string
	err := database.DB.QueryRow("SELECT password_hash FROM users WHERE username = ?", creds.Username).Scan(&storedHash)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Invalid username or password", http.StatusUnauthorized)
			return
		}
		log.Printf("Login DB error: %v", err)
		http.Error(w, "Database error during login", http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(creds.Password)); err != nil {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &jwt.RegisteredClaims{
		Subject:   creds.Username,
		ExpiresAt: jwt.NewNumericDate(expirationTime),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		http.Error(w, "Server error generating token", http.StatusInternalServerError)
		return
	}

	cookie := http.Cookie{
		Name:     "jwt_token",
		Value:    tokenString,
		Expires:  expirationTime,
		HttpOnly: true,
		Secure:   false,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	}
	http.SetCookie(w, &cookie)

	w.Header().Set("Content-Type", "application/json")
	TrackActivityForUser(creds.Username, r, "LOGIN", "User Login", "User authenticated successfully", "")
	json.NewEncoder(w).Encode(map[string]string{
		"token":   tokenString,
		"message": "Login successful",
	})
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	if user := GetUsernameFromRequest(r); user != "" {
		TrackActivityForUser(user, r, "LOGOUT", "User Logout", "User logged out of session", "")
	}

	cookie := http.Cookie{
		Name:     "jwt_token",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		HttpOnly: true,
		Path:     "/",
	}
	http.SetCookie(w, &cookie)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logged out successfully"})
}

func GetProfileHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)

	var profile models.ProfileResponse
	err := database.DB.QueryRow(
		"SELECT username, full_name, email FROM users WHERE username = ?",
		username,
	).Scan(&profile.Username, &profile.FullName, &profile.Email)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func ResetPasswordHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)

	var req models.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid data", http.StatusBadRequest)
		return
	}

	var storedHash string
	err := database.DB.QueryRow("SELECT password_hash FROM users WHERE username = ?", username).Scan(&storedHash)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.OldPassword)); err != nil {
		http.Error(w, "Incorrect current password", http.StatusUnauthorized)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	_, err = database.DB.Exec("UPDATE users SET password_hash = ? WHERE username = ?", string(newHash), username)
	if err != nil {
		log.Printf("ResetPassword DB error: %v", err)
		http.Error(w, "Failed to update password", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	TrackActivityForUser(username, r, "PASSWORD_RESET", "Password Changed", "User updated account password", "")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password updated successfully"})
}
