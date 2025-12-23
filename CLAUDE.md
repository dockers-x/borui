# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`borui` is a web-based management application for bore tunnels, built with Rust (2024 edition). It provides a comprehensive UI for managing both bore servers and clients with real-time status updates.

## Build Commands

- **Build the project**: `cargo build`
- **Build with optimizations**: `cargo build --release`
- **Run the application**: `cargo run`
- **Run in release mode**: `cargo run --release`
- **Clean build artifacts**: `cargo clean`

## Testing Commands

- **Run all tests**: `cargo test`
- **Run a specific test**: `cargo test <test_name>`
- **Run tests with output**: `cargo test -- --nocapture`

## Development Commands

- **Check code without building**: `cargo check`
- **Format code**: `cargo fmt`
- **Lint with Clippy**: `cargo clippy`
- **Update dependencies**: `cargo update`

## Docker Commands

- **Build image**: `docker build -t borui:latest .`
- **Run with Docker Compose**: `docker-compose up -d`
- **View logs**: `docker-compose logs -f`
- **Stop services**: `docker-compose down`

## Features
- Server included: Users can setup own server with options in web UI
- Multi-client support and management in web UI, users can connect to multiple servers
- Modern web UI embedded in the binary
- Modern CSS for better UI appearance
- Multi-language support: Chinese, English, Traditional Chinese
- Backend: Axum + SQLite (lightweight but powerful)
- Docker Compose deployment and GitHub Actions auto-build for Docker Hub and GHCR

## Architecture

### Technology Stack
- **Web Framework**: Axum 0.7 with Tower middleware
- **Database**: SQLite via sqlx (async, compile-time checked queries)
- **Tunnel Integration**: bore-cli library API (not spawning processes)
- **Frontend**: Vanilla JavaScript + HTML/CSS (embedded via rust-embed)
- **Authentication**: JWT tokens with Argon2 password hashing
- **Real-time**: WebSocket for live status updates

### Core Components

#### Backend Structure (`src/`)
- **main.rs**: Application entry point, Axum server initialization, graceful shutdown
- **config.rs**: Configuration from environment variables
- **error.rs**: Centralized error handling with AppError enum
- **state.rs**: AppState with database pool, ServerManager, ClientManager, and WsBroadcaster
- **models/**: Database models (Server, Client, Session, User) with serde serialization
- **db/operations.rs**: CRUD operations for all entities
- **api/**: REST API handlers
  - auth.rs: JWT authentication (login, logout, me)
  - servers.rs: Server CRUD and control (start, stop, status)
  - clients.rs: Client CRUD and control (start, stop, status)
  - status.rs: System health and statistics
- **tunnel/**: Tunnel management logic
  - server_manager.rs: Manages bore server instances (DashMap-based)
  - client_manager.rs: Manages bore client instances (DashMap-based)
  - status.rs: Status tracking structures
- **ws/handler.rs**: WebSocket connection handler and broadcaster
- **web/static_files.rs**: Embedded static file serving via rust-embed

#### Frontend Structure (`static/`)
- **index.html**: Main UI layout with navigation tabs
- **css/main.css**: Custom styles (no framework dependencies)
- **js/**:
  - app.js: Main application initialization and routing
  - i18n.js: Internationalization with localStorage persistence
  - api.js: REST API client wrapper with fetch
  - websocket.js: WebSocket client with auto-reconnection
  - servers.js: Server management UI logic
  - clients.js: Client management UI logic
- **locales/**: Translation files (en.json, zh-CN.json, zh-TW.json)

#### Database Schema (`migrations/`)
- **users**: Web authentication (id, username, password_hash)
- **servers**: Bore server configurations (id, name, bind_addr, port_range, secret, status)
- **clients**: Bore client configurations (id, name, local_host, local_port, remote_server, assigned_port, status)
- **sessions**: Active connection tracking (id, session_type, entity_id, stats)

### Key Design Patterns

1. **Tunnel Management**: Uses DashMap for concurrent access to running tunnel instances
2. **Real-time Updates**: WebSocket broadcaster pattern with topic-based subscriptions
3. **Error Handling**: Custom AppError type that implements IntoResponse for Axum
4. **Database Access**: Async sqlx with compile-time query verification
5. **Static Files**: Embedded at compile-time using rust-embed for single-binary deployment
6. **Authentication**: JWT tokens stored in localStorage, verified via middleware

### API Endpoints

All API endpoints are under `/api/v1`:
- **Auth**: `/auth/login`, `/auth/logout`, `/auth/me`
- **Servers**: `/servers`, `/servers/:id`, `/servers/:id/start`, `/servers/:id/stop`
- **Clients**: `/clients`, `/clients/:id`, `/clients/:id/start`, `/clients/:id/stop`
- **System**: `/system/health`, `/system/version`, `/system/stats`
- **WebSocket**: `/ws` (real-time status updates)

### Database Migrations

Migrations are stored in `migrations/` and run automatically on startup via sqlx::migrate!()

### Important Notes for Development

1. **bore-cli Integration**: ServerManager and ClientManager use bore-cli's library API directly (not spawning processes). This is currently stubbed with TODO markers.

2. **WebSocket Messages**: Follow the WsMessage enum in ws/handler.rs for consistency:
   - ServerStatus: Server state changes
   - ClientStatus: Client state changes
   - ConnectionEvent: New connections
   - Error: Error notifications
   - Pong: Heartbeat response

3. **Frontend i18n**: When adding UI text, add corresponding keys to all locale files (en.json, zh-CN.json, zh-TW.json)

4. **Database Changes**: Create new migration files with sequential timestamps (format: YYYYMMDDHHMMSS_description.sql)

5. **Error Handling**: Use Result<T> = std::result::Result<T, AppError> throughout the codebase

6. **Static Files**: After modifying static files, rebuild to embed changes

7. **Authentication**: Default user is admin/admin - remind users to change this in production

8. **Docker**: Multi-stage build caches dependencies for faster subsequent builds

### TODO Items

The following features are planned but not yet implemented:
1. **Full bore-cli Integration**: ServerManager and ClientManager currently have stub implementations
2. **Auto-start Functionality**: Servers/clients with auto_start=true should start on application boot
3. **Advanced Authentication**: Role-based access control (RBAC)
4. **Metrics Collection**: Detailed statistics for tunnel usage
5. **Rate Limiting**: API rate limiting middleware
6. **TLS Support**: Optional TLS for bore tunnels via bore-cli's secret mechanism

### Common Development Tasks

**Adding a new API endpoint:**
1. Define route in appropriate `api/*.rs` file
2. Add handler function with State extraction
3. Update api/mod.rs router if needed
4. Add database operations in db/operations.rs if needed
5. Update frontend API client in static/js/api.js
6. Add UI handling in appropriate static/js/*.js file

**Adding a new database table:**
1. Create migration in migrations/ directory
2. Add model in src/models/
3. Export from src/models/mod.rs
4. Add CRUD operations in src/db/operations.rs
5. Create API handlers if needed

**Updating translations:**
1. Modify all three locale files: en.json, zh-CN.json, zh-TW.json
2. Use dotted key notation (e.g., "nav.servers")
3. Update UI elements with data-i18n attributes
