package handlers

import (
	"encoding/json"
	"greenbuilding-backend/database"
	"net/http"
)

func SaveHistoryHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)

	var data interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid data", http.StatusBadRequest)
		return
	}

	payload, _ := json.Marshal(data)

	_, err := database.DB.Exec(
		"INSERT INTO calculation_history (username, payload) VALUES (?, ?)",
		username, payload,
	)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	database.DB.Exec(`
		DELETE FROM calculation_history 
		WHERE username = ? AND id NOT IN (
			SELECT id FROM (
				SELECT id FROM calculation_history 
				WHERE username = ? 
				ORDER BY created_at DESC LIMIT 10
			) AS latest
		)`, username, username)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "History updated"})
}

func GetHistoryHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)

	rows, err := database.DB.Query(
		"SELECT payload, created_at FROM calculation_history WHERE username = ? ORDER BY created_at DESC",
		username,
	)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []interface{}
	for rows.Next() {
		var pStr, date string
		rows.Scan(&pStr, &date)
		var p interface{}
		json.Unmarshal([]byte(pStr), &p)
		results = append(results, map[string]interface{}{"data": p, "timestamp": date})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
