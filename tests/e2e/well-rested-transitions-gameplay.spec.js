import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    useEncounterQAWaypoint, ensureDungeonReadyLevel, enterAndExitDungeon, returnToTown } from './helpers.js';
import { readRestedAura, restedAuraMeetsBudget } from '../restedAuraEvidence.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 15000 });
const observe = page => page.evaluate(() => {
    const game = window.game, p = game.player;
    return { ...window.__readRestedAura(p, game.renderSystem.scene), zone: p.safeZoneId,
        instance: game.currentInstanceId, instanceType: game.currentInstanceType,
        hp: p.stats.hp, maxHP: p.stats.maxHp, mana: p.stats.mana, maxMana: p.stats.maxMana };
});
async function visibleAura(page) {
    await expect.poll(async () => {
        const aura = await observe(page);
        return restedAuraMeetsBudget(aura, 'high') && aura.visibleInScene && aura.hitboxOpacity === 0;
    }, { timeout: 15000, message: 'earned aura must be attached once, visible and free of an interaction cube' }).toBe(true);
    return observe(page);
}
async function earnRest(page) {
    await expect.poll(async () => (await observe(page)).zone).toBe('lanternhold');
    console.log('[rest-transition]', 'Earning 60 seconds of Well Rested through ordinary town time.');
    await expect.poll(async () => (await observe(page)).bank, { timeout: 75000, intervals: [1000] }).toBeGreaterThanOrEqual(60);
    return visibleAura(page);
}
async function setup(page, baseURL, suffix) {
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable allowlisted registrations');
    const credentials = credentialsFromEnvironment(); credentials.username += `-${suffix}`;
    expect(credentials.characterClass).toBe('Wizard');
    const failures = collectBrowserFailures(page, baseURL);
    await page.addInitScript({ content: `window.__readRestedAura = (${readRestedAura.toString()});` });
    await page.route('**/tests/**', route => route.abort());
    await loginAndEnterWorld(page, credentials);
    return { credentials, failures };
}
async function command(page, value, confirmation) {
    // Explicitly scoped, pre-existing QA setup; never used to grant or reset rest.
    await page.waitForTimeout(1100);
    const messages = page.locator('.chat-message__text').filter({ hasText: confirmation });
    const before = await messages.count();
    const input = page.locator('#chat-input');
    await input.click(); await input.fill(value); await input.press('Enter');
    await expect.poll(() => messages.count()).toBeGreaterThan(before);
    if (await input.evaluate(node => node === document.activeElement)) await page.keyboard.press('Escape');
}

