use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};

use crate::db;
use crate::error::Result;
use crate::models::{Client, ClientStatus, CreateClient, UpdateClient};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_clients).post(create_client))
        .route("/:id", get(get_client).put(update_client).delete(delete_client))
        .route("/:id/start", post(start_client))
        .route("/:id/stop", post(stop_client))
        .route("/:id/status", get(get_client_status))
}

async fn list_clients(
    State(state): State<AppState>,
) -> Result<Json<Vec<Client>>> {
    let clients = db::list_clients(&state.db).await?;
    Ok(Json(clients))
}

async fn get_client(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Client>> {
    let client = db::get_client(&state.db, id).await?;
    Ok(Json(client))
}

async fn create_client(
    State(state): State<AppState>,
    Json(input): Json<CreateClient>,
) -> Result<(StatusCode, Json<Client>)> {
    let client = db::create_client(&state.db, input).await?;
    Ok((StatusCode::CREATED, Json(client)))
}

async fn update_client(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(input): Json<UpdateClient>,
) -> Result<Json<Client>> {
    let client = db::update_client(&state.db, id, input).await?;
    Ok(Json(client))
}

async fn delete_client(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<StatusCode> {
    // Ensure client is stopped before deletion
    let client = db::get_client(&state.db, id).await?;
    if client.status != ClientStatus::Stopped {
        return Err(crate::error::AppError::BadRequest(
            "Cannot delete running client. Stop it first.".to_string()
        ));
    }

    db::delete_client(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn start_client(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Client>> {
    let mut client = db::get_client(&state.db, id).await?;

    if client.status == ClientStatus::Connected {
        return Err(crate::error::AppError::BadRequest(
            "Client is already connected".to_string()
        ));
    }

    // Update status to starting
    db::update_client_status(&state.db, id, ClientStatus::Starting, None, None).await?;
    db::update_client_last_connected(&state.db, id).await?;

    // Start the client using ClientManager
    match state.client_manager.start_client(client.clone()).await {
        Ok(assigned_port) => {
            db::update_client_status(
                &state.db,
                id,
                ClientStatus::Connected,
                Some(assigned_port as i64),
                None
            ).await?;
            client.status = ClientStatus::Connected;
            client.assigned_port = Some(assigned_port as i64);
            Ok(Json(client))
        }
        Err(e) => {
            let error_msg = e.to_string();
            db::update_client_status(&state.db, id, ClientStatus::Error, None, Some(error_msg)).await?;
            Err(e)
        }
    }
}

async fn stop_client(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Client>> {
    let mut client = db::get_client(&state.db, id).await?;

    if client.status == ClientStatus::Stopped {
        return Ok(Json(client));
    }

    // Stop the client using ClientManager
    state.client_manager.stop_client(id).await?;

    // Update status
    db::update_client_status(&state.db, id, ClientStatus::Stopped, None, None).await?;
    client.status = ClientStatus::Stopped;
    client.assigned_port = None;

    Ok(Json(client))
}

async fn get_client_status(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>> {
    let _ = db::get_client(&state.db, id).await?;

    if let Some(status) = state.client_manager.get_status(id) {
        Ok(Json(serde_json::to_value(status).unwrap()))
    } else {
        Ok(Json(serde_json::json!({
            "id": id,
            "status": "stopped",
            "assigned_port": null,
            "uptime_seconds": 0
        })))
    }
}
