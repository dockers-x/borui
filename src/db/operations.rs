use crate::error::{AppError, Result};
use crate::models::*;
use sqlx::SqlitePool;

// User operations
pub async fn create_user(pool: &SqlitePool, username: &str, password_hash: &str) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING *"
    )
    .bind(username)
    .bind(password_hash)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn get_user_by_username(pool: &SqlitePool, username: &str) -> Result<User> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ?")
        .bind(username)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", username)))?;

    Ok(user)
}

pub async fn get_user_by_id(pool: &SqlitePool, id: i64) -> Result<User> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    Ok(user)
}

pub async fn update_username(pool: &SqlitePool, user_id: i64, new_username: &str) -> Result<User> {
    // Check if username already exists
    let existing = sqlx::query("SELECT id FROM users WHERE username = ? AND id != ?")
        .bind(new_username)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    if existing.is_some() {
        return Err(AppError::BadRequest("Username already exists".to_string()));
    }

    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *"
    )
    .bind(new_username)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn update_password(pool: &SqlitePool, user_id: i64, new_password_hash: &str) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *"
    )
    .bind(new_password_hash)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn update_display_name(pool: &SqlitePool, user_id: i64, display_name: Option<&str>) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *"
    )
    .bind(display_name)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

// Server operations
pub async fn list_servers(pool: &SqlitePool) -> Result<Vec<Server>> {
    let servers = sqlx::query_as::<_, Server>("SELECT * FROM servers ORDER BY id DESC")
        .fetch_all(pool)
        .await?;

    Ok(servers)
}

pub async fn get_server(pool: &SqlitePool, id: i64) -> Result<Server> {
    let server = sqlx::query_as::<_, Server>("SELECT * FROM servers WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Server {} not found", id)))?;

    Ok(server)
}

pub async fn create_server(pool: &SqlitePool, input: CreateServer) -> Result<Server> {
    let server = sqlx::query_as::<_, Server>(
        r#"
        INSERT INTO servers (name, description, bind_addr, bind_tunnels, port_range_start, port_range_end, secret, auto_start)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#
    )
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.bind_addr)
    .bind(&input.bind_tunnels)
    .bind(input.port_range_start)
    .bind(input.port_range_end)
    .bind(&input.secret)
    .bind(input.auto_start)
    .fetch_one(pool)
    .await?;

    Ok(server)
}

pub async fn update_server(pool: &SqlitePool, id: i64, input: UpdateServer) -> Result<Server> {
    // First check if server exists
    let _ = get_server(pool, id).await?;

    // Build dynamic UPDATE query based on provided fields
    let mut query = String::from("UPDATE servers SET updated_at = CURRENT_TIMESTAMP");
    let mut params: Vec<String> = vec![];

    if let Some(name) = &input.name {
        query.push_str(", name = ?");
        params.push(name.clone());
    }
    if let Some(desc) = &input.description {
        query.push_str(", description = ?");
        params.push(desc.clone());
    }
    if let Some(addr) = &input.bind_addr {
        query.push_str(", bind_addr = ?");
        params.push(addr.clone());
    }
    if let Some(tunnels) = &input.bind_tunnels {
        query.push_str(", bind_tunnels = ?");
        params.push(tunnels.clone());
    }
    if let Some(start) = input.port_range_start {
        query.push_str(&format!(", port_range_start = {}", start));
    }
    if let Some(end) = input.port_range_end {
        query.push_str(&format!(", port_range_end = {}", end));
    }
    if let Some(secret) = &input.secret {
        query.push_str(", secret = ?");
        params.push(secret.clone());
    }
    if let Some(auto) = input.auto_start {
        query.push_str(&format!(", auto_start = {}", if auto { 1 } else { 0 }));
    }

    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    for param in &params {
        q = q.bind(param);
    }
    q = q.bind(id);

    q.execute(pool).await?;

    get_server(pool, id).await
}

pub async fn delete_server(pool: &SqlitePool, id: i64) -> Result<()> {
    let result = sqlx::query("DELETE FROM servers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Server {} not found", id)));
    }

    Ok(())
}

