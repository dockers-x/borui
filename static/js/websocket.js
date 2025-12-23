// WebSocket client
class WSClient {
    constructor() {
        this.ws = null;
        this.reconnectInterval = 5000;
        this.reconnectTimer = null;
        this.listeners = new Map();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL = `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsURL);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateStatus(true);
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (e) {
                console.error('Failed to parse WebSocket message', e);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateStatus(false);
            this.reconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error', error);
        };
    }

    reconnect() {
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
                console.log('Attempting to reconnect WebSocket...');
                this.connect();
            }, this.reconnectInterval);
        }
    }

    handleMessage(message) {
        const { type, data } = message;

        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(callback => callback(data));
        }
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }

    updateStatus(connected) {
        const indicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('#connection-status span:last-child');

        if (indicator) {
            indicator.className = connected ? 'status-indicator connected' : 'status-indicator disconnected';
        }

        if (statusText) {
            statusText.textContent = connected ?
                window.i18n.t('status.connected') :
                window.i18n.t('status.disconnected');
        }
    }
}

// Global WebSocket instance
window.wsClient = new WSClient();
