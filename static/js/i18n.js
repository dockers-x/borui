// Simple i18n implementation
class I18n {
    constructor() {
        this.locale = localStorage.getItem('locale') || 'en';
        this.translations = {};
        this.fallback = {
            'nav.servers': 'Servers',
            'nav.clients': 'Clients',
            'nav.system': 'System',
            'servers.title': 'Bore Servers',
            'servers.create': 'Create Server',
            'clients.title': 'Bore Clients',
            'clients.create': 'Create Client',
            'system.title': 'System Information',
            'common.loading': 'Loading...',
            'status.connected': 'Connected',
            'status.disconnected': 'Disconnected',
            'status.running': 'Running',
            'status.stopped': 'Stopped',
            'status.error': 'Error',
        };
    }

    async loadLocale(locale) {
        try {
            const response = await fetch(`/locales/${locale}.json`);
            if (response.ok) {
                this.translations = await response.json();
            } else {
                this.translations = this.fallback;
            }
        } catch (e) {
            console.warn('Failed to load locale, using fallback', e);
            this.translations = this.fallback;
        }

        this.locale = locale;
        localStorage.setItem('locale', locale);
        this.updateUI();
    }

    t(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.translations) ||
               key.split('.').reduce((obj, k) => obj?.[k], this.fallback) ||
               key;
    }

    updateUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });
    }
}

// Global i18n instance
window.i18n = new I18n();
