-- Active sessions tracking
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_type TEXT NOT NULL CHECK(session_type IN ('server', 'client')),
    entity_id INTEGER NOT NULL,  -- foreign key to servers.id or clients.id
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    connection_count INTEGER NOT NULL DEFAULT 0,
    bytes_sent INTEGER NOT NULL DEFAULT 0,
    bytes_received INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_type_entity ON sessions(session_type, entity_id);
CREATE INDEX idx_sessions_heartbeat ON sessions(last_heartbeat);
