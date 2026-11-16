package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"greenbuilding-backend/database"
)

// TableMeta defines schema metadata for editable system tables
type TableMeta struct {
	Key         string `json:"table_key"`
	Title       string `json:"title"`
	Description string `json:"description"`
	FileName    string `json:"file_name"`
	RowCount    int    `json:"row_count"`
	UpdatedAt   string `json:"updated_at"`
}

var AvailableTables = []TableMeta{
	{
		Key:         "sheet1",
		Title:       "Table 1: Material Thermal Properties",
		Description: "Density (d), Thermal Conductivity (k), and Specific Heat Capacity (c). Used to derive Thermal Diffusivity K = k / (d × c).",
		FileName:    "GreenBuildingData_Sheet1.json",
	},
	{
		Key:         "sheet2",
		Title:       "Table 2: Surface Resistances & Conductances",
		Description: "Internal and external surface heat transfer coefficients, conductance (h) and resistance (Rso, Rsi) for walls, roofs, and floors.",
		FileName:    "GreenBuildingData_Sheet2.json",
	},
	{
		Key:         "sheet3",
		Title:       "Table 3: Construction Assemblies & U-Values",
		Description: "Overall thermal transmittance (U-Values) for standard masonry, concrete, stone, and composite envelope assemblies.",
		FileName:    "GreenBuildingData_Sheet3.json",
	},
	{
		Key:         "sheet4",
		Title:       "Table 4: Glazing & Window Specifications",
		Description: "U-values and solar heat gain performance for single, double, and specialized glazing across directional exposures.",
		FileName:    "GreenBuildingData_Sheet4.json",
	},
	{
		Key:         "periodic",
		Title:       "Table 5: Periodic Heat Flow & Thermal Inertia",
		Description: "Dynamic properties: thickness (mm), Time-lag ϕ (hours), and Decrement factor μ (attenuation) for periodic diurnal simulation.",
		FileName:    "GreenBuildingData_Periodic.json",
	},
}

// getPublicDataDir resolves the directory where static JSON tables reside
func getPublicDataDir() string {
	candidates := []string{
		"frontend/public",
		"../frontend/public",
		filepath.Join("..", "frontend", "public"),
		"/home/utkarsh/Desktop/greenBuilding/frontend/public",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			return c
		}
	}
	return "frontend/public"
}

// InitDataTables seeds data_tables if empty on startup
func InitDataTables() {
	if database.DB == nil {
		return
	}

	publicDir := getPublicDataDir()

	for _, meta := range AvailableTables {
		var count int
		_ = database.DB.QueryRow("SELECT COUNT(*) FROM data_tables WHERE table_key = ?", meta.Key).Scan(&count)
		if count > 0 {
			continue
		}

		filePath := filepath.Join(publicDir, meta.FileName)
		content, err := os.ReadFile(filePath)
		if err != nil {
			log.Printf("InitDataTables: could not read %s: %v. Using fallback.", filePath, err)
			content = []byte("[]")
		}

		_, err = database.DB.Exec(
			"INSERT INTO data_tables (table_key, title, description, payload, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
			meta.Key, meta.Title, meta.Description, string(content),
		)
		if err != nil {
			log.Printf("InitDataTables: failed to insert table %s: %v", meta.Key, err)
		} else {
			log.Printf("InitDataTables: successfully seeded table '%s' (%s)", meta.Key, meta.Title)
		}
	}
}

