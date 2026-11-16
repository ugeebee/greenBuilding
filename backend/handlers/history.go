package handlers

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"greenbuilding-backend/database"
)

func SaveHistoryHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value("username").(string)

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil || len(bodyBytes) == 0 {
		http.Error(w, "Invalid data payload", http.StatusBadRequest)
		return
	}

	var imageHash, imageName string
	var parsedMap map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &parsedMap); err == nil {
		if val, ok := parsedMap["image_hash"].(string); ok {
			imageHash = val
		} else if val, ok := parsedMap["imageHash"].(string); ok {
			imageHash = val
		}
		if val, ok := parsedMap["image_name"].(string); ok {
			imageName = val
		} else if val, ok := parsedMap["imageName"].(string); ok {
			imageName = val
		}
	}

	// 30-day retention: save calculation and prune any records older than 30 days
	_, err = database.DB.Exec(
		"INSERT INTO calculation_history (username, payload, image_hash, image_name) VALUES (?, ?, ?, ?)",
		username, string(bodyBytes), imageHash, imageName,
	)
	if err != nil {
		log.Printf("SaveHistory DB error: %v", err)
		http.Error(w, "Database error saving calculation", http.StatusInternalServerError)
		return
	}

	// Prune records older than 30 days
	_ = database.PruneHistoryOlderThan30Days()

	// Track user activity with image linkage
	TrackActivityWithImage(
		username,
		r,
		"CALCULATION_SAVED",
		"Heat Load Calculation Saved",
		"Saved heat load calculation results to 30-day database history",
		string(bodyBytes),
		imageHash,
		imageName,
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
		query = "SELECT payload, image_hash, image_name, created_at FROM calculation_history WHERE username = ? AND created_at >= NOW() - INTERVAL 30 DAY ORDER BY created_at DESC"
	} else {
		query = "SELECT payload, image_hash, image_name, created_at FROM calculation_history WHERE username = ? AND created_at >= datetime('now', '-30 days') ORDER BY created_at DESC"
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
		var imgHash, imgName sql.NullString
		if err := rows.Scan(&pStr, &imgHash, &imgName, &date); err == nil {
			var p interface{}
			json.Unmarshal([]byte(pStr), &p)
			item := map[string]interface{}{
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
