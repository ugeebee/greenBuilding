package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	_ "github.com/mattn/go-sqlite3"
)

var (
	DB            *sql.DB
	CurrentEnv    string
	CurrentDriver string
)

func InitDB() {
	CurrentEnv = os.Getenv("APP_ENV")
	if CurrentEnv == "" {
		CurrentEnv = os.Getenv("ENV")
	}
	if CurrentEnv == "" {
		CurrentEnv = "development"
	}
	CurrentEnv = strings.ToLower(CurrentEnv)

	driver := os.Getenv("DB_DRIVER")
	if driver == "" {
		if CurrentEnv == "development" {
			driver = "sqlite3"
		} else {
			driver = "mysql"
		}
	}
	CurrentDriver = strings.ToLower(driver)

	var err error
	switch CurrentDriver {
	case "sqlite", "sqlite3":
		dbPath := os.Getenv("DB_NAME")
		if dbPath == "" || dbPath == "green_building_db" {
			dbPath = "greenbuilding_dev.db"
		}
		// Open SQLite database file for development
		DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
		if err != nil {
			log.Fatalf("❌ [%s] Failed to open SQLite database '%s': %v", CurrentEnv, dbPath, err)
		}
		DB.SetMaxOpenConns(1)

		// Auto-migrate schema for development database
		migrateDevelopmentSchema()

	case "mysql":
		addr := os.Getenv("DB_ADDR")
		if addr == "" {
			log.Fatalf("❌ [%s] DB_ADDR is required for MySQL database connection in %s environment", CurrentEnv, CurrentEnv)
		}

		cfg := mysql.Config{
			User:                 os.Getenv("DB_USER"),
			Passwd:               os.Getenv("DB_PASSWORD"),
			Net:                  "tcp",
			Addr:                 addr,
			DBName:               os.Getenv("DB_NAME"),
			AllowNativePasswords: true,
			ParseTime:            true,
			Timeout:              5 * time.Second,
		}

		DB, err = sql.Open("mysql", cfg.FormatDSN())
		if err != nil {
			log.Fatalf("❌ [%s] Failed to open MySQL connection: %v", CurrentEnv, err)
		}

		DB.SetMaxOpenConns(25)
		DB.SetMaxIdleConns(25)
		DB.SetConnMaxLifetime(5 * time.Minute)

	default:
		log.Fatalf("❌ [%s] Unsupported DB_DRIVER '%s'. Supported drivers: sqlite3, mysql", CurrentEnv, CurrentDriver)
	}

	// Strictly verify database connection
	if err = DB.Ping(); err != nil {
		log.Fatalf("❌ [%s] Database connection failed for %s (%v)", CurrentEnv, CurrentDriver, err)
	}

	fmt.Printf("✅ [%s] Connected successfully to %s database!\n", strings.ToUpper(CurrentEnv), CurrentDriver)
}

func migrateDevelopmentSchema() {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		full_name TEXT,
		email TEXT,
		role TEXT DEFAULT 'user',
		totp_secret TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS calculation_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL,
		payload TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		setting_key TEXT UNIQUE NOT NULL,
		setting_value TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := DB.Exec(schema)
	if err != nil {
		log.Fatalf("❌ Failed to initialize development database schema: %v", err)
	}

	// Seed initial development user if table is empty
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count == 0 {
		// Default dev user: utkarsh / utkarsh
		DB.Exec(`INSERT INTO users (username, password_hash, full_name, email, role) 
		         VALUES ('utkarsh', '$2a$10$s.7gQmNRmv0RfR2dQ8iGqu/qjt2u0YzY0EB.aqoWYfbzcyZp454r6', 'Utkarsh Bhartariya', 'utkarsh@example.com', 'admin')`)
		DB.Exec(`INSERT INTO settings (setting_key, setting_value) VALUES ('calculator_enabled', 'true')`)
	}
}
