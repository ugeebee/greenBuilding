package handlers

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"

	"greenbuilding-backend/database"

	"github.com/golang-jwt/jwt/v5"
)

// ActivityRecord represents a single tracked user action in the system
type ActivityRecord struct {
	ID           int64  `json:"id"`
	Username     string `json:"username"`
	ActivityType string `json:"activity_type"`
	ActionName   string `json:"action_name"`
	Description  string `json:"description"`
	Details      string `json:"details,omitempty"`
	IPAddress    string `json:"ip_address,omitempty"`
	CreatedAt    string `json:"created_at"`
}

// ExtractClientIP extracts the client IP address from proxy headers or remote address
func ExtractClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		return host
	}
	return ip
}

// GetUsernameFromRequest retrieves the username from the request context or JWT token
func GetUsernameFromRequest(r *http.Request) string {
	if u, ok := r.Context().Value("username").(string); ok && u != "" {
		return u
	}

	var tokenString string
	if cookie, err := r.Cookie("jwt_token"); err == nil && cookie.Value != "" {
		tokenString = cookie.Value
	} else {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if tokenString == "" {
		return ""
	}

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, http.ErrNotSupported
		}
		return jwtKey, nil
	})

	if err == nil && token.Valid {
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if sub, ok := claims["sub"].(string); ok {
				return sub
			}
		}
	}

	return ""
}

// TrackActivity records any activity for the current request's user
func TrackActivity(r *http.Request, activityType, actionName, description, details string) {
	username := GetUsernameFromRequest(r)
	if username == "" {
		username = "anonymous"
	}
	TrackActivityForUser(username, r, activityType, actionName, description, details)
}

// TrackActivityForUser records an activity explicitly for a given username
func TrackActivityForUser(username string, r *http.Request, activityType, actionName, description, details string) {
	if database.DB == nil {
		return
	}
	ip := ExtractClientIP(r)

	// Prune history older than 30 days periodically/on insert
	go func() {
		_, err := database.DB.Exec(
			"INSERT INTO activity_history (username, activity_type, action_name, description, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
			username, activityType, actionName, description, details, ip,
		)
		if err != nil {
			log.Printf("⚠️ TrackActivity DB error: %v", err)
		}
	}()
}

// GetUserActivitiesHandler returns the logged-in user's activities from the past 30 days
func GetUserActivitiesHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)
	if username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Ensure 30-day retention prune has run
	_ = database.PruneHistoryOlderThan30Days()

	var query string
	if database.CurrentDriver == "mysql" {
		query = "SELECT id, username, activity_type, action_name, description, details, ip_address, created_at FROM activity_history WHERE username = ? AND created_at >= NOW() - INTERVAL 30 DAY ORDER BY created_at DESC LIMIT 200"
	} else {
		query = "SELECT id, username, activity_type, action_name, description, details, ip_address, created_at FROM activity_history WHERE username = ? AND created_at >= datetime('now', '-30 days') ORDER BY created_at DESC LIMIT 200"
	}

	rows, err := database.DB.Query(query, username)
	if err != nil {
		log.Printf("GetUserActivities DB error: %v", err)
		http.Error(w, "Database error retrieving user activities", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	activities := []ActivityRecord{}
	for rows.Next() {
		var a ActivityRecord
		var details, ipAddress *string
		if err := rows.Scan(&a.ID, &a.Username, &a.ActivityType, &a.ActionName, &a.Description, &details, &ipAddress, &a.CreatedAt); err == nil {
			if details != nil {
				a.Details = *details
			}
			if ipAddress != nil {
				a.IPAddress = *ipAddress
			}
			activities = append(activities, a)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}

// GetAllActivitiesHandler returns activities from the past 30 days across all users (Admin only)
func GetAllActivitiesHandler(w http.ResponseWriter, r *http.Request) {
	targetUsername := r.URL.Query().Get("username")
	targetType := r.URL.Query().Get("type")
	limitStr := r.URL.Query().Get("limit")

	limit := 300
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 1000 {
		limit = l
	}

	// Ensure 30-day retention prune has run
	_ = database.PruneHistoryOlderThan30Days()

	var query string
	var args []interface{}

	if database.CurrentDriver == "mysql" {
		query = "SELECT id, username, activity_type, action_name, description, details, ip_address, created_at FROM activity_history WHERE created_at >= NOW() - INTERVAL 30 DAY"
	} else {
		query = "SELECT id, username, activity_type, action_name, description, details, ip_address, created_at FROM activity_history WHERE created_at >= datetime('now', '-30 days')"
	}

	if targetUsername != "" {
		query += " AND username = ?"
		args = append(args, targetUsername)
	}
	if targetType != "" {
		query += " AND activity_type = ?"
		args = append(args, targetType)
	}

	query += " ORDER BY created_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		log.Printf("GetAllActivities DB error: %v", err)
		http.Error(w, "Database error retrieving activities", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	activities := []ActivityRecord{}
	for rows.Next() {
		var a ActivityRecord
		var details, ipAddress *string
		if err := rows.Scan(&a.ID, &a.Username, &a.ActivityType, &a.ActionName, &a.Description, &details, &ipAddress, &a.CreatedAt); err == nil {
			if details != nil {
				a.Details = *details
			}
			if ipAddress != nil {
				a.IPAddress = *ipAddress
			}
			activities = append(activities, a)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}
