// Toast Notification System
class Toast {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Get icon based on type
        let icon = '';
        switch (type) {
            case 'success':
                icon = icons.check;
                break;
            case 'error':
                icon = icons.x;
                break;
            case 'warning':
                icon = icons.info;
                break;
            case 'info':
            default:
                icon = icons.info;
                break;
        }

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                ${icons.x}
            </button>
        `;

        this.container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    // Confirmation dialog (replaces confirm())
    confirm(message, onConfirm, onCancel) {
        const overlay = document.createElement('div');
        overlay.className = 'toast-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'toast-dialog';

        dialog.innerHTML = `
            <div class="toast-dialog-header">
                <span class="toast-dialog-icon">${icons.info}</span>
                <h3 data-i18n="common.confirm">Confirm</h3>
            </div>
            <div class="toast-dialog-body">
                ${message}
            </div>
            <div class="toast-dialog-footer">
                <button class="btn-secondary toast-dialog-cancel" data-i18n="common.cancel">Cancel</button>
                <button class="btn-danger toast-dialog-confirm" data-i18n="common.confirm">Confirm</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Apply translations
        if (window.i18n) {
            i18n.applyTranslations();
        }

        // Trigger animation
        setTimeout(() => {
            overlay.classList.add('show');
            dialog.classList.add('show');
        }, 10);

        const close = () => {
            overlay.classList.remove('show');
            dialog.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        };

        dialog.querySelector('.toast-dialog-cancel').addEventListener('click', () => {
            close();
            if (onCancel) onCancel();
        });

        dialog.querySelector('.toast-dialog-confirm').addEventListener('click', () => {
            close();
            if (onConfirm) onConfirm();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close();
                if (onCancel) onCancel();
            }
        });
    }
}

// Global toast instance
window.toast = new Toast();
