// API client wrapper
class API {
    constructor() {
        this.baseURL = '/api/v1';
        this.token = localStorage.getItem('token');
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
