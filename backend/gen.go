package main

import (
	"fmt"

	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// 1. Generate a Password Hash
	pass := "your_admin_password" // Change this
	hash, _ := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	fmt.Println("HASHED_PASSWORD:", string(hash))

	// 2. Generate a TOTP Secret
	key, _ := totp.Generate(totp.GenerateOpts{
		Issuer:      "GreenBuilding",
		AccountName: "admin@greenbuilding.com",
	})
	fmt.Println("TOTP_SECRET:", key.Secret())
}
