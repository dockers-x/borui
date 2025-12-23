// Server management UI
window.serversUI = {
    async loadServers() {
        const container = document.getElementById('servers-list');
        container.innerHTML = '<p class="loading" data-i18n="common.loading">Loading...</p>';
        i18n.applyTranslations();

        try {
            const servers = await api.listServers();
            this.renderServers(servers);
        } catch (e) {
            container.innerHTML = `<p class="error">Failed to load servers: ${e.message}</p>`;
        }
    },

    renderServers(servers) {
        const container = document.getElementById('servers-list');

        if (servers.length === 0) {
            container.innerHTML = `<p class="loading" data-i18n="servers.noServers">No servers found. Create one to get started!</p>`;
            i18n.applyTranslations();
            return;
        }

        container.innerHTML = servers.map(server => {
            const description = server.description || `<span data-i18n="common.noDescription">No description</span>`;
            const authInfo = server.secret ? `<br><strong data-i18n="servers.auth">Auth</strong>: <span data-i18n="servers.authEnabled">Enabled</span>` : '';

            return `
            <div class="item-card">
                <div class="item-header">
                    <div class="item-title">${server.name}</div>
                    <div class="item-status status-${server.status}" data-i18n="status.${server.status}">${server.status}</div>
                </div>
                <div class="item-details">
                    ${description}
                    <br>
                    <strong>Address:</strong> ${server.bind_addr}
                    <br>
                    <strong>Port Range:</strong> ${server.port_range_start}-${server.port_range_end}
                    ${authInfo}
                </div>
                <div class="item-actions">
                    ${server.status === 'stopped' ?
                        `<button class="btn-success" onclick="serversUI.startServer(${server.id})" data-i18n="servers.start">Start</button>` :
                        server.status === 'running' ?
                        `<button class="btn-danger" onclick="serversUI.stopServer(${server.id})" data-i18n="servers.stop">Stop</button>` :
                        ''
                    }
                    <button class="btn-danger" onclick="serversUI.deleteServer(${server.id})" ${server.status !== 'stopped' ? 'disabled' : ''} data-i18n="servers.delete">Delete</button>
                </div>
            </div>
        `;
        }).join('');

        // Apply translations to dynamically generated content
        i18n.applyTranslations();
    },

    showCreateForm() {
        const modal = document.getElementById('server-modal');
        const form = document.getElementById('server-form');

        form.reset();
        modal.classList.add('show');

        // Remove old event listener and add new one
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                name: document.getElementById('server-name').value,
                description: document.getElementById('server-description').value || '',
                bind_addr: document.getElementById('server-bind-addr').value,
                bind_tunnels: document.getElementById('server-bind-tunnels').value,
                port_range_start: parseInt(document.getElementById('server-port-start').value),
                port_range_end: parseInt(document.getElementById('server-port-end').value),
                secret: document.getElementById('server-secret').value || null,
                auto_start: document.getElementById('server-auto-start').checked,
            };

            try {
                await this.createServer(data);
                closeServerModal();
            } catch (e) {
                alert(`Failed to create server: ${e.message}`);
            }
        });
    },

    async createServer(data) {
        try {
            await api.createServer(data);
            await this.loadServers();
        } catch (e) {
            throw e;
        }
    },

    async startServer(id) {
        try {
            await api.startServer(id);
            await this.loadServers();
        } catch (e) {
            alert(`Failed to start server: ${e.message}`);
        }
    },

    async stopServer(id) {
        try {
            await api.stopServer(id);
            await this.loadServers();
        } catch (e) {
            alert(`Failed to stop server: ${e.message}`);
        }
    },

    async deleteServer(id) {
        if (!confirm('Are you sure you want to delete this server?')) {
            return;
        }

        try {
            await api.deleteServer(id);
            await this.loadServers();
        } catch (e) {
            alert(`Failed to delete server: ${e.message}`);
        }
    }
};