test('earned aura disappears on authoritative hostile death and returns after real Respawn', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(300000);
    const { credentials, failures } = await setup(page, baseURL, 'death');
    const town = await earnRest(page);
    await useEncounterQAWaypoint(page);
    const beforeDeath = await visibleAura(page);
    expect(beforeDeath.zone).toBe('');
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        window.__beforeDeathAura = game.player.attachedStatusEffects.get('well_rested');
        window.__hostileDeathDamage = 0;
        game.handleServerMessage = message => {
            const data = message.payload;
            if (message.type === 'damage' && data?.targetId === game.player.id && data.amount > 0 &&
                game.isHostileActorTarget(game.remotePlayers.get(data.sourceId))) window.__hostileDeathDamage += data.amount;
            return original(message);
        };
    });
    await command(page, '/qa-animation-ready near-death', 'Animation QA readiness restored at one health for hostile death validation.');
    await command(page, '/qa-protection off', 'QA waypoint protection disabled; hostile damage is authoritative.');
    await expect(page.locator('#death-screen')).toBeVisible({ timeout: 45000 });
    await expect.poll(() => page.evaluate(() => window.__hostileDeathDamage)).toBeGreaterThan(0);
    await expect.poll(async () => (await observe(page)).ownerGroups).toBe(0);
    const dead = await observe(page);
    expect(dead).toMatchObject({ state: 'DEAD', hp: 0, attached: false, meshes: 0, visibleInScene: false, hitboxOpacity: 0 });
    expect(dead.bank, 'suppression must be caused by death, not natural rest expiry').toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__beforeDeathAura.disposed && !window.__beforeDeathAura.group.parent)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('rested-hostile-death.png') });
    await loginAndEnterWorld(page, credentials);
    await expect(page.locator('#death-screen')).toBeVisible();
    const deadLogin = await observe(page);
    expect(deadLogin).toMatchObject({ state: 'DEAD', attached: false, visibleInScene: false, ownerGroups: 0, hitboxOpacity: 0 });
    expect(deadLogin.bank).toBeGreaterThan(0);
    await returnToTown(page);
    const respawn = await visibleAura(page);
    expect(respawn.zone).toBe('lanternhold'); expect(respawn.state).not.toBe('DEAD');
    expect(respawn.hp).toBe(respawn.maxHP); expect(respawn.mana).toBe(respawn.maxMana);
    await page.screenshot({ path: testInfo.outputPath('rested-real-respawn.png') });
    await loginAndEnterWorld(page, credentials);
    const rejoined = await visibleAura(page);
    expect(rejoined.bank).toBeGreaterThanOrEqual(respawn.bank);
    await page.screenshot({ path: testInfo.outputPath('rested-respawn-rejoined.png') });
    console.log('[rested-death-transition]', JSON.stringify({ town, beforeDeath, dead, deadLogin, respawn, rejoined,
        fixture: 'earned town rest; allowlisted encounter/one-health setup; authoritative hostile hit and real Respawn input' }));
    expect(failures, failures.join('\n')).toEqual([]);
});

test('earned aura survives repeated real dungeon entry, dungeon relogin and town Recall', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(420000);
    const { credentials, failures } = await setup(page, baseURL, 'dungeon');
    await ensureDungeonReadyLevel(page, 30);
    const evidence = [];
    for (let cycle = 0; cycle < 2; cycle++) {
        const town = await earnRest(page);
        await page.evaluate(() => { window.__priorSceneAura = window.game.player.attachedStatusEffects.get('well_rested'); });
        let entered, rejoined;
        await enterAndExitDungeon(page, { useTownGuide: true, beforeExit: async () => {
            entered = await visibleAura(page);
            expect(entered.instanceType).toBe('verdant_bastion_catacombs'); expect(entered.instance).toBeTruthy();
            expect(entered.zone).toBe('');
            expect(await page.evaluate(() => {
                const previous = window.__priorSceneAura, current = window.game.player.attachedStatusEffects.get('well_rested');
                // Scene clearing may preserve/reparent the same actor effect.
                return previous === current || (previous.disposed && !previous.group.parent);
            })).toBe(true);
            await page.screenshot({ path: testInfo.outputPath(`rested-dungeon-${cycle}.png`) });
            await loginAndEnterWorld(page, credentials);
            rejoined = await visibleAura(page);
            expect(rejoined.instance).toBe(entered.instance); expect(rejoined.zone).toBe('');
            expect(rejoined.bank).toBeLessThanOrEqual(entered.bank);
            await page.evaluate(() => { window.__priorSceneAura = window.game.player.attachedStatusEffects.get('well_rested'); });
        } });
        const returned = await visibleAura(page);
        expect(returned.zone).toBe('lanternhold'); expect(returned.instance).toBeFalsy();
        expect(await page.evaluate(() => {
            const previous = window.__priorSceneAura, current = window.game.player.attachedStatusEffects.get('well_rested');
            return previous === current || (previous.disposed && !previous.group.parent);
        })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`rested-dungeon-return-${cycle}.png`) });
        evidence.push({ cycle, town, entered, rejoined, returned });
    }
    console.log('[rested-dungeon-transition]', JSON.stringify({ evidence,
        fixture: 'allowlisted level30 only; earned town rest; ordinary guide entry, credentialed login and Recall; no dungeon clear claim' }));
    expect(failures, failures.join('\n')).toEqual([]);
});
