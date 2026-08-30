# Use Go base image
FROM golang:1.23-alpine AS builder

# Set working directory
WORKDIR /app

# Install Git (for private modules, if needed)
RUN apk add --no-cache git

# Copy go mod and download deps
COPY go.mod ./
COPY go.sum ./
RUN go mod download

# Copy the rest of the application
COPY . .

# Release version, stamped into the /health response
ARG VERSION=dev

# Build the Go app
RUN go build -ldflags "-X github.com/aboogie/budget-backend/handlers.Version=${VERSION}" -o budget-app-backend main.go

# Use minimal runtime image
FROM alpine:latest

# TLS trust store (Plaid/Teller/Anthropic calls) + timezone data
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /root/

# Copy compiled binary from builder
COPY --from=builder /app/budget-app-backend .

# Ship migrations so a deploy can run them (e.g. migrate/migrate pointed
# at this path, or a bind from the image)
COPY --from=builder /app/migrations ./migrations

# Configuration comes from runtime environment variables (docker compose
# env_file / -e) — never bake a .env into the image.

# Set environment variable to configure port (optional)
ENV PORT=8080

# Run the binary
CMD ["./budget-app-backend"]
