import { jest } from '@jest/globals';
import { AdminUI } from '../src/ui/AdminUI.js';
import { GameEngine } from '../src/core/GameEngine.js';

let ui, send;
const reply = (payload = {}) => ui.handleResult(`${ui.pending.type}_result`, { id: ui.pending.id, authorized: true, success: true, ...payload });
const prepare = (kind = 'maintenance', message = 'Save your progress before the planned update.') => {
    const notice = ui.announcements;
    notice.form.elements.kind.value = kind;
    notice.form.elements.message.value = message;
    notice.form.elements.nextUpdateAt.value = kind === 'recovery' ? '' : '2026-10-06T05:30';
    notice.form.dispatchEvent(new Event('submit', { cancelable: true }));
    return notice;
};

beforeEach(() => {
    jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-06T05:00:00Z'));
    document.body.innerHTML = '<button id="launch"></button><div id="host"></div>';
    send = jest.fn();
    ui = new AdminUI({ host: document.getElementById('host'), launcher: document.getElementById('launch'), send,
        openWindow: () => {}, closeWindow: () => {} });
    ui.connectionState('connected'); reply(); send.mockClear();
});
afterEach(() => { ui.dispose(); jest.useRealTimers(); });

test('review is plain text and sends one frozen explicitly confirmed public notice', () => {
    const notice = prepare('maintenance', '<img src=x> literal public copy');
    expect(send).not.toHaveBeenCalled(); expect(notice.review.hidden).toBe(false);
    expect(notice.copy.textContent).toContain('<img src=x>'); expect(notice.root.querySelector('img')).toBeNull();
    expect(notice.copy.textContent).toContain('2026-10-06T05:30:00.000Z (UTC)');
    notice.confirm.click(); notice.confirm.click();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith('admin_announcement', { id: ui.pending.id, confirmed: true,
        kind: 'maintenance', message: '<img src=x> literal public copy', nextUpdateAt: '2026-10-06T05:30:00.000Z' });
    expect(notice.fields.disabled).toBe(true);
    reply({ message: 'Notice queued; not guaranteed delivery.' });
    expect(notice.status.textContent).toContain('not guaranteed delivery'); expect(notice.fields.disabled).toBe(false);
});

test('editing or canceling a review retires it without sending', () => {
    const notice = prepare(); notice.form.elements.message.value = 'Changed copy';
    notice.form.dispatchEvent(new Event('input', { bubbles: true })); notice.confirm.click();
    expect(send).not.toHaveBeenCalled(); expect(notice.review.hidden).toBe(true);
    prepare(); notice.cancel.click(); notice.confirm.click(); expect(send).not.toHaveBeenCalled();
});

test('invalid time, message controls and UTF8 size never prepare a request', () => {
    for (const message of ['', 'hello\nworld', 'é'.repeat(111)]) {
        const notice = prepare('maintenance', message);
        expect(notice.review.hidden).toBe(true); expect(notice.status.textContent).toContain('plain text');
    }
    const notice = prepare(); notice.form.elements.nextUpdateAt.value = '2026-10-06T05:00'; notice.prepare();
    expect(notice.review.hidden).toBe(true);
    notice.form.elements.nextUpdateAt.value = '2026-10-08T05:00'; notice.prepare(); expect(notice.review.hidden).toBe(true);
    notice.form.elements.nextUpdateAt.value = ''; notice.prepare(); expect(notice.review.hidden).toBe(true);
    expect(send).not.toHaveBeenCalled();
    prepare('recovery'); expect(notice.review.hidden).toBe(false);
});

test('uncertain acknowledgement is not resent and advises checking history', () => {
    const notice = prepare(); notice.confirm.click(); const id = ui.pending.id;
    jest.advanceTimersByTime(10000);
    expect(send).toHaveBeenCalledTimes(1); expect(ui.status.textContent).toContain('activity history');
    expect(notice.status.textContent).toContain('no automatic resend'); expect(notice.review.hidden).toBe(true);
    ui.handleResult('admin_announcement_result', { id, authorized: true, success: true, message: 'late' });
    expect(ui.status.textContent).not.toBe('late');
});

test('audit failure keeps authority but denial and disconnect discard drafts and ignore late replies', () => {
    const notice = prepare(); notice.confirm.click(); reply({ success: false, message: 'Audit unavailable; nothing queued.' });
    expect(ui.authorized).toBe(true); expect(notice.status.textContent).toContain('nothing queued');
    prepare(); notice.confirm.click(); reply({ authorized: false, success: false, message: 'Access revoked.' });
    expect(notice.fields.disabled).toBe(true); expect(notice.copy.textContent).toBe(''); expect(notice.form.elements.message.value).toBe('');
    ui.refreshAccess(); reply(); prepare(); notice.confirm.click(); const id = ui.pending.id;
    ui.connectionState('disconnected'); expect(notice.fields.disabled).toBe(true); expect(notice.copy.textContent).toBe('');
    ui.handleResult('admin_announcement_result', { id, success: true, authorized: true }); expect(ui.authorized).toBe(false);
});

test('announcement acknowledgement routes only to current admin UI; public server chat stays ordinary safe chat', () => {
    const admin = { handleResult: jest.fn() }, addChatMessage = jest.fn(), payload = { id: 'notice-id' };
    GameEngine.prototype.handleServerMessage.call({ uiManager: { admin }, player: { id: 'staff' } }, { type: 'admin_announcement_result', payload });
    expect(admin.handleResult).toHaveBeenCalledWith('admin_announcement_result', payload);
    GameEngine.prototype.handleServerMessage.call({ uiManager: { addChatMessage }, player: { id: 'player' } },
        { type: 'chat', payload: { sender: 'System', channel: 'server', message: '[Recovery] Service restored.' } });
    expect(addChatMessage).toHaveBeenCalledWith('System', '[Recovery] Service restored.', { channel: 'server', senderAccount: 'System' });
});