// GetAllTablesHandler returns metadata and row counts for all value tables
func GetAllTablesHandler(w http.ResponseWriter, r *http.Request) {
	if database.DB == nil {
		http.Error(w, "Database not available", http.StatusInternalServerError)
		return
	}

	rows, err := database.DB.Query("SELECT table_key, title, description, payload, updated_at FROM data_tables")
	if err != nil {
		log.Printf("GetAllTablesHandler query error: %v", err)
		http.Error(w, "Error retrieving tables", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	tableMap := make(map[string]TableMeta)
	for rows.Next() {
		var key, title, desc, payload, updatedAt string
		if err := rows.Scan(&key, &title, &desc, &payload, &updatedAt); err == nil {
			var arr []interface{}
			_ = json.Unmarshal([]byte(payload), &arr)
			tableMap[key] = TableMeta{
				Key:         key,
				Title:       title,
				Description: desc,
				RowCount:    len(arr),
				UpdatedAt:   updatedAt,
			}
		}
	}

	var results []TableMeta
	for _, meta := range AvailableTables {
		if val, exists := tableMap[meta.Key]; exists {
			meta.RowCount = val.RowCount
			meta.UpdatedAt = val.UpdatedAt
			results = append(results, meta)
		} else {
			results = append(results, meta)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// GetTableDataHandler returns full data for a specific table by key
func GetTableDataHandler(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		http.Error(w, "Missing 'key' query parameter", http.StatusBadRequest)
		return
	}

	var title, desc, payload, updatedAt string
	err := database.DB.QueryRow(
		"SELECT title, description, payload, updated_at FROM data_tables WHERE table_key = ?",
		key,
	).Scan(&title, &desc, &payload, &updatedAt)

	if err != nil {
		// Fallback to reading file directly if database entry not found
		publicDir := getPublicDataDir()
		var fileName string
		for _, m := range AvailableTables {
			if m.Key == key {
				fileName = m.FileName
				title = m.Title
				desc = m.Description
				break
			}
		}
		if fileName == "" {
			http.Error(w, "Table not found", http.StatusNotFound)
			return
		}
		filePath := filepath.Join(publicDir, fileName)
		dataBytes, fErr := os.ReadFile(filePath)
		if fErr != nil {
			http.Error(w, "Table data file not found", http.StatusNotFound)
			return
		}
		payload = string(dataBytes)
		updatedAt = time.Now().Format("2006-01-02 15:04:05")
	}

	var rawData json.RawMessage = []byte(payload)
	resp := map[string]interface{}{
		"table_key":   key,
		"title":       title,
		"description": desc,
		"updated_at":  updatedAt,
		"data":        rawData,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// UpdateTableRequest is the payload sent when admin saves table edits
type UpdateTableRequest struct {
	Key  string          `json:"table_key"`
	Data json.RawMessage `json:"data"`
}

// UpdateTableDataHandler updates the database table and synchronizes the frontend static JSON file
func UpdateTableDataHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req UpdateTableRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	if req.Key == "" {
		http.Error(w, "table_key is required", http.StatusBadRequest)
		return
	}

	var arr []interface{}
	if err := json.Unmarshal(req.Data, &arr); err != nil {
		http.Error(w, "Data must be a valid JSON array of rows", http.StatusBadRequest)
		return
	}

	// Format data cleanly
	formattedJSON, err := json.MarshalIndent(arr, "", "    ")
	if err != nil {
		http.Error(w, "Error formatting JSON", http.StatusInternalServerError)
		return
	}

	// Update Database
	var meta TableMeta
	found := false
	for _, m := range AvailableTables {
		if m.Key == req.Key {
			meta = m
			found = true
			break
		}
	}
	if !found {
		http.Error(w, "Unknown table key", http.StatusBadRequest)
		return
	}

	var updateErr error
	if database.CurrentDriver == "mysql" {
		_, updateErr = database.DB.Exec(
			"INSERT INTO data_tables (table_key, title, description, payload, updated_at) VALUES (?, ?, ?, ?, NOW()) "+
				"ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()",
			meta.Key, meta.Title, meta.Description, string(formattedJSON),
		)
	} else {
		// SQLite
		_, updateErr = database.DB.Exec(
			"INSERT INTO data_tables (table_key, title, description, payload, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) "+
				"ON CONFLICT(table_key) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP",
			meta.Key, meta.Title, meta.Description, string(formattedJSON),
		)
	}

	if updateErr != nil {
		log.Printf("UpdateTableDataHandler DB error: %v", updateErr)
		http.Error(w, "Database error saving table data", http.StatusInternalServerError)
		return
	}

	// Synchronize to public JSON file so frontend static imports stay in sync
	publicDir := getPublicDataDir()
	filePath := filepath.Join(publicDir, meta.FileName)
	if writeErr := os.WriteFile(filePath, formattedJSON, 0644); writeErr != nil {
		log.Printf("Warning: Failed to sync file %s: %v", filePath, writeErr)
	}

	// Track Admin Activity
	adminUser, _ := r.Context().Value("username").(string)
	if adminUser == "" {
		adminUser = "admin"
	}
	TrackActivityForUser(
		adminUser,
		r,
		"TABLE_UPDATE",
		"Updated "+meta.Title,
		fmt.Sprintf("Admin %s updated %d records in %s (%s)", adminUser, len(arr), meta.Title, meta.FileName),
		fmt.Sprintf(`{"table_key":"%s","rows":%d}`, meta.Key, len(arr)),
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "success",
		"message":    fmt.Sprintf("Successfully updated %s with %d records", meta.Title, len(arr)),
		"table_key":  meta.Key,
		"row_count":  len(arr),
		"updated_at": time.Now().Format("2006-01-02 15:04:05"),
	})
}

// ResetTableDataHandler resets a table to its original factory configuration
func ResetTableDataHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	key := r.URL.Query().Get("key")
	if key == "" {
		http.Error(w, "Missing 'key' query parameter", http.StatusBadRequest)
		return
	}

	var meta TableMeta
	found := false
	for _, m := range AvailableTables {
		if m.Key == key {
			meta = m
			found = true
			break
		}
	}
	if !found {
		http.Error(w, "Unknown table key", http.StatusBadRequest)
		return
	}

	// Read original default from frontend-old or public if exists
	backupDir := filepath.Join("frontend-old", "calculator")
	backupPath := filepath.Join(backupDir, meta.FileName)
	content, err := os.ReadFile(backupPath)
	if err != nil {
		// Read from public as fallback
		content, err = os.ReadFile(filepath.Join(getPublicDataDir(), meta.FileName))
	}

	if err != nil || len(content) == 0 {
		http.Error(w, "Original backup file not available to restore", http.StatusInternalServerError)
		return
	}

	// Update DB
	_, err = database.DB.Exec("UPDATE data_tables SET payload = ?, updated_at = CURRENT_TIMESTAMP WHERE table_key = ?", string(content), key)
	if err != nil {
		log.Printf("ResetTableDataHandler DB error: %v", err)
		http.Error(w, "Database error restoring default data", http.StatusInternalServerError)
		return
	}

	// Write to public file
	_ = os.WriteFile(filepath.Join(getPublicDataDir(), meta.FileName), content, 0644)

	adminUser, _ := r.Context().Value("username").(string)
	if adminUser == "" {
		adminUser = "admin"
	}
	TrackActivityForUser(
		adminUser,
		r,
		"TABLE_RESET",
		"Reset "+meta.Title,
		fmt.Sprintf("Admin %s reset %s to original system defaults", adminUser, meta.Title),
		fmt.Sprintf(`{"table_key":"%s"}`, meta.Key),
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "success",
		"message":   fmt.Sprintf("Successfully restored %s to factory defaults", meta.Title),
		"table_key": key,
	})
}
