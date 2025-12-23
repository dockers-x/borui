# Multi-stage build for smaller image
FROM rust:1.92-slim as builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Create dummy source files for dependency caching
# borui is a library + binary project, so we need both lib.rs and main.rs
RUN mkdir src && \
    echo "pub fn dummy() {}" > src/lib.rs && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy all source code, migrations, and static files
COPY . .

# Build the actual application
# Remove the dummy build artifacts to force a clean rebuild
RUN rm -f /app/target/release/borui* && \
    rm -f /app/target/release/deps/borui* && \
    cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the binary (static files and migrations are embedded)
COPY --from=builder /app/target/release/borui /app/borui

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose ports (3000 for web UI, 7835 is default bore port range start)
EXPOSE 3000 7835

ENV DATABASE_URL=sqlite:///app/data/borui.db
ENV BIND_ADDR=0.0.0.0:3000
ENV RUST_LOG=info

CMD ["/app/borui"]
