package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"

	"github.com/aboogie/budget-backend/routes"
)

func main() {
	// Load .env variables
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found or error loading it.")
	}

	r := mux.NewRouter()
	routes.SetupRoutes(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server is running on port %s\n", port)
	err = http.ListenAndServe(":"+port, r)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
