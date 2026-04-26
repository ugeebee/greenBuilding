package handlers

import (
	"encoding/json"
	"fmt"
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
		http.Error(w, "Database error", http.StatusInternalServerError)
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
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	fmt.Printf("Admin Toggled Calculator: %s\n", status)
	json.NewEncoder(w).Encode(map[string]string{"message": "Calculator status updated"})
}

func GetAllUsersHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query("SELECT username, full_name, email, created_at FROM users WHERE role != 'admin' ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var username, fullName, email, createdAt string
		rows.Scan(&username, &fullName, &email, &createdAt)
		users = append(users, map[string]interface{}{
			"username":   username,
			"full_name":  fullName,
			"email":      email,
			"created_at": createdAt,
		})
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

	rows, err := database.DB.Query(
		"SELECT id, payload, created_at FROM calculation_history WHERE username = ? ORDER BY created_at DESC",
		username,
	)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []interface{}
	for rows.Next() {
		var id int
		var pStr, date string
		rows.Scan(&id, &pStr, &date)
		var p interface{}
		json.Unmarshal([]byte(pStr), &p)
		results = append(results, map[string]interface{}{
			"id":        id,
			"data":      p,
			"timestamp": date,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
