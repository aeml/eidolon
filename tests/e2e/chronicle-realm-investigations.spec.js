import { seedReturningCharacter } from './chronicle-returning-fixture.js';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame, projectEntity } from './helpers.js';
import { openIlyra } from './chronicle-earth-route.js';
import { earnInvestigation } from './chronicle-investigation-route.js';
import { createEarnedWizardDefense } from './earned-wizard-defense.js';
import { chronicleInvestigations } from '../../src/data/chronicleInvestigations.generated.js';
import { chroniclePhoneRoutes } from './chronicle-phone-routes.js';
import { defeatCommandAnchor } from './chronicle-command-anchor.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 20_000 });

const realm = process.env.EIDOLON_E2E_INVESTIGATION_REALM || 'water';
const realmRoutes = chroniclePhoneRoutes;
if (!['water', 'fire', 'air'].includes(realm)) throw new Error('Investigation realm must be water, fire or air');

async function clearPursuingHostiles(page, site, beforeCombat) {
    const engaged = new Set();
    try { await expect.poll(async () => {
        if (await beforeCombat()) return false;
        const state = await page.evaluate(() => {
            const game = window.game, player = game.player;
            const enemies = (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                player.position.distanceTo(enemy.position) < 14);
            enemies.sort((a, b) => player.position.distanceTo(a.position) - player.position.distanceTo(b.position));
            return { dead: player.state === 'DEAD', id: enemies[0]?.id, cooldown: player.abilityCooldown };
        });
        expect(state.dead, 'Prepared returning character must survive ordinary field combat').toBe(false);
        if (!state.id) return true;
        const point = await projectEntity(page, state.id);
        if (!point?.visible) return false;
        await page.mouse.move(point.x, point.y);
        const actual = await page.evaluate(() => {
            const game = window.game;
            return game.isHostileActorTarget(game.hoveredEntity) ? game.hoveredEntity.id : null;
        });
        if (!actual) return false;
        // Actual left-click pursuit/basic attack and Wizard's right-click
        // Fireball. No despawn, invulnerability, damage or kill-credit grants.
        await page.mouse.click(point.x, point.y);
        if ((state.cooldown || 0) <= 0) await page.mouse.click(point.x, point.y, { button: 'right' });
        engaged.add(actual);
        return false;
    }, { timeout: 180_000, intervals: [250], message: `Clear ordinary pursuers before inspecting ${site.id}` }).toBe(true); } catch (error) {
        console.log(`[${realm}-site-failure]`, JSON.stringify(await page.evaluate(site => {
            const game = window.game, player = game.player;
            return { site, position: player.position.toArray(), state: player.state, health: player.stats.hp,
                maximumHealth: player.stats.maxHp, damage: player.stats.damage, shield: player.shieldHP,
                target: player.targetEntity?.id, hovered: game.hoveredEntity?.id,
                defense: window.__freshWizardDefense?.counts,
                nearby: (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                    player.position.distanceTo(enemy.position) < 30).map(enemy => ({ id: enemy.id,
                    health: enemy.stats?.hp, level: enemy.level, position: enemy.position.toArray() })) };
        }, site.id)));
        throw error;
    }
    if (engaged.size) console.log(`[${realm}-site-combat] ${site.id}: engaged ${engaged.size} actual pursuers; nearby hostile area cleared`);
}



test(`returning character earns ${realm} records through ordinary travel and manual catch-up turn-ins`, async ({ page, baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_INVESTIGATION_MONGO_CONTAINER, 'Requires isolated returning-character fixture');
    test.setTimeout(900_000);
    const credentials = credentialsFromEnvironment();
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    const failures = collectBrowserFailures(page, baseURL);
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    seedReturningCharacter(credentials.username);
    await loginAndEnterWorld(page, credentials);
    // Choose the available control branch normally, then use its actual
    // defensive hotbar inputs and ordinary kiting rather than tanking a crowd.
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    await skills.locator('.skill-branch').filter({ hasText: 'Control & Utility' }).getByRole('button', { name: 'Select Spec' }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.selectedBranch)).toBe('C');
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Arcane Shield'))).toBe(true);
    await page.locator('#btn-close-skills').click();
    // The same ordinary Ctrl-click used during travel also permits retreat
    // when a hostile model covers the projected ground. Other hunt baselines
    // retain their existing walking-only defense default.
    const beforeCombat = await createEarnedWizardDefense(page, { allowJumpFallback: true, useCrowdControl: true });
    const chapters = chronicleInvestigations.filter(chapter => chapter.realm === realm);
    const ids = chapters.map(chapter => chapter.id);
    for (const id of ids) {
        const initial = await page.evaluate(id => window.game.player.quests.find(q => q.id === id), id);
        expect(initial.legacyOptional).toBe(true);
        expect(initial.accepted).toBe(false);
        expect(initial.investigationMask || 0).toBe(0);
        await earnInvestigation(page, id, openIlyra,
            (site, stage) => page.screenshot({ path: testInfo.outputPath(`${site.id}-${stage}.png`) }), {
                waypoints: realmRoutes[realm],
                beforeInspect: async site => {
                    if (realm === 'fire' && ['cold_ash', 'released_ember'].includes(site.id)) {
                        const released = site.id === 'released_ember';
                        await expect.poll(() => page.evaluate(() => {
                            const model = window.game.remotePlayers.get('chronicle-site-released_ember')?.siteModel;
                            return { bound: model?.boundEmber?.visible, released: model?.releasedEmber?.visible };
                        })).toEqual({ bound: !released, released });
                    }
                    await clearPursuingHostiles(page, site, beforeCombat);
                },
                defeatSite: (site, chapter) => defeatCommandAnchor(page, site, chapter, beforeCombat),
                selectChapter: async chapter => {
                    const other = page.locator('#quest-list details').filter({ has: page.locator('summary').filter({ hasText: 'Other discoveries' }) });
                    if (await other.getAttribute('open') === null) await other.locator('summary').click();
                    await other.getByRole('button', { name: chapter.title, exact: true }).click();
                }
            });
    }
    await loginAndEnterWorld(page, credentials);
    for (const id of ids) {
        const quest = await page.evaluate(id => window.game.player.quests.find(q => q.id === id), id);
        expect(quest.completed).toBe(true);
        expect(quest.count).toBe(quest.maxCount);
        expect(quest.investigationMask).toBe(id === ids[0] ? 1 : 7);
        expect(quest.grantedXP || 0).toBe(0);
        expect(quest.grantedResonanceXP).toBeGreaterThan(0);
        expect(quest.grantedGold).toBeGreaterThan(0);
    }
    const saved = await page.evaluate(() => window.game.player.quests);
    expect(saved.find(q => q.id === 'chronicle_09_sky_answers').completed).toBe(true);
    expect(saved.find(q => q.id === 'chronicle_10_rootheart_raid').completed).toBe(false);
    await page.keyboard.press('j');
    await expect(page.locator('#quest-journal')).toBeVisible();
    for (const site of chapters.flatMap(chapter => chapter.sites)) {
        const record = page.locator(`#journal-list details[data-discovery-id="${site.id}"]`);
        await record.locator('summary').scrollIntoViewIfNeeded();
        if (await record.getAttribute('open') === null) await record.locator('summary').click();
        await expect(record).toHaveAttribute('open', '');
        await expect(record).toContainText(site.text.replace(/\n\s*\n/g, ''));
    }
    await page.locator('#btn-close-journal').click();
    console.log(`[${realm}-investigations] local veteran fixture; actual field discoveries, manual rewards, reconnect and journal rereading passed`);
    expect(failures, failures.join('\n')).toEqual([]);
});
