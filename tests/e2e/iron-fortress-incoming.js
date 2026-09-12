import { expect } from '@playwright/test';
import { moveByGroundClick, returnToTown } from './helpers.js';
import { installIronFortressObserver } from './iron-fortress-observer.js';

// Prepared level/saved build, not an earned-progression or encounter-balance
// claim. No HP assignment, forced damage, clock changes or combat-time refills.
export async function verifyFortressIncoming(page, command, testInfo, protection = {
    skill: 'Iron Fortress', timer: 'ironFortressTimer', effect: 'iron_fortress',
    active: 'ironFortressActive', duration: 'ironFortressDuration', mana: 40, retainedPercent: 80
}) {
    const evidenceName = protection.skill === 'Iron Fortress' ? 'fortress' : protection.effect;
    await expect.poll(() => page.evaluate(timer => window.game.player[timer] <= 0, protection.timer)).toBe(true);
    const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
    await command('/qa-animation-ready');
    await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
    const townPosition = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
    await command('/qa-waypoint encounter');
    await expect.poll(() => page.evaluate(before => Math.hypot(window.game.player.position.x - before.x,
        window.game.player.position.z - before.z), townPosition), { timeout: 30_000 }).toBeGreaterThan(20);
    await page.waitForTimeout(1100); // Authoritative waypoint movement lock, not an effect clock.
    const observe = () => page.evaluate(async () => {
        const { nearestObservedHostile } = await import('/tests/observedHostileApproach.js');
        const game = window.game;
        return nearestObservedHostile(game.player.position, [...game.remotePlayers.values()].map(enemy => ({
            id: enemy.id, subtype: enemy.subType || enemy.constructor?.name,
            active: enemy.isActive && game.isHostileActorTarget(enemy),
            alive: enemy.state !== 'DEAD' && (enemy.health ?? enemy.stats?.hp) > 0,
            x: enemy.position.x, z: enemy.position.z
        })), 'Skeleton');
    });
    await expect.poll(observe, { timeout: 30_000 }).not.toBeNull();
    const target = await observe();
    for (let step = 0; step < 15; step++) {
        const offset = await page.evaluate(id => {
            const enemy = window.game.remotePlayers.get(id), p = window.game.player;
            return enemy ? { x: enemy.position.x - p.position.x, z: enemy.position.z - p.position.z } : null;
        }, target.id);
        expect(offset).not.toBeNull();
        const distance = Math.hypot(offset.x, offset.z);
        if (distance < 3) break;
        const scale = Math.min(7, distance - 2) / distance;
        await moveByGroundClick(page, offset.x * scale, offset.z * scale,
            { moveOnly: true, minimumDistance: Math.min(6, Math.max(1, (distance - 3) * .5)) });
    }
    expect(await page.evaluate(id => {
        const enemy = window.game.remotePlayers.get(id);
        return enemy ? window.game.player.position.distanceTo(enemy.position) : Infinity;
    }, target.id)).toBeLessThan(3);
    await page.evaluate(installIronFortressObserver, protection);
    // This existing allowlisted command also primes the nearest hostile's
    // threat/first ordinary swing. Subsequent attacks use normal AI, wind-up,
    // range, armor and receiving defenses; no damage or health is injected.
    await command('/qa-protection off');
    const hits = (after = 0) => page.evaluate(({ id, after }) => window.__fortressNative.incoming
        .filter(hit => hit.sourceId === id && hit.kind === 'physical' && hit.amount > 0 && hit.at > after),
    { id: target.id, after });
    const evidence = { target, baseline: [], protected: [], expired: [] };
    try {
        await expect.poll(async () => (await hits()).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
        evidence.baseline = await hits();
        const baseline = evidence.baseline[0];
        expect(baseline.amount).toBeGreaterThan(1);
        for (const hit of evidence.baseline) {
            expect(hit).toMatchObject({ amount: baseline.amount, defense: baseline.defense, timer: 0, effectAttached: false });
        }
        const before = await page.evaluate(skill => ({ mana: window.game.player.stats.mana,
            slot: window.game.player.hotbar.indexOf(skill) }), protection.skill);
        expect(before.slot).toBeGreaterThanOrEqual(0);
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        await expect.poll(() => page.evaluate(() => window.__fortressNative.results.length)).toBe(1);
        const receipt = await page.evaluate(() => window.__fortressNative.results[0]);
        expect(receipt.accepted).toBe(true);
        expect(before.mana - receipt.mana).toBe(protection.mana);
        await expect.poll(() => page.evaluate(effect => window.game.player.attachedStatusEffects.has(effect), protection.effect)).toBe(true);
        // Observe away from cast/expiry boundaries; exact deadline races are
        // covered by receiving-pipeline tests using actual paid casts.
        const protectedAfter = await page.evaluate(() => performance.now());
        await expect.poll(async () => (await hits(protectedAfter)).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
        evidence.protected = await hits(protectedAfter);
        for (const hit of evidence.protected) {
            expect(hit.timer).toBeGreaterThan(0);
            expect(hit.effectAttached).toBe(true);
            // Skeleton basic hits use full flat armor, unlike elite-family
            // bosses' half-armor penetration. Use observed armor, not gear guesses.
            const armored = Math.max(1, baseline.amount - (hit.defense - baseline.defense));
            if (protection.skill === 'Guardian Roar') expect(hit.defense).toBe(baseline.defense);
            expect(hit.amount).toBe(Math.floor(armored * protection.retainedPercent / 100));
            expect(hit.amount).toBeLessThan(baseline.amount);
        }
        await page.screenshot({ path: testInfo.outputPath(`${evidenceName}-real-incoming-protection.png`) });
        await expect.poll(() => page.evaluate(cfg => window.__fortressNative.expired &&
            window.game.player[cfg.timer] <= 0 &&
            !window.game.player.attachedStatusEffects.has(cfg.effect), protection), { timeout: 65_000 }).toBe(true);
        await page.waitForTimeout(1500); // Do not classify an in-flight receipt at the expiry boundary.
        const expiredAfter = await page.evaluate(() => performance.now());
        await expect.poll(async () => (await hits(expiredAfter)).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
        evidence.expired = await hits(expiredAfter);
        for (const hit of evidence.expired) {
            expect(hit).toMatchObject({ amount: baseline.amount, defense: baseline.defense, timer: 0, effectAttached: false });
        }
        expect(await page.evaluate(() => window.game.player.state)).not.toBe('DEAD');
        console.log(`[${evidenceName}-real-incoming]`, JSON.stringify(evidence));
    } finally {
        evidence.observation = await page.evaluate(() => ({ ...window.__fortressNative,
            state: window.game.player.state, health: window.game.player.stats.hp }));
        await testInfo.attach(`${evidenceName}-incoming-receipts`, { body: JSON.stringify({ protection, ...evidence }, null, 2), contentType: 'application/json' });
    }
    await returnToTown(page, { allowRespawn: false });
}
