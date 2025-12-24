// API client wrapper
class API {
    constructor() {
        this.baseURL = '/api/v1';
        this.token = localStorage.getItem('token');
        this.tokenRefreshTimer = null;

        // Start token refresh timer if we have a token
        if (this.token) {
            this.scheduleTokenRefresh();
        }
    }

    // Decode JWT token to get expiration time
    decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Failed to decode token:', e);
            return null;
        }
    }

    // Schedule automatic token refresh
    scheduleTokenRefresh() {
        // Clear existing timer
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
        }

        const decoded = this.decodeToken(this.token);
        if (!decoded || !decoded.exp) {
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp - now;

        // Refresh token 5 minutes before expiration
        const refreshIn = Math.max((expiresIn - 300) * 1000, 60000); // At least 1 minute

        console.log(`Token will be refreshed in ${Math.floor(refreshIn / 1000)} seconds`);

        this.tokenRefreshTimer = setTimeout(async () => {
            try {
                await this.refreshToken();
            } catch (e) {
                console.error('Failed to refresh token:', e);
                // If refresh fails, redirect to login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            }
        }, refreshIn);
    }

    // Refresh the JWT token
    async refreshToken() {
        console.log('Refreshing token...');
        const response = await fetch(`${this.baseURL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
            },
        });

        if (response.ok) {
            const data = await response.json();
            this.token = data.token;
            localStorage.setItem('token', data.token);
            console.log('Token refreshed successfully');

            // Schedule next refresh
            this.scheduleTokenRefresh();

            // Notify WebSocket to reconnect with new token
            if (window.wsClient) {
                window.wsClient.reconnectWithNewToken(data.token);
            }
        } else {
            throw new Error('Token refresh failed');
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            // Handle authentication errors (401 Unauthorized)
            if (response.status === 401) {
                console.warn('Authentication failed - redirecting to login');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login.html';
                return;
            }

            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    // Servers
    async listServers() {
        return this.request('/servers');
    }

    async getServer(id) {
        return this.request(`/servers/${id}`);
    }

    async createServer(data) {
        return this.request('/servers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateServer(id, data) {
        return this.request(`/servers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteServer(id) {
        return this.request(`/servers/${id}`, {
            method: 'DELETE',
        });
    }

    async startServer(id) {
        return this.request(`/servers/${id}/start`, {
            method: 'POST',
        });
    }

    async stopServer(id) {
        return this.request(`/servers/${id}/stop`, {
            method: 'POST',
        });
    }

    // Clients
    async listClients() {
        return this.request('/clients');
    }

    async getClient(id) {
        return this.request(`/clients/${id}`);
    }

    async createClient(data) {
        return this.request('/clients', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateClient(id, data) {
        return this.request(`/clients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteClient(id) {
        return this.request(`/clients/${id}`, {
            method: 'DELETE',
        });
    }

    async startClient(id) {
        return this.request(`/clients/${id}/start`, {
            method: 'POST',
        });
    }

    async stopClient(id) {
        return this.request(`/clients/${id}/stop`, {
            method: 'POST',
        });
    }

    // System
    async getHealth() {
        return this.request('/system/health');
    }

    async getVersion() {
        return this.request('/system/version');
    }

    async getStats() {
        return this.request('/system/stats');
    }

    // Auth & User
    async getCurrentUser() {
        return this.request('/auth/me');
    }

    async updateUsername(newUsername) {
        return this.request('/auth/update-username', {
            method: 'PUT',
            body: JSON.stringify({ new_username: newUsername }),
        });
    }

    async updateDisplayName(displayName) {
        return this.request('/auth/update-display-name', {
            method: 'PUT',
            body: JSON.stringify({ display_name: displayName }),
        });
    }

    async updatePassword(currentPassword, newPassword) {
        return this.request('/auth/update-password', {
            method: 'PUT',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
            }),
        });
    }
}

// Global API instance
window.api = new API();
