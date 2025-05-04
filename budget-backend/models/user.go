package models

import "golang.org/x/crypto/bcrypt"

type User struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (u *User) HashPassword() error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashed)
	return nil
}

func (u *User) CheckPassword(providedPassword string) bool {
	return bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(providedPassword)) == nil
}
