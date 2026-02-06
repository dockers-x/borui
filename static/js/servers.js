// Server management UI
window.serversUI = {
    servers: [], // Store all servers
    currentFilter: 'all', // Current tag filter

    async loadServers() {
        const container = document.getElementById('servers-list');
        container.innerHTML = '<p class="loading" data-i18n="common.loading">Loading…</p>';
        i18n.applyTranslations();

        try {
            this.servers = await api.listServers();
            this.updateTagFilter();
            this.renderServers(this.getFilteredServers());
        } catch (e) {
            container.innerHTML = `<p class="error">Failed to load servers: ${e.message}</p>`;
        }
    },

    getFilteredServers() {
        if (this.currentFilter === 'all') {
            return this.servers;
        }
        if (this.currentFilter === '__no_tag__') {
            return this.servers.filter(s => !s.tags || s.tags.trim() === '');
        }
        return this.servers.filter(s => {
            if (!s.tags) return false;
            const tags = s.tags.split(',').map(t => t.trim().toLowerCase());
            return tags.includes(this.currentFilter.toLowerCase());
        });
    },

    updateTagFilter() {
        const chipsContainer = document.getElementById('servers-tag-chips');
        const filterBar = document.getElementById('servers-tag-filter');

        // Collect all unique tags
        const tagCounts = new Map();
        let noTagCount = 0;

        this.servers.forEach(server => {
            if (!server.tags || server.tags.trim() === '') {
                noTagCount++;
            } else {
                const tags = server.tags.split(',').map(t => t.trim());
                tags.forEach(tag => {
                    if (tag) {
                        const key = tag.toLowerCase();
                        tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
                    }
                });
            }
        });

        // Hide filter bar if no tags exist
        if (tagCounts.size === 0 && noTagCount === this.servers.length) {
            filterBar.classList.add('hidden');
            return;
        }
        filterBar.classList.remove('hidden');

        // Build tag chips HTML
        let html = `
            <button class="tag-chip ${this.currentFilter === 'all' ? 'active' : ''}" data-tag="all" onclick="serversUI.filterByTag('all')">
                <span data-i18n="common.allTags">All</span>
                <span class="tag-count">${this.servers.length}</span>
            </button>
        `;

        // Add "no tag" chip if there are untagged items
        if (noTagCount > 0) {
            html += `
                <button class="tag-chip no-tag ${this.currentFilter === '__no_tag__' ? 'active' : ''}" data-tag="__no_tag__" onclick="serversUI.filterByTag('__no_tag__')">
                    <span data-i18n="common.noTag">No Tag</span>
                    <span class="tag-count">${noTagCount}</span>
                </button>
            `;
        }

        // Add tag chips sorted alphabetically
        const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        sortedTags.forEach(([tag, count]) => {
            html += `
                <button class="tag-chip ${this.currentFilter === tag ? 'active' : ''}" data-tag="${tag}" onclick="serversUI.filterByTag('${tag}')">
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
        this.renderServers(this.getFilteredServers());
    },

    renderServers(servers) {
        const container = document.getElementById('servers-list');

        if (servers.length === 0) {
            if (this.currentFilter !== 'all') {
                container.innerHTML = `<p class="loading" data-i18n="common.noMatchingItems">No items match the selected filter.</p>`;
            } else {
                container.innerHTML = `<p class="loading" data-i18n="servers.noServers">No servers found. Create one to get started!</p>`;
            }
            i18n.applyTranslations();
            return;
        }

        container.innerHTML = servers.map(server => {
            const description = server.description || `<span data-i18n="common.noDescription">No description</span>`;
            const authInfo = server.secret ? `<br><strong data-i18n="servers.auth">Auth</strong>: <span data-i18n="servers.authEnabled">Enabled</span>` : '';

            // Render tags
            let tagsHtml = '';
            if (server.tags && server.tags.trim()) {
                const tags = server.tags.split(',').map(t => t.trim()).filter(t => t);
                if (tags.length > 0) {
                    tagsHtml = `<div class="item-tags">${tags.map(tag => `<span class="item-tag">${tag}</span>`).join('')}</div>`;
                }
            }

            return `
            <div class="item-card">
                <div class="item-header">
                    <div class="item-title">${server.name} <span class="item-id">#${server.id}</span></div>
                    <div class="item-status status-${server.status}" data-i18n="status.${server.status}">${server.status}</div>
                </div>
                <div class="item-details">
                    ${description}
                    <br>
                    <strong data-i18n="servers.address">Address</strong>: ${server.bind_addr}
                    <br>
                    <strong data-i18n="servers.portRange">Port Range</strong>: ${server.port_range_start}-${server.port_range_end}
                    ${authInfo}
                    ${tagsHtml}
                </div>
                <div class="item-actions">
                    ${server.status === 'stopped' ?
                        `<button class="btn-icon btn-success" onclick="serversUI.startServer(${server.id})" data-tooltip="${i18n.t('servers.start') || 'Start'}" aria-label="${i18n.t('servers.start') || 'Start'}">${getIcon('play')}</button>` :
                        server.status === 'running' ?
                        `<button class="btn-icon btn-danger" onclick="serversUI.stopServer(${server.id})" data-tooltip="${i18n.t('servers.stop') || 'Stop'}" aria-label="${i18n.t('servers.stop') || 'Stop'}">${getIcon('stop')}</button>` :
                        ''
                    }
                    <button class="btn-icon btn-secondary" onclick="serversUI.showEditForm(${server.id})" ${server.status !== 'stopped' ? 'disabled' : ''} data-tooltip="${i18n.t('common.edit') || 'Edit'}" aria-label="${i18n.t('common.edit') || 'Edit'}">${getIcon('edit')}</button>
                    <button class="btn-icon btn-secondary btn-copy" onclick="serversUI.copyServer(${server.id}, event)" data-tooltip="${i18n.t('common.copy') || 'Copy'}" aria-label="${i18n.t('common.copy') || 'Copy'}">${getIcon('copy')}</button>
                    <button class="btn-icon btn-danger" onclick="serversUI.deleteServer(${server.id})" ${server.status !== 'stopped' ? 'disabled' : ''} data-tooltip="${i18n.t('common.delete') || 'Delete'}" aria-label="${i18n.t('common.delete') || 'Delete'}">${getIcon('trash')}</button>
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

        // Update modal title based on mode
        if (server) {
            modalTitle.textContent = i18n.t('servers.editTitle') || 'Edit Server';
        } else {
            modalTitle.textContent = i18n.t('servers.modalTitle') || 'Create Server';
        }

        form.reset();

        // If editing, populate form with server data
        if (server) {
            document.getElementById('server-name').value = server.name;
            document.getElementById('server-description').value = server.description || '';
            document.getElementById('server-tags').value = server.tags || '';
            document.getElementById('server-bind-addr').value = server.bind_addr;
            document.getElementById('server-bind-tunnels').value = server.bind_tunnels || server.bind_addr;
            document.getElementById('server-port-start').value = server.port_range_start;
            document.getElementById('server-port-end').value = server.port_range_end;
            document.getElementById('server-secret').value = server.secret || '';
            document.getElementById('server-auto-start').checked = server.auto_start || false;
        }

        // Use the new openServerModal function
        openServerModal();

        // Remove old event listener and add new one
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        // Update button text AFTER cloning
        const submitBtn = newForm.querySelector('button[type="submit"]');
        if (server) {
            submitBtn.textContent = i18n.t('common.save') || 'Save';
            submitBtn.setAttribute('data-i18n', 'common.save');
        } else {
            submitBtn.textContent = i18n.t('common.create') || 'Create';
            submitBtn.setAttribute('data-i18n', 'common.create');
        }

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                name: document.getElementById('server-name').value,
                description: document.getElementById('server-description').value || '',
                tags: document.getElementById('server-tags').value || null,
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
    },

    async copyServer(id, event) {
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
            const server = await api.getServer(id);
            // Create copy data with modified name
            const copyData = {
                name: server.name + ' (' + (i18n.t('common.copy') || 'Copy') + ')',
                description: server.description || '',
                tags: server.tags || null,
                bind_addr: server.bind_addr,
                bind_tunnels: server.bind_tunnels || server.bind_addr,
                port_range_start: server.port_range_start,
                port_range_end: server.port_range_end,
                secret: server.secret || null,
                auto_start: false, // Don't auto-start copies
            };
            // Create the copy directly and refresh list
            const newServer = await api.createServer(copyData);
            await this.loadServers();
            toast.success(i18n.t('servers.copySuccess') || 'Server copied successfully');
            // Open edit form for the new server so user can modify it
            this.showEditForm(newServer.id);
        } catch (e) {
            if (btn) btn.classList.remove('copy-success');
            toast.error(i18n.t('servers.copyError') + ': ' + e.message);
        }
    }
};
