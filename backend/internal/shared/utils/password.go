package utils

func PasswordsMatch(password, confirmPassword string) bool {
	return password != "" && password == confirmPassword
}
