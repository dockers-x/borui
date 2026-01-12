-- Add webhook configuration columns to clients table
ALTER TABLE clients ADD COLUMN webhook_url TEXT;
ALTER TABLE clients ADD COLUMN webhook_format TEXT NOT NULL DEFAULT 'json';
ALTER TABLE clients ADD COLUMN webhook_template TEXT;
