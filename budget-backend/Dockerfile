# Use Go base image
FROM golang:1.21-alpine as builder

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

# Build the Go app
RUN go build -o budget-app-backend main.go

# Use minimal runtime image
FROM alpine:latest

WORKDIR /root/

# Copy compiled binary from builder
COPY --from=builder /app/budget-app-backend .

# Copy .env if needed (optional)
# COPY .env .

# Set environment variable to configure port (optional)
ENV PORT=8080

# Run the binary
CMD ["./budget-app-backend"]
