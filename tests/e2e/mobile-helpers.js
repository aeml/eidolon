import { expect } from '@playwright/test';
import { projectNearestHostile, projectEntity, useEncounterQAWaypoint } from './helpers.js';

export async function approachEncounter(page) {
    if (await page.locator('#chat-mobile-toggle').getAttribute('aria-expanded') !== 'true') {
        await page.locator('#chat-mobile-toggle').tap();
    }
    await page.locator('#chat-input').tap();
    await useEncounterQAWaypoint(page);
    await page.locator('#chat-mobile-toggle').tap();
}

export async function selectLiveTarget(page) {
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
