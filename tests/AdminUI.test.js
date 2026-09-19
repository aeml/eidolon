import { jest } from '@jest/globals';
import { AdminUI } from '../src/ui/AdminUI.js';

let ui, send;
function reply(payload = {}, type) {
    ui.handleResult(type || `${ui.pending.type}_result`, {
        id: ui.pending.id, success: true, authorized: true, ...payload
    });
}

beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<button id="launch" hidden>Administration</button><div id="host"></div>';
    send = jest.fn();
    ui = new AdminUI({ host: document.getElementById('host'), launcher: document.getElementById('launch'), send,
        openWindow: element => { element.style.display = 'flex'; },
        closeWindow: element => { element.style.display = 'none'; } });
});
afterEach(() => { ui.dispose(); jest.useRealTimers(); });

test('launcher stays hidden until an authenticated server response verifies the role', () => {
    expect(ui.launcher.hidden).toBe(true);
    ui.launcher.click();
    expect(send).not.toHaveBeenCalled();
    ui.connectionState('connected');
    expect(send).toHaveBeenCalledWith('admin_status', { id: ui.pending.id });
    reply({ authorized: false });
    expect(ui.launcher.hidden).toBe(true);
    ui.refreshAccess();
    reply();
    expect(ui.launcher.hidden).toBe(false);
    expect(ui.role.textContent).toContain('verified by server');
});

test('online list loads, paginates, refreshes and renders untrusted names only as text', () => {
    ui.connectionState('connected'); reply(); ui.launcher.click();
    expect(ui.root.style.display).toBe('flex');
    expect(ui.refresh.disabled).toBe(true);
    expect(ui.status.textContent).toContain('Loading');
    expect(ui.root.getAttribute('aria-busy')).toBe('true');
    reply({ players: [{ name: '<img src=x onerror=alert(1)>', account: 'hero', class: 'Fighter', level: 70 }], next: 'hero' });
    expect(ui.root.querySelector('img')).toBeNull();
    expect(ui.list.textContent).toContain('<img');
    expect(ui.refresh.disabled).toBe(false);
    expect(ui.next.hidden).toBe(false);
    ui.next.click();
    expect(send).toHaveBeenLastCalledWith('admin_players', { id: ui.pending.id, after: 'hero' });
    expect(ui.list.children).toHaveLength(0);
    reply({ players: [] });
    expect(ui.status.textContent).toContain('No authenticated players');
    expect(ui.next.hidden).toBe(true);
    ui.refresh.click();
    expect(send).toHaveBeenLastCalledWith('admin_players', { id: ui.pending.id, after: '' });
});

test('role removal or lookup failure clears visible data and disables further queries', () => {
    ui.connectionState('connected'); reply(); ui.launcher.click();
    reply({ players: [{ account: 'hero', name: 'Hero', class: 'Wizard', level: 20 }] });
    ui.refresh.click();
    reply({ success: false, authorized: false, message: 'Administration is unavailable. Try refreshing.' });
    expect(ui.launcher.hidden).toBe(true);
    expect(ui.refresh.disabled).toBe(true);
    expect(ui.list.children).toHaveLength(0);
    expect(ui.status.textContent).toContain('unavailable');
});

test('disconnect hides access and ignores delayed responses from the old session', () => {
    ui.connectionState('connected');
    const staleID = ui.pending.id;
    ui.connectionState('reconnecting');
    ui.handleResult('admin_status_result', { id: staleID, success: true, authorized: true });
    expect(ui.launcher.hidden).toBe(true);
    expect(ui.root.style.display).toBe('none');
    ui.connectionState('connected');
    ui.handleResult('admin_status_result', { id: staleID, success: true, authorized: true });
    expect(ui.launcher.hidden).toBe(true);
    reply();
    expect(ui.launcher.hidden).toBe(false);
});

test('missing responses time out closed, and the next menu access can retry', () => {
    ui.connectionState('connected');
    jest.advanceTimersByTime(10000);
    expect(ui.pending).toBeNull();
    expect(ui.launcher.hidden).toBe(true);
    expect(ui.status.textContent).toContain('did not respond');
    ui.refreshAccess(); reply();
    expect(ui.launcher.hidden).toBe(false);
});

test('a mismatched response type cannot enable administration', () => {
    ui.connectionState('connected');
    reply({}, 'admin_players_result');
    expect(ui.launcher.hidden).toBe(true);
    expect(ui.pending).not.toBeNull();
});

test('history uses bounded filters and drops its previous cursor when filters change', () => {
    ui.connectionState('connected'); reply(); ui.launcher.click(); reply({ players: [] });
    ui.root.querySelector('[data-view="history"]').click();
    expect(send).toHaveBeenLastCalledWith('admin_history', { id: ui.pending.id, before: '', actor: '', action: '' });
    reply({ history: { entries: [{ actor: 'operator', action: 'admin_players', result: 'success',
        at: '2026-09-19T12:00:00Z', summary: '<script>private()</script>' }], next: 'cursor-one', retentionDays: 90 } });
    expect(ui.list.textContent).toContain('admin_players · success');
    expect(ui.list.querySelector('script')).toBeNull();
    expect(ui.note.textContent).toContain('90 days');
    ui.next.click();
    expect(send).toHaveBeenLastCalledWith('admin_history', { id: ui.pending.id, before: 'cursor-one', actor: '', action: '' });
    reply({ history: { entries: [], next: 'cursor-two', retentionDays: 90 } });
    ui.actor.value = 'someone-else'; ui.actor.dispatchEvent(new Event('input'));
    expect(ui.next.hidden).toBe(true);
    expect(ui.cursor).toBe('');
    ui.refresh.click();
    expect(send).toHaveBeenLastCalledWith('admin_history', { id: ui.pending.id, before: '', actor: 'someone-else', action: '' });
});

test('dispose removes its launcher listener and pending timeout', () => {
    ui.connectionState('connected'); reply();
    const launcher = ui.launcher;
    ui.dispose();
    send.mockClear();
    launcher.click();
    jest.runOnlyPendingTimers();
    expect(send).not.toHaveBeenCalled();
    expect(document.getElementById('administration-screen')).toBeNull();
});
