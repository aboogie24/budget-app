# ─────────────────────────────────────────────────────────────
# CoupleFlow Budget App — Local Development Makefile
# ─────────────────────────────────────────────────────────────
#
# Quick start:
#   make setup        — first-time setup (db + migrate + install)
#   make dev          — run backend + frontend together
#   make stop         — tear down the database container
#
# Individual targets:
#   make db           — start Postgres in Docker
#   make migrate-up   — run all pending migrations
#   make migrate-down — roll back last migration
#   make backend      — run Go backend (hot-reload if air installed)
#   make frontend     — run Expo dev server
#   make test         — run all backend tests
#   make build        — compile backend binary
#   make clean        — stop containers and remove build artifacts
#
# ─────────────────────────────────────────────────────────────

SHELL := /bin/bash

# Directories
ROOT_DIR     := $(shell pwd)
BACKEND_DIR  := $(ROOT_DIR)/budget-backend
FRONTEND_DIR := $(ROOT_DIR)/budget-app

# Load database credentials from backend .env file
# Falls back to defaults if .env is missing
-include $(BACKEND_DIR)/.env
export

PG_HOST     ?= localhost
PG_PORT     ?= 5432
PG_USER     ?= youruser
PG_PASS     ?= yourpassword
PG_DB       ?= budget_db
DATABASE_URL := postgres://$(PG_USER):$(PG_PASS)@$(PG_HOST):$(PG_PORT)/$(PG_DB)?sslmode=disable

# ─── Composite targets ──────────────────────────────────────

.PHONY: setup dev stop clean help

## First-time setup: start DB, run migrations, install frontend deps
setup: db-wait migrate-up frontend-install
	@echo ""
	@echo "✅  Setup complete! Run 'make dev' to start developing."
	@echo ""

## Run backend + frontend in parallel (Ctrl-C to stop both)
dev:
	@echo "Starting backend and frontend..."
	@trap 'kill 0' EXIT; \
		$(MAKE) backend & \
		$(MAKE) frontend & \
		wait

## Stop all Docker containers
stop:
	cd $(BACKEND_DIR) && docker-compose down

## Stop containers and remove build artifacts
clean: stop
	rm -f $(BACKEND_DIR)/budget-app-backend
	@echo "🧹  Clean complete."

# ─── Database ────────────────────────────────────────────────

.PHONY: db db-wait db-reset

## Start Postgres via Docker Compose
db:
	cd $(BACKEND_DIR) && docker-compose up -d db
	@echo "🐘  Postgres running on port $(PG_PORT)"

## Wait for Postgres to accept connections
db-wait: db
	@echo "Waiting for Postgres..."
	@for i in $$(seq 1 30); do \
		pg_isready -h localhost -p $(PG_PORT) -U $(PG_USER) -q 2>/dev/null && break; \
		sleep 1; \
	done
	@echo "🐘  Postgres is ready."

## Drop and recreate the database (destructive!)
db-reset: db-wait
	@echo "WARNING: Dropping and recreating $(PG_DB)..."
	PGPASSWORD=$(PG_PASS) psql -h $(PG_HOST) -p $(PG_PORT) -U $(PG_USER) -d postgres \
		-c "DROP DATABASE IF EXISTS $(PG_DB);" \
		-c "CREATE DATABASE $(PG_DB);"
	$(MAKE) migrate-up

## Wipe ONE user's financial data (keeps login, household, categories, settings).
## Usage: make reset-user USER_EMAIL=you@example.com
reset-user:
	@test -n "$(USER_EMAIL)" || (echo "usage: make reset-user USER_EMAIL=you@example.com" && exit 1)
	@echo "WARNING: wiping financial data for $(USER_EMAIL) in $(PG_DB)..."
	PGPASSWORD=$(PG_PASS) psql -h $(PG_HOST) -p $(PG_PORT) -U $(PG_USER) -d $(PG_DB) \
		-v target_email='$(USER_EMAIL)' -f $(BACKEND_DIR)/scripts/reset_user_data.sql

# ─── Migrations ──────────────────────────────────────────────

.PHONY: migrate-up migrate-down migrate-status

## Run all pending migrations
migrate-up:
	migrate -path $(BACKEND_DIR)/migrations -database "$(DATABASE_URL)" up
	@echo "📦  Migrations applied."

## Roll back the last migration
migrate-down:
	migrate -path $(BACKEND_DIR)/migrations -database "$(DATABASE_URL)" down 1
	@echo "⬇️   Rolled back 1 migration."

## Show migration version
migrate-status:
	migrate -path $(BACKEND_DIR)/migrations -database "$(DATABASE_URL)" version

# ─── Backend ─────────────────────────────────────────────────

.PHONY: backend build test lint-backend

