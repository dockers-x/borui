# Borui - Web-based Bore Tunnel Management

Borui is a comprehensive web-based management application for [bore](https://github.com/ekzhang/bore) tunnels. It provides a modern web UI to manage both bore servers and clients, with multi-language support and real-time status updates.

## Features

- **Server Included**: Setup your own bore server with configurable options via web UI
- **Multi-Client Support**: Manage multiple bore clients connecting to various servers
- **Modern Web UI**: Clean, responsive interface embedded directly in the binary
- **Real-time Updates**: WebSocket-based live status updates for all tunnels
- **Multi-language**: Support for English, Simplified Chinese, and Traditional Chinese
- **Lightweight**: Built with Axum + SQLite - powerful but minimal footprint
- **Docker Ready**: Docker Compose deployment with automated builds via GitHub Actions

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/borui.git
cd borui

# Start the application
docker-compose up -d

# Access the web UI
open http://localhost:3000
```

Default login: `admin` / `admin` (change this immediately!)

### Manual Installation

```bash
# Build from source
cargo build --release

# Copy environment template
cp .env.example .env

# Edit configuration as needed
vim .env

# Run the application
cargo run --release
```

## Configuration

Configuration is done via environment variables or `.env` file:

```bash
# Database location
DATABASE_URL=sqlite://./data/borui.db

# Server bind address
BIND_ADDR=0.0.0.0:3000

# JWT secret for authentication (CHANGE THIS!)
JWT_SECRET=change-me-in-production-this-is-not-secure

# Logging level
RUST_LOG=info,borui=debug
```

## Development

### Prerequisites

- Rust 1.75+ (2024 edition)
- SQLite 3
- Node.js (optional, for frontend development)

### Build Commands

```bash
# Check code
cargo check

# Build project
cargo build

# Build with optimizations
cargo build --release

# Run application
cargo run

# Run tests
cargo test

# Format code
cargo fmt

# Lint code
cargo clippy
```

### Project Structure

```
borui/
├── src/
│   ├── main.rs              # Application entry point
│   ├── api/                 # REST API handlers
│   ├── db/                  # Database operations
│   ├── models/              # Data models
│   ├── tunnel/              # Tunnel management logic
│   ├── ws/                  # WebSocket handler
│   └── web/                 # Static file serving
├── static/                  # Frontend files
│   ├── css/                 # Stylesheets
│   ├── js/                  # JavaScript
│   └── locales/             # Translation files
├── migrations/              # Database migrations
├── Dockerfile               # Docker image
└── docker-compose.yml       # Docker Compose config
```

## API Documentation

### Authentication

- `POST /api/v1/auth/login` - Login with username/password
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user

### Servers

- `GET /api/v1/servers` - List all servers
- `POST /api/v1/servers` - Create server
- `GET /api/v1/servers/:id` - Get server details
- `PUT /api/v1/servers/:id` - Update server
- `DELETE /api/v1/servers/:id` - Delete server
- `POST /api/v1/servers/:id/start` - Start server
- `POST /api/v1/servers/:id/stop` - Stop server

### Clients

- `GET /api/v1/clients` - List all clients
- `POST /api/v1/clients` - Create client
- `GET /api/v1/clients/:id` - Get client details
- `PUT /api/v1/clients/:id` - Update client
- `DELETE /api/v1/clients/:id` - Delete client
- `POST /api/v1/clients/:id/start` - Start client
- `POST /api/v1/clients/:id/stop` - Stop client

### System

- `GET /api/v1/system/health` - Health check
- `GET /api/v1/system/version` - Version info
- `GET /api/v1/system/stats` - System statistics

## WebSocket

Connect to `/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Update:', message);
};
```

## Deployment

### Docker

```bash
# Build image
docker build -t borui:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -p 7835:7835 \
  -v ./data:/app/data \
  -e JWT_SECRET=your-secret-here \
  borui:latest
```

### Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Architecture

Borui is built with:

- **Backend**: Rust with Axum web framework
- **Database**: SQLite with sqlx for async database operations
- **Frontend**: Vanilla JavaScript (no framework bloat!)
- **Real-time**: WebSocket for live updates
- **Authentication**: JWT tokens with Argon2 password hashing

### Tunnel Management

- **ServerManager**: Manages bore server instances using the bore-cli library API
- **ClientManager**: Manages bore client tunnels, tracks assigned ports
- **Status Tracking**: Real-time monitoring of all tunnels

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built on top of [bore](https://github.com/ekzhang/bore) by Eric Zhang
- Uses [Axum](https://github.com/tokio-rs/axum) web framework
- Powered by [Tokio](https://tokio.rs/) async runtime

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/borui/issues).
