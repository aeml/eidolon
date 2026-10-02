import { showSessionRecoveryLogin } from '../src/ui/SessionRecovery.js';

test('failed session restores the login ancestor, hides stale character controls and clears only the password', () => {
    document.body.innerHTML = `<div id="start-screen" class="hidden" style="display:none">
        <div id="login-panel" style="display:none"><input id="auth-username" value="traveler">
        <input id="auth-password" value="private"><div id="auth-status"></div></div>
        <div id="class-selection-container" style="display:flex"></div><div id="play-container"></div>
        </div><div id="loading-screen" style="display:flex"></div>`;
    localStorage.setItem('unrelated-preference', 'keep');
    showSessionRecoveryLogin();
    expect(document.getElementById('start-screen').classList.contains('hidden')).toBe(false);
    for (const id of ['start-screen', 'login-panel']) expect(document.getElementById(id).style.display).toBe('');
    for (const id of ['loading-screen', 'class-selection-container', 'play-container']) {
        expect(document.getElementById(id).style.display).toBe('none');
    }
    expect(document.getElementById('auth-status').textContent).toContain('log in again');
    expect(document.getElementById('auth-password').value).toBe('');
    expect(document.activeElement.id).toBe('auth-username');
    expect(document.activeElement.value).toBe('traveler');
    expect(localStorage.getItem('unrelated-preference')).toBe('keep');
    showSessionRecoveryLogin({ message: 'Name correction required. Open Account help. <script>not markup</script>' });
    expect(document.getElementById('auth-status').textContent).toContain('Name correction required. Open Account help.');
    expect(document.getElementById('auth-status').querySelector('script')).toBeNull();
});
