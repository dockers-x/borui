pub mod auth;
pub mod servers;
pub mod clients;
pub mod status;

use axum::{Router, routing::get};
use crate::state::AppState;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .nest("/auth", auth::router())
        .nest("/servers", servers::router())
        .nest("/clients", clients::router())
        .nest("/system", status::router())
}
