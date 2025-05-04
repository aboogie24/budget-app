package main

import (
	"log"
	"net/http"
	"os"

	"github.com/aboogie/budget-backend/middleware"
	"github.com/aboogie/budget-backend/routes"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	r := mux.NewRouter()
	routes.SetupRoutes(r)

	corsWrapped := middleware.EnableCORS(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server is running on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, corsWrapped))
}
