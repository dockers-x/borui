# Multi-stage build for smaller image
FROM rust:1.92-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy all source files
# (For dependency caching in a complex project, consider using cargo-chef)
COPY . .

# Build the application in release mode
RUN cargo build --release

# Runtime stage - use minimal base image
FROM debian:bookworm-slim

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
