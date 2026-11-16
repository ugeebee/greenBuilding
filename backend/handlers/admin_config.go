package handlers

import (
	"log"
	"os"
	"strings"
)

type AdminUser struct {
	Username     string
	PasswordHash string
	TOTPSecret   string
}

var Admins map[string]AdminUser

func LoadAdmins() {
	username := os.Getenv("ADMIN_USERNAME")
	if username == "" {
		return
	}
	hash := os.Getenv("ADMIN_PASSWORD_HASH")
	secret := os.Getenv("ADMIN_TOTP_SECRET")

	// If godotenv or a shell stripped $2 and $10 variable expansions (e.g. "a$...")
	if strings.HasPrefix(hash, "a$") {
		hash = "$2" + hash[:2] + "10$" + hash[2:]
		log.Println("[ADMIN] Notice: Restored bcrypt prefix for ADMIN_PASSWORD_HASH")
	}

	Admins = map[string]AdminUser{
		username: {
			Username:     username,
			PasswordHash: hash,
			TOTPSecret:   secret,
		},
	}
}
