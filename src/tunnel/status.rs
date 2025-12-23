use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatusInfo {
    pub id: i64,
    pub status: String,
    pub active_connections: u64,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientStatusInfo {
    pub id: i64,
    pub status: String,
    pub assigned_port: Option<u16>,
    pub uptime_seconds: u64,
}
