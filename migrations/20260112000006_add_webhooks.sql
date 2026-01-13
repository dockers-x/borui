-- Add webhook configuration to clients
ALTER TABLE clients ADD COLUMN webhook_url TEXT;
ALTER TABLE clients ADD COLUMN webhook_format TEXT NOT NULL DEFAULT 'json' CHECK(webhook_format IN ('json', 'custom'));
ALTER TABLE clients ADD COLUMN webhook_template TEXT;

-- Create index for webhook-enabled clients
CREATE INDEX idx_clients_webhook ON clients(webhook_url) WHERE webhook_url IS NOT NULL;
