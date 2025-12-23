use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: i64,
    pub session_type: SessionType,
    pub entity_id: i64,
    pub started_at: String,
    pub last_heartbeat: String,
    pub connection_count: i64,
    pub bytes_sent: i64,
    pub bytes_received: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    Server,
    Client,
}

#[derive(Debug, Serialize)]
pub struct SessionStats {
    pub connection_count: i64,
    pub bytes_sent: i64,
    pub bytes_received: i64,
    pub uptime_seconds: i64,
}
