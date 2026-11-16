package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"greenbuilding-backend/database"
)

func SaveHistoryHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)

	var data interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid data payload", http.StatusBadRequest)
		return
	}

	payload, err := json.Marshal(data)
	if err != nil {
		http.Error(w, "Error encoding payload", http.StatusInternalServerError)
		return
	}

	_, err = database.DB.Exec(
		"INSERT INTO calculation_history (username, payload) VALUES (?, ?)",
		username, payload,
	)
	if err != nil {
		log.Printf("SaveHistory DB error: %v", err)
		http.Error(w, "Database error saving calculation", http.StatusInternalServerError)
		return
	}

	// Keep only latest 10 records per user
	if database.CurrentDriver == "mysql" {
		database.DB.Exec(`
			DELETE FROM calculation_history 
			WHERE username = ? AND id NOT IN (
				SELECT id FROM (
					SELECT id FROM calculation_history 
					WHERE username = ? 
					ORDER BY created_at DESC LIMIT 10
				) AS latest
			)`, username, username)
	} else {
		database.DB.Exec(`
			DELETE FROM calculation_history 
			WHERE username = ? AND id NOT IN (
				SELECT id FROM calculation_history 
				WHERE username = ? 
				ORDER BY created_at DESC LIMIT 10
			)`, username, username)
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Calculation history saved successfully"})
}

func GetHistoryHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)

	rows, err := database.DB.Query(
		"SELECT payload, created_at FROM calculation_history WHERE username = ? ORDER BY created_at DESC",
		username,
	)
	if err != nil {
		log.Printf("GetHistory DB error: %v", err)
		http.Error(w, "Database error retrieving history", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []interface{}{}
	for rows.Next() {
		var pStr, date string
		if err := rows.Scan(&pStr, &date); err == nil {
			var p interface{}
			json.Unmarshal([]byte(pStr), &p)
			results = append(results, map[string]interface{}{"data": p, "timestamp": date})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
