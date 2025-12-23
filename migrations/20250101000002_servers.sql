-- Bore servers managed by this instance
CREATE TABLE servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    bind_addr TEXT NOT NULL DEFAULT '0.0.0.0',
    bind_tunnels TEXT NOT NULL DEFAULT '0.0.0.0',
    port_range_start INTEGER NOT NULL DEFAULT 1024,
    port_range_end INTEGER NOT NULL DEFAULT 65535,
    secret TEXT,  -- Optional authentication secret
    status TEXT NOT NULL CHECK(status IN ('stopped', 'starting', 'running', 'error')) DEFAULT 'stopped',
    auto_start BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_started_at TEXT,
    error_message TEXT
);

CREATE INDEX idx_servers_status ON servers(status);
