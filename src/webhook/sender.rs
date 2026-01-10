use crate::models::Client;
use handlebars::Handlebars;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WebhookEvent {
    Connected,
    Disconnected,
}

impl WebhookEvent {
    pub fn as_str(&self) -> &str {
        match self {
            WebhookEvent::Connected => "connected",
            WebhookEvent::Disconnected => "disconnected",
        }
    }
}

#[derive(Debug, Clone)]
pub struct WebhookSender {
    client: reqwest::Client,
}

impl WebhookSender {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|e| {
                tracing::warn!("Failed to build webhook HTTP client with custom config: {}. Using default client.", e);
                reqwest::Client::new()
            });

        Self { client }
    }

    /// Validate webhook URL to prevent SSRF attacks
    fn validate_webhook_url(url: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let parsed = url::Url::parse(url)
            .map_err(|e| format!("Invalid webhook URL: {}", e))?;

        // Only allow HTTP and HTTPS schemes
        let scheme = parsed.scheme();
        if scheme != "http" && scheme != "https" {
            return Err(format!("Invalid webhook URL scheme: {}. Only http and https are allowed.", scheme).into());
        }

        // Check for private/internal IP addresses
        if let Some(host) = parsed.host_str() {
            // Resolve hostname to IP if it's not already an IP
            if let Ok(ip) = host.parse::<IpAddr>() {
                if Self::is_private_ip(&ip) {
                    return Err("Webhook URL points to private IP address. This is not allowed for security reasons.".into());
                }
            } else {
                // For hostnames, check common private network patterns
                let host_lower = host.to_lowercase();
                if host_lower == "localhost"
                    || host_lower.ends_with(".local")
                    || host_lower.ends_with(".internal") {
                    return Err(format!("Webhook hostname '{}' appears to be internal. This is not allowed for security reasons.", host).into());
                }
            }
        }

        Ok(())
    }

    fn is_private_ip(ip: &IpAddr) -> bool {
        match ip {
            IpAddr::V4(ipv4) => {
                ipv4.is_private()
                    || ipv4.is_loopback()
                    || ipv4.is_link_local()
                    || ipv4.is_broadcast()
                    || ipv4.is_documentation()
                    || *ipv4 == Ipv4Addr::new(0, 0, 0, 0) // 0.0.0.0
            }
            IpAddr::V6(ipv6) => {
                ipv6.is_loopback()
                    || ipv6.is_unspecified()
                    || *ipv6 == Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1) // ::1
            }
        }
    }

    pub async fn send(
        &self,
        url: &str,
        event: WebhookEvent,
        client_data: &Client,
        extra_data: serde_json::Value,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Validate URL before sending
        Self::validate_webhook_url(url)?;

        let format = &client_data.webhook_format;

        let (body, content_type) = if format == "custom" {
            let body = self.render_custom_template(event.clone(), client_data, extra_data)?;
            (body, "text/plain")
        } else {
            let body = self.build_json_payload(event, client_data, extra_data)?;
            (body, "application/json")
        };

        self.send_with_retry(url, body, content_type).await?;
        Ok(())
    }

    fn build_json_payload(
        &self,
        event: WebhookEvent,
        client: &Client,
        extra_data: serde_json::Value,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let timestamp = chrono::Utc::now().to_rfc3339();

        let mut payload = json!({
            "event": format!("client.{}", event.as_str()),
            "timestamp": timestamp,
            "client_id": client.id,
            "client_name": &client.name,
        });

        if let Some(desc) = &client.description {
            payload["description"] = json!(desc);
        }

        match event {
            WebhookEvent::Connected => {
                payload["local_host"] = json!(&client.local_host);
                payload["local_port"] = json!(client.local_port);
                payload["remote_server"] = json!(&client.remote_server);
                if let Some(port) = client.assigned_port {
                    payload["assigned_port"] = json!(port);
                }
            }
            WebhookEvent::Disconnected => {
                if let Some(uptime) = extra_data.get("uptime_seconds") {
                    payload["uptime_seconds"] = uptime.clone();
                }
            }
        }

        serde_json::to_string(&payload)
            .map_err(|e| format!("Failed to serialize webhook payload: {}", e).into())
    }

    fn render_custom_template(
        &self,
        event: WebhookEvent,
        client: &Client,
        extra_data: serde_json::Value,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let template = client
            .webhook_template
            .as_ref()
            .ok_or("No webhook template configured")?;

        let timestamp = chrono::Utc::now().to_rfc3339();

        let mut data = serde_json::Map::new();
        data.insert("event".to_string(), json!(event.as_str()));
        data.insert("timestamp".to_string(), json!(timestamp));
        data.insert("client_id".to_string(), json!(client.id));
        data.insert("client_name".to_string(), json!(&client.name));

        if let Some(desc) = &client.description {
            data.insert("description".to_string(), json!(desc));
        }

        match event {
            WebhookEvent::Connected => {
                data.insert("local_host".to_string(), json!(&client.local_host));
                data.insert("local_port".to_string(), json!(client.local_port));
                data.insert("remote_server".to_string(), json!(&client.remote_server));
                if let Some(port) = client.assigned_port {
                    data.insert("assigned_port".to_string(), json!(port));
                }
            }
            WebhookEvent::Disconnected => {
                if let Some(uptime) = extra_data.get("uptime_seconds") {
                    data.insert("uptime_seconds".to_string(), uptime.clone());
                }
            }
        }

        let handlebars = Handlebars::new();
        let rendered = handlebars.render_template(template, &data)?;

        Ok(rendered)
    }

    async fn send_with_retry(
        &self,
        url: &str,
        body: String,
        content_type: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let max_retries = 3;
        let mut last_error = None;

        for attempt in 1..=max_retries {
            match self
                .client
                .post(url)
                .header("Content-Type", content_type)
                .body(body.clone())
                .send()
                .await
            {
                Ok(response) => {
                    let status = response.status();
                    if status.is_success() {
                        tracing::info!(
                            "Webhook sent successfully to {} (attempt {})",
                            url,
                            attempt
                        );
                        return Ok(());
                    } else if status.is_client_error() {
                        // Don't retry 4xx errors - they won't succeed on retry
                        let error_msg = format!("HTTP {} (client error, not retrying)", status);
                        tracing::error!("Webhook to {} failed: {}", url, error_msg);
                        return Err(error_msg.into());
                    } else {
                        // Retry 5xx server errors
                        tracing::warn!(
                            "Webhook returned status {} (attempt {})",
                            status,
                            attempt
                        );
                        last_error = Some(format!("HTTP {}", status));
                    }
                }
                Err(e) => {
                    tracing::warn!("Webhook failed (attempt {}): {}", attempt, e);
                    last_error = Some(e.to_string());
                }
            }

            if attempt < max_retries {
                let delay = Duration::from_millis(100 * 2u64.pow(attempt - 1));
                tokio::time::sleep(delay).await;
            }
        }

        let error_msg = last_error.unwrap_or_else(|| "Unknown error".to_string());
        tracing::error!("Webhook to {} failed after {} attempts: {}", url, max_retries, error_msg);
        Err(error_msg.into())
    }
}

impl Default for WebhookSender {
    fn default() -> Self {
        Self::new()
    }
}

/// Fire-and-forget webhook sending
pub fn send_webhook(
    url: String,
    event: WebhookEvent,
    client: Client,
    extra_data: serde_json::Value,
) {
    tokio::spawn(async move {
        let sender = WebhookSender::new();
        if let Err(e) = sender.send(&url, event, &client, extra_data).await {
            tracing::error!("Webhook error: {}", e);
        }
    });
}
