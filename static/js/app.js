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

    // Initialize icons
    document.getElementById('user-menu-icon').innerHTML = icons.chevronDown;
    document.getElementById('settings-icon').innerHTML = icons.settings;
    document.getElementById('logout-icon').innerHTML = icons.logOut;
    document.getElementById('create-server-icon').innerHTML = icons.plus;
    document.getElementById('create-client-icon').innerHTML = icons.plus;
    document.getElementById('globe-icon').innerHTML = icons.globe;

    // Initialize password toggle icons
    document.querySelectorAll('.password-toggle-icon').forEach(icon => {
        icon.innerHTML = icons.eye;
    });

    // Load user info
    try {
        const user = await api.getCurrentUser();
        const displayName = user.display_name || user.username;
        document.getElementById('user-display-name').textContent = displayName;
    } catch (e) {
        console.error('Failed to load user info:', e);
        document.getElementById('user-display-name').textContent = 'User';
    }

    // Setup language menu
    const langMenuButton = document.getElementById('lang-menu-button');
    const langMenuDropdown = document.getElementById('lang-menu-dropdown');
    const currentLangCode = document.getElementById('current-lang-code');

    // Update current language display
    function updateLangDisplay(locale) {
        const langMap = {
            'en': 'EN',
            'zh-CN': '简',
            'zh-TW': '繁'
        };
        currentLangCode.textContent = langMap[locale] || 'EN';

        // Update active state
        document.querySelectorAll('.lang-menu-item').forEach(item => {
            if (item.dataset.lang === locale) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    updateLangDisplay(i18n.locale);

    langMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        langMenuDropdown.classList.toggle('show');
        userMenuDropdown.classList.remove('show');
    });

    langMenuDropdown.addEventListener('click', async (e) => {
        e.stopPropagation();
        const langItem = e.target.closest('.lang-menu-item');
        if (langItem) {
            const lang = langItem.dataset.lang;
            await i18n.loadLocale(lang);
            updateLangDisplay(lang);
            langMenuDropdown.classList.remove('show');
        }
    });

    // Setup user menu
    const userMenuButton = document.getElementById('user-menu-button');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');

    userMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenuDropdown.classList.toggle('show');
        langMenuDropdown.classList.remove('show');
    });

    // Close menus when clicking outside
    document.addEventListener('click', () => {
        userMenuDropdown.classList.remove('show');
        langMenuDropdown.classList.remove('show');
    });

    // Handle menu item clicks - settings link and logout are handled here
    userMenuDropdown.addEventListener('click', (e) => {
        e.stopPropagation();

        const settingsLink = e.target.closest('a[href="#settings"]');
        if (settingsLink) {
            e.preventDefault();
            showView('settings');
            userMenuDropdown.classList.remove('show');
        }
    });

    // Setup navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.getAttribute('href').substring(1);
            showView(target);
            userMenuDropdown.classList.remove('show');
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

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.password-toggle');
    const iconSpan = button.querySelector('.password-toggle-icon');

    if (input.type === 'password') {
        input.type = 'text';
        iconSpan.innerHTML = icons.eyeOff;
    } else {
        input.type = 'password';
        iconSpan.innerHTML = icons.eye;
    }
}
