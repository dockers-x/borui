use crate::tunnel::{ServerManager, ClientManager};
use crate::ws::WsBroadcaster;
use sqlx::SqlitePool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub server_manager: Arc<ServerManager>,
    pub client_manager: Arc<ClientManager>,
    pub ws_broadcaster: Arc<WsBroadcaster>,
}

impl AppState {
    pub fn new(db: SqlitePool) -> Self {
        Self {
            db,
            server_manager: Arc::new(ServerManager::new()),
            client_manager: Arc::new(ClientManager::new()),
            ws_broadcaster: Arc::new(WsBroadcaster::new()),
        }
    }
}
