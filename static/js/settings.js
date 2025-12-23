// Settings page logic
let currentUser = null;

// Load user settings when settings view is shown
async function loadSettings() {
    try {
        currentUser = await api.getCurrentUser();
        updateCurrentUserDisplay();
        // Pre-fill display name field if it exists
        document.getElementById('new-display-name').value = currentUser.display_name || '';
    } catch (error) {
        console.error('Failed to load user settings:', error);
        toast.error(i18n.t('settings.loadError') + ': ' + error.message);
    }
}

// Update current user display
function updateCurrentUserDisplay() {
    if (!currentUser) return;

    document.getElementById('current-display-name').textContent = currentUser.display_name || '(using username)';
    document.getElementById('current-username').textContent = currentUser.username;
    document.getElementById('current-user-id').textContent = currentUser.id;
}

// Handle display name form submission
document.getElementById('display-name-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const displayNameInput = document.getElementById('new-display-name');
    const displayName = displayNameInput.value.trim() || null;

    try {
        const updatedUser = await api.updateDisplayName(displayName);
        currentUser = updatedUser;
        updateCurrentUserDisplay();
        toast.success(i18n.t('settings.displayNameSuccess'));
        displayNameInput.value = displayName || '';
    } catch (error) {
        console.error('Failed to update display name:', error);
        toast.error(i18n.t('settings.displayNameError') + ': ' + error.message);
    }
});

// Handle username form submission
document.getElementById('username-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('new-username');
    const newUsername = usernameInput.value.trim();

    if (!newUsername) {
        toast.error(i18n.t('settings.usernameEmpty'));
        return;
    }

    if (newUsername.length < 3) {
        toast.error(i18n.t('settings.usernameLength'));
        return;
    }

    toast.confirm(i18n.t('settings.usernameConfirm').replace('{username}', newUsername), async () => {
        try {
            const updatedUser = await api.updateUsername(newUsername);
            currentUser = updatedUser;
            updateCurrentUserDisplay();
            toast.success(i18n.t('settings.usernameSuccess'));
            usernameInput.value = '';
        } catch (error) {
            console.error('Failed to update username:', error);
            toast.error(i18n.t('settings.usernameError') + ': ' + error.message);
        }
    });
});

// Handle password form submission
document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error(i18n.t('settings.passwordRequired'));
        return;
    }

    if (newPassword.length < 6) {
        toast.error(i18n.t('settings.passwordLength'));
        return;
    }

    if (newPassword !== confirmPassword) {
        toast.error(i18n.t('settings.passwordMismatch'));
        return;
    }

    try {
        await api.updatePassword(currentPassword, newPassword);
        toast.success(i18n.t('settings.passwordSuccess'));
        // Clear form
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
    } catch (error) {
        console.error('Failed to update password:', error);
        toast.error(i18n.t('settings.passwordError') + ': ' + error.message);
    }
});

// Export loadSettings for use in app.js
window.loadSettings = loadSettings;
