import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { partyDungeonCharacter, requireIsolatedPartyFixture } from '../partyDungeonFixture.js';
import { seedActor } from './geared-party-route.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, projectEntity } from './helpers.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const arenaState = page => page.evaluate(() => window.game.uiManager.pvp.state);
const openArena = async page => {
    if (!await page.locator('#pvp-window').isVisible()) await page.locator('#btn-menu-pvp').click();
    await expect(page.locator('#pvp-window')).toBeVisible();
};

// Complements the accepted four-socket result/restart tests with actual client
// inputs, rendered team combat and personal result screens. No forced deaths,
// combat grants, direct game messages or simulated match/score updates.
test('two real parties play ranked rounds and see their personal results', async ({ page, browser, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_ARENA_TEAM_RENDER !== '1', 'Explicit disposable arena visual review');
    test.setTimeout(600000);
    requireIsolatedPartyFixture({ ...process.env, EIDOLON_E2E_PARTY_DUNGEON: '1' });
    const output = execFileSync('go', ['test', './internal/game', '-run', '^TestPartyBrowserFixtureCatalog$', '-count=1', '-v'], {
        cwd: 'server', env: { ...process.env, EIDOLON_PARTY_FIXTURE_CATALOG: '1', EIDOLON_PARTY_FIXTURE_LEVEL: '30',
            EIDOLON_E2E_PARTY_GEAR: 'progressed' }, encoding: 'utf8', timeout: 120000
    });
    const line = output.split('\n').find(line => line.startsWith('[party-fixture-catalog]'));
    if (!line) throw new Error('Missing ordinary gear catalog');
    const catalog = JSON.parse(line.slice('[party-fixture-catalog]'.length));
    const base = credentialsFromEnvironment(), actors = [], ownedBrowsers = [];
    try {
        for (let index = 0; index < 4; index++) {
            let actorPage = page;
            if (index) {
                const extra = await browser.browserType().launch({ executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
                    headless: true, args: hardwareWebGLBrowserArgs() });
                ownedBrowsers.push(extra);
                actorPage = await (await extra.newContext({ baseURL, viewport: { width: 1280, height: 720 } })).newPage();
            }
            actorPage.setDefaultTimeout(20000);
            actorPage.setDefaultNavigationTimeout(30000);
            const login = { ...base, username: `${base.username}-arena-${index}`, characterClass: 'Wizard' };
            const actor = { page: actorPage, login, failures: collectBrowserFailures(actorPage, baseURL) };
            actors.push(actor);
            const character = partyDungeonCharacter(catalog, [], 'Wizard', login.username, 'progressed');
            for (const [slot, item] of Object.entries(character.equipment)) item.id = `arena-${index}-${slot}`;
            await seedActor(actorPage, login, character);
            await actorPage.keyboard.press('Escape');
            await actorPage.locator('#btn-settings').click();
            await actorPage.locator('#graphics-quality').selectOption('low');
            await actorPage.locator('#btn-close-settings').click();
            if (await actorPage.locator('#esc-menu').isVisible()) await actorPage.locator('#btn-resume').click();
            actor.id = await actorPage.evaluate(() => window.game.player.id);
            await actorPage.evaluate(() => {
                const game = window.game, original = game.handleServerMessage.bind(game);
                window.__teamArena = { hits: 0, rounds: [], completed: null };
                game.handleServerMessage = message => {
                    const evidence = window.__teamArena, match = message.type === 'pvp_update' && message.payload?.match;
                    if (match) {
                        if (!evidence.rounds.includes(match.round)) evidence.rounds.push(match.round);
                        if (match.status === 'complete') evidence.completed = structuredClone(match);
                    }
                    if (message.type === 'damage' && message.payload?.sourceId === game.player.id && message.payload.amount > 0) evidence.hits++;
                    return original(message);
                };
            });
        }
        for (const leader of [0, 2]) {
            const a = actors[leader].page, b = actors[leader + 1].page;
            await a.locator('body').press('o');
            await a.locator('#party-invite-input').fill(actors[leader + 1].login.username);
            await a.locator('#btn-invite-party').click();
            await expect(b.locator('#party-request-modal')).toBeVisible();
            await b.locator('#btn-accept-party').click();
            await expect.poll(() => a.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(2);
            await a.locator('body').press('Escape');
            await openArena(a);
            await a.getByRole('button', { name: 'Queue 2v2 Party', exact: true }).click();
            if (leader === 0) await expect.poll(async () => (await arenaState(a)).queued).toBe(2);
            await a.getByRole('button', { name: 'Close PvP window', exact: true }).click();
        }
        for (const actor of actors) await expect.poll(async () => (await arenaState(actor.page)).match?.mode).toBe('arena_2v2');
        const initial = (await arenaState(page)).match;
        expect(initial.practice).toBe(false);
        expect(initial.firstTo).toBe(2);
        for (const actor of actors) {
            expect((await arenaState(actor.page)).match.id).toBe(initial.id);
            await expect.poll(() => actor.page.evaluate(() => window.game.currentInstanceType)).toBe('pvp_arena');
        }
        for (const pair of [[actors[0].id, actors[1].id], [actors[2].id, actors[3].id]]) {
            expect([initial.teamA, initial.teamB].some(team => pair.every(id => team.includes(id)))).toBe(true);
        }
        let capturedCombat = false;
        const deadline = Date.now() + 240000;
        while (Date.now() < deadline) {
            const states = await Promise.all(actors.map(actor => arenaState(actor.page)));
            const receipts = await Promise.all(actors.map(actor => actor.page.evaluate(() => window.__teamArena)));
            if (receipts.every(receipt => receipt.completed)) break;
            for (const [index, actor] of actors.entries()) {
                const state = states[index], match = state.match;
                if (!match || match.status !== 'active' || match.roundPending || match.eliminated?.includes(actor.id)) continue;
                const target = await actor.page.evaluate(opponents => {
                    const game = window.game;
                    return opponents.map(id => game.remotePlayers.get(id)).filter(enemy => enemy?.state !== 'DEAD' && enemy?.stats.hp > 0)
                        .sort((a, b) => a.position.distanceToSquared(game.player.position) - b.position.distanceToSquared(game.player.position))[0]?.id;
                }, state.opponents || []);
                if (!target) continue;
                const key = `${match.round}:${target}`;
                if (actor.target === key && Date.now() - actor.lastInput < 10000) continue;
                const point = await projectEntity(actor.page, target);
                if (!point?.visible) continue;
                await actor.page.mouse.click(point.x, point.y);
                actor.target = key; actor.lastInput = Date.now();
            }
            if (!capturedCombat && receipts.every(receipt => receipt.hits > 0) && states[0].match?.status === 'active'
                && !states[0].match.roundPending && !states[0].match.eliminated?.includes(actors[0].id)) {
                await page.screenshot({ path: testInfo.outputPath('ranked-team-combat-low.png') });
                await openArena(page);
                await page.locator('#pvp-window').screenshot({ path: testInfo.outputPath('ranked-team-round.png') });
                await page.getByRole('button', { name: 'Close PvP window', exact: true }).click();
                capturedCombat = true;
            }
            await page.waitForTimeout(350);
        }
        expect(capturedCombat, 'All four players must contribute actual combat').toBe(true);
        let wins = 0;
        for (const [index, actor] of actors.entries()) {
            const evidence = await actor.page.evaluate(() => window.__teamArena);
            expect(evidence.hits).toBeGreaterThan(0);
            expect(evidence.completed?.id).toBe(initial.id);
            expect(Math.max(evidence.completed.scoreA, evidence.completed.scoreB)).toBe(2);
            expect(evidence.rounds.length).toBeGreaterThanOrEqual(2);
            await expect.poll(() => actor.page.evaluate(() => window.game.currentInstanceId || '')).toBe('');
            await openArena(actor.page);
            await expect.poll(async () => (await arenaState(actor.page)).profile?.lastResult?.matchId).toBe(initial.id);
            const profile = (await arenaState(actor.page)).profile;
            expect(profile.lastResult.forfeit).toBe(false);
            expect(profile.lastResult.won).toBe(evidence.completed.winnerIds.includes(actor.id));
            wins += Number(profile.lastResult.won);
            await expect(actor.page.locator('.pvp-card--result')).toContainText(profile.lastResult.won ? 'Victory' : 'Defeat');
            await actor.page.locator('#pvp-window').screenshot({ path: testInfo.outputPath(`ranked-personal-result-${index}.png`) });
            // Retain existing extensive settlement/restart tests; one ordinary
            // re-login here checks the same rendered personal result survives.
            await loginAndEnterWorld(actor.page, actor.login);
            await openArena(actor.page);
            await expect.poll(async () => (await arenaState(actor.page)).profile?.lastResult).toEqual(profile.lastResult);
            expect(actor.failures, `Arena client ${index}`).toEqual([]);
            console.log('[arena-render-result]', JSON.stringify({ player: index, hits: evidence.hits,
                rounds: evidence.rounds, won: profile.lastResult.won, rating: profile.rating, honor: profile.honor }));
        }
        expect(wins).toBe(2);
    } catch (error) {
        for (const [index, actor] of actors.entries()) {
            const diagnostic = await actor.page.evaluate(() => {
                const game = window.game, player = game?.player;
                if (!player) return { inWorld: false };
                const evidence = window.__teamArena;
                return { inWorld: true, position: player.position.toArray(), state: player.state,
                    hp: player.stats.hp, instanceType: game.currentInstanceType,
                    match: game.uiManager.pvp.state.match, hits: evidence?.hits, rounds: evidence?.rounds };
            }).catch(() => ({ inWorld: false }));
            await testInfo.attach(`arena-client-${index}-diagnostic`, { body: JSON.stringify(diagnostic), contentType: 'application/json' });
            if (diagnostic.inWorld) await actor.page.screenshot({ path: testInfo.outputPath(`arena-client-${index}-failure.png`) }).catch(() => {});
        }
        throw error;
    } finally {
        await Promise.all(ownedBrowsers.map(owned => owned.close()));
    }
});
