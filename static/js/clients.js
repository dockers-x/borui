// Client management UI
window.clientsUI = {
    async loadClients() {
        const container = document.getElementById('clients-list');
        container.innerHTML = '<p class="loading" data-i18n="common.loading">Loading...</p>';
        i18n.applyTranslations();

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
            container.innerHTML = `<p class="loading" data-i18n="clients.noClients">No clients found. Create one to get started!</p>`;
            i18n.applyTranslations();
            return;
        }

        container.innerHTML = clients.map(client => {
            // Determine remote port display
            let remotePortDisplay = '';
            if (client.remote_port === 0) {
                // Auto-assign mode
                if (client.assigned_port) {
                    remotePortDisplay = `:${client.assigned_port} <span class="badge">auto-assigned</span>`;
                } else {
                    remotePortDisplay = ' <span class="badge">auto-assign</span>';
                }
            } else {
                // User specified port
                remotePortDisplay = `:${client.remote_port}`;
            }

            const description = client.description || `<span data-i18n="common.noDescription">No description</span>`;
            const authInfo = client.secret ? `<br><strong data-i18n="clients.auth">Auth</strong>: <span data-i18n="clients.authEnabled">Enabled</span>` : '';

            return `
            <div class="item-card">
                <div class="item-header">
                    <div class="item-title">${client.name}</div>
                    <div class="item-status status-${client.status}" data-i18n="status.${client.status}">${client.status}</div>
                </div>
                <div class="item-details">
                    ${description}
                    <br>
                    <strong data-i18n="clients.local">Local</strong>: ${client.local_host}:${client.local_port}
                    <br>
                    <strong data-i18n="clients.remote">Remote</strong>: ${client.remote_server}${remotePortDisplay}
                    ${authInfo}
                </div>
                <div class="item-actions">
                    ${client.status === 'stopped' ?
                        `<button class="btn-success" onclick="clientsUI.startClient(${client.id})" data-i18n="clients.start">Start</button>` :
                        client.status === 'connected' ?
                        `<button class="btn-danger" onclick="clientsUI.stopClient(${client.id})" data-i18n="clients.stop">Stop</button>` :
                        ''
                    }
                    <button class="btn-danger" onclick="clientsUI.deleteClient(${client.id})" ${client.status !== 'stopped' ? 'disabled' : ''} data-i18n="clients.delete">Delete</button>
                </div>
            </div>
        `;
        }).join('');

        // Apply translations to dynamically generated content
        i18n.applyTranslations();
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

    showCreateForm() {
        const modal = document.getElementById('client-modal');
        const form = document.getElementById('client-form');

        form.reset();
        modal.classList.add('show');

        // Remove old event listener and add new one
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                name: document.getElementById('client-name').value,
                description: document.getElementById('client-description').value || '',
                local_host: document.getElementById('client-local-host').value,
                local_port: parseInt(document.getElementById('client-local-port').value),
                remote_server: document.getElementById('client-remote-server').value,
                remote_port: parseInt(document.getElementById('client-remote-port').value),
                secret: document.getElementById('client-secret').value || null,
                auto_start: document.getElementById('client-auto-start').checked,
            };

            try {
                await this.createClient(data);
                closeClientModal();
            } catch (e) {
                alert(`Failed to create client: ${e.message}`);
            }
        });
    },

    async createClient(data) {
        try {
            await api.createClient(data);
            await this.loadClients();
        } catch (e) {
            throw e;
        }
    }
};