## Run the Go backend (with live reload via 'air' if installed)
backend:
	@cd $(BACKEND_DIR) && \
	if command -v air >/dev/null 2>&1; then \
		echo "🔄  Starting backend with air (hot reload)..."; \
		air; \
	else \
		echo "🚀  Starting backend with go run..."; \
		echo "    (Install 'air' for hot reload: go install github.com/air-verse/air@latest)"; \
		go run main.go; \
	fi

## Compile the backend binary
build:
	cd $(BACKEND_DIR) && go build -o budget-app-backend main.go
	@echo "📦  Built $(BACKEND_DIR)/budget-app-backend"

## Run all backend tests
test:
	cd $(BACKEND_DIR) && go test ./... -v -count=1
	@echo ""
	@echo "✅  All tests passed."

# ─── End-to-end tests ────────────────────────────────────────

.PHONY: test-e2e-backend test-e2e-app

E2E_DB := budget_db_e2e

## Backend E2E: fresh database + all migrations + real HTTP flows.
## Covers register/login, bill auto-detect (incl. overpayments + debt-balance
## guard), and debt/goal ↔ account balance linking.
test-e2e-backend:
	@pg_isready -h $(PG_HOST) -p $(PG_PORT) -U $(PG_USER) -q || \
		(echo "Postgres not reachable on $(PG_HOST):$(PG_PORT) — start it first (make db)" && exit 1)
	@echo "🧪  Recreating $(E2E_DB) and applying migrations..."
	@PGPASSWORD=$(PG_PASS) psql -h $(PG_HOST) -p $(PG_PORT) -U $(PG_USER) -d postgres -q \
		-c "DROP DATABASE IF EXISTS $(E2E_DB);" \
		-c "CREATE DATABASE $(E2E_DB);"
	@migrate -path $(BACKEND_DIR)/migrations \
		-database "postgres://$(PG_USER):$(PG_PASS)@$(PG_HOST):$(PG_PORT)/$(E2E_DB)?sslmode=disable" up
	cd $(BACKEND_DIR) && \
		PG_HOST=$(PG_HOST) PG_PORT=$(PG_PORT) PG_USER=$(PG_USER) PG_PASS=$(PG_PASS) \
		PG_DB=$(E2E_DB) JWT_SECRET=e2e-test-secret \
		go test -tags e2e -count=1 -v ./e2e/...
	@echo ""
	@echo "✅  Backend E2E suite passed."

## Mobile E2E: Maestro flows against the app in a simulator.
## Prereqs: `brew install maestro`, a running simulator with the app installed,
## and the backend up (`make backend`). See budget-app/.maestro/README.md.
test-e2e-app:
	@command -v maestro >/dev/null 2>&1 || \
		(echo "maestro not installed — run: brew install maestro" && exit 1)
	cd $(FRONTEND_DIR) && maestro test .maestro/

# ─── Frontend ────────────────────────────────────────────────

.PHONY: frontend frontend-install frontend-web

## Start the Expo dev server
frontend:
	cd $(FRONTEND_DIR) && npx expo start

## Install frontend dependencies
frontend-install:
	cd $(FRONTEND_DIR) && npm install
	@echo "📱  Frontend dependencies installed."

## Start the Expo web build
frontend-web:
	cd $(FRONTEND_DIR) && npx expo start --web

# ─── Docker (full stack) ─────────────────────────────────────

.PHONY: docker-up docker-down docker-logs

## Start the full Docker stack (db + backend + migrate)
docker-up:
	cd $(BACKEND_DIR) && docker-compose up --build -d
	@echo "🐳  Full stack running."

## Stop the full Docker stack
docker-down:
	cd $(BACKEND_DIR) && docker-compose down

## Tail Docker logs
docker-logs:
	cd $(BACKEND_DIR) && docker-compose logs -f

# ─── Help ────────────────────────────────────────────────────

## Show this help
help:
	@echo ""
	@echo "CoupleFlow Budget App"
	@echo "====================="
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Quick start:"
	@echo "  setup          First-time setup (db + migrations + npm install)"
	@echo "  dev            Run backend + frontend together"
	@echo "  stop           Tear down Docker containers"
	@echo ""
	@echo "Database:"
	@echo "  db             Start Postgres in Docker"
	@echo "  db-reset       Drop & recreate database (destructive)"
	@echo "  migrate-up     Run all pending migrations"
	@echo "  migrate-down   Roll back last migration"
	@echo "  migrate-status Show current migration version"
	@echo ""
	@echo "Backend:"
	@echo "  backend        Run Go server (hot reload with 'air')"
	@echo "  build          Compile backend binary"
	@echo "  test           Run backend tests"
	@echo ""
	@echo "Frontend:"
	@echo "  frontend       Start Expo dev server"
	@echo "  frontend-web   Start Expo web build"
	@echo ""
	@echo "Docker:"
	@echo "  docker-up      Start full Docker stack"
	@echo "  docker-down    Stop full Docker stack"
	@echo "  docker-logs    Tail Docker logs"
	@echo ""
