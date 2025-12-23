use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64, // user id
    pub username: String,
    pub exp: usize,
}

/// Extension type to store authenticated user info in request
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: i64,
    pub username: String,
}

/// JWT authentication middleware
pub async fn auth_middleware(
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract token from Authorization header
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    let token = if let Some(auth_header) = auth_header {
        // Support both "Bearer TOKEN" and "TOKEN" formats
        if auth_header.starts_with("Bearer ") {
            auth_header.trim_start_matches("Bearer ")
        } else {
            auth_header
        }
    } else {
        tracing::warn!("Missing Authorization header");
        return Err(StatusCode::UNAUTHORIZED);
    };

    // Verify JWT token
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "change-me-in-production-this-is-not-secure".to_string());

    let claims = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    ) {
        Ok(token_data) => token_data.claims,
        Err(e) => {
            tracing::warn!("Invalid JWT token: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Check if token is expired (jsonwebtoken already validates exp, but we can add custom logic here)
    let current_time = chrono::Utc::now().timestamp() as usize;
    if claims.exp < current_time {
        tracing::warn!("Expired JWT token for user: {}", claims.username);
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Add user info to request extensions
    request.extensions_mut().insert(AuthUser {
        id: claims.sub,
        username: claims.username.clone(),
    });

    tracing::debug!("Authenticated user: {} (id: {})", claims.username, claims.sub);

    Ok(next.run(request).await)
}

/// Helper function to verify token (can be used in other places)
pub fn verify_token(token: &str) -> Result<Claims, AppError> {
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "change-me-in-production-this-is-not-secure".to_string());

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )?;

    Ok(token_data.claims)
}
