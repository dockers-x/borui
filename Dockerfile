# Multi-stage build for smaller image
FROM rust:1.75-slim as builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Cache dependencies by building a dummy project
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy source code and static files
COPY . .

# Build application (touch to ensure rebuild)
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/borui /app/borui

# Copy static files and migrations
COPY --from=builder /app/static /app/static
COPY --from=builder /app/migrations /app/migrations

# Create data directory
RUN mkdir -p /app/data

# Expose ports
EXPOSE 3000 7835

ENV DATABASE_URL=sqlite:///app/data/borui.db
ENV BIND_ADDR=0.0.0.0:3000
ENV RUST_LOG=info

CMD ["/app/borui"]
