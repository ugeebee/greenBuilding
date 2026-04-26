package models

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
}

type TokenResponse struct {
	Token string `json:"token"`
}
type CalculationResult struct {
	Details interface{} `json:"details"`
	Totals  interface{} `json:"totals"`
}

type ProfileResponse struct {
	Username string `json:"username"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
}

type ResetPasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}
