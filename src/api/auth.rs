use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router, Extension,
};
use argon2::PasswordVerifier;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::error::{AppError, Result};
use crate::models::{LoginRequest, LoginResponse, UserInfo};
use crate::state::AppState;
use crate::middleware::AuthUser;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64, // user id
    pub username: String,
    pub exp: usize,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/logout", post(logout))
}

// Separate router for authenticated routes
pub fn protected_router() -> Router<AppState> {
    Router::new()
        .route("/me", get(me))
}

async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginRequest>,
) -> Result<Json<LoginResponse>> {
    // Get user from database
    let user = db::get_user_by_username(&state.db, &input.username).await?;

    // Verify password
    let parsed_hash = argon2::PasswordHash::new(&user.password_hash)
        .map_err(|_| AppError::PasswordHash)?;

    argon2::Argon2::default()
        .verify_password(input.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)?;

    // Generate JWT token
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id,
        username: user.username.clone(),
        exp: expiration,
    };

    // Get JWT secret from environment (in real app, this should be in config)
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "change-me-in-production-this-is-not-secure".to_string());

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )?;

    Ok(Json(LoginResponse {
        token,
        user: UserInfo {
            id: user.id,
            username: user.username,
        },
    }))
}

async fn logout() -> Result<StatusCode> {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token. Here we just return success.
    Ok(StatusCode::OK)
}

async fn me(
    Extension(user): Extension<AuthUser>,
) -> Result<Json<UserInfo>> {
    // Extract user info from JWT token (provided by auth middleware)
    Ok(Json(UserInfo {
        id: user.id,
        username: user.username,
    }))
}
