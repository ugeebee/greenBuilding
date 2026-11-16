package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"greenbuilding-backend/database"
	"greenbuilding-backend/handlers"

	"github.com/rs/cors"
)

func main() {
	handlers.InitConfig()
	database.InitDB()
	handlers.InitDataTables()

	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "online",
			"message": "Green Building API is running perfectly",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/api/signup", handlers.SignupHandler)
	mux.HandleFunc("/api/login", handlers.LoginHandler)
	mux.HandleFunc("/api/logout", handlers.LogoutHandler)
	mux.HandleFunc("/api/save", handlers.AuthMiddleware(handlers.SaveHistoryHandler))
	mux.HandleFunc("/api/history", handlers.AuthMiddleware(handlers.GetHistoryHandler))
	mux.HandleFunc("/api/user/activities", handlers.AuthMiddleware(handlers.GetUserActivitiesHandler))
	mux.HandleFunc("/api/admin/login", handlers.AdminLoginHandler)
	mux.HandleFunc("/api/admin/users", handlers.AdminAuthMiddleware(handlers.GetAllUsersHandler))
	mux.HandleFunc("/api/admin/user-history", handlers.AdminAuthMiddleware(handlers.GetUserHistoryHandler))
	mux.HandleFunc("/api/admin/activities", handlers.AdminAuthMiddleware(handlers.GetAllActivitiesHandler))
	mux.HandleFunc("/api/admin/tables", handlers.AdminAuthMiddleware(handlers.GetAllTablesHandler))
	mux.HandleFunc("/api/admin/tables/data", handlers.AdminAuthMiddleware(handlers.GetTableDataHandler))
	mux.HandleFunc("/api/admin/tables/update", handlers.AdminAuthMiddleware(handlers.UpdateTableDataHandler))
	mux.HandleFunc("/api/admin/tables/reset", handlers.AdminAuthMiddleware(handlers.ResetTableDataHandler))

	// System & Calculation Data Endpoints
	mux.HandleFunc("/api/tables", handlers.GetAllTablesHandler)
	mux.HandleFunc("/api/tables/data", handlers.GetTableDataHandler)

	// Floor Plan Generator & Reader API Endpoints
	mux.HandleFunc("/api/floorplan/presets", handlers.FloorPlanPresetsHandler)
	mux.HandleFunc("/api/floorplan/multi-room-presets", handlers.FloorPlanMultiRoomPresetsHandler)
	mux.HandleFunc("/api/floorplan/validate", handlers.FloorPlanValidateHandler)
	mux.HandleFunc("/api/floorplan/validate-multi-room", handlers.FloorPlanValidateMultiRoomHandler)
	mux.HandleFunc("/api/floorplan/samples", handlers.FloorPlanSamplesHandler)
	mux.HandleFunc("/api/floorplan/analyze", handlers.FloorPlanAnalyzeHandler)

	// Legacy aliases for standalone compatibility
	mux.HandleFunc("/api/multi-room-presets", handlers.FloorPlanMultiRoomPresetsHandler)
	mux.HandleFunc("/api/validate", handlers.FloorPlanValidateHandler)
	mux.HandleFunc("/api/validate-multi-room", handlers.FloorPlanValidateMultiRoomHandler)

	// Uploads file server (blueprints, overlays)
	uploadsDir := handlers.GetUploadsDir()
	mux.Handle("/api/uploads/", http.StripPrefix("/api/uploads/", http.FileServer(http.Dir(uploadsDir))))

	calcDirectory := "../frontend/calculator"
	fileServer := http.FileServer(http.Dir(calcDirectory))

	mux.Handle("/calculator/", handlers.AuthMiddleware(http.StripPrefix("/calculator/", fileServer).ServeHTTP))

	origins := os.Getenv("ALLOWED_ORIGINS")
	allowedOrigins := []string{
		"http://localhost:5500",
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:3000",
		"http://localhost:4173",
	}
	if origins != "" {
		allowedOrigins = strings.Split(origins, ",")
	}

	c := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	})

	handler := c.Handler(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	fmt.Printf("Green Building Backend starting securely on port %s\n", port)

	serverErr := http.ListenAndServe(port, handler)
	if serverErr != nil {
		log.Fatal("ListenAndServe: ", serverErr)
	}
}
