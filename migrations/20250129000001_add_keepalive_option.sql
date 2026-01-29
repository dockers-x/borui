-- Add TCP keepalive option to clients table
ALTER TABLE clients ADD COLUMN enable_keepalive BOOLEAN NOT NULL DEFAULT 1;
