-- Bore clients (tunnels to remote servers)
CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,

    -- Local settings
    local_host TEXT NOT NULL DEFAULT 'localhost',
    local_port INTEGER NOT NULL,

    -- Remote server settings
    remote_server TEXT NOT NULL,  -- hostname/IP
    remote_port INTEGER NOT NULL DEFAULT 0,  -- 0 = any available port
    assigned_port INTEGER,  -- actual port assigned by server
    secret TEXT,  -- Optional authentication secret

    -- Status
    status TEXT NOT NULL CHECK(status IN ('stopped', 'starting', 'connected', 'error')) DEFAULT 'stopped',
    auto_start BOOLEAN NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_connected_at TEXT,
    error_message TEXT
);

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_remote ON clients(remote_server);
