import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    exerciseReconnect, loginAndEnterWorld, moveByGroundClick, projectNearestHostile,
    readPlayerState, useEncounterQAWaypoint
} from './helpers.js';
import { readAnimationCastState } from '../animationPresentationRecord.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

// Observe production messages and actual draws only. Never invoke movement,
// casting or transport actions from page code, or manufacture combat state.
function observeTerrainInPage() {
    const game = window.game;
    const evidence = window.__terrainProfileEvidence = {
        authoritativePlayer: null, projectileStates: [], projectileDraws: [], impacts: [], damage: [], resumeProfile: null
    };
    const handle = game.handleServerMessage;
    game.handleServerMessage = function (message) {
        if (message.type === 'resume_session') evidence.resumeProfile = message.payload?.terrainProfile || 'flat-v1';
        const updates = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
        for (const [id, value] of Object.entries(updates || {})) {
            if (id === game.player.id) {
                const previous = evidence.authoritativePlayer || {};
                evidence.authoritativePlayer = {
                    x: value.x ?? previous.x, y: value.y ?? previous.y, z: value.z ?? previous.z
                };
            }
            if (value.type === 'Projectile' && value.subType === 'Fireball' && value.ownerId === game.player.id &&
                evidence.projectileStates.length < 32) {
                evidence.projectileStates.push({ x: value.x, y: value.y, z: value.z });
            }
        }
        if (message.type === 'projectile_impact' && message.payload?.sourceId === game.player.id &&
            message.payload.projectileType === 'Fireball' && evidence.impacts.length < 32) {
            const value = message.payload;
            evidence.impacts.push({ targetId: value.targetId || '', x: value.x, y: value.y, z: value.z });
        }
        if (message.type === 'damage' && message.payload?.sourceId === game.player.id && evidence.damage.length < 32) {
            evidence.damage.push({ targetId: message.payload.targetId, amount: message.payload.amount });
        }
        return handle.call(this, message);
    };
    const render = game.renderSystem.render;
    const observed = new WeakSet();
    game.renderSystem.render = function (...args) {
        for (const entity of game.remotePlayers.values()) {
            if (entity.type !== 'Fireball' || entity.owner?.id !== game.player.id || !entity.mesh) continue;
            entity.mesh.traverse(child => {
                if (!child.isMesh || observed.has(child)) return;
                observed.add(child);
                const before = child.onBeforeRender;
                child.onBeforeRender = function (...drawArgs) {
                    if (evidence.projectileDraws.length < 32) evidence.projectileDraws.push({
                        x: entity.mesh.position.x, y: entity.mesh.position.y, z: entity.mesh.position.z,
                        ground: game.terrainElevation.sample(entity.mesh.position.x, entity.mesh.position.z)
                    });
                    return before?.apply(this, drawArgs);
                };
            });
        }
        return render.apply(this, args);
    };
}

function readTerrainInPage() {
    const game = window.game;
    const p = game.player.position, mesh = game.player.mesh.position;
    const authority = window.__terrainProfileEvidence.authoritativePlayer;
    const field = game.terrainElevation;
    return {
        profile: game.terrainProfile, expectedProfile: game.network.expectedTerrainProfile,
        ground: field?.sample(p.x, p.z), playerError: field ? Math.abs(p.y - field.sample(p.x, p.z)) : Infinity,
        meshError: field ? Math.abs(mesh.y - field.sample(mesh.x, mesh.z)) : Infinity,
        authorityError: field && Number.isFinite(authority?.y)
            ? Math.abs(authority.y - field.sample(authority.x, authority.z)) : Infinity,
        authorityDistance: authority ? Math.hypot(p.x - authority.x, p.z - authority.z) : Infinity,
        outcrops: Boolean(game.renderSystem.scene.getObjectByName('Earth exposed rock shelves'))
    };
}

