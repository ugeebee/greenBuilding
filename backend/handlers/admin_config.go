package handlers

import "os"

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
	Admins = map[string]AdminUser{
		username: {
			Username:     username,
			PasswordHash: os.Getenv("ADMIN_PASSWORD_HASH"),
			TOTPSecret:   os.Getenv("ADMIN_TOTP_SECRET"),
		},
	}
}
