// Main application
(async function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Load i18n
    await i18n.loadLocale(i18n.locale);

    // Setup language selector
    const langSelector = document.getElementById('language-selector');
    langSelector.value = i18n.locale;
    langSelector.addEventListener('change', async (e) => {
        await i18n.loadLocale(e.target.value);
    });

    // Setup navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.getAttribute('href').substring(1);
            showView(target);
        });
    });

    function showView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.classList.add('active');
            document.querySelector(`[href="#${viewName}"]`).classList.add('active');

            // Load data for the view
            if (viewName === 'servers') {
                serversUI.loadServers();
            } else if (viewName === 'clients') {
                clientsUI.loadClients();
            } else if (viewName === 'system') {
                loadSystemInfo();
            } else if (viewName === 'settings') {
                loadSettings();
            }
        }
    }

    async function loadSystemInfo() {
        const container = document.getElementById('system-info');
        container.innerHTML = '<p class="loading" data-i18n="common.loading">Loading...</p>';
        i18n.applyTranslations();

        try {
            const [health, version, stats] = await Promise.all([
                api.getHealth(),
                api.getVersion(),
                api.getStats(),
            ]);

            container.innerHTML = `
                <div class="info-item">
                    <div class="info-label" data-i18n="system.version">Version</div>
                    <div class="info-value">${version.version}</div>
                </div>
                <div class="info-item">
                    <div class="info-label" data-i18n="system.databaseStatus">Database Status</div>
                    <div class="info-value">${health.database}</div>
                </div>
                <div class="info-item">
                    <div class="info-label" data-i18n="system.totalServers">Total Servers</div>
                    <div class="info-value">${stats.total_servers}</div>
                </div>
                <div class="info-item">
                    <div class="info-label" data-i18n="system.totalClients">Total Clients</div>
                    <div class="info-value">${stats.total_clients}</div>
                </div>
                <div class="info-item">
                    <div class="info-label" data-i18n="system.serversRunning">Servers Running</div>
                    <div class="info-value">${stats.servers_running}</div>
                </div>
                <div class="info-item">
                    <div class="info-label" data-i18n="system.clientsConnected">Clients Connected</div>
                    <div class="info-value">${stats.clients_connected}</div>
                </div>
            `;

            // Apply translations to dynamically generated content
            i18n.applyTranslations();
        } catch (e) {
            container.innerHTML = `<p class="error">Failed to load system info: ${e.message}</p>`;
        }
    }

    // Setup create buttons
    document.getElementById('create-server-btn').addEventListener('click', () => {
        serversUI.showCreateForm();
    });

    document.getElementById('create-client-btn').addEventListener('click', () => {
        clientsUI.showCreateForm();
    });

    // Connect WebSocket
    wsClient.connect();

    // Listen for status updates
    wsClient.on('server_status', (data) => {
        console.log('Server status update:', data);
        serversUI.loadServers();
    });

    wsClient.on('client_status', (data) => {
        console.log('Client status update:', data);
        clientsUI.loadClients();
    });

    // Load initial data
    serversUI.loadServers();
})();

// Global logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// Global modal functions
function closeServerModal() {
    document.getElementById('server-modal').classList.remove('show');
    document.getElementById('server-form').reset();
}

function closeClientModal() {
    document.getElementById('client-modal').classList.remove('show');
    document.getElementById('client-form').reset();
}
