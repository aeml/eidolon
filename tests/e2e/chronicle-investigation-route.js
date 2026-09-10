import { expect } from '@playwright/test';
import { chronicleInvestigations } from '../../src/data/chronicleInvestigations.generated.js';
import { getIlyraCompletionReply } from '../../src/ui/QuestConversation.js';
import { moveByGroundClick, readPlayerState, returnToTown } from './helpers.js';
import { approachInvestigationReading, investigationReadingOpen, resumeInvestigationReading } from './investigation-reading-state.js';

async function walkTo(page, x, z, reading = null) {
    for (let step = 0; step < 50; step++) {
        const player = await readPlayerState(page);
        expect(player.state, 'Investigation travel must remain survivable').not.toBe('DEAD');
        const dx = x - player.x, dz = z - player.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 2) return;
        const scale = Math.min(1, 12 / distance);
        // Ordinary jump input is allowed when roaming enemies cover the path;
        // this is the same player-controlled fallback as other earned routes.
        const move = () => moveByGroundClick(page, dx * scale, dz * scale);
        if (reading) {
            const result = await approachInvestigationReading(reading, move);
            if (result === 'already-open') {
                expect((await readPlayerState(page)).state, 'Reading must remain survivable').not.toBe('DEAD');
                return result;
            }
        } else await move();
        // The shared movement helper confirms displacement, not arrival. Let
        // both the walk and following camera settle before projecting again.
        await expect.poll(() => page.evaluate(() => {
            const game = window.game;
            return game.player.state === 'IDLE' && !game.player.targetPosition &&
                Math.hypot(game.renderSystem.cameraTarget.x - game.player.position.x,
                    game.renderSystem.cameraTarget.z - game.player.position.z) < 0.05;
        })).toBe(true);
    }
    throw new Error(`Ordinary investigation travel did not reach ${x}, ${z}: ${JSON.stringify(await readPlayerState(page))}`);
}

// Ordinary ground/jump clicks, prop clicks and explicit Ilyra turn-ins only. No
// teleport-to-site, quest-state writes, credit messages or invulnerability.
export async function earnEarthInvestigation(page, id, openIlyra, capture, options) {
    expect(chronicleInvestigations.find(chapter => chapter.id === id).realm).toBe('earth');
    return earnInvestigation(page, id, openIlyra, capture, options);
}

