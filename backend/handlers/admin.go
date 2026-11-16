package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"greenbuilding-backend/database"

	"github.com/pquerna/otp/totp"
)

type AdminLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Code     string `json:"code"`
}

func SetupAdminHandler(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		http.Error(w, "Username required", http.StatusBadRequest)
		return
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "GreenBuildingApp",
		AccountName: username,
	})
	if err != nil {
		http.Error(w, "Error generating TOTP", http.StatusInternalServerError)
		return
	}

	_, err = database.DB.Exec("UPDATE users SET totp_secret = ?, role = 'admin' WHERE username = ?", key.Secret(), username)
	if err != nil {
		log.Printf("SetupAdmin DB error: %v", err)
		http.Error(w, "Database error updating admin status", http.StatusInternalServerError)
		return
	}

	res := map[string]string{
		"secret": key.Secret(),
		"qr_url": key.URL(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func ToggleCalculatorHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	status := "false"
	if body.Enabled {
		status = "true"
	}

	_, err := database.DB.Exec("UPDATE settings SET setting_value = ? WHERE setting_key = 'calculator_enabled'", status)
	if err != nil {
		log.Printf("ToggleCalculator DB error: %v", err)
		http.Error(w, "Database error updating setting", http.StatusInternalServerError)
		return
	}

	fmt.Printf("Admin Toggled Calculator: %s\n", status)
	json.NewEncoder(w).Encode(map[string]string{"message": "Calculator status updated"})
}

func GetAllUsersHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query("SELECT username, full_name, email, created_at FROM users WHERE role != 'admin' ORDER BY created_at DESC")
	if err != nil {
		log.Printf("GetAllUsers DB error: %v", err)
		http.Error(w, "Database error querying users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := []map[string]interface{}{}
	for rows.Next() {
		var username, fullName, email, createdAt string
		if err := rows.Scan(&username, &fullName, &email, &createdAt); err == nil {
			users = append(users, map[string]interface{}{
				"username":   username,
				"full_name":  fullName,
				"email":      email,
				"created_at": createdAt,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func GetUserHistoryHandler(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		http.Error(w, "Username required", http.StatusBadRequest)
		return
	}

	// Ensure records older than 30 days are pruned
	_ = database.PruneHistoryOlderThan30Days()

	var query string
	if database.CurrentDriver == "mysql" {
		query = "SELECT id, payload, image_hash, image_name, created_at FROM calculation_history WHERE username = ? AND created_at >= NOW() - INTERVAL 30 DAY ORDER BY created_at DESC"
	} else {
		query = "SELECT id, payload, image_hash, image_name, created_at FROM calculation_history WHERE username = ? AND created_at >= datetime('now', '-30 days') ORDER BY created_at DESC"
	}

	rows, err := database.DB.Query(query, username)
	if err != nil {
		log.Printf("GetUserHistory DB error: %v", err)
		http.Error(w, "Database error querying user history", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []interface{}{}
	for rows.Next() {
		var id int
		var pStr, date string
		var imgHash, imgName sql.NullString
		if err := rows.Scan(&id, &pStr, &imgHash, &imgName, &date); err == nil {
			var p interface{}
			json.Unmarshal([]byte(pStr), &p)
			item := map[string]interface{}{
				"id":        id,
				"data":      p,
				"timestamp": date,
			}
			if imgHash.Valid && imgHash.String != "" {
				item["image_hash"] = imgHash.String
				item["image_url"] = "/api/uploads/blueprints/" + imgHash.String + ".png"
			}
			if imgName.Valid && imgName.String != "" {
				item["image_name"] = imgName.String
			}
			results = append(results, item)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
