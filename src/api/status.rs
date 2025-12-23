use axum::{
    extract::State,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health_check))
        .route("/version", get(version_info))
        .route("/stats", get(system_stats))
}

#[derive(Debug, Serialize, Deserialize)]
struct HealthResponse {
    status: String,
    database: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct VersionResponse {
    version: String,
    build_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct StatsResponse {
    servers_running: usize,
    clients_connected: usize,
    total_servers: i64,
    total_clients: i64,
}

async fn health_check(
    State(state): State<AppState>,
) -> Result<Json<HealthResponse>> {
    // Check database connection
    let db_status = match sqlx::query("SELECT 1")
        .execute(&state.db)
        .await
    {
        Ok(_) => "ok",
        Err(_) => "error",
    };

    Ok(Json(HealthResponse {
        status: "ok".to_string(),
        database: db_status.to_string(),
    }))
}

async fn version_info() -> Result<Json<VersionResponse>> {
    Ok(Json(VersionResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_date: "2025-12-23".to_string(), // TODO: Use build-time env var
    }))
}

async fn system_stats(
    State(state): State<AppState>,
) -> Result<Json<StatsResponse>> {
    // Get total counts from database
    let total_servers: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM servers")
        .fetch_one(&state.db)
        .await?;

    let total_clients: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM clients")
        .fetch_one(&state.db)
        .await?;

    // Get running counts (this is a placeholder - actual implementation would query the managers)
    let servers_running = 0;
    let clients_connected = 0;

    Ok(Json(StatsResponse {
        servers_running,
        clients_connected,
        total_servers: total_servers.0,
        total_clients: total_clients.0,
    }))
}
