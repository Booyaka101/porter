# Stage 1: Build UI
FROM node:20-alpine AS ui-builder

WORKDIR /app/web/ui

# Copy package files first for better caching
COPY web/ui/package*.json ./
RUN npm ci

# Copy UI source and build
COPY web/ui/ ./
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS go-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Copy built UI from previous stage
COPY --from=ui-builder /app/web/ui/build ./cmd/porter-ui/build

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o porter-ui ./cmd/porter-ui

# Stage 3: Final runtime image
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    openssh-client \
    rsync \
    tzdata

# Create non-root user
RUN adduser -D -u 1000 porter

# Copy binary from builder
COPY --from=go-builder /app/porter-ui /app/porter-ui

# Create data directory
RUN mkdir -p /app/data && chown -R porter:porter /app

# Switch to non-root user
USER porter

# Expose port
EXPOSE 8069

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8069/ || exit 1

# Environment variables
ENV PORT=8069
ENV USE_SQLITE=true

# Run porter
ENTRYPOINT ["/app/porter-ui"]
CMD ["-open=false"]
