// Restore the real login view, not merely a panel inside its hidden parent.
// Character state remains server-owned; this only retires the failed session UI.
export function showSessionRecoveryLogin({ message } = {}) {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close?.());
    const start = document.getElementById('start-screen');
    start?.classList.remove('hidden');
    if (start) start.style.display = '';
    for (const id of ['loading-screen', 'class-selection-container', 'play-container']) {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    }
    const login = document.getElementById('login-panel');
    if (login) login.style.display = '';
    const status = document.getElementById('auth-status');
    if (status) {
        status.textContent = message || 'Connection could not be restored. Please log in again to continue your saved character.';
        status.style.color = '#ff7777';
        status.setAttribute('role', 'status');
    }
    const password = document.getElementById('auth-password');
    if (password) password.value = '';
    document.getElementById('auth-username')?.focus({ preventScroll: true });
}
