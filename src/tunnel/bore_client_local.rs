//! Local bore client implementation with TCP keepalive support
//!
//! This is a custom implementation of bore client that adds TCP keepalive
//! functionality. It's based on bore-cli but with keepalive modifications.
//!
//! Original bore-cli: https://github.com/ekzhang/bore
//! Keepalive patch: https://github.com/miao2y/bore/commit/f8a3f51

use std::sync::Arc;
use std::time::Duration;
use anyhow::{bail, Context, Result};
use tokio::{io::{AsyncWriteExt, copy}, net::TcpStream, time::timeout};
use tracing::{error, info, info_span, warn, Instrument};
use uuid::Uuid;
use socket2::{SockRef, TcpKeepalive};

// Import types from bore-cli
use bore_cli::auth::Authenticator;
use bore_cli::shared::{
    ClientMessage, Delimited, ServerMessage, CONTROL_PORT, NETWORK_TIMEOUT,
};

/// Proxy data between two TCP streams
async fn proxy(mut local: TcpStream, mut remote: TcpStream) -> Result<()> {
    let (mut local_read, mut local_write) = local.split();
    let (mut remote_read, mut remote_write) = remote.split();

    let client_to_server = copy(&mut local_read, &mut remote_write);
    let server_to_client = copy(&mut remote_read, &mut local_write);

    tokio::try_join!(client_to_server, server_to_client)?;

    Ok(())
}

/// Local bore client with TCP keepalive support
pub struct LocalBoreClient {
    /// Control connection to the server
    conn: Option<Delimited<TcpStream>>,

    /// Destination address of the server
    to: String,

    /// Local host that is forwarded
    local_host: String,

    /// Local port that is forwarded
    local_port: u16,

    /// Port that is publicly available on the remote
    remote_port: u16,

    /// Optional secret used to authenticate clients
    auth: Option<Authenticator>,

    /// Whether TCP keepalive is enabled
    enable_keepalive: bool,
}

impl LocalBoreClient {
    /// Create a new client
    pub async fn new(
        local_host: &str,
        local_port: u16,
        to: &str,
        port: u16,
        secret: Option<&str>,
        enable_keepalive: bool,
    ) -> Result<Self> {
        let mut stream = Delimited::new(
            connect_with_timeout(to, CONTROL_PORT, enable_keepalive).await?
        );

        let auth = secret.map(Authenticator::new);
        if let Some(auth) = &auth {
            auth.client_handshake(&mut stream).await?;
        }

        stream.send(ClientMessage::Hello(port)).await?;
        let remote_port = match stream.recv_timeout().await? {
            Some(ServerMessage::Hello(remote_port)) => remote_port,
            Some(ServerMessage::Error(message)) => bail!("server error: {message}"),
            Some(ServerMessage::Challenge(_)) => {
                bail!("server requires authentication, but no client secret was provided");
            }
            Some(_) => bail!("unexpected initial non-hello message"),
            None => bail!("unexpected EOF"),
        };

        info!(remote_port, "connected to server");
        info!("listening at {to}:{remote_port}");

        if enable_keepalive {
            info!("TCP keepalive is ACTIVE for this connection");
        }

        Ok(LocalBoreClient {
            conn: Some(stream),
            to: to.to_string(),
            local_host: local_host.to_string(),
            local_port,
            remote_port,
            auth,
            enable_keepalive,
        })
    }

    /// Returns the port publicly available on the remote
    pub fn remote_port(&self) -> u16 {
        self.remote_port
    }

    /// Start the client, listening for new connections
    pub async fn listen(mut self) -> Result<()> {
        let mut conn = self.conn.take().unwrap();
        let this = Arc::new(self);

        loop {
            match conn.recv().await? {
                Some(ServerMessage::Hello(_)) => warn!("unexpected hello"),
                Some(ServerMessage::Challenge(_)) => warn!("unexpected challenge"),
                Some(ServerMessage::Heartbeat) => (),
                Some(ServerMessage::Connection(id)) => {
                    let this = Arc::clone(&this);
                    tokio::spawn(
                        async move {
                            info!("new connection");
                            match this.handle_connection(id).await {
                                Ok(_) => info!("connection exited"),
                                Err(err) => warn!(%err, "connection exited with error"),
                            }
                        }
                        .instrument(info_span!("proxy", %id)),
                    );
                }
                Some(ServerMessage::Error(err)) => error!(%err, "server error"),
                None => return Ok(()),
            }
        }
    }

    async fn handle_connection(&self, id: Uuid) -> Result<()> {
        let mut remote_conn = Delimited::new(
            connect_with_timeout(&self.to[..], CONTROL_PORT, self.enable_keepalive).await?
        );

        if let Some(auth) = &self.auth {
            auth.client_handshake(&mut remote_conn).await?;
        }

        remote_conn.send(ClientMessage::Accept(id)).await?;

        let mut local_conn = connect_with_timeout(
            &self.local_host,
            self.local_port,
            self.enable_keepalive
        ).await?;

        let parts = remote_conn.into_parts();
        debug_assert!(parts.write_buf.is_empty(), "framed write buffer not empty");

        // Write any buffered data to local connection
        local_conn.write_all(&parts.read_buf).await?;

        // Start proxying
        proxy(local_conn, parts.io).await?;

        Ok(())
    }
}

/// Connect to a remote host with optional TCP keepalive
async fn connect_with_timeout(
    to: &str,
    port: u16,
    enable_keepalive: bool,
) -> Result<TcpStream> {
    let stream = timeout(
        NETWORK_TIMEOUT,
        TcpStream::connect((to, port))
    )
    .await
    .with_context(|| format!("could not connect to {to}:{port}"))?
    .with_context(|| format!("could not connect to {to}:{port}"))?;

    // Apply TCP keepalive if enabled
    if enable_keepalive {
        apply_tcp_keepalive(&stream)?;
    }

    Ok(stream)
}

/// Apply TCP keepalive settings to a TCP stream
fn apply_tcp_keepalive(stream: &TcpStream) -> Result<()> {
    let sock_ref = SockRef::from(stream);

    let mut ka = TcpKeepalive::new();
    // Wait 10 minutes before sending first keepalive probe
    ka = ka.with_time(Duration::from_secs(600));
    // Send keepalive probe every 60 seconds
    ka = ka.with_interval(Duration::from_secs(60));

    sock_ref.set_tcp_keepalive(&ka)?;

    info!("TCP keepalive applied: time=600s, interval=60s");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keepalive_config() {
        // Basic compilation test
        let _ = Duration::from_secs(600);
        let _ = Duration::from_secs(60);
    }
}
