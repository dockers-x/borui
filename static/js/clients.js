// Client management UI
window.clientsUI = {
    clients: [], // Store all clients
    currentFilter: 'all', // Current tag filter

    async loadClients() {
        const container = document.getElementById('clients-list');
        container.innerHTML = '<p class="loading" data-i18n="common.loading">Loading…</p>';
        i18n.applyTranslations();

        try {
            this.clients = await api.listClients();
            this.updateTagFilter();
            this.renderClients(this.getFilteredClients());
        } catch (e) {
            container.innerHTML = `<p class="error">Failed to load clients: ${e.message}</p>`;
        }
    },

    getFilteredClients() {
        if (this.currentFilter === 'all') {
            return this.clients;
        }
        if (this.currentFilter === '__no_tag__') {
            return this.clients.filter(c => !c.tags || c.tags.trim() === '');
        }
        return this.clients.filter(c => {
            if (!c.tags) return false;
            const tags = c.tags.split(',').map(t => t.trim().toLowerCase());
            return tags.includes(this.currentFilter.toLowerCase());
        });
    },

    updateTagFilter() {
        const chipsContainer = document.getElementById('clients-tag-chips');
        const filterBar = document.getElementById('clients-tag-filter');

        // Collect all unique tags
        const tagCounts = new Map();
        let noTagCount = 0;

        this.clients.forEach(client => {
            if (!client.tags || client.tags.trim() === '') {
                noTagCount++;
            } else {
                const tags = client.tags.split(',').map(t => t.trim());
                tags.forEach(tag => {
                    if (tag) {
                        const key = tag.toLowerCase();
                        tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
                    }
                });
            }
        });

        // Hide filter bar if no tags exist
        if (tagCounts.size === 0 && noTagCount === this.clients.length) {
            filterBar.classList.add('hidden');
            return;
        }
        filterBar.classList.remove('hidden');

        // Build tag chips HTML
        let html = `
            <button class="tag-chip ${this.currentFilter === 'all' ? 'active' : ''}" data-tag="all" onclick="clientsUI.filterByTag('all')">
                <span data-i18n="common.allTags">All</span>
                <span class="tag-count">${this.clients.length}</span>
            </button>
        `;

        // Add "no tag" chip if there are untagged items
        if (noTagCount > 0) {
            html += `
                <button class="tag-chip no-tag ${this.currentFilter === '__no_tag__' ? 'active' : ''}" data-tag="__no_tag__" onclick="clientsUI.filterByTag('__no_tag__')">
                    <span data-i18n="common.noTag">No Tag</span>
                    <span class="tag-count">${noTagCount}</span>
                </button>
            `;
        }

        // Add tag chips sorted alphabetically
        const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        sortedTags.forEach(([tag, count]) => {
            html += `
                <button class="tag-chip ${this.currentFilter === tag ? 'active' : ''}" data-tag="${tag}" onclick="clientsUI.filterByTag('${tag}')">
                    <span>${tag}</span>
                    <span class="tag-count">${count}</span>
                </button>
            `;
        });

        chipsContainer.innerHTML = html;
        i18n.applyTranslations();
    },

    filterByTag(tag) {
        this.currentFilter = tag;
        this.updateTagFilter();
        this.renderClients(this.getFilteredClients());
    },

    renderClients(clients) {
        const container = document.getElementById('clients-list');

        if (clients.length === 0) {
            if (this.currentFilter !== 'all') {
                container.innerHTML = `<p class="loading" data-i18n="common.noMatchingItems">No items match the selected filter.</p>`;
            } else {
                container.innerHTML = `<p class="loading" data-i18n="clients.noClients">No clients found. Create one to get started!</p>`;
            }
            i18n.applyTranslations();
            return;
        }

        container.innerHTML = clients.map(client => {
            // Determine remote port display
            let remotePortDisplay = '';
            if (client.remote_port === 0) {
                // Auto-assign mode
                if (client.assigned_port) {
                    remotePortDisplay = `:${client.assigned_port} <span class="badge" data-i18n="clients.autoAssigned">auto-assigned</span>`;
                } else {
                    remotePortDisplay = ' <span class="badge" data-i18n="clients.autoAssign">auto-assign</span>';
                }
            } else {
                // User specified port
                remotePortDisplay = `:${client.remote_port}`;
            }

            const description = client.description || `<span data-i18n="common.noDescription">No description</span>`;
            const authInfo = client.secret ? `<br><strong data-i18n="clients.auth">Auth</strong>: <span data-i18n="clients.authEnabled">Enabled</span>` : '';
            const errorInfo = client.status === 'error' && client.error_message ?
                `<br><span class="error-message" style="color: #dc3545;">⚠ ${client.error_message}</span>` : '';

            // Render tags
            let tagsHtml = '';
            if (client.tags && client.tags.trim()) {
                const tags = client.tags.split(',').map(t => t.trim()).filter(t => t);
                if (tags.length > 0) {
                    tagsHtml = `<div class="item-tags">${tags.map(tag => `<span class="item-tag">${tag}</span>`).join('')}</div>`;
                }
            }

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
                    ${errorInfo}
                    ${tagsHtml}
                </div>
                <div class="item-actions">
                    ${client.status === 'stopped' || client.status === 'error' ?
                        `<button class="btn-icon btn-success" onclick="clientsUI.startClient(${client.id})" data-tooltip="${i18n.t('clients.start') || 'Start'}" aria-label="${i18n.t('clients.start') || 'Start'}">${getIcon('play')}</button>` :
                        client.status === 'connected' ?
                        `<button class="btn-icon btn-danger" onclick="clientsUI.stopClient(${client.id})" data-tooltip="${i18n.t('clients.stop') || 'Stop'}" aria-label="${i18n.t('clients.stop') || 'Stop'}">${getIcon('stop')}</button>` :
                        ''
                    }
                    <button class="btn-icon btn-secondary" onclick="clientsUI.showEditForm(${client.id})" ${client.status === 'connected' || client.status === 'starting' ? 'disabled' : ''} data-tooltip="${i18n.t('common.edit') || 'Edit'}" aria-label="${i18n.t('common.edit') || 'Edit'}">${getIcon('edit')}</button>
                    <button class="btn-icon btn-secondary btn-copy" onclick="clientsUI.copyClient(${client.id}, event)" data-tooltip="${i18n.t('common.copy') || 'Copy'}" aria-label="${i18n.t('common.copy') || 'Copy'}">${getIcon('copy')}</button>
                    <button class="btn-icon btn-danger" onclick="clientsUI.deleteClient(${client.id})" ${client.status === 'connected' || client.status === 'starting' ? 'disabled' : ''} data-tooltip="${i18n.t('common.delete') || 'Delete'}" aria-label="${i18n.t('common.delete') || 'Delete'}">${getIcon('trash')}</button>
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

        // Update modal title based on mode
        if (client) {
            modalTitle.textContent = i18n.t('clients.editTitle') || 'Edit Client';
        } else {
            modalTitle.textContent = i18n.t('clients.modalTitle') || 'Create Client';
        }

        form.reset();

        // If editing, populate form with client data
        if (client) {
            document.getElementById('client-name').value = client.name;
            document.getElementById('client-description').value = client.description || '';
            document.getElementById('client-tags').value = client.tags || '';
            document.getElementById('client-local-host').value = client.local_host;
            document.getElementById('client-local-port').value = client.local_port;
            document.getElementById('client-remote-server').value = client.remote_server;
            document.getElementById('client-remote-port').value = client.remote_port;
            document.getElementById('client-secret').value = client.secret || '';
            document.getElementById('client-auto-start').checked = client.auto_start || false;
            document.getElementById('client-enable-keepalive').checked = client.enable_keepalive !== false; // default true

            // Set webhook fields
            const webhookEnabled = !!client.webhook_url;
            document.getElementById('webhook-enabled').checked = webhookEnabled;
            document.getElementById('client-webhook-url').value = client.webhook_url || '';
            document.getElementById('client-webhook-format').value = client.webhook_format || 'json';
            document.getElementById('client-webhook-template').value = client.webhook_template || '';

            // Update webhook UI state
            toggleWebhookSection();
            toggleWebhookTemplate();
        } else {
            // Default state for new clients - webhook disabled
            document.getElementById('webhook-enabled').checked = false;
            toggleWebhookSection();
        }

        modal.classList.add('show');

        // Reset to first tab
        document.querySelectorAll('.modal-tab').forEach((tab, index) => {
            if (index === 0) tab.classList.add('active');
            else tab.classList.remove('active');
        });
        document.querySelectorAll('.modal-tab-panel').forEach((panel, index) => {
            if (index === 0) panel.classList.add('active');
            else panel.classList.remove('active');
        });

        // Remove old event listener and add new one
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        // Update button text AFTER cloning
        const submitBtn = newForm.querySelector('button[type="submit"]');
        if (client) {
            submitBtn.textContent = i18n.t('common.save') || 'Save';
            submitBtn.setAttribute('data-i18n', 'common.save');
        } else {
            submitBtn.textContent = i18n.t('common.create') || 'Create';
            submitBtn.setAttribute('data-i18n', 'common.create');
        }

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Get webhook URL only if enabled
            const webhookEnabled = document.getElementById('webhook-enabled').checked;
            const webhookUrl = webhookEnabled ? document.getElementById('client-webhook-url').value : null;

            const data = {
                name: document.getElementById('client-name').value,
                description: document.getElementById('client-description').value || '',
                tags: document.getElementById('client-tags').value || null,
                local_host: document.getElementById('client-local-host').value,
                local_port: parseInt(document.getElementById('client-local-port').value),
                remote_server: document.getElementById('client-remote-server').value,
                remote_port: parseInt(document.getElementById('client-remote-port').value),
                secret: document.getElementById('client-secret').value || null,
                auto_start: document.getElementById('client-auto-start').checked,
                enable_keepalive: document.getElementById('client-enable-keepalive').checked,
                webhook_url: webhookUrl,
                webhook_format: document.getElementById('client-webhook-format').value,
                webhook_template: document.getElementById('client-webhook-template').value || null,
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
    },

    async copyClient(id, event) {
        // Add visual feedback to button
        const btn = event ? event.currentTarget : null;
        if (btn) {
            btn.classList.add('copy-success');
            // Add ripple effect
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = btn.getBoundingClientRect();
            const x = (event.clientX || rect.left + rect.width / 2) - rect.left;
            const y = (event.clientY || rect.top + rect.height / 2) - rect.top;
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }

        try {
            const client = await api.getClient(id);
            // Create copy data with modified name
            const copyData = {
                name: client.name + ' (' + (i18n.t('common.copy') || 'Copy') + ')',
                description: client.description || '',
                tags: client.tags || null,
                local_host: client.local_host,
                local_port: client.local_port,
                remote_server: client.remote_server,
                remote_port: client.remote_port,
                secret: client.secret || null,
                auto_start: false, // Don't auto-start copies
                enable_keepalive: client.enable_keepalive !== false,
                webhook_url: client.webhook_url || null,
                webhook_format: client.webhook_format || 'json',
                webhook_template: client.webhook_template || null,
            };
            // Create the copy directly and refresh list
            const newClient = await api.createClient(copyData);
            await this.loadClients();
            toast.success(i18n.t('clients.copySuccess') || 'Client copied successfully');
            // Open edit form for the new client so user can modify it
            this.showEditForm(newClient.id);
        } catch (e) {
            if (btn) btn.classList.remove('copy-success');
            toast.error(i18n.t('clients.copyError') + ': ' + e.message);
        }
    }
};

// Helper functions for webhook configuration
function toggleWebhookSection() {
    const enabled = document.getElementById('webhook-enabled').checked;
    const section = document.getElementById('webhook-section');
    const config = document.getElementById('webhook-config');
    const statusBadge = document.getElementById('webhook-status-badge');
    const urlInput = document.getElementById('client-webhook-url');

    if (enabled) {
        section.classList.add('webhook-enabled');
        section.classList.remove('webhook-disabled');
        config.classList.remove('webhook-disabled');
        statusBadge.classList.remove('status-disabled');
        statusBadge.classList.add('status-enabled');
        statusBadge.querySelector('span').textContent = i18n.t('clients.webhookEnabled') || 'Enabled';
    } else {
        section.classList.remove('webhook-enabled');
        section.classList.add('webhook-disabled');
        config.classList.add('webhook-disabled');
        statusBadge.classList.add('status-disabled');
        statusBadge.classList.remove('status-enabled');
        statusBadge.querySelector('span').textContent = i18n.t('clients.webhookDisabled') || 'Disabled';
        // Clear URL when disabling
        urlInput.value = '';
    }
}

function toggleWebhookTemplate() {
    const format = document.getElementById('client-webhook-format').value;
    const templateGroup = document.getElementById('webhook-template-group');
    const formatInfo = document.getElementById('webhook-format-info');

    if (format === 'custom') {
        templateGroup.classList.remove('hidden');
        templateGroup.classList.add('visible');
        if (formatInfo) {
            formatInfo.querySelector('span').textContent = i18n.t('clients.webhookFormatInfoCustom') || 'Custom templates let you format the webhook payload exactly as needed';
        }
    } else {
        templateGroup.classList.add('hidden');
        templateGroup.classList.remove('visible');
        if (formatInfo) {
            formatInfo.querySelector('span').textContent = i18n.t('clients.webhookFormatInfo') || 'Standard JSON sends structured data ideal for integrations';
        }
    }
}

function applyWebhookPreset() {
    const preset = document.getElementById('webhook-template-preset').value;
    const templateTextarea = document.getElementById('client-webhook-template');

    const presets = {
        slack: `{
  "text": "🔔 Client *{{client_name}}* {{event}}",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Client Status Update*\\n{{#if assigned_port}}Connected on port {{assigned_port}}{{else}}Disconnected after {{uptime_seconds}}s{{/if}}"
      }
    }
  ]
}`,
        discord: `{
  "content": "🔔 Webhook Notification",
  "embeds": [{
    "title": "Client {{client_name}}",
    "description": "Status: {{event}}",
    "color": {{#if assigned_port}}3066993{{else}}15158332{{/if}},
    "timestamp": "{{timestamp}}",
    "fields": [
      {{#if assigned_port}}
      {"name": "Port", "value": "{{assigned_port}}", "inline": true}
      {{/if}}
    ]
  }]
}`,
        simple: `Client {{client_name}} (ID: {{client_id}}) {{event}} at {{timestamp}}{{#if assigned_port}}
Assigned Port: {{assigned_port}}{{/if}}{{#if uptime_seconds}}
Uptime: {{uptime_seconds}} seconds{{/if}}`
    };

    if (preset && presets[preset]) {
        templateTextarea.value = presets[preset];
    }
}

function showWebhookHelp() {
    const modal = document.getElementById('webhook-help-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeWebhookHelp() {
    const modal = document.getElementById('webhook-help-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Tab switching for modal
function switchTab(event, tabId) {
    // Remove active class from all tabs
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all panels
    document.querySelectorAll('.modal-tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    // Add active class to clicked tab
    event.currentTarget.classList.add('active');

    // Add active class to corresponding panel
    document.getElementById(tabId).classList.add('active');
}
