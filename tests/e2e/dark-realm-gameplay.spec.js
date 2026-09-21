import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { partyDungeonCharacter, requireIsolatedPartyFixture } from '../partyDungeonFixture.js';
import { seedActor } from './geared-party-route.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, projectEntity, returnToTown, selectGraphicsThroughSettings } from './helpers.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { walkInvestigationWaypoints } from './chronicle-investigation-route.js';
import { darkRealmChapters } from '../../src/data/chronicleCatalog.js';
import { createInvestigationTravelDefense } from './fresh-investigation-combat.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 20_000 });

test('prepared expedition entrant discovers shore records, claims Ilyra’s reward and retains them after reconnect', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_DARK_REALM !== '1', 'Explicit isolated expedition check only');
    test.setTimeout(600_000);
    requireIsolatedPartyFixture({ ...process.env, EIDOLON_E2E_PARTY_DUNGEON: '1' });
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    const output = execFileSync('go', ['test', './internal/game', '-run', '^TestPartyBrowserFixtureCatalog$', '-count=1', '-v'], {
        cwd: 'server', env: { ...process.env, EIDOLON_PARTY_FIXTURE_CATALOG: '1', EIDOLON_PARTY_FIXTURE_LEVEL: '100', EIDOLON_E2E_PARTY_GEAR: 'progressed' },
        encoding: 'utf8', timeout: 120_000
    });
    const catalog = JSON.parse(output.split('\n').find(line => line.startsWith('[party-fixture-catalog]')).slice(23));
    const chapter = darkRealmChapters[0];
    const index = catalog.quests.findIndex(q => q.id === chapter.id);
    expect(index).toBe(29);
    // Prepared entry prerequisites ONLY. No Dark Realm discovery, reward,
    // completion, location, invulnerability or combat damage is fabricated.
    const prior = catalog.quests.slice(0, index).map(q => ({ id: q.id, accepted: true, completed: true,
        count: q.maxCount, investigation_mask: q.type === 'INVESTIGATE' ? (1 << q.maxCount) - 1 : 0 }));
    const character = partyDungeonCharacter(catalog, prior, 'Wizard', credentials.username, 'progressed');
    await seedActor(page, credentials, character);
    await selectGraphicsThroughSettings(page, 'low');
    const beforeTravel = await createInvestigationTravelDefense(page);
    const enterRealm = async () => {
        await openDungeonGuide(page);
        expect(await page.locator('#dungeon-type-select option[value="umbral_nexus"]').count()).toBe(0);
        await page.locator('#btn-enter-dark-realm').click();
        await expect.poll(() => page.evaluate(() => ({ instance: window.game.currentInstanceId,
            scene: window.game.currentInstanceType, rooms: window.game.currentDungeonLayout?.rooms?.length,
            x: Math.round(window.game.player.position.x), z: Math.round(window.game.player.position.z) })))
            .toEqual({ instance: 'dark-realm', scene: 'dark_realm', rooms: 5, x: 40000, z: 40800 });
    };
    const openCampIlyra = async () => {
        await walkInvestigationWaypoints(page, [[40009, 40800]]);
        // Cross a periodic legacy-cleanup tick. Previously it evicted the
        // valid expedition projection after the server spawned her.
        const frame = await page.evaluate(() => window.game.frameCount);
        await page.waitForFunction(frame => window.game.frameCount >= frame + 65, frame);
        expect(await page.evaluate(() => window.game.activeEntitiesCache.some(entity => entity.id === 'story-wizard-dark-realm'))).toBe(true);
        let point;
        await expect.poll(async () => {
            point = await projectEntity(page, 'story-wizard-dark-realm');
            if (!point?.visible) return false;
            await page.mouse.move(point.x, point.y);
            return page.evaluate(() => window.game.hoveredEntity?.id === 'story-wizard-dark-realm');
        }).toBe(true).catch(async error => {
            await page.screenshot({ path: testInfo.outputPath('camp-ilyra-failure.png') });
            console.log('[dark-expedition-camp]', JSON.stringify(await page.evaluate(() => {
                const game = window.game, npc = game.remotePlayers.get('story-wizard-dark-realm');
                return { player: game.player.position.toArray(), npc: npc?.position.toArray(),
                    mesh: Boolean(npc?.mesh), active: npc?.isActive, hovered: game.hoveredEntity?.id };
            })));
            throw error;
        });
        await page.mouse.click(point.x, point.y);
        await expect(page.locator('#quest-window')).toBeVisible();
    };
    const readQuest = () => page.evaluate(id => window.game.player.quests.find(q => q.id === id), chapter.id);
    await enterRealm();
    await walkInvestigationWaypoints(page, [[39992, 40800]]);
    let maelin;
    await expect.poll(async () => {
        maelin = await projectEntity(page, 'dark-witness-maelin');
        if (!maelin?.visible) return false;
        await page.mouse.move(maelin.x, maelin.y);
        return page.evaluate(() => window.game.hoveredEntity?.id === 'dark-witness-maelin');
    }).toBe(true);
    await page.mouse.click(maelin.x, maelin.y);
    await expect(page.locator('#quest-window')).toBeVisible();
    await expect(page.locator('#quest-list')).toContainText('How does the foothold keep us safe?');
    await expect(page.locator('#quest-list details')).toHaveCount(1);
    expect((await readQuest()).accepted).toBe(false);
    await page.locator('#quest-list summary').click();
    await expect(page.locator('#quest-list')).toContainText('Recall will take you to Lanternhold');
    await page.screenshot({ path: testInfo.outputPath('camp-maelin-conversation.png') });
    await page.locator('#btn-close-quest').click();
    await openCampIlyra();
    expect((await readQuest()).accepted).toBe(false);
    await page.locator('#quest-window').getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readQuest()).accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    await page.keyboard.press('m');
    await expect(page.locator('#world-map')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('expedition-map.png') });
    await page.keyboard.press('m');
    const routes = [
        [[40000, 40710], [40000, 40640], [39860, 40640], [39860, 40543], [39900, 40543]],
        [[39955, 40520], [40090, 40523]],
        [[40140, 40520], [40140, 40363], [40130, 40363]]
    ];
    for (const [i, site] of chapter.sites.entries()) {
        await walkInvestigationWaypoints(page, routes[i], { beforeTravel });
        await beforeTravel(await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z })));
        await page.keyboard.press('e');
        const record = page.locator(`#journal-list details[data-discovery-id="${site.id}"]`);
        await expect(record).toHaveAttribute('open', '');
        await expect(record).toContainText(site.text);
        await expect.poll(async () => (await readQuest()).count).toBe(i + 1);
        expect((await readQuest()).completed).toBe(false);
        await page.screenshot({ path: testInfo.outputPath(`${site.id}.png`) });
        await page.locator('#btn-close-journal').click();
        console.log(`[dark-expedition] recorded ${site.id} through ordinary travel and E inspection`);
    }
    await returnToTown(page, { allowRespawn: false });
    await enterRealm();
    await openCampIlyra();
    const before = await readQuest();
    const gold = await page.evaluate(() => window.game.player.gold);
    expect(before.investigationMask).toBe(7);
    expect(before.completed).toBe(false);
    await page.locator('#quest-window').getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(async () => (await readQuest()).completed).toBe(true);
    await expect(page.locator('#quest-window .quest-dialogue__speech')).toHaveText(chapter.completion);
    await expect.poll(() => page.evaluate(() => window.game.player.gold)).toBe(gold + before.rewardGold);
    const claimed = await readQuest();
    expect(claimed.grantedXP || 0).toBe(0);
    expect(claimed.grantedResonanceXP).toBe(before.rewardXP);
    await loginAndEnterWorld(page, credentials);
    await expect.poll(() => page.evaluate(() => window.game.currentInstanceId)).toBe('dark-realm');
    const saved = await readQuest();
    expect(saved).toMatchObject({ completed: true, count: 3, investigationMask: 7,
        grantedGold: before.rewardGold, grantedResonanceXP: before.rewardXP });
    expect(await page.evaluate(() => window.game.player.gold)).toBe(gold + before.rewardGold);
    await returnToTown(page, { allowRespawn: false });
    console.log('[dark-expedition] shared entry, three discoveries, manual camp reward, saved reconnect and Recall passed; prepared prerequisites are not earned campaign evidence');
    expect(failures, failures.join('\n')).toEqual([]);
});
