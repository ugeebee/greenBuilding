package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isAPI := strings.HasPrefix(r.URL.Path, "/api/")

		var candidateTokens []string

		// 1. Authorization Header takes priority
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			if strings.HasPrefix(authHeader, "Bearer ") {
				candidateTokens = append(candidateTokens, strings.TrimPrefix(authHeader, "Bearer "))
			} else {
				candidateTokens = append(candidateTokens, authHeader)
			}
		}

		// 2. Cookie next
		if cookie, err := r.Cookie("jwt_token"); err == nil && cookie.Value != "" {
			candidateTokens = append(candidateTokens, cookie.Value)
		}
		if cookie, err := r.Cookie("admin_token"); err == nil && cookie.Value != "" {
			candidateTokens = append(candidateTokens, cookie.Value)
		}

		if len(candidateTokens) == 0 {
			if isAPI {
				http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
			} else {
				http.Redirect(w, r, "/index.html", http.StatusSeeOther)
			}
			return
		}

		var validClaims jwt.MapClaims
		for _, tokenStr := range candidateTokens {
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, http.ErrNotSupported
				}
				return jwtKey, nil
			})
			if err == nil && token.Valid {
				if claims, ok := token.Claims.(jwt.MapClaims); ok {
					validClaims = claims
					break
				}
			}
		}

		if validClaims == nil {
			clearCookie := http.Cookie{
				Name:     "jwt_token",
				Value:    "",
				MaxAge:   -1,
				HttpOnly: true,
				Path:     "/",
			}
			http.SetCookie(w, &clearCookie)

			if isAPI {
				http.Error(w, `{"error": "Invalid or expired token"}`, http.StatusUnauthorized)
			} else {
				http.Redirect(w, r, "/index.html", http.StatusSeeOther)
			}
			return
		}

		username := validClaims["sub"]
		if username == nil || username == "" {
			username = validClaims["username"]
		}
		ctx := context.WithValue(r.Context(), "username", username)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func AdminAuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var tokenString string
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}

		if tokenString == "" {
			http.Error(w, `{"error": "Admin access required"}`, http.StatusUnauthorized)
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, http.ErrNotSupported
			}
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error": "Invalid admin token"}`, http.StatusUnauthorized)
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			if claims["iss"] != "admin.greenbuilding.com" {
				http.Error(w, `{"error": "Forbidden: Not an admin token"}`, http.StatusForbidden)
				return
			}
			ctx := context.WithValue(r.Context(), "admin_username", claims["sub"])
			next.ServeHTTP(w, r.WithContext(ctx))
		} else {
			http.Error(w, `{"error": "Invalid token claims"}`, http.StatusUnauthorized)
		}
	}
}
