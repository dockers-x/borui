use crate::error::{AppError, Result};
use crate::models::Server;
use crate::tunnel::status::ServerStatusInfo;
use bore_cli::server::Server as BoreServer;
use dashmap::DashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

pub struct ServerManager {
    servers: Arc<DashMap<i64, ServerHandle>>,
}

struct ServerHandle {
    handle: JoinHandle<anyhow::Result<()>>,
    started_at: SystemTime,
    _tx: mpsc::Sender<ServerCommand>,
}

#[allow(dead_code)]
enum ServerCommand {
    Stop,
}

impl ServerManager {
    pub fn new() -> Self {
        Self {
            servers: Arc::new(DashMap::new()),
        }
    }

    pub async fn start_server(&self, server: Server) -> Result<()> {
        tracing::info!("Starting bore server: {} (id: {})", server.name, server.id);

        // Check if already running
        if self.servers.contains_key(&server.id) {
            return Err(AppError::BadRequest(format!(
                "Server {} is already running",
                server.id
            )));
        }

        // Parse bind addresses
        let bind_addr: IpAddr = server.bind_addr.parse().map_err(|e| {
            AppError::BadRequest(format!("Invalid bind_addr: {}", e))
        })?;

        let bind_tunnels: IpAddr = server.bind_tunnels.parse().map_err(|e| {
            AppError::BadRequest(format!("Invalid bind_tunnels: {}", e))
        })?;

        // Create bore server
        let port_range = server.port_range_start as u16..=server.port_range_end as u16;
        let mut bore_server = BoreServer::new(port_range, server.secret.as_deref());
        bore_server.set_bind_addr(bind_addr);
        bore_server.set_bind_tunnels(bind_tunnels);

        // Create command channel (currently unused, but available for future control)
        let (_tx, mut _rx) = mpsc::channel::<ServerCommand>(10);

        // Spawn server task
        let server_id = server.id;
        let server_name = server.name.clone();
        let handle = tokio::spawn(async move {
            tracing::info!("Bore server {} listening on port 7835", server_name);
            match bore_server.listen().await {
                Ok(_) => {
                    tracing::info!("Bore server {} stopped normally", server_name);
                    Ok(())
                }
                Err(e) => {
                    tracing::error!("Bore server {} error: {}", server_name, e);
                    Err(e)
                }
            }
        });

        // Store handle
        self.servers.insert(
            server_id,
            ServerHandle {
                handle,
                started_at: SystemTime::now(),
                _tx,
            },
        );

        tracing::info!("Bore server {} started successfully", server.name);
        Ok(())
    }

    pub async fn stop_server(&self, id: i64) -> Result<()> {
        tracing::info!("Stopping bore server id: {}", id);

        if let Some((_, handle)) = self.servers.remove(&id) {
            // Abort the server task
            handle.handle.abort();

            // Wait a bit for cleanup
            tokio::time::sleep(Duration::from_millis(100)).await;

            tracing::info!("Bore server {} stopped", id);
            Ok(())
        } else {
            Err(AppError::NotFound(format!("Server {} not running", id)))
        }
    }

    pub fn get_status(&self, id: i64) -> Option<ServerStatusInfo> {
        self.servers.get(&id).and_then(|entry| {
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

                Some(ServerStatusInfo {
                    id,
                    status: "running".to_string(),
                    active_connections: 0, // TODO: Track actual connections
                    uptime_seconds: uptime,
                })
            }
        })
    }

    /// Check all running servers and return IDs of servers whose tasks have finished
    pub fn get_finished_servers(&self) -> Vec<i64> {
        self.servers
            .iter()
            .filter(|entry| entry.handle.is_finished())
            .map(|entry| *entry.key())
            .collect()
    }

    /// Remove a server from the manager without stopping it (for cleanup of finished tasks)
    pub fn remove_finished_server(&self, id: i64) -> Option<()> {
        self.servers.remove(&id).map(|_| ())
    }
}

impl Default for ServerManager {
    fn default() -> Self {
        Self::new()
    }
}
