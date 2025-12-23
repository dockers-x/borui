use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Server {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub bind_addr: String,
    pub bind_tunnels: String,
    pub port_range_start: i64,
    pub port_range_end: i64,
    pub secret: Option<String>,
    pub status: ServerStatus,
    pub auto_start: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_started_at: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    Stopped,
    Starting,
    Running,
    Error,
}

#[derive(Debug, Deserialize)]
pub struct CreateServer {
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_bind_addr")]
    pub bind_addr: String,
    #[serde(default = "default_bind_tunnels")]
    pub bind_tunnels: String,
    #[serde(default = "default_port_start")]
    pub port_range_start: i64,
    #[serde(default = "default_port_end")]
    pub port_range_end: i64,
    pub secret: Option<String>,
    #[serde(default)]
    pub auto_start: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateServer {
    pub name: Option<String>,
    pub description: Option<String>,
    pub bind_addr: Option<String>,
    pub bind_tunnels: Option<String>,
    pub port_range_start: Option<i64>,
    pub port_range_end: Option<i64>,
    pub secret: Option<String>,
    pub auto_start: Option<bool>,
}

fn default_bind_addr() -> String {
    "0.0.0.0".to_string()
}

fn default_bind_tunnels() -> String {
    "0.0.0.0".to_string()
}

fn default_port_start() -> i64 {
    1024
}

fn default_port_end() -> i64 {
    65535
}