test('public terrain selection supports connected walking, rendered Fireball impact and reconnect on raised Earth', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires disposable allowlisted QA accounts');
    test.setTimeout(180_000);
    expect(process.env.EIDOLON_E2E_TERRAIN_PROFILE).toBe('earth-elevation-rocks-v1');
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page, 30);
    expect(await page.evaluate(() => window.game.player.abilityName)).toBe('Fireball');
    await page.evaluate(observeTerrainInPage);
    await useEncounterQAWaypoint(page);
    await expect.poll(() => page.evaluate(readTerrainInPage)).toMatchObject({
        profile: 'earth-elevation-rocks-v1', expectedProfile: 'earth-elevation-rocks-v1', outcrops: true
    });
    const assertGrounded = async () => {
        await expect.poll(() => page.evaluate(readTerrainInPage)).toMatchObject({
            playerError: expect.any(Number), meshError: expect.any(Number), authorityError: expect.any(Number)
        });
        await expect.poll(async () => {
            const value = await page.evaluate(readTerrainInPage);
            return value.ground > 1 && value.playerError < .05 && value.meshError < .1 &&
                value.authorityError < .05 && value.authorityDistance < 1;
        }, { message: 'Raised client, rendered actor and authoritative position must agree' }).toBe(true);
    };
    await assertGrounded();
    const start = await readPlayerState(page);
    await moveByGroundClick(page, -6, 0, {
        // Shift-click is the normal move-only input, avoiding incidental attacks
        // when a moving hostile covers ground. Keep ordinary collision/sliding.
        moveOnly: true, allowAlternatePaths: true, allowJumpFallback: false, minimumDistance: 2
    });
    const walked = await readPlayerState(page);
    expect(Math.hypot(walked.x - start.x, walked.z - start.z)).toBeGreaterThan(2);
    await assertGrounded();

    let target;
    await expect.poll(async () => {
        target = await projectNearestHostile(page);
        return Boolean(target && target.distance < 20 && target.health > 0);
    }).toBe(true);
    await page.mouse.move(target.x, target.y);
    await expect.poll(() => page.evaluate(() => window.game.hoveredEntity?.id)).toBe(target.id);
    const beforeCast = await page.evaluate(readAnimationCastState, 'Fireball');
    await page.mouse.click(target.x, target.y, { button: 'right' });
    try {
        await expect.poll(() => page.evaluate(() => window.__terrainProfileEvidence.projectileStates.length), {
            intervals: [25, 50, 100], timeout: 10_000
        }).toBeGreaterThan(0);
    } catch (error) {
        const afterCast = await page.evaluate(readAnimationCastState, 'Fireball');
        const evidence = await page.evaluate(() => window.__terrainProfileEvidence);
        throw new Error(`Raised Fireball did not replicate: ${JSON.stringify({ beforeCast, afterCast, evidence })}`, { cause: error });
    }
    await expect.poll(() => page.evaluate(() => window.__terrainProfileEvidence.projectileDraws.length), {
        intervals: [25, 50, 100], timeout: 10_000
    }).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(id => window.__terrainProfileEvidence.impacts.some(value => value.targetId === id), target.id))
        .toBe(true);
    await expect.poll(() => page.evaluate(id => window.__terrainProfileEvidence.damage.some(value =>
        value.targetId === id && value.amount > 0), target.id)).toBe(true);
    const spell = await page.evaluate(() => {
        const evidence = window.__terrainProfileEvidence;
        return {
            states: evidence.projectileStates.length, draws: evidence.projectileDraws.length,
            minimumGround: Math.min(...evidence.projectileDraws.map(value => value.ground)),
            minimumClearance: Math.min(...evidence.projectileDraws.map(value => value.y - value.ground)),
            impactClearance: evidence.impacts.map(value => value.y - window.game.terrainElevation.sample(value.x, value.z))
        };
    });
    expect(spell.minimumGround).toBeGreaterThan(1);
    expect(spell.minimumClearance).toBeGreaterThan(0);
    expect(spell.impactClearance.every(value => value >= 0)).toBe(true);
    await exerciseReconnect(page);
    expect(await page.evaluate(() => window.__terrainProfileEvidence.resumeProfile)).toBe('earth-elevation-rocks-v1');
    await assertGrounded();
    expect((await readPlayerState(page)).instanceId).toBe('');
    expect(failures, failures.join('\n')).toEqual([]);
    console.log(`[terrain-profile] connected walking, ${spell.states} authoritative Fireball samples, ${spell.draws} actual draws, hostile impact and matching-profile resume passed`);
});
