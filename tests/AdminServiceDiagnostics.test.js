import { renderAdminServiceDiagnostics } from '../src/ui/AdminServiceDiagnostics.js';
import { jest } from '@jest/globals';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

test('the actual network message router forwards correlated service replies and ignores destroyed sessions', () => {
    class EngineFixture {}
    installGameEngineNetworkMessages(EngineFixture);
    const engine = new EngineFixture();
    engine.player = { id: 'player-operator' };
    const handleResult = jest.fn(); engine.uiManager = { admin: { handleResult } };
    const payload = { id: 'read-request-000001', authorized: true, success: true, service: { health: { status: 'ok' } } };
    engine.handleServerMessage({ type: 'admin_service_result', payload });
    expect(handleResult).toHaveBeenCalledWith('admin_service_result', payload);
    engine.isDestroyed = true;
    engine.handleServerMessage({ type: 'admin_service_result', payload });
    expect(handleResult).toHaveBeenCalledTimes(1);
});

test('an impossible mean cannot appear above its reported maximum', () => {
    const list = document.createElement('ul');
    for (const [totalMicros, maxMicros] of [[2001, 1000], [1, 0]]) {
        renderAdminServiceDiagnostics(list, { health: { operational: {
            casinoEP: { completed: 2, failed: 0, timedSamples: 2, totalMicros, maxMicros }
        } } });
        expect(list.lastElementChild.textContent).toContain('Call timing: Unavailable');
    }
});

test('fixed diagnostic rows distinguish missing values, zero counters and unsafe numeric precision', () => {
    const list = document.createElement('ul');
    expect(renderAdminServiceDiagnostics(list, null)).toBe(false);
    renderAdminServiceDiagnostics(list, { sampledAt: 'invalid', health: { status: 'unavailable', database: 'unavailable',
        heapAllocBytes: 0, heapObjects: Number.MAX_SAFE_INTEGER + 1,
        operational: { casinoGold: { completed: 0, failed: 0 } }, private: '<script>secret()</script>' } });
    const rows = [...list.children];
    expect(rows).toHaveLength(16);
    expect(rows[0].textContent).toContain('Unavailable'); expect(rows[5].textContent).toContain('0.00 MiB');
    expect(rows[6].textContent).toContain('Unavailable'); expect(rows[14].textContent).toContain('Completed calls: 0');
    expect(rows[15].textContent).toContain('Unavailable');
    expect(list.textContent).not.toContain('secret'); expect(list.querySelector('script')).toBeNull();
});

test('untrusted release/clock strings and negative counters are never interpreted as markup or measurements', () => {
    const list = document.createElement('ul');
    renderAdminServiceDiagnostics(list, { sampledAt: '<img src=x>', health: {
        commit: '<img src=x>', version: '<script>secret()</script>', goroutines: -1, database: 'private-error',
        broadcastQueues: { queued: 'private-error', capacity: -1 }
    } });
    expect(list.textContent).not.toContain('private-error'); expect(list.textContent).not.toContain('<img');
    expect(list.querySelector('img, script')).toBeNull();
    expect(list.textContent).toContain('Unknown'); expect(list.textContent).toContain('Unavailable');
});

test('timing shows measured zero and slow calls but never missing or inconsistent samples', () => {
    const list = document.createElement('ul');
    renderAdminServiceDiagnostics(list, { health: { operational: {
        characterJournal: { completed: 2, failed: 1, timedSamples: 2, totalMicros: 6000, maxMicros: 5000 },
        characterCommit: { completed: 1, failed: 0, timedSamples: 1, totalMicros: 0, maxMicros: 0 },
        characterCleanup: { completed: 1, failed: 0, timedSamples: 0, totalMicros: 0, maxMicros: 0 },
        characterRecovery: { completed: 1, failed: 0, timedSamples: 2, totalMicros: 6000, maxMicros: 5000 },
        casinoGold: { completed: 1, failed: 0, timedSamples: 1, totalMicros: 5000, maxMicros: 6000 },
        casinoEP: { completed: 1, failed: 0, timedSamples: 1, totalMicros: Number.MAX_SAFE_INTEGER + 1, maxMicros: 0 }
    } } });
    const rows = [...list.children];
    expect(rows[10].textContent).toContain('Mean call: 3.00 ms · Slowest call: 5.00 ms · Timed samples: 2');
    expect(rows[11].textContent).toContain('Mean call: 0.00 ms');
    for (const row of rows.slice(12)) expect(row.textContent).toContain('Call timing: Unavailable');
});
