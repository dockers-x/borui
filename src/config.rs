use crate::error::{AppError, Result};
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
    pub jwt_secret: String,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "sqlite://./data/borui.db".to_string());

        let bind_addr = env::var("BIND_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:3000".to_string());

        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| {
                tracing::warn!("JWT_SECRET not set, using default (INSECURE)");
                "change-me-in-production-this-is-not-secure".to_string()
            });

        let log_level = env::var("RUST_LOG")
            .unwrap_or_else(|_| "info,borui=debug".to_string());

        Ok(Config {
            database_url,
            bind_addr,
            jwt_secret,
            log_level,
        })
    }
}