export async function earnInvestigation(page, id, openIlyra, capture, { waypoints, selectChapter, beforeInspect, defeatSite, inspectWithKeyboard = false } = {}) {
    const chapter = chronicleInvestigations.find(chapter => chapter.id === id);
    await openIlyra(page);
    if (selectChapter) await selectChapter(chapter);
    await page.locator('#quest-window').getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(() => page.evaluate(id => window.game.player.quests.find(q => q.id === id)?.accepted, id)).toBe(true);
    await page.locator('#btn-close-quest').click();
    await returnToTown(page);
    if (waypoints) {
        for (const [x, z] of waypoints) await walkTo(page, x, z);
    } else {
        expect(chapter.realm, 'Non-Earth routes require explicit ordinary travel').toBe('earth');
        await walkTo(page, 80, 200);
        await walkTo(page, 125, 200);
        if (chapter.sites[0].z < 100) await walkTo(page, 145, 80);
    }
    for (const site of chapter.sites) {
        if (site.kind === 'combat') {
            expect(defeatSite, 'Combat evidence needs ordinary combat, never inspection credit').toBeTruthy();
            await walkTo(page, site.x + 18, site.z + 18);
            try { await defeatSite(site, chapter); } catch (error) {
                if (capture) await capture(site, 'combat-failure');
                throw error;
            }
            if (capture) await capture(site, 'earned-combat');
            continue;
        }
        expect(site.kind, 'Combat evidence requires a separate actual combat driver').toBe('inspect');
        await walkTo(page, site.x, site.z + 3);
        if (beforeInspect) {
            try { await beforeInspect(site); } catch (error) {
                if (capture) await capture(site, 'combat-failure');
                throw error;
            }
        }
        const evidence = page.locator(`#journal-list details[data-discovery-id="${site.id}"]`);
        try {
        const reading = await resumeInvestigationReading(page, evidence, async () => {
        if (beforeInspect && await walkTo(page, site.x, site.z + 3, evidence) === 'already-open') return 'already-open';
        if (await investigationReadingOpen(evidence)) return 'already-open';
        if (capture) await capture(site, 'approach');
        if (inspectWithKeyboard) {
            // Ordinary E input reaches nearby evidence even if a hostile
            // covers its visible geometry. Server acknowledgement below is
            // still mandatory; no quest state or request is injected here.
            await page.keyboard.press('e');
        } else {
        let point;
        let candidate = 0;
        try { await expect.poll(async () => {
            // Enemies can cover the foundation center. Try visible geometry
            // on this actual prop; never override normal hostile priority.
            point = await page.evaluate(({ id, candidate }) => {
                const game = window.game, entity = game.remotePlayers.get(id);
                if (!entity?.mesh) return null;
                const meshes = [];
                entity.mesh.updateWorldMatrix(true, true);
                entity.mesh.traverse(mesh => {
                    if (mesh.isMesh && mesh.visible && mesh.userData.entityId === id) meshes.push(mesh);
                });
                const mesh = meshes[candidate % meshes.length];
                if (!mesh) return null;
                mesh.geometry.computeBoundingBox();
                const world = mesh.geometry.boundingBox.getCenter(entity.position.clone());
                const projected = mesh.localToWorld(world).project(game.renderSystem.camera);
                const x = (projected.x + 1) * innerWidth / 2, y = (1 - projected.y) * innerHeight / 2;
                return { x, y, visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 &&
                    Math.abs(projected.z) <= 1 && document.elementFromPoint(x, y)?.tagName === 'CANVAS' };
            }, { id: site.entityId, candidate: candidate++ });
            if (!point?.visible) return false;
            await page.mouse.move(point.x, point.y);
            return page.evaluate(id => window.game.hoveredEntity?.id === id, site.entityId);
        }).toBe(true); } catch (error) {
            console.log('[investigation-hover]', JSON.stringify(await page.evaluate(id => {
                const game = window.game, entity = game.remotePlayers.get(id);
                return { id, player: game.player.position.toArray(), entity: entity?.position.toArray(),
                    type: entity?.type, active: entity?.isActive, state: entity?.state,
                    mesh: Boolean(entity?.mesh), inCache: game.activeEntitiesCache.some(value => value.id === id),
                    hovered: game.hoveredEntity?.id, hits: game.raycastHitEntities?.map(value => value.id) };
            }, site.entityId)));
            throw error;
        }
        await page.mouse.click(point.x, point.y);
        }
        });
        console.log('[investigation-reading]', JSON.stringify({ site: site.id, reading }));
        await expect(evidence).toHaveAttribute('open', '');
        await expect(evidence).toContainText(site.title);
        if (capture) await capture(site, 'earned');
        await page.locator('#btn-close-journal').click();
        } catch (error) {
            if (capture) await capture(site, 'reading-failure');
            throw error;
        }
    }
    const before = await page.evaluate(id => window.game.player.quests.find(q => q.id === id), id);
    expect(before.count).toBe(chapter.sites.length);
    expect(before.completed).toBe(false);
    expect(before.grantedXP || 0).toBe(0);
    await openIlyra(page);
    if (selectChapter) await selectChapter(chapter);
    await page.locator('#quest-window').getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(() => page.evaluate(id => window.game.player.quests.find(q => q.id === id)?.completed, id)).toBe(true);
    const reply = getIlyraCompletionReply(before);
    await expect(page.locator('#quest-window .quest-dialogue__speech')).toHaveText(reply.split(/\n\s*\n/));
    await page.locator('#quest-window').getByRole('button', { name: 'Continue conversation', exact: true }).click();
    await page.locator('#btn-close-quest').click();
}
