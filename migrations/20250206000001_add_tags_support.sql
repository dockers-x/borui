-- Add tags support for clients and servers
-- Tags are stored as comma-separated values for simplicity

ALTER TABLE clients ADD COLUMN tags TEXT DEFAULT NULL;
ALTER TABLE servers ADD COLUMN tags TEXT DEFAULT NULL;

-- Create indexes for better query performance when filtering by tags
CREATE INDEX IF NOT EXISTS idx_clients_tags ON clients(tags) WHERE tags IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_servers_tags ON servers(tags) WHERE tags IS NOT NULL;
