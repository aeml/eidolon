import { jest } from '@jest/globals';
import { AdminUI } from '../src/ui/AdminUI.js';

let ui, send, controls;
const catalog = [{ id: 'iron-sword', name: 'Iron Sword', material: false }, { id: 'eidolic-shard', name: 'Eidolic Shard', material: true }];
function reply(result = {}) {
    ui.handleResult(`${ui.pending.type}_result`, { id: ui.pending.id, success: true, authorized: true, ...result });
}
function prepare(kind = 'gold', target = 'recipient') {
    controls.input.target.value = target;
    controls.input.reason.value = 'Restore verified lost reward';
    controls.input.operation.value = kind;
    controls.input.operation.dispatchEvent(new Event('change'));
    controls.form.dispatchEvent(new Event('submit', { cancelable: true }));
}
beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<button id="launcher" hidden>Administration</button><div id="host"></div>';
    send = jest.fn();
    ui = new AdminUI({ host: document.getElementById('host'), launcher: document.getElementById('launcher'), send,
        openWindow: root => { root.style.display = 'flex'; }, closeWindow: root => { root.style.display = 'none'; } });
    controls = ui.operations;
    ui.connectionState('connected');
    reply({ account: 'operator', items: catalog });
});
afterEach(() => { ui.dispose(); jest.useRealTimers(); });

test('Gold requires a frozen explicit review and confirmation, and a double click sends once', () => {
    send.mockClear();
    prepare();
    expect(send).not.toHaveBeenCalled();
    expect(controls.fields.disabled).toBe(true);
    expect(controls.summary.textContent).toContain('100 Gold to recipient');
    expect(document.activeElement).toBe(controls.confirm);
    controls.confirm.click(); controls.confirm.click();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('admin_grant_gold', expect.objectContaining({ target: 'recipient', amount: 100, confirmed: true, reason: 'Restore verified lost reward' }));
    expect(controls.retry.disabled).toBe(true);
    reply({ final: true, message: 'Granted 100 Gold.' });
    expect(controls.operation).toBeNull();
    expect(controls.result.textContent).toContain('Granted 100 Gold.');
    expect(controls.fields.disabled).toBe(false);
});

test('cancel makes no mutation, and missing reason or invalid amounts cannot be reviewed', () => {
    send.mockClear();
    prepare(); controls.cancel.click();
    expect(controls.preview).toBeNull();
    expect(controls.fields.disabled).toBe(false);
    controls.input.reason.value = '';
    controls.prepare();
    expect(controls.preview).toBeNull();
    controls.input.reason.value = 'reason';
    for (const amount of ['0', '-1', '1.5', '100000001', '']) {
        controls.input.amount.value = amount; controls.prepare();
        expect(controls.preview).toBeNull();
    }
    expect(send).not.toHaveBeenCalled();
});

test('timeout and reconnect preserve the identical request ID and payload', () => {
    prepare(); controls.confirm.click();
    const [type, payload] = send.mock.calls.at(-1);
    jest.advanceTimersByTime(10000);
    expect(controls.operation.id).toBe(payload.id);
    expect(controls.root.hidden).toBe(true);
    ui.connectionState('reconnecting'); ui.connectionState('connected');
    reply({ account: 'operator', items: catalog });
    controls.retry.click();
    expect(send).toHaveBeenLastCalledWith(type, payload);
    reply({ success: false, pending: true, final: false, message: 'Awaiting recovery.' });
    expect(controls.fields.disabled).toBe(true);
    expect(controls.retry.disabled).toBe(false);
    controls.retry.click();
    expect(send).toHaveBeenLastCalledWith(type, payload);
    reply({ final: true, message: 'Granted 100 Gold.' });
    expect(controls.operation).toBeNull();
});

test('role revocation hides controls, while a different account cannot replay a departed request', () => {
    prepare(); controls.confirm.click();
    reply({ success: false, authorized: false, message: 'Access revoked.' });
    expect(controls.root.hidden).toBe(true);
    expect(controls.fields.disabled).toBe(true);
    expect(controls.operation).not.toBeNull();
    ui.connectionState('reconnecting'); ui.connectionState('connected');
    reply({ account: 'another-admin', items: catalog });
    expect(controls.operation).toBeNull();
    expect(controls.input.target.value).toBe('another-admin');
    expect(controls.retry.hidden).toBe(true);
});

test('server denial is final without hiding a still-authorized panel', () => {
    prepare(); controls.confirm.click();
    reply({ success: false, authorized: true, final: true, message: 'Inventory full.' });
    expect(ui.authorized).toBe(true);
    expect(controls.operation).toBeNull();
    expect(controls.fields.disabled).toBe(false);
});

test('canonical material selection sends no invented stats and uses its own limits', () => {
    controls.input.operation.value = 'item'; controls.updateFields();
    controls.input.item.value = 'eidolic-shard'; controls.updateFields();
    expect(controls.input.rarity.value).toBe('Eidolic');
    expect(controls.input.level.max).toBe('1');
    expect(controls.input.quantity.max).toBe('1000');
    controls.input.quantity.value = '250';
    prepare('item'); controls.confirm.click();
    expect(send).toHaveBeenLastCalledWith('admin_grant_item', {
        id: controls.operation.id, target: 'recipient', reason: 'Restore verified lost reward', confirmed: true,
        item: 'eidolic-shard', rarity: 'Eidolic', level: 1, quantity: 250
    });
});

test.each([
    ['to-player', { target: 'operator', destination: 'player', destinationPlayer: 'recipient' }],
    ['bring-player', { target: 'recipient', destination: 'player', destinationPlayer: 'operator' }],
    ['town', { target: 'recipient', destination: 'town' }]
])('teleport %s derives its endpoints from the server account and selected player', (kind, endpoints) => {
    prepare(kind); controls.confirm.click();
    expect(send).toHaveBeenLastCalledWith('admin_teleport', { ...endpoints, id: controls.operation.id,
        reason: 'Restore verified lost reward', confirmed: true });
});

test('online player selection fills the exact account, and review renders names and reasons as text', () => {
    ui.launcher.click();
    reply({ players: [{ account: '<img src=x onerror=bad()>', name: 'Hero', class: 'Wizard', level: 70 }] });
    ui.list.querySelector('button').click();
    expect(controls.input.target.value).toBe('<img src=x onerror=bad()>');
    expect(controls.root.open).toBe(true);
    controls.input.reason.value = '<script>bad()</script>';
    controls.prepare();
    expect(controls.summary.textContent).toContain('<script>');
    expect(controls.root.querySelector('img, script')).toBeNull();
});
