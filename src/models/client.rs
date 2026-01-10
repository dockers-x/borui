use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Client {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub local_host: String,
    pub local_port: i64,
    pub remote_server: String,
    pub remote_port: i64,
    pub assigned_port: Option<i64>,
    pub secret: Option<String>,
    pub status: ClientStatus,
    pub auto_start: bool,
    pub webhook_url: Option<String>,
    pub webhook_format: String,
    pub webhook_template: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_connected_at: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ClientStatus {
    Stopped,
    Starting,
    Connected,
    Error,
}

#[derive(Debug, Deserialize)]
pub struct CreateClient {
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_local_host")]
    pub local_host: String,
    pub local_port: i64,
    pub remote_server: String,
    #[serde(default)]
    pub remote_port: i64,
    pub secret: Option<String>,
    #[serde(default)]
    pub auto_start: bool,
    pub webhook_url: Option<String>,
    #[serde(default = "default_webhook_format")]
    pub webhook_format: String,
    pub webhook_template: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClient {
    pub name: Option<String>,
    pub description: Option<String>,
    pub local_host: Option<String>,
    pub local_port: Option<i64>,
    pub remote_server: Option<String>,
    pub remote_port: Option<i64>,
    pub secret: Option<String>,
    pub auto_start: Option<bool>,
    pub webhook_url: Option<String>,
    pub webhook_format: Option<String>,
    pub webhook_template: Option<String>,
}

fn default_local_host() -> String {
    "localhost".to_string()
}

fn default_webhook_format() -> String {
    "json".to_string()
}
