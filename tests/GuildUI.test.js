import { jest } from '@jest/globals';
import { GuildUI } from '../src/ui/GuildUI.js';
import { SocialPresenceController } from '../src/core/SocialPresenceController.js';

function createUI(player = { name: 'Alice', inventory: [{ id: 'blade', name: 'Blade', stack: 1 }] }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const ui = new GuildUI({ container, getLastPlayer: () => player, addChatMessage: jest.fn() });
    return { ui, container };
}

describe('GuildUI', () => {
    beforeEach(() => { sessionStorage.clear(); document.body.replaceChildren(); });
    test('creates a guild from validated form inputs', () => {
        const { ui, container } = createUI();
        ui.onCreate = jest.fn();
        container.querySelector('[data-guild-name]').value = 'Night Watch';
        container.querySelector('[data-guild-tag]').value = 'NW';
        container.querySelector('[data-guild-create]').click();
        expect(ui.onCreate).toHaveBeenCalledWith('Night Watch', 'NW');
    });

    test('renders and accepts pending invitations', () => {
        const { ui, container } = createUI();
        ui.onRespond = jest.fn();
        ui.update({ guild: null, invites: [{ guildId: 'g1', guildName: 'Wardens', guildTag: 'WARD' }] });
        expect(container.textContent).toContain('[WARD] Wardens');
        Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Accept').click();
        expect(ui.onRespond).toHaveBeenCalledWith('g1', true);
    });

    test('renders roster permissions and bank actions', () => {
        const { ui, container } = createUI();
        ui.onSetRank = jest.fn();
        ui.onBankDeposit = jest.fn();
        ui.onBankWithdraw = jest.fn();
        ui.update({ guild: {
            id: 'g1', name: 'Wardens', tag: 'WARD', leaderId: 'player-Alice',
            permissions: { invite: true, kick: true, set_rank: true, withdraw_bank: true },
            members: [
                { playerId: 'player-Alice', username: 'Alice', rank: 'leader', online: true, class: 'Fighter', level: 60 },
                { playerId: 'player-Bob', username: 'Bob', rank: 'member', online: false },
            ],
            bank: { gold: 500, items: [{ id: 'stored', name: 'Stored Wand', stack: 1 }] },
            audit: [],
        }});
        expect(container.textContent).toContain('[WARD] Wardens');
        expect(container.textContent).toContain('Bob');
        const management = container.querySelector('.guild-member-actions');
        expect(management.open).toBe(false);
        expect(management.querySelector('summary').getAttribute('aria-label')).toBe('Manage Bob');
        expect(container.querySelectorAll('.guild-member-actions')).toHaveLength(1);
        management.open = true;
        Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Promote').click();
        expect(ui.onSetRank).not.toHaveBeenCalled();
        container.querySelector('.guild-confirmation button').click();
        expect(ui.onSetRank).toHaveBeenCalledWith('player-Bob', 'officer');
        Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Deposit Item').click();
        expect(ui.onBankDeposit).toHaveBeenCalledWith({ itemId: 'blade', requestId: expect.stringMatching(/^[A-Za-z0-9_-]{16,64}$/) });
        ui.handleBankResult({ requestId: ui.onBankDeposit.mock.calls[0][0].requestId, status: 'complete', message: 'Complete.' });
        const withdrawButtons = Array.from(container.querySelectorAll('button')).filter(button => button.textContent === 'Withdraw');
        withdrawButtons.at(-1).click();
        expect(ui.onBankWithdraw).toHaveBeenCalledWith({ itemId: 'stored', requestId: expect.stringMatching(/^[A-Za-z0-9_-]{16,64}$/) });
    });

    test('uses text nodes for server-provided identity fields', () => {
        const { ui, container } = createUI();
        ui.update({ guild: {
            id: 'g1', name: '<img src=x onerror=alert(1)>', tag: 'SAFE', leaderId: 'p1',
            permissions: {}, members: [], bank: { gold: 0, items: [] },
        }});
        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    });

    test('requests and renders seasonal dungeon records', () => {
        const { ui, container } = createUI();
        ui.onLeaderboard = jest.fn();
        ui.update({ guild: {
            id: 'g1', name: 'Wardens', tag: 'WARD', leaderId: 'p1', permissions: {}, members: [], bank: { gold: 0, items: [] },
        }});
        Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Refresh').click();
        expect(ui.onLeaderboard).toHaveBeenCalledWith({ dungeonType: 'umbral_nexus', difficulty: 'mythic', runLevel: 100 });
        ui.updateLeaderboard({ season: '2026-Q3', runs: [{ guildTag: 'WARD', guildName: 'Wardens', durationMs: 125000, memberCount: 5 }] });
        expect(container.textContent).toContain('2026-Q3');
        expect(container.textContent).toContain('[WARD] Wardens · 2:05 · 5 members');
    });

    test('uncertain requests retain their exact nonce and payload across state updates and page reload', () => {
        const { ui, container } = createUI();
        const guild = { id: 'g1', name: 'Wardens', tag: 'WARD', permissions: { withdraw_bank: true }, members: [], bank: { gold: 500, items: [] } };
        ui.onBankDeposit = jest.fn();
        ui.update({ guild });
        container.querySelector('[data-guild-gold]').value = '125';
        [...container.querySelectorAll('button')].find(button => button.textContent === 'Deposit').click();
        const original = { ...ui.onBankDeposit.mock.calls[0][0] };
        expect(original.gold).toBe(125);
        expect(container.querySelector('[data-guild-gold]').disabled).toBe(true);
        ui.update({ guild: { ...guild, bank: { gold: 625, items: [] } } });
        ui.handleBankResult({ requestId: 'someone-elses-request', status: 'complete' });
        ui.handleBankResult({ requestId: original.requestId, status: 'pending', message: 'Recovery pending.' });
        [...container.querySelectorAll('button')].find(button => button.textContent === 'Retry Transfer').click();
        expect(ui.onBankDeposit.mock.calls).toEqual([[original], [original]]);
        // A callback cannot mutate the retained request into a second transfer.
        ui.onBankDeposit.mock.calls[1][0].gold = 999;
        const reloaded = createUI();
        reloaded.ui.onBankDeposit = jest.fn();
        reloaded.ui.update({ guild });
        [...reloaded.container.querySelectorAll('button')].find(button => button.textContent === 'Retry Transfer').click();
        expect(reloaded.ui.onBankDeposit).toHaveBeenCalledWith(original);
        expect(reloaded.container.querySelector('[data-guild-gold]').disabled).toBe(true);
        reloaded.ui.handleBankResult({ requestId: original.requestId, status: 'complete', message: 'Transfer complete.' });
        expect(reloaded.container.querySelector('[data-guild-gold]').disabled).toBe(false);
        expect(reloaded.container.textContent).toContain('Transfer complete.');
        expect(sessionStorage.getItem('eidolon.guild-bank.pending.Alice')).toBeNull();
    });

    test('pending transfer restoration is account scoped and rejects malformed stored data', () => {
        const alice = createUI();
        alice.ui.beginBankRequest('deposit', { itemId: 'blade' });
        const bob = createUI({ name: 'Bob', inventory: [] });
        expect(bob.ui.pendingBank).toBeNull();
        expect(bob.container.textContent).not.toContain('Retry Transfer');
        sessionStorage.setItem('eidolon.guild-bank.pending.Carol', JSON.stringify({ action: 'deposit', payload: { requestId: 'notvalid', gold: 1 } }));
        expect(createUI({ name: 'Carol' }).ui.pendingBank).toBeNull();
    });

    test('only matching terminal decisions enable a new request and amounts must be positive integers', () => {
        const { ui } = createUI();
        ui.onBankDeposit = jest.fn();
        for (const gold of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) ui.beginBankRequest('deposit', { gold });
        expect(ui.onBankDeposit).not.toHaveBeenCalled();
        ui.beginBankRequest('deposit', { gold: 10 });
        const first = ui.onBankDeposit.mock.calls[0][0].requestId;
        ui.beginBankRequest('deposit', { gold: 20 });
        expect(ui.onBankDeposit).toHaveBeenCalledTimes(1);
        ui.handleBankResult({ requestId: first, status: 'rejected', message: 'Not applied.' });
        ui.beginBankRequest('deposit', { gold: 20 });
        expect(ui.onBankDeposit).toHaveBeenCalledTimes(2);
        expect(ui.onBankDeposit.mock.calls[1][0].requestId).not.toBe(first);
    });

    test('network routing consumes correlated bank results without changing unrelated menus', () => {
        const handleBankResult = jest.fn();
        const controller = new SocialPresenceController({ network: {}, uiManager: { social: { guild: { handleBankResult } } }, remotePlayers: new Map() });
        const payload = { requestId: 'request-123456789', status: 'pending' };
        expect(controller.handleMessage({ type: 'guild_bank_result', payload })).toBe(true);
        expect(handleBankResult).toHaveBeenCalledWith(payload);
    });

    test('officer audit identifies actor, target, rank decision and exact transfer without HTML injection', () => {
        const { ui, container } = createUI();
        ui.update({ guild: { id: 'g1', name: 'Wardens', tag: 'WARD', permissions: {}, members: [
            { playerId: 'player-Alice', username: 'Alice', rank: 'leader' },
            { playerId: 'player-Bob', username: '<b>Bob</b>', rank: 'officer' }], bank: { gold: 0, items: [] }, audit: [
            { action: 'rank_changed', actorId: 'player-Alice', targetId: 'player-Bob', previousRank: 'member', rank: 'officer', at: '2026-09-30T12:00:00Z' },
            { action: 'bank_gold_deposit', actorId: 'player-former-member', amount: 125 },
        ] } });
        const audit = container.querySelector('.guild-audit-row').parentElement;
        expect(audit.textContent).toContain('Alice · rank changed · <b>Bob</b> · member → officer');
        expect(audit.textContent).toContain('former-member · bank gold deposit · 125 Gold');
        expect(audit.querySelector('b')).toBeNull();
    });

    test('destructive changes describe consequences and require fresh confirmation', () => {
        const { ui, container } = createUI();
        const guild = { id: 'g1', name: 'Wardens', tag: 'WARD', permissions: { disband: true, claim_leadership: true, set_rank: true, kick: true },
            members: [{ playerId: 'player-Alice', username: 'Alice', rank: 'leader' }, { playerId: 'player-Bob', username: 'Bob', rank: 'officer' }], bank: { gold: 123, items: [] } };
        for (const [buttonName, callback, confirmLabel] of [['Leave Guild', 'onLeave', 'Leave Guild'], ['Disband Guild', 'onDisband', 'Disband Guild'],
            ['Claim Inactive Leadership', 'onClaimLeadership', 'Claim Inactive Leadership'], ['Demote', 'onSetRank', 'Change Rank'],
            ['Transfer', 'onTransfer', 'Transfer Leadership'], ['Kick', 'onKick', 'Kick Member']]) {
            ui[callback] = jest.fn();
            ui.update({ guild });
            [...container.querySelectorAll('button')].find(button => button.textContent === buttonName).click();
            expect(ui[callback]).not.toHaveBeenCalled();
            const panel = container.querySelector('[role="alertdialog"]');
            expect(panel.getAttribute('aria-label')).toBe(confirmLabel);
            expect(panel.textContent).toMatch(/Wardens|Bob/);
            [...panel.querySelectorAll('button')].find(button => button.textContent === 'Cancel').click();
            expect(ui[callback]).not.toHaveBeenCalled();
            [...container.querySelectorAll('button')].find(button => button.textContent === buttonName).click();
            container.querySelector('[role="alertdialog"] button').click();
            expect(ui[callback]).toHaveBeenCalledTimes(1);
        }
        ui.onDisband.mockClear();
        [...container.querySelectorAll('button')].find(button => button.textContent === 'Disband Guild').click();
        const staleConfirm = container.querySelector('[role="alertdialog"] button');
        ui.update({ guild: { ...guild, permissions: {} } });
        staleConfirm.click();
        expect(ui.onDisband).not.toHaveBeenCalled();
    });
});