pub async fn update_server_status(
    pool: &SqlitePool,
    id: i64,
    status: ServerStatus,
    error_message: Option<String>,
) -> Result<()> {
    let status_str = match status {
        ServerStatus::Stopped => "stopped",
        ServerStatus::Starting => "starting",
        ServerStatus::Running => "running",
        ServerStatus::Error => "error",
    };

    sqlx::query(
        "UPDATE servers SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(status_str)
    .bind(error_message)
    .bind(id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_server_last_started(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("UPDATE servers SET last_started_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

// Client operations
pub async fn list_clients(pool: &SqlitePool) -> Result<Vec<Client>> {
    let clients = sqlx::query_as::<_, Client>("SELECT * FROM clients ORDER BY id DESC")
        .fetch_all(pool)
        .await?;

    Ok(clients)
}

pub async fn get_client(pool: &SqlitePool, id: i64) -> Result<Client> {
    let client = sqlx::query_as::<_, Client>("SELECT * FROM clients WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Client {} not found", id)))?;

    Ok(client)
}

pub async fn create_client(pool: &SqlitePool, input: CreateClient) -> Result<Client> {
    let client = sqlx::query_as::<_, Client>(
        r#"
        INSERT INTO clients (name, description, local_host, local_port, remote_server, remote_port, secret, auto_start)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#
    )
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.local_host)
    .bind(input.local_port)
    .bind(&input.remote_server)
    .bind(input.remote_port)
    .bind(&input.secret)
    .bind(input.auto_start)
    .fetch_one(pool)
    .await?;

    Ok(client)
}

pub async fn update_client(pool: &SqlitePool, id: i64, input: UpdateClient) -> Result<Client> {
    // First check if client exists
    let _ = get_client(pool, id).await?;

    // Build dynamic UPDATE query
    let mut query = String::from("UPDATE clients SET updated_at = CURRENT_TIMESTAMP");
    let mut params: Vec<String> = vec![];

    if let Some(name) = &input.name {
        query.push_str(", name = ?");
        params.push(name.clone());
    }
    if let Some(desc) = &input.description {
        query.push_str(", description = ?");
        params.push(desc.clone());
    }
    if let Some(host) = &input.local_host {
        query.push_str(", local_host = ?");
        params.push(host.clone());
    }
    if let Some(port) = input.local_port {
        query.push_str(&format!(", local_port = {}", port));
    }
    if let Some(server) = &input.remote_server {
        query.push_str(", remote_server = ?");
        params.push(server.clone());
    }
    if let Some(rport) = input.remote_port {
        query.push_str(&format!(", remote_port = {}", rport));
    }
    if let Some(secret) = &input.secret {
        query.push_str(", secret = ?");
        params.push(secret.clone());
    }
    if let Some(auto) = input.auto_start {
        query.push_str(&format!(", auto_start = {}", if auto { 1 } else { 0 }));
    }

    query.push_str(" WHERE id = ?");

    let mut q = sqlx::query(&query);
    for param in &params {
        q = q.bind(param);
    }
    q = q.bind(id);

    q.execute(pool).await?;

    get_client(pool, id).await
}

pub async fn delete_client(pool: &SqlitePool, id: i64) -> Result<()> {
    let result = sqlx::query("DELETE FROM clients WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Client {} not found", id)));
    }

    Ok(())
}

pub async fn update_client_status(
    pool: &SqlitePool,
    id: i64,
    status: ClientStatus,
    assigned_port: Option<i64>,
    error_message: Option<String>,
) -> Result<()> {
    let status_str = match status {
        ClientStatus::Stopped => "stopped",
        ClientStatus::Starting => "starting",
        ClientStatus::Connected => "connected",
        ClientStatus::Error => "error",
    };

    sqlx::query(
        "UPDATE clients SET status = ?, assigned_port = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(status_str)
    .bind(assigned_port)
    .bind(error_message)
    .bind(id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_client_last_connected(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("UPDATE clients SET last_connected_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}
