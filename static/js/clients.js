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
                    <div class="item-title">${client.name} <span class="item-id">#${client.id}</span></div>
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
                        `<button class="btn-success" onclick="clientsUI.startClient(${client.id})">${getIcon('play')}<span data-i18n="clients.start">Start</span></button>` :
                        client.status === 'connected' ?
                        `<button class="btn-danger" onclick="clientsUI.stopClient(${client.id})">${getIcon('stop')}<span data-i18n="clients.stop">Stop</span></button>` :
                        ''
                    }
                    <button class="btn-secondary" onclick="clientsUI.showEditForm(${client.id})" ${client.status !== 'stopped' ? 'disabled' : ''}>${getIcon('edit')}<span data-i18n="common.edit">Edit</span></button>
                    <button class="btn-danger" onclick="clientsUI.deleteClient(${client.id})" ${client.status !== 'stopped' ? 'disabled' : ''}>${getIcon('trash')}<span data-i18n="common.delete">Delete</span></button>
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
            toast.success(i18n.t('clients.startSuccess'));
        } catch (e) {
            toast.error(i18n.t('clients.startError') + ': ' + e.message);
        }
    },

    async stopClient(id) {
        try {
            await api.stopClient(id);
            await this.loadClients();
            toast.success(i18n.t('clients.stopSuccess'));
        } catch (e) {
            toast.error(i18n.t('clients.stopError') + ': ' + e.message);
        }
    },

    async deleteClient(id) {
        toast.confirm(i18n.t('clients.deleteConfirm'), async () => {
            try {
                await api.deleteClient(id);
                await this.loadClients();
                toast.success(i18n.t('clients.deleteSuccess'));
            } catch (e) {
                toast.error(i18n.t('clients.deleteError') + ': ' + e.message);
            }
        });
    },

    showCreateForm() {
        this.showForm(null);
    },

    async showEditForm(id) {
        try {
            const client = await api.getClient(id);
            this.showForm(client);
        } catch (e) {
            toast.error(i18n.t('clients.loadError') + ': ' + e.message);
        }
    },

    showForm(client = null) {
        const modal = document.getElementById('client-modal');
        const form = document.getElementById('client-form');
        const modalTitle = document.getElementById('client-modal-title');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Update modal title and button text based on mode
        if (client) {
            modalTitle.textContent = i18n.t('clients.editTitle') || 'Edit Client';
            submitBtn.textContent = i18n.t('common.save') || 'Save';
            submitBtn.setAttribute('data-i18n', 'common.save');
        } else {
            modalTitle.textContent = i18n.t('clients.modalTitle') || 'Create Client';
            submitBtn.textContent = i18n.t('common.create') || 'Create';
            submitBtn.setAttribute('data-i18n', 'common.create');
        }

        form.reset();

        // If editing, populate form with client data
        if (client) {
            document.getElementById('client-name').value = client.name;
            document.getElementById('client-description').value = client.description || '';
            document.getElementById('client-local-host').value = client.local_host;
            document.getElementById('client-local-port').value = client.local_port;
            document.getElementById('client-remote-server').value = client.remote_server;
            document.getElementById('client-remote-port').value = client.remote_port;
            document.getElementById('client-secret').value = client.secret || '';
            document.getElementById('client-auto-start').checked = client.auto_start || false;
        }

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
                if (client) {
                    await this.updateClient(client.id, data);
                } else {
                    await this.createClient(data);
                }
                closeClientModal();
            } catch (e) {
                const errorKey = client ? 'clients.updateError' : 'clients.createError';
                toast.error(i18n.t(errorKey) + ': ' + e.message);
            }
        });
    },

    async createClient(data) {
        try {
            await api.createClient(data);
            await this.loadClients();
            toast.success(i18n.t('clients.createSuccess'));
        } catch (e) {
            throw e;
        }
    },

    async updateClient(id, data) {
        try {
            await api.updateClient(id, data);
            await this.loadClients();
            toast.success(i18n.t('clients.updateSuccess'));
        } catch (e) {
            throw e;
        }
    }
};
