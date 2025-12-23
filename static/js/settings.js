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
        alert('Failed to load user settings: ' + error.message);
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
        alert('Display name updated successfully!');
        displayNameInput.value = displayName || '';
    } catch (error) {
        console.error('Failed to update display name:', error);
        alert('Failed to update display name: ' + error.message);
    }
});

// Handle username form submission
document.getElementById('username-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('new-username');
    const newUsername = usernameInput.value.trim();

    if (!newUsername) {
        alert('Username cannot be empty');
        return;
    }

    if (newUsername.length < 3) {
        alert('Username must be at least 3 characters');
        return;
    }

    if (!confirm(`Are you sure you want to change your username to "${newUsername}"?`)) {
        return;
    }

    try {
        const updatedUser = await api.updateUsername(newUsername);
        currentUser = updatedUser;
        updateCurrentUserDisplay();
        alert('Username updated successfully!');
        usernameInput.value = '';
    } catch (error) {
        console.error('Failed to update username:', error);
        alert('Failed to update username: ' + error.message);
    }
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
        alert('All password fields are required');
        return;
    }

    if (newPassword.length < 6) {
        alert('New password must be at least 6 characters');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    try {
        await api.updatePassword(currentPassword, newPassword);
        alert('Password updated successfully!');
        // Clear form
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
    } catch (error) {
        console.error('Failed to update password:', error);
        alert('Failed to update password: ' + error.message);
    }
});

// Export loadSettings for use in app.js
window.loadSettings = loadSettings;
