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

	// 30-day retention: save calculation and prune any records older than 30 days
	_, err = database.DB.Exec(
		"INSERT INTO calculation_history (username, payload) VALUES (?, ?)",
		username, payload,
	)
	if err != nil {
		log.Printf("SaveHistory DB error: %v", err)
		http.Error(w, "Database error saving calculation", http.StatusInternalServerError)
		return
	}

	// Prune records older than 30 days
	_ = database.PruneHistoryOlderThan30Days()

	// Track user activity
	TrackActivityForUser(
		username,
		r,
		"CALCULATION_SAVED",
		"Heat Load Calculation Saved",
		"Saved heat load calculation results to 30-day database history",
		string(payload),
	)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Calculation history saved successfully for 30 days",
	})
}

func GetHistoryHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)

	// Prune any records older than 30 days before query
	_ = database.PruneHistoryOlderThan30Days()

	var query string
	if database.CurrentDriver == "mysql" {
		query = "SELECT payload, created_at FROM calculation_history WHERE username = ? AND created_at >= NOW() - INTERVAL 30 DAY ORDER BY created_at DESC"
	} else {
		query = "SELECT payload, created_at FROM calculation_history WHERE username = ? AND created_at >= datetime('now', '-30 days') ORDER BY created_at DESC"
	}

	rows, err := database.DB.Query(query, username)
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
