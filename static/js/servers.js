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
                    <div class="item-title">${server.name} <span class="item-id">#${server.id}</span></div>
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
                        `<button class="btn-success" onclick="serversUI.startServer(${server.id})">${getIcon('play')}<span data-i18n="servers.start">Start</span></button>` :
                        server.status === 'running' ?
                        `<button class="btn-danger" onclick="serversUI.stopServer(${server.id})">${getIcon('stop')}<span data-i18n="servers.stop">Stop</span></button>` :
                        ''
                    }
                    <button class="btn-secondary" onclick="serversUI.showEditForm(${server.id})" ${server.status !== 'stopped' ? 'disabled' : ''}>${getIcon('edit')}<span data-i18n="common.edit">Edit</span></button>
                    <button class="btn-danger" onclick="serversUI.deleteServer(${server.id})" ${server.status !== 'stopped' ? 'disabled' : ''}>${getIcon('trash')}<span data-i18n="common.delete">Delete</span></button>
                </div>
            </div>
        `;
        }).join('');

        // Apply translations to dynamically generated content
        i18n.applyTranslations();
    },

    showCreateForm() {
        this.showForm(null);
    },

    async showEditForm(id) {
        try {
            const server = await api.getServer(id);
            this.showForm(server);
        } catch (e) {
            toast.error(i18n.t('servers.loadError') + ': ' + e.message);
        }
    },

    showForm(server = null) {
        const modal = document.getElementById('server-modal');
        const form = document.getElementById('server-form');
        const modalTitle = document.getElementById('server-modal-title');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Update modal title and button text based on mode
        if (server) {
            modalTitle.textContent = i18n.t('servers.editTitle') || 'Edit Server';
            submitBtn.textContent = i18n.t('common.save') || 'Save';
            submitBtn.setAttribute('data-i18n', 'common.save');
        } else {
            modalTitle.textContent = i18n.t('servers.modalTitle') || 'Create Server';
            submitBtn.textContent = i18n.t('common.create') || 'Create';
            submitBtn.setAttribute('data-i18n', 'common.create');
        }

        form.reset();

        // If editing, populate form with server data
        if (server) {
            document.getElementById('server-name').value = server.name;
            document.getElementById('server-description').value = server.description || '';
            document.getElementById('server-bind-addr').value = server.bind_addr;
            document.getElementById('server-bind-tunnels').value = server.bind_tunnels || server.bind_addr;
            document.getElementById('server-port-start').value = server.port_range_start;
            document.getElementById('server-port-end').value = server.port_range_end;
            document.getElementById('server-secret').value = server.secret || '';
            document.getElementById('server-auto-start').checked = server.auto_start || false;
        }

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
                if (server) {
                    await this.updateServer(server.id, data);
                } else {
                    await this.createServer(data);
                }
                closeServerModal();
            } catch (e) {
                const errorKey = server ? 'servers.updateError' : 'servers.createError';
                toast.error(i18n.t(errorKey) + ': ' + e.message);
            }
        });
    },

    async createServer(data) {
        try {
            await api.createServer(data);
            await this.loadServers();
            toast.success(i18n.t('servers.createSuccess'));
        } catch (e) {
            throw e;
        }
    },

    async updateServer(id, data) {
        try {
            await api.updateServer(id, data);
            await this.loadServers();
            toast.success(i18n.t('servers.updateSuccess'));
        } catch (e) {
            throw e;
        }
    },

    async startServer(id) {
        try {
            await api.startServer(id);
            await this.loadServers();
            toast.success(i18n.t('servers.startSuccess'));
        } catch (e) {
            toast.error(i18n.t('servers.startError') + ': ' + e.message);
        }
    },

    async stopServer(id) {
        try {
            await api.stopServer(id);
            await this.loadServers();
            toast.success(i18n.t('servers.stopSuccess'));
        } catch (e) {
            toast.error(i18n.t('servers.stopError') + ': ' + e.message);
        }
    },

    async deleteServer(id) {
        toast.confirm(i18n.t('servers.deleteConfirm'), async () => {
            try {
                await api.deleteServer(id);
                await this.loadServers();
                toast.success(i18n.t('servers.deleteSuccess'));
            } catch (e) {
                toast.error(i18n.t('servers.deleteError') + ': ' + e.message);
            }
        });
    }
};
