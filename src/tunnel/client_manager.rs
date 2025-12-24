use crate::error::{AppError, Result};
use crate::models::Client;
use crate::tunnel::status::ClientStatusInfo;
use bore_cli::client::Client as BoreClient;
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

pub struct ClientManager {
    clients: Arc<DashMap<i64, ClientHandle>>,
}

struct ClientHandle {
    assigned_port: u16,
    handle: JoinHandle<anyhow::Result<()>>,
    started_at: SystemTime,
    _tx: mpsc::Sender<ClientCommand>,
}

#[allow(dead_code)]
enum ClientCommand {
    Stop,
}

impl ClientManager {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(DashMap::new()),
        }
    }

    pub async fn start_client(&self, client: Client) -> Result<u16> {
        tracing::info!("Starting bore client: {} (id: {})", client.name, client.id);

        // Check if already running
        if self.clients.contains_key(&client.id) {
            return Err(AppError::BadRequest(format!(
                "Client {} is already running",
                client.id
            )));
        }

        // Create bore client
        let bore_client = BoreClient::new(
            &client.local_host,
            client.local_port as u16,
            &client.remote_server,
            client.remote_port as u16, // 0 means auto-assign
            client.secret.as_deref(),
        )
        .await
        .map_err(|e| {
            AppError::Tunnel(anyhow::anyhow!("Failed to create bore client: {}", e))
        })?;

        // Get the assigned port
        let assigned_port = bore_client.remote_port();

        tracing::info!(
            "Bore client {} connected, assigned port: {}",
            client.name,
            assigned_port
        );

        // Create command channel (currently unused, but available for future control)
        let (_tx, mut _rx) = mpsc::channel::<ClientCommand>(10);

        // Spawn client task
        let client_id = client.id;
        let client_name = client.name.clone();
        let handle = tokio::spawn(async move {
            tracing::info!(
                "Bore client {} forwarding {}:{} -> {}:{}",
                client_name,
                client.local_host,
                client.local_port,
                client.remote_server,
                assigned_port
            );

            match bore_client.listen().await {
                Ok(_) => {
                    tracing::info!("Bore client {} stopped normally", client_name);
                    Ok(())
                }
                Err(e) => {
                    tracing::error!("Bore client {} error: {}", client_name, e);
                    Err(e)
                }
            }
        });

        // Store handle
        self.clients.insert(
            client_id,
            ClientHandle {
                assigned_port,
                handle,
                started_at: SystemTime::now(),
                _tx,
            },
        );

        tracing::info!(
            "Bore client {} started successfully, port: {}",
            client.name,
            assigned_port
        );

        Ok(assigned_port)
    }

    pub async fn stop_client(&self, id: i64) -> Result<()> {
        tracing::info!("Stopping bore client id: {}", id);

        if let Some((_, handle)) = self.clients.remove(&id) {
            // Abort the client task
            handle.handle.abort();

            // Wait a bit for cleanup
            tokio::time::sleep(Duration::from_millis(100)).await;

            tracing::info!("Bore client {} stopped", id);
            Ok(())
        } else {
            Err(AppError::NotFound(format!("Client {} not running", id)))
        }
    }

    pub fn get_status(&self, id: i64) -> Option<ClientStatusInfo> {
        self.clients.get(&id).and_then(|entry| {
            // Check if task is still running
            if entry.handle.is_finished() {
                // Task has finished, return None to indicate it's not running
                None
            } else {
                let uptime = entry
                    .started_at
                    .elapsed()
                    .unwrap_or(Duration::from_secs(0))
                    .as_secs();

                Some(ClientStatusInfo {
                    id,
                    status: "connected".to_string(),
                    assigned_port: Some(entry.assigned_port),
                    uptime_seconds: uptime,
                })
            }
        })
    }

    /// Check all running clients and return IDs of clients whose tasks have finished
    pub fn get_finished_clients(&self) -> Vec<i64> {
        self.clients
            .iter()
            .filter(|entry| entry.handle.is_finished())
            .map(|entry| *entry.key())
            .collect()
    }

    /// Remove a client from the manager without stopping it (for cleanup of finished tasks)
    pub fn remove_finished_client(&self, id: i64) -> Option<()> {
        self.clients.remove(&id).map(|_| ())
    }
}

impl Default for ClientManager {
    fn default() -> Self {
        Self::new()
    }
}
