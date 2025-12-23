// Client management UI
window.clientsUI = {
    async loadClients() {
        const container = document.getElementById('clients-list');
        container.innerHTML = '<p class="loading">Loading...</p>';

        try {
            const clients = await api.listClients();
            this.renderClients(clients);
        } catch (e) {
            container.innerHTML = `<p class="error">Failed to load clients: ${e.message}</p>`;
        }
    },

    renderClients(clients) {
        const container = document.getElementById('clients-list');

        if (clients.length === 0) {
            container.innerHTML = '<p class="loading">No clients found. Create one to get started!</p>';
            return;
        }

        container.innerHTML = clients.map(client => `
            <div class="item-card">
                <div class="item-header">
                    <div class="item-title">${client.name}</div>
                    <div class="item-status status-${client.status}">${client.status}</div>
                </div>
                <div class="item-details">
                    ${client.description || 'No description'}
                    <br>
                    <strong>Local:</strong> ${client.local_host}:${client.local_port}
                    <br>
                    <strong>Remote:</strong> ${client.remote_server}${client.assigned_port ? `:${client.assigned_port}` : ''}
                </div>
                <div class="item-actions">
                    ${client.status === 'stopped' ?
                        `<button class="btn-success" onclick="clientsUI.startClient(${client.id})">Start</button>` :
                        client.status === 'connected' ?
                        `<button class="btn-danger" onclick="clientsUI.stopClient(${client.id})">Stop</button>` :
                        ''
                    }
                    <button class="btn-danger" onclick="clientsUI.deleteClient(${client.id})" ${client.status !== 'stopped' ? 'disabled' : ''}>Delete</button>
                </div>
            </div>
        `).join('');
    },

    async startClient(id) {
        try {
            await api.startClient(id);
            await this.loadClients();
        } catch (e) {
            alert(`Failed to start client: ${e.message}`);
        }
    },

    async stopClient(id) {
        try {
            await api.stopClient(id);
            await this.loadClients();
        } catch (e) {
            alert(`Failed to stop client: ${e.message}`);
        }
    },

    async deleteClient(id) {
        if (!confirm('Are you sure you want to delete this client?')) {
            return;
        }

        try {
            await api.deleteClient(id);
            await this.loadClients();
        } catch (e) {
            alert(`Failed to delete client: ${e.message}`);
        }
    },

    showCreateDialog() {
        const name = prompt('Client name:');
        if (!name) return;

        const localPort = prompt('Local port:', '8080');
        const remoteServer = prompt('Remote server:', 'localhost');

        this.createClient({
            name,
            description: '',
            local_port: parseInt(localPort) || 8080,
            remote_server: remoteServer || 'localhost',
        });
    },

    async createClient(data) {
        try {
            await api.createClient(data);
            await this.loadClients();
        } catch (e) {
            alert(`Failed to create client: ${e.message}`);
        }
    }
};
