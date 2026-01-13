
-- Create index for webhook-enabled clients
CREATE INDEX idx_clients_webhook ON clients(webhook_url) WHERE webhook_url IS NOT NULL;
