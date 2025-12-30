use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::{State, Query},
    response::IntoResponse,
    http::StatusCode,
};
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::state::AppState;
use crate::middleware::verify_token;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    #[serde(rename = "server_status")]
    ServerStatus(serde_json::Value),
    #[serde(rename = "client_status")]
    ClientStatus(serde_json::Value),
    #[serde(rename = "connection_event")]
    ConnectionEvent(serde_json::Value),
    #[serde(rename = "error")]
    Error(serde_json::Value),
    #[serde(rename = "pong")]
    Pong,
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: Option<String>,
}

pub struct WsBroadcaster {
    clients: Arc<DashMap<Uuid, mpsc::UnboundedSender<WsMessage>>>,
}

impl WsBroadcaster {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(DashMap::new()),
        }
    }

    pub fn broadcast(&self, message: WsMessage) {
        let mut dead_clients = Vec::new();

        for entry in self.clients.iter() {
            if entry.value().send(message.clone()).is_err() {
                dead_clients.push(*entry.key());
            }
        }

        for id in dead_clients {
            self.clients.remove(&id);
        }
    }

    fn add_client(&self, id: Uuid, tx: mpsc::UnboundedSender<WsMessage>) {
        self.clients.insert(id, tx);
    }

    fn remove_client(&self, id: &Uuid) {
        self.clients.remove(id);
    }
}

impl Default for WsBroadcaster {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    // Verify JWT token from query parameter
    if let Some(token) = query.token {
        match verify_token(&token) {
            Ok(claims) => {
                tracing::debug!("WebSocket authenticated for user: {}", claims.username);
                Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, claims.username)))
            }
            Err(e) => {
                tracing::warn!("WebSocket authentication failed: {}", e);
                Err(StatusCode::UNAUTHORIZED)
            }
        }
    } else {
        tracing::warn!("WebSocket token missing");
        Err(StatusCode::UNAUTHORIZED)
    }
}

async fn handle_socket(socket: WebSocket, state: AppState, username: String) {
    let (mut sender, mut receiver) = socket.split();
    let client_id = Uuid::new_v4();

    let (tx, mut rx) = mpsc::unbounded_channel::<WsMessage>();

    state.ws_broadcaster.add_client(client_id, tx);

    tracing::info!("WebSocket client connected: {} (user: {})", client_id, username);

    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    let ws_broadcaster = state.ws_broadcaster.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                // Handle incoming messages (ping, subscribe, etc.)
                tracing::debug!("Received WS message: {}", text);
                if text.contains("\"ping\"") {
                    // Respond with pong
                    ws_broadcaster.broadcast(WsMessage::Pong);
                }
            } else if let Message::Close(_) = msg {
                break;
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    state.ws_broadcaster.remove_client(&client_id);
    tracing::info!("WebSocket client disconnected: {}", client_id);
}
