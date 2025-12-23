use axum::{
    routing::get,
    Router,
};
use futures_util::StreamExt;
use sqlx::sqlite::SqlitePoolOptions;
use std::net::SocketAddr;
use std::str::FromStr;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use borui::{api, config::Config, state::AppState, web, ws};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load configuration
    let config = Config::from_env()?;

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| config.log_level.clone().into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Borui v{}", env!("CARGO_PKG_VERSION"));
    tracing::info!("Database: {}", config.database_url);
    tracing::info!("Bind address: {}", config.bind_addr);

    // Ensure data directory exists
    if config.database_url.starts_with("sqlite://") {
        let db_path = config.database_url.trim_start_matches("sqlite://");
        if let Some(parent) = std::path::Path::new(db_path).parent() {
            std::fs::create_dir_all(parent)?;
            tracing::info!("Ensured database directory exists: {}", parent.display());
        }
    }

    // Connect to database
    tracing::info!("Connecting to database...");
    let db = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .connect_with(
            sqlx::sqlite::SqliteConnectOptions::from_str(&config.database_url)?
                .create_if_missing(true)
        )
        .await?;

    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&db)
        .await?;

    tracing::info!("Database migrations completed");

    // Create initial admin user if no users exist
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&db)
        .await?;

    if user_count.0 == 0 {
        tracing::info!("No users found, creating initial admin user");

        let admin_username = std::env::var("INIT_ADMIN")
            .unwrap_or_else(|_| "admin".to_string());

        let admin_password = std::env::var("INIT_ADMIN_PASSWORD")
            .unwrap_or_else(|_| {
                tracing::warn!("INIT_ADMIN_PASSWORD not set, using default (INSECURE!)");
                "admin".to_string()
            });

        // Hash the password using Argon2
        use argon2::{
            password_hash::{PasswordHasher, SaltString},
            Argon2,
        };
        use rand::rngs::OsRng;

        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(admin_password.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!("Failed to hash password: {}", e))?
            .to_string();

        sqlx::query("INSERT INTO users (username, password_hash) VALUES (?, ?)")
            .bind(&admin_username)
            .bind(&password_hash)
            .execute(&db)
            .await?;

        tracing::info!("Initial admin user '{}' created successfully", admin_username);
        if admin_password == "admin" {
            tracing::warn!("⚠️  WARNING: Using default password 'admin' - CHANGE THIS IMMEDIATELY!");
        }
    }

    // Create application state
    let state = AppState::new(db);

    // TODO: Start auto-start servers and clients
    // start_auto_start_entities(&state).await?;

    // Build router
    let app = Router::new()
        .nest("/api/v1", api::api_router())
        .route("/ws", get(ws::ws_handler))
        .fallback(|uri: axum::http::Uri| async move {
            web::serve_static(uri.to_string()).await
        })
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Parse bind address
    let addr: SocketAddr = config.bind_addr.parse()?;

    tracing::info!("Server listening on {}", addr);
    tracing::info!("Web UI available at http://{}", addr);
    tracing::info!("API available at http://{}/api/v1", addr);
    tracing::info!("WebSocket available at ws://{}/ws", addr);

    // Start server with graceful shutdown
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server shut down gracefully");

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        use futures_util::StreamExt;
        let mut signals = signal_hook_tokio::Signals::new(&[signal_hook::consts::SIGTERM])
            .expect("failed to install SIGTERM handler");

        signals.next().await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C, shutting down...");
        },
        _ = terminate => {
            tracing::info!("Received SIGTERM, shutting down...");
        },
    }
}

