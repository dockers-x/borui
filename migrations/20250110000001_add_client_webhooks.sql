-- Add webhook configuration to clients
ALTER TABLE clients ADD COLUMN webhook_url TEXT;
ALTER TABLE clients ADD COLUMN webhook_format TEXT NOT NULL DEFAULT 'json' CHECK(webhook_format IN ('json', 'custom'));
ALTER TABLE clients ADD COLUMN webhook_template TEXT;
