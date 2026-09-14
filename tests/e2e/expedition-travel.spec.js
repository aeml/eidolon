import { expect, test } from '@playwright/test';
import { findExpeditionTarget } from './earned-expedition-target.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    moveByGroundClick, projectEntity, readPlayerState, returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

// Short real-input regression, not earned quest/raid acceptance. Reuse the
// disposable-service wrapper; do not grant levels, move actors or kill targets.
test('ordinary town returns reach visible Imps without exhausting partial strides', async ({ page, baseURL }) => {
    test.skip(process.env.EIDOLON_ISOLATED_QA_ROUTE !== 'expedition-travel', 'Explicit isolated travel check only');
    test.setTimeout(180_000);
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    expect(process.env.EIDOLON_E2E_WS_URL).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentialsFromEnvironment());
    for (let trip = 1; trip <= 2; trip++) {
        for (let step = 0; step < 20 && (await readPlayerState(page)).x < 120; step++) {
            const state = await readPlayerState(page);
            await moveByGroundClick(page, 12, Math.max(-4, Math.min(4, 200 - state.z)), {
                moveOnly: true, minimumDistance: 8, timeout: 2500
            });
        }
        const start = await readPlayerState(page);
        expect(start.x).toBeGreaterThanOrEqual(120);
        const started = Date.now();
        const target = await findExpeditionTarget(page, {
            huntingRealm: 'earth', enemy: 'Imp', minEnemyLevel: 20
        }, started + 60_000);
        expect(target.level).toBeGreaterThanOrEqual(20);
        expect((await projectEntity(page, target.id))?.visible).toBe(true);
        const arrived = await readPlayerState(page);
        expect(arrived.state).not.toBe('DEAD');
        console.log('[expedition-travel]', JSON.stringify({ trip, seconds: (Date.now() - started) / 1000,
            from: { x: start.x, z: start.z }, to: { x: arrived.x, z: arrived.z }, targetLevel: target.level }));
        await returnToTown(page, { allowRespawn: false });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
