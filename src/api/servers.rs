use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};

use crate::db;
use crate::error::Result;
use crate::models::{CreateServer, Server, ServerStatus, UpdateServer};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_servers).post(create_server))
        .route("/{id}", get(get_server).put(update_server).delete(delete_server))
        .route("/{id}/start", post(start_server))
        .route("/{id}/stop", post(stop_server))
        .route("/{id}/status", get(get_server_status))
}

async fn list_servers(
    State(state): State<AppState>,
) -> Result<Json<Vec<Server>>> {
    let servers = db::list_servers(&state.db).await?;
    Ok(Json(servers))
}

async fn get_server(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Server>> {
    let server = db::get_server(&state.db, id).await?;
    Ok(Json(server))
}

async fn create_server(
    State(state): State<AppState>,
    Json(input): Json<CreateServer>,
) -> Result<(StatusCode, Json<Server>)> {
    let server = db::create_server(&state.db, input).await?;
    Ok((StatusCode::CREATED, Json(server)))
}

async fn update_server(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(input): Json<UpdateServer>,
) -> Result<Json<Server>> {
    let server = db::update_server(&state.db, id, input).await?;
    Ok(Json(server))
}

async fn delete_server(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<StatusCode> {
    // Ensure server is stopped before deletion
    let server = db::get_server(&state.db, id).await?;
    if server.status != ServerStatus::Stopped {
        return Err(crate::error::AppError::BadRequest(
            "Cannot delete running server. Stop it first.".to_string()
        ));
    }

    db::delete_server(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn start_server(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Server>> {
    let mut server = db::get_server(&state.db, id).await?;

    if server.status == ServerStatus::Running {
        return Err(crate::error::AppError::BadRequest(
            "Server is already running".to_string()
        ));
    }

    // Update status to starting
    db::update_server_status(&state.db, id, ServerStatus::Starting, None).await?;
    db::update_server_last_started(&state.db, id).await?;

    // Start the server using ServerManager
    match state.server_manager.start_server(server.clone()).await {
        Ok(_) => {
            db::update_server_status(&state.db, id, ServerStatus::Running, None).await?;
            server.status = ServerStatus::Running;
            Ok(Json(server))
        }
        Err(e) => {
            let error_msg = e.to_string();
            db::update_server_status(&state.db, id, ServerStatus::Error, Some(error_msg)).await?;
            Err(e)
        }
    }
}

async fn stop_server(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Server>> {
    let mut server = db::get_server(&state.db, id).await?;

    if server.status == ServerStatus::Stopped {
        return Ok(Json(server));
    }

    // Try to stop the server using ServerManager
    match state.server_manager.stop_server(id).await {
        Ok(_) => {
            // Successfully stopped
            tracing::info!("Server {} stopped successfully", id);
        }
        Err(e) => {
            // If server not found in manager, it's already stopped (e.g., after restart)
            // Just log and continue to update database status
            tracing::warn!(
                "Server {} not found in ServerManager ({}), assuming already stopped. Syncing database.",
                id, e
            );
        }
    }

    // Update status regardless of ServerManager result
    db::update_server_status(&state.db, id, ServerStatus::Stopped, None).await?;
    server.status = ServerStatus::Stopped;

    Ok(Json(server))
}

async fn get_server_status(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>> {
    let _ = db::get_server(&state.db, id).await?;

    if let Some(status) = state.server_manager.get_status(id) {
        Ok(Json(serde_json::to_value(status).unwrap()))
    } else {
        Ok(Json(serde_json::json!({
            "id": id,
            "status": "stopped",
            "active_connections": 0,
            "uptime_seconds": 0
        })))
    }
}
