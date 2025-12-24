use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post, put},
    Json, Router, Extension,
};
use argon2::{PasswordVerifier, PasswordHasher, password_hash::{rand_core::OsRng, SaltString}};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::error::{AppError, Result};
use crate::models::{LoginRequest, LoginResponse, TokenRefreshResponse, UserInfo, UpdateUsernameRequest, UpdateDisplayNameRequest, UpdatePasswordRequest};
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
        .route("/refresh", post(refresh_token))
        .route("/update-username", put(update_username))
        .route("/update-display-name", put(update_display_name))
        .route("/update-password", put(update_password))
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
            username: user.username.clone(),
            display_name: user.display_name,
        },
    }))
}

async fn logout() -> Result<StatusCode> {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token. Here we just return success.
    Ok(StatusCode::OK)
}

async fn me(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<UserInfo>> {
    // Get current user from database to get latest display_name
    let current_user = db::get_user_by_id(&state.db, user.id).await?;

    Ok(Json(UserInfo {
        id: current_user.id,
        username: current_user.username,
        display_name: current_user.display_name,
    }))
}

async fn refresh_token(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<TokenRefreshResponse>> {
    // Get current user from database
    let current_user = db::get_user_by_id(&state.db, user.id).await?;

    // Generate new JWT token with fresh expiration
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: current_user.id,
        username: current_user.username.clone(),
        exp: expiration,
    };

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "change-me-in-production-this-is-not-secure".to_string());

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )?;

    Ok(Json(TokenRefreshResponse { token }))
}

async fn update_username(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(input): Json<UpdateUsernameRequest>,
) -> Result<Json<UserInfo>> {
    // Validate new username
    if input.new_username.trim().is_empty() {
        return Err(AppError::BadRequest("Username cannot be empty".to_string()));
    }

    if input.new_username.len() < 3 {
        return Err(AppError::BadRequest("Username must be at least 3 characters".to_string()));
    }

    // Update username in database
    let updated_user = db::update_username(&state.db, user.id, &input.new_username).await?;

    Ok(Json(UserInfo {
        id: updated_user.id,
        username: updated_user.username,
        display_name: updated_user.display_name,
    }))
}

async fn update_password(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(input): Json<UpdatePasswordRequest>,
) -> Result<StatusCode> {
    // Get current user from database to verify old password
    let current_user = db::get_user_by_id(&state.db, user.id).await?;

    // Verify current password
    let parsed_hash = argon2::PasswordHash::new(&current_user.password_hash)
        .map_err(|_| AppError::PasswordHash)?;

    argon2::Argon2::default()
        .verify_password(input.current_password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)?;

    // Validate new password
    if input.new_password.len() < 6 {
        return Err(AppError::BadRequest("Password must be at least 6 characters".to_string()));
    }

    // Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = argon2::Argon2::default()
        .hash_password(input.new_password.as_bytes(), &salt)
        .map_err(|_| AppError::PasswordHash)?
        .to_string();

    // Update password in database
    db::update_password(&state.db, user.id, &password_hash).await?;

    Ok(StatusCode::OK)
}

async fn update_display_name(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(input): Json<UpdateDisplayNameRequest>,
) -> Result<Json<UserInfo>> {
    // Validate display name if provided
    if let Some(ref name) = input.display_name {
        let name_str: &str = name;
        if name_str.trim().is_empty() {
            return Err(AppError::BadRequest("Display name cannot be empty".to_string()));
        }
        if name_str.len() > 50 {
            return Err(AppError::BadRequest("Display name must be at most 50 characters".to_string()));
        }
    }

    // Update display name in database
    let updated_user = db::update_display_name(
        &state.db,
        user.id,
        input.display_name.as_deref()
    ).await?;

    Ok(Json(UserInfo {
        id: updated_user.id,
        username: updated_user.username,
        display_name: updated_user.display_name,
    }))
}
