import { expect, test } from '@playwright/test';
import { collectBrowserFailures, loginAndEnterWorld } from './helpers.js';

// Local routed transport only: authenticate a presentation fixture, then fail
// the actual entry-module GET. No real account, server mutation or game state.
test('failed engine import keeps its module path and network code in the startup assertion', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(60_000);
    await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
        socket.onMessage(data => {
            if (JSON.parse(data).type === 'login') socket.send(JSON.stringify({
                type: 'login_success', payload: { hasCharacter: true, characterType: 'Wizard', terrainProfile: 'flat-v1' }
            }));
        });
    });
    await page.route('**/src/core/GameEngine.js*', route => route.abort('connectionclosed'));
    const failures = collectBrowserFailures(page, baseURL);
    const error = await loginAndEnterWorld(page, {
        username: 'fixture-only', password: 'fixture-only', characterClass: 'Wizard'
    }).catch(error => error);
    expect(error).toBeInstanceOf(Error);
    const diagnostic = JSON.parse(error.message.split('authoritative state: ')[1]);
    expect(diagnostic).toMatchObject({ enginePresent: false, playerReady: false, firstStateReceived: false,
        startupPhase: 'engine-module', startupFailureKind: 'module-download',
        moduleFailures: { observed: 2, dropped: 0, failures: [
            { module: '/src/core/GameEngine.js', kind: 'request', code: 'net::ERR_CONNECTION_CLOSED' },
            { module: '/src/core/GameEngine.js', kind: 'request', code: 'net::ERR_CONNECTION_CLOSED' }
        ] } });
    expect(error.cause).toBeInstanceOf(Error);
    expect(failures.some(detail => detail.includes('GameEngine.js'))).toBe(true);
    await testInfo.attach('startup-module-fault-control', { body: JSON.stringify(diagnostic), contentType: 'application/json' });
});
