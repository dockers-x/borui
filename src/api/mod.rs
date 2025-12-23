pub mod auth;
pub mod servers;
pub mod clients;
pub mod status;

use axum::{middleware, Router};
use crate::state::AppState;
use crate::middleware::auth_middleware;

pub fn api_router() -> Router<AppState> {
    // Public routes (no authentication required)
    let public_routes = Router::new()
        .nest("/auth", auth::router());

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .nest("/auth", auth::protected_router())
        .nest("/servers", servers::router())
        .nest("/clients", clients::router())
        .nest("/system", status::router())
        .route_layer(middleware::from_fn(auth_middleware));

    // Combine routes
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
}
