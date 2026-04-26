package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

func AdminLoginHandler(w http.ResponseWriter, r *http.Request) {
	var req AdminLoginRequest // We defined this in admin.go earlier
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	admin, exists := Admins[req.Username]
	if !exists {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	valid := totp.Validate(req.Code, admin.TOTPSecret)
	if !valid {
		http.Error(w, "Invalid 2FA code", http.StatusUnauthorized)
		return
	}

	expirationTime := time.Now().Add(2 * time.Hour)
	claims := &jwt.RegisteredClaims{
		Subject:   admin.Username,
		ExpiresAt: jwt.NewNumericDate(expirationTime),
		Issuer:    "admin.greenbuilding.com",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString(jwtKey)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
}
