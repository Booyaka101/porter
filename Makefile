.PHONY: all build build-ui ui build-go clean run dev install check test lint fmt build-all docker-build docker-run docker-stop docker-compose-up docker-compose-down docker-compose-mysql docker-clean

# Default target
all: build

# Build everything (UI + Go binary)
build: build-ui build-go

# Pre-commit gate: format check + vet + build + tests across the whole module.
check: fmt vet
	go build ./...
	go test ./...

test:
	go test ./...

# go vet across the module
vet:
	go vet ./...

# Fail if any Go file is not gofmt-clean
fmt:
	@if [ -n "$$(gofmt -l .)" ]; then \
		echo "These files are not gofmt-clean:"; gofmt -l .; exit 1; \
	fi

# Static analysis (matches CI). Requires golangci-lint.
lint:
	golangci-lint run ./...

# Build the React UI and stage it for both the CLI and the standalone UI server.
ui: build-ui

build-ui:
	@echo "Building UI..."
	cd ui && npm install && npm run build
	@echo "Staging UI build (cmd/porter + porterui embed)..."
	rm -rf cmd/porter/build porterui/build
	cp -r ui/build cmd/porter/build
	cp -r ui/build porterui/build

# Build Go binary
build-go:
	@echo "Building porter binary..."
	go build -o porter ./cmd/porter

# Clean build artifacts
clean:
	rm -rf porter
	rm -rf cmd/porter/build
	rm -rf ui/build
	rm -rf ui/node_modules

# Run porter
run: build
	./porter -open=false

# Development mode - run with auto-open
dev: build
	./porter

# Install dependencies
install:
	cd ui && npm install
	go mod download

# Build for multiple platforms
build-all: build-ui
	@echo "Building for Linux..."
	GOOS=linux GOARCH=amd64 go build -o porter-linux-amd64 ./cmd/porter
	@echo "Building for macOS..."
	GOOS=darwin GOARCH=amd64 go build -o porter-darwin-amd64 ./cmd/porter
	GOOS=darwin GOARCH=arm64 go build -o porter-darwin-arm64 ./cmd/porter
	@echo "Building for Windows..."
	GOOS=windows GOARCH=amd64 go build -o porter-windows-amd64.exe ./cmd/porter

# Docker targets
docker-build:
	@echo "Building Docker image..."
	docker build -t porter:latest .

docker-run: docker-build
	@echo "Running Porter in Docker..."
	docker run -d --name porter -p 8069:8069 -v porter-data:/app/data porter:latest

docker-stop:
	docker stop porter && docker rm porter

docker-compose-up:
	docker compose up -d

docker-compose-down:
	docker compose down

docker-compose-mysql:
	docker compose --profile mysql up -d

docker-clean:
	docker compose down -v
	docker rmi porter:latest 2>/dev/null || true
