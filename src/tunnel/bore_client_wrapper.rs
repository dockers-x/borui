//! Bore client wrapper with TCP keepalive support
//!
//! This wrapper provides a unified interface for bore clients:
//! - When enable_keepalive=false: Uses official bore-cli::Client (stable)
//! - When enable_keepalive=true: Uses LocalBoreClient (with keepalive)
//!
//! TCP Keepalive Parameters (when enabled):
//! - Keepalive time: 600 seconds (10 minutes idle before first probe)
//! - Keepalive interval: 60 seconds (probe every 60 seconds)
//!
//! Benefits of using official client (when keepalive disabled):
//! - More stable and well-tested
//! - Automatic updates from upstream
//! - Lower maintenance burden
//!
//! Benefits of keepalive (when enabled):
//! - Prevents idle connection timeouts through NAT/firewalls
//! - Detects dead connections within ~1-2 minutes
//! - Works with auto_start feature for automatic reconnection

use anyhow::Result;
use tracing::info;

use crate::tunnel::bore_client_local::LocalBoreClient;
use bore_cli::client::Client as OfficialBoreClient;

/// Bore client wrapper supporting both official and custom implementations
pub struct BoreClientWrapper {
    inner: ClientImpl,
}

/// Internal client implementation (official or custom)
enum ClientImpl {
    /// Official bore-cli client (stable, no keepalive)
    Official(OfficialBoreClient),
    /// Custom local client (with TCP keepalive support)
    WithKeepalive(LocalBoreClient),
}

impl BoreClientWrapper {
    /// Create a new bore client with optional keepalive support
    ///
    /// # Arguments
    /// * `local_host` - Local host to forward (e.g., "localhost")
    /// * `local_port` - Local port to forward
    /// * `remote_server` - Remote bore server address
    /// * `remote_port` - Remote port (0 = auto-assign)
    /// * `secret` - Optional authentication secret
    /// * `enable_keepalive` - Enable TCP keepalive
    ///
    /// # Implementation Selection
    /// - `enable_keepalive=false`: Uses official bore-cli (recommended for stability)
    /// - `enable_keepalive=true`: Uses local implementation with keepalive
    pub async fn new(
        local_host: &str,
        local_port: u16,
        remote_server: &str,
        remote_port: u16,
        secret: Option<&str>,
        enable_keepalive: bool,
    ) -> Result<Self> {
        let inner = if enable_keepalive {
            info!(
                "Creating bore client with TCP keepalive for {}:{} -> {}:{}",
                local_host, local_port, remote_server, remote_port
            );

            let client = LocalBoreClient::new(
                local_host,
                local_port,
                remote_server,
                remote_port,
                secret,
                true, // keepalive enabled
            )
            .await?;

            ClientImpl::WithKeepalive(client)
        } else {
            info!(
                "Creating bore client (official, no keepalive) for {}:{} -> {}:{}",
                local_host, local_port, remote_server, remote_port
            );

            let client = OfficialBoreClient::new(
                local_host,
                local_port,
                remote_server,
                remote_port,
                secret,
            )
            .await?;

            ClientImpl::Official(client)
        };

        Ok(Self { inner })
    }

    /// Get the assigned remote port
    pub fn remote_port(&self) -> u16 {
        match &self.inner {
            ClientImpl::Official(client) => client.remote_port(),
            ClientImpl::WithKeepalive(client) => client.remote_port(),
        }
    }

    /// Start listening for connections
    ///
    /// This will maintain the connection and handle incoming connections
    /// from the remote server. If keepalive is enabled, connections will
    /// be monitored with TCP keepalive probes.
    pub async fn listen(self) -> Result<()> {
        match self.inner {
            ClientImpl::Official(client) => {
                info!("Starting official bore client (stable)");
                client.listen().await
            }
            ClientImpl::WithKeepalive(client) => {
                info!("Starting bore client with TCP keepalive");
                client.listen().await
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wrapper_compiles() {
        // Compilation test - ensures both client types work
    }
}
