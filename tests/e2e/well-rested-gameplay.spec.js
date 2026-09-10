import { expect, test } from '@playwright/test';
import { readSanctuaryHoverEvidence } from './sanctuary-hover-observation.js';
import { observeCollectionCombatReceipts, readFreshCollectionCombat,
    selectCollectionTargetThroughInput } from './fresh-collection-combat.js';
import { collectBrowserFailures, credentialsFromEnvironment, jumpByGroundClick,
    loginAndEnterWorld, moveByGroundClick, projectEntity, projectNearestHostile,
    readPlayerState, returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const restState = page => page.evaluate(() => {
    const player = window.game.player;
    const aura = player.attachedStatusEffects.get('well_rested');
    let meshes = 0;
    aura?.group.traverse(part => { if (part.isMesh) meshes++; });
    return { bank: player.wellRestedSeconds, zone: player.safeZoneId,
        hp: player.health ?? player.stats.hp, mana: player.mana ?? player.stats.mana,
        maxHP: player.stats.maxHp, maxMana: player.stats.maxMana,
        aura: Boolean(aura?.group.parent), meshes, state: player.state };
});

async function hoverEnemyCardThroughInput(page, testInfo, targetId = null) {
    let hoveredId;
    let attempt = { requestedTarget: targetId, id: null, point: null };
    try { await expect.poll(async () => {
        const id = targetId || (await projectNearestHostile(page, 'Skeleton'))?.id;
        attempt = { requestedTarget: targetId, id: id || null, point: null };
        if (!id) return false;
        const point = await projectEntity(page, id);
        attempt.point = point;
        if (!point?.visible) return false;
        await page.mouse.move(point.x, point.y);
        const selected = await page.evaluate(id => window.game.hoveredEntity?.id === id &&
            window.game.combatIntent?.entityId === id, id);
        if (selected) hoveredId = id;
        return selected;
    }, { timeout: 10_000, message: 'The real enemy hover must populate the combat card' }).toBe(true);
    } catch (error) {
        const evidence = await readSanctuaryHoverEvidence(page, attempt);
        await testInfo.attach('sanctuary-hover-failure', { body: JSON.stringify(evidence), contentType: 'application/json' });
        await page.screenshot({ path: testInfo.outputPath('sanctuary-hover-failure.png') });
        console.log('[sanctuary-hover-failure]', JSON.stringify(evidence));
        throw error;
    }
    return hoveredId;
}

// Fresh registration and ordinary canvas/Recall/login input only. No actor,
// inventory, clock, buff or safe-zone mutation and no QA encounter teleport.
test('earned sanctuary rest follows real travel, combat and a fresh login', async ({ page, baseURL }, testInfo) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires an isolated disposable character');
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    expect(credentials.characterClass).toBe('Wizard');
    test.setTimeout(300_000);
    const failures = collectBrowserFailures(page, baseURL);
    // Exercise the same asset boundary as Pages, even on a local QA server.
    await page.route('**/tests/**', route => route.abort());
    await loginAndEnterWorld(page, credentials);
    await expect.poll(async () => (await restState(page)).bank).toBeGreaterThanOrEqual(5);
    await expect.poll(async () => {
        const p = await restState(page);
        return p.hp === p.maxHP && p.mana === p.maxMana;
    }).toBe(true);
    const rested = await restState(page);
    expect(rested.zone).toBe('lanternhold');
    expect(rested.aura).toBe(true);
    expect(rested.meshes).toBeGreaterThan(0);
    await expect(page.locator('.minimap-buff-icon[data-buff-id="well_rested"]'))
        .toHaveAttribute('aria-label', /Resting/);
    await page.screenshot({ path: testInfo.outputPath('rested-town.png') });

    // Stop inside the real east boundary, then hover an ordinary enemy outside
    // it. Read replicated membership; never assign the zone, target or card.
    for (let step = 0; (await readPlayerState(page)).x < 94 && step < 12; step++) {
        const position = await readPlayerState(page);
        await jumpByGroundClick(page, Math.min(25, 95 - position.x), Math.max(-8, Math.min(8, 200 - position.z)));
    }
    const insidePosition = await readPlayerState(page);
    expect(insidePosition.x).toBeGreaterThanOrEqual(94);
    expect(insidePosition.x).toBeLessThan(100);
    await expect.poll(async () => (await restState(page)).zone).toBe('lanternhold');
    const boundaryTarget = await hoverEnemyCardThroughInput(page, testInfo);
    await expect(page.locator('#combat-intent-status')).toHaveText('Leave the safe zone');
    await expect(page.locator('#combat-intent-status')).not.toHaveClass(/is-in-range/);
    await page.screenshot({ path: testInfo.outputPath('native-safe-zone-warning.png') });

    for (let step = 0; (await readPlayerState(page)).x < 115 && step < 20; step++) {
        const position = await readPlayerState(page);
        await jumpByGroundClick(page, 25, Math.max(-8, Math.min(8, 200 - position.z)));
    }
    expect((await readPlayerState(page)).x).toBeGreaterThanOrEqual(115);
    await expect.poll(async () => (await restState(page)).zone).toBe('');
    await hoverEnemyCardThroughInput(page, testInfo, boundaryTarget);
    await expect(page.locator('#combat-intent-status')).toHaveText(/^(In Range|Move Into Range)$/);
    await page.screenshot({ path: testInfo.outputPath('native-safe-zone-departure.png') });
    console.log('[native-safe-zone-feedback]', JSON.stringify({ target: boundaryTarget,
        insidePosition, outsidePosition: await readPlayerState(page), zone: (await restState(page)).zone }));
    const departed = await restState(page);
    expect(departed.bank).toBeGreaterThan(2);
    await expect.poll(async () => (await restState(page)).bank).toBeLessThan(departed.bank - 1);

    let target;
    for (let step = 0; step < 24 && !target; step++) {
        target = await projectNearestHostile(page, 'Skeleton');
        if (target) break;
        const offset = await page.evaluate(() => {
            const game = window.game;
            const enemies = [...game.remotePlayers.values()].filter(actor => actor.isActive &&
                actor.state !== 'DEAD' && (actor.subType || actor.constructor?.name) === 'Skeleton');
            enemies.sort((a, b) => game.player.position.distanceTo(a.position) - game.player.position.distanceTo(b.position));
            if (!enemies[0]) return { x: 0, z: -15 };
            const dx = enemies[0].position.x - game.player.position.x;
            const dz = enemies[0].position.z - game.player.position.z;
            const scale = Math.min(1, 15 / Math.max(1, Math.hypot(dx, dz)));
            return { x: dx * scale, z: dz * scale };
        });
        await moveByGroundClick(page, offset.x, offset.z);
    }
    expect(target, 'A hostile must be reached through normal travel').toBeTruthy();
    await observeCollectionCombatReceipts(page);
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        const evidence = window.__restJourneyEvidence = { incomingDamage: 0, cast: null };
        game.handleServerMessage = message => {
            const data = message.payload;
            if (message.type === 'damage' && data?.targetId === game.player.id && data.amount > 0 &&
                game.isHostileActorTarget(game.remotePlayers.get(data.sourceId))) {
                evidence.incomingDamage += data.amount;
            }
            if (message.type === 'ability_result' && data?.skillName === 'Fireball') {
                evidence.cast = { accepted: data.accepted, mana: data.mana };
            }
            return original(message);
        };
    });
    const selectionPoint = await projectEntity(page, target.id);
    expect(selectionPoint?.visible).toBe(true);
    target = await selectCollectionTargetThroughInput(page, target, selectionPoint);
    const targetHP = () => page.evaluate(id => {
        const actor = window.game.remotePlayers.get(id);
        // Death snapshots drive the corpse animation instead of updating its
        // live stats object. A confirmed DEAD actor has no remaining health.
        return actor ? actor.state === 'DEAD' ? 0 : actor.health ?? actor.stats?.hp : null;
    }, target.id);
    console.log('[well-rested-combat-selection]', JSON.stringify(await readFreshCollectionCombat(page, target.id)));
    // A visible target can be beyond projectile range. The ordinary left-click
    // owns chase/auto-attack; retain that input while approaching it.
    await expect.poll(async () => {
        const combat = await readFreshCollectionCombat(page, target.id);
        return combat.target?.distance ?? Infinity;
    }, { timeout: 15_000 }).toBeLessThan(12);
    // Let the ordinary hostile attack before finishing it. A reduced maximum
    // at buff expiry is not evidence that combat depleted actual health.
    await expect.poll(() => page.evaluate(() => window.__restJourneyEvidence.incomingDamage),
        { timeout: 15_000 }).toBeGreaterThan(0);
    const beforeCast = await restState(page);
    expect(beforeCast.hp).toBeGreaterThan(0);
    expect(beforeCast.hp).toBeLessThan(beforeCast.maxHP);
    const beforeHP = await targetHP();
    expect(beforeHP).toBeGreaterThan(0);
    const point = await projectEntity(page, target.id);
    expect(point?.visible).toBe(true);
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await expect.poll(targetHP, { timeout: 15_000 }).toBeLessThan(beforeHP);
    await expect.poll(async () => (await readFreshCollectionCombat(page, target.id))
        .receipts[target.id]?.hits || 0).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.__restJourneyEvidence.cast?.accepted)).toBe(true);
    const evidence = await page.evaluate(() => window.__restJourneyEvidence);
    expect(evidence.cast.mana).toBeLessThanOrEqual(beforeCast.maxMana - 30);
    console.log('[well-rested-combat-hit]', JSON.stringify(await readFreshCollectionCombat(page, target.id)));
    expect((await restState(page)).state).not.toBe('DEAD');

    await returnToTown(page);
    await expect.poll(async () => (await restState(page)).zone).toBe('lanternhold');
    const returned = await restState(page);
    await expect.poll(async () => (await restState(page)).bank).toBeGreaterThan(returned.bank + 1);
    await expect.poll(async () => {
        const p = await restState(page);
        return p.state !== 'DEAD' && p.hp === p.maxHP && p.mana === p.maxMana;
    }, { timeout: 15_000, message: 'ordinary town recovery must fill both combat-depleted pools' }).toBe(true);
    expect((await restState(page)).aura).toBe(true);
    const beforeLogin = await restState(page);
    await loginAndEnterWorld(page, credentials);
    await expect.poll(async () => (await restState(page)).aura).toBe(true);
    const rejoined = await restState(page);
    expect(rejoined.zone).toBe('lanternhold');
    expect(rejoined.bank).toBeGreaterThanOrEqual(beforeLogin.bank);
    await page.screenshot({ path: testInfo.outputPath('rested-rejoined.png') });
    console.log('[well-rested-gameplay]', JSON.stringify({ rested, departed, beforeCast, evidence, returned, beforeLogin, rejoined }));
    expect(failures, failures.join('\n')).toEqual([]);
});
