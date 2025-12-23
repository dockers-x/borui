-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table for web UI authentication
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Note: Initial admin user will be created by the application
-- using environment variables INIT_ADMIN and INIT_ADMIN_PASSWORD
-- Default values if not set: admin / admin
