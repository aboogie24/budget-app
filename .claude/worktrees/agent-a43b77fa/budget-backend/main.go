package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aboogie/budget-backend/handlers"
	"github.com/aboogie/budget-backend/middleware"
	"github.com/aboogie/budget-backend/routes"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	r := mux.NewRouter()
	routes.SetupRoutes(r)

	// Start background recurring transaction processor (runs daily).
	handlers.StartRecurringTicker()

	// Rate limiter: 120 requests per minute per IP, burst of 20.
	limiter := middleware.NewRateLimiter(120, 20, time.Minute)

	corsWrapped := middleware.EnableCORS(r)
	rateLimited := limiter.Middleware(corsWrapped)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server is running on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, rateLimited))
}
