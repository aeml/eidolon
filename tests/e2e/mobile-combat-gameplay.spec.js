import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    projectNearestHostile, projectEntity, useEncounterQAWaypoint } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent,
    actionTimeout: 12_000, trace: 'off', screenshot: 'off', video: 'off' });

async function approachEncounter(page) {
    if (await page.locator('#chat-mobile-toggle').getAttribute('aria-expanded') !== 'true') {
        await page.locator('#chat-mobile-toggle').tap();
    }
    await page.locator('#chat-input').tap();
    await useEncounterQAWaypoint(page);
    await page.locator('#chat-mobile-toggle').tap();
}

async function selectLiveTarget(page) {
    let target;
    await expect.poll(async () => { target = await projectNearestHostile(page); return Boolean(target); }).toBe(true);
    // A live crowd can overlap the chosen enemy. Repeated real taps cycle that
    // hit stack; keep acquisition bounded instead of assigning a target in JS.
    for (let attempt = 0; attempt < 24; attempt++) {
        const projection = await projectEntity(page, target.id);
        if (!projection?.visible) continue;
        await page.touchscreen.tap(projection.x, projection.y);
        if (await page.evaluate(id => window.game.getMobileCombatTarget()?.id === id, target.id)) return target;
    }
    console.log('[phone-combat] acquisition diagnostic', JSON.stringify(await page.evaluate(async id => {
        const THREE = await import('three');
        const game = window.game;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(game.inputManager.mouse, game.renderSystem.camera);
        const actors = game.activeEntitiesCache.filter(e => e.mesh && e.isActive && e !== game.player);
        return { wanted: id, selected: game.getMobileCombatTarget()?.id, mouse: game.inputManager.mouse.toArray(),
            candidates: actors.filter(e => e.id === id || e.id === game.getMobileCombatTarget()?.id).map(e => ({
                id: e.id, position: e.position.toArray(), meshPosition: e.mesh.position.toArray(),
                hitboxId: game.getRaycastMeshForEntity(e)?.userData?.entityId
            })),
            hits: ray.intersectObjects(actors.map(e => game.getRaycastMeshForEntity(e)), true).slice(0, 5).map(hit => ({
                distance: hit.distance, id: hit.object.userData?.entityId, name: hit.object.name,
                parentId: hit.object.parent?.userData?.entityId
            })) };
    }, target.id)));
    expect(await page.evaluate(() => window.game.getMobileCombatTarget()?.id), 'A visible enemy must be acquired by bounded real taps').toBe(target.id);
    return target;
}

async function runPhoneCombat({ page, baseURL }) {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated disposable QA account');
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.isMobile)).toBe(true);
    // Setup only: the allowlisted waypoint approaches a normal live enemy. It
    // grants no kill/quest completion and does not replace targeting or damage.
    await approachEncounter(page);
    await page.evaluate(() => {
        const game = window.game;
        window.__phoneCombatCommands = [];
        const send = game.network.send.bind(game.network);
        game.network.send = (type, payload) => {
            if (type === 'attack' || type === 'ability') window.__phoneCombatCommands.push({ type, targetId: payload.targetId });
            return send(type, payload);
        };
    });
    // Reproject in a bounded retry if authoritative movement changes the hitbox
    // before touch release. Every acquisition still uses an actual browser tap.
    let target = await selectLiveTarget(page);
    await expect.poll(() => page.evaluate(() => window.game.getMobileCombatTarget()?.id)).toBe(target.id);
    expect(await page.evaluate(() => window.__phoneCombatCommands)).toEqual([]);
    expect(await page.evaluate(() => window.game.pendingInteraction)).toBeNull();
    await expect(page.locator('#combat-intent-panel')).toBeVisible();
    expect(await page.evaluate(() => window.game.combatTargetHighlight?.visible)).toBe(true);
    const hpBefore = await page.evaluate(id => window.game.chunkManager.getActiveEntities().find(e => e.id === id)?.stats.hp, target.id);
    await page.locator('#btn-mobile-ability').tap();
    await expect.poll(() => page.evaluate(() => window.__phoneCombatCommands.find(command => command.type === 'ability')?.targetId)).toBe(target.id);
    await expect.poll(() => page.evaluate(id => {
        const enemy = window.game.chunkManager.getActiveEntities().find(e => e.id === id);
        return enemy?.state === 'DEAD' ? 0 : enemy?.stats.hp ?? Infinity;
    }, target.id), { timeout: 20_000 }).toBeLessThan(hpBefore);
    console.log('[phone-combat] browser tap selected without attacking; Skill caused authoritative health loss on that target');

    // Reacquire a live encounter if the spell killed this one, then prove the
    // separate basic-attack button's selected id before clearing pursuit.
    await approachEncounter(page);
    target = await selectLiveTarget(page);
    await expect.poll(() => page.evaluate(() => window.game.getMobileCombatTarget()?.id)).toBe(target.id);
    await page.locator('#btn-mobile-attack').tap();
    await expect.poll(() => page.evaluate(() => window.__phoneCombatCommands.find(command => command.type === 'attack')?.targetId)).toBe(target.id);
    await page.locator('#btn-mobile-target-clear').tap();
    await expect(page.locator('#combat-intent-panel')).toBeHidden();
    expect(await page.evaluate(() => window.game.pendingInteraction)).toBeNull();
    expect(await page.evaluate(() => window.game.getMobileCombatTarget())).toBeNull();
    const commandsAfterClear = await page.evaluate(() => window.__phoneCombatCommands.length);
    await page.waitForTimeout(1_100);
    expect(await page.evaluate(() => window.__phoneCombatCommands.length)).toBe(commandsAfterClear);
    console.log('[phone-combat] Attack used the selected id; Clear Target canceled pursuit and removed the highlight');
    expect(failures, failures.join('\n')).toEqual([]);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
        test.use({ viewport });
        test('phone taps select an authoritative enemy and Attack and Skill honor it', runPhoneCombat);
    });
}
