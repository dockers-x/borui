# Multi-stage build for smaller image with dependency caching

# Stage 1: Prepare recipe for dependency caching
FROM rust:1.92.0-slim-bookworm AS chef
RUN cargo install cargo-chef
WORKDIR /app

# Stage 2: Analyze dependencies
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Stage 3: Build dependencies (cached layer)
FROM chef AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build dependencies first (this layer is cached unless dependencies change)
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Copy source code and build application
COPY . .
RUN cargo build --release

# Stage 4: Runtime stage - use minimal base image
FROM debian:trixie-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled binary from builder stage
# Static files and migrations are embedded via rust-embed and sqlx::migrate!
COPY --from=builder /app/target/release/borui /app/borui

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose ports
# 3000: Web UI
# 7835-65535: Default bore tunnel port range
EXPOSE 3000 7835-65535

# Environment variables
ENV DATABASE_URL=sqlite:///app/data/borui.db \
    BIND_ADDR=0.0.0.0:3000 \
    RUST_LOG=info \
    JWT_SECRET=change-me-in-production

# Run the application
CMD ["/app/borui"]
