import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    findOverworldTarget, loginAndEnterWorld, moveByGroundClick, projectEntity,
    projectGroundOffset, returnToTown, useCombatQAWaypoint
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('hostile marks reject an empty cast and accept an actual reachable enemy', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    const className = process.env.EIDOLON_E2E_CLASS || 'Wizard';
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.skip(!['Cleric', 'Rogue'].includes(className), 'Direct hostile marks belong to Cleric and Rogue');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    const skill = className === 'Cleric' ? 'Mark of Weakness' : 'Weak Point Mark';
    const branchName = className === 'Cleric' ? 'Buff/Debuff Support' : 'Assassin Burst Path';
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    const branch = page.locator('.skill-branch').filter({ hasText: branchName });
    await expect(branch).toHaveCount(1);
    const select = branch.getByRole('button', { name: 'Select Spec' });
    if (await select.count()) await select.click();
    await expect.poll(() => page.evaluate(skill => window.game.player.hotbar.indexOf(skill), skill)).toBeGreaterThanOrEqual(0);
    const key = String(1 + await page.evaluate(skill => window.game.player.hotbar.indexOf(skill), skill));
    await page.locator('#btn-close-skills').click();
    await returnToTown(page);
    await page.evaluate(skill => {
        const game = window.game;
        const original = game.handleServerMessage.bind(game);
        window.__directCastResults = [];
        window.__directCastTargets = [];
        game.handleServerMessage = message => {
            if (message.type === 'ability_result' && message.payload?.skillName === skill) {
                window.__directCastResults.push(message.payload);
            }
            if (message.type === 'ability' && message.payload?.skillName === skill &&
                message.payload.sourceId === game.player.id) {
                window.__directCastTargets.push(message.payload.targetId);
            }
            return original(message);
        };
    }, skill);
    const empty = await projectGroundOffset(page, 7, 2);
    expect(empty?.canvas).toBe(true);
    await page.mouse.move(empty.x, empty.y);
    await page.keyboard.press(key);
    await expect.poll(() => page.evaluate(() => window.__directCastResults.length)).toBe(1);
    expect(await page.evaluate(() => window.__directCastResults[0])).toEqual(expect.objectContaining({
        accepted: false, reason: 'requirements_not_met', cooldownRemaining: 0
    }));
    expect(await page.evaluate(() => window.__directCastTargets)).toEqual([]);
    await expect.poll(() => page.evaluate(skill => window.game.player.cooldowns?.[skill] || 0, skill)).toBe(0);

    if (className === 'Rogue') {
        // Observe authoritative ranks independently of the desktop's optimistic
        // preview. Purchase only through the normal talent menu.
        await page.evaluate(() => {
            // A Playwright retry reuses the same disposable character and save.
            window.__directSavedRank = window.game.player.talentRanks?.ROG_36 || 0;
            const game = window.game, original = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
                for (const state of Object.values(states || {})) {
                    if (state.id === game.player.id && state.talentRanks?.ROG_36 !== undefined) {
                        window.__directSavedRank = state.talentRanks.ROG_36;
                    }
                }
                return original(message);
            };
        });
        await page.keyboard.press('k');
        await skills.getByRole('button', { name: 'Talents', exact: true }).click();
        const initialRank = await page.evaluate(() => window.__directSavedRank);
        for (let rank = initialRank + 1; rank <= 5; rank++) {
            const talent = skills.locator('.skill-node').filter({ has: page.locator('.skill-node-title', { hasText: 'Quick Draw' }) });
            await talent.scrollIntoViewIfNeeded(); await talent.click();
            await expect.poll(() => page.evaluate(() => window.__directSavedRank)).toBe(rank);
        }
        await page.locator('#btn-close-skills').click();
        expect(await page.evaluate(() => window.game.abilityController.getAbilityCastRange('Weak Point Mark'))).toBeCloseTo(11.5, 8);
    }

    // Protection is only incoming-damage QA setup. Selection, movement and
    // casting use ordinary controls against a normal authoritative enemy.
    await useCombatQAWaypoint(page);
    const target = await findOverworldTarget(page);
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const offset = await page.evaluate(id => {
            const game = window.game;
            const enemy = game.remotePlayers.get(id);
            if (!enemy?.isActive || enemy.state === 'DEAD') return null;
            return { x: enemy.position.x - game.player.position.x, z: enemy.position.z - game.player.position.z };
        }, target.id);
        expect(offset, 'selected ordinary enemy must remain alive').not.toBeNull();
        const distance = Math.hypot(offset.x, offset.z);
        if (distance < 6) break;
        const scale = Math.min(8, distance - 4) / distance;
        await moveByGroundClick(page, offset.x * scale, offset.z * scale, { allowJumpFallback: false });
    }
    await expect.poll(async () => {
        const aim = await projectEntity(page, target.id);
        if (!aim?.visible) return false;
        await page.mouse.move(aim.x, aim.y);
        return page.evaluate(id => window.game.hoveredEntity?.id === id &&
            window.game.hoveredEntity.position.distanceTo(window.game.player.position) < 8, target.id);
    }).toBe(true);
    await page.keyboard.press(key);
    await expect.poll(() => page.evaluate(() => window.__directCastResults.length)).toBe(2);
    const accepted = await page.evaluate(() => window.__directCastResults[1]);
    expect(accepted.accepted).toBe(true);
    expect(accepted.cooldownRemaining).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.__directCastTargets)).toEqual([target.id]);
    console.log(`[direct-target] ${className} empty rejection and authoritative enemy mark passed`);
    if (className === 'Rogue') {
        await page.evaluate(targetId => {
            window.__lungeQA = { requests: [], results: [], bleed: [], damage: [], casts: [], states: [], before: window.game.player.position.toArray() };
            const game = window.game, original = game.handleServerMessage.bind(game);
            const originalSend = game.network.send.bind(game.network);
            game.network.send = (kind, payload) => {
                if (kind === 'ability' && payload?.skillName === 'Shadow Lunge') {
                    window.__lungeQA.requests.push({ targetMatches: payload.targetId === targetId,
                        hoveredMatches: game.hoveredEntity?.id === targetId, hasTarget: Boolean(payload.targetId) });
                }
                return originalSend(kind, payload);
            };
            game.handleServerMessage = message => {
                if (message.type === 'ability_result' && message.payload?.skillName === 'Shadow Lunge') {
                    window.__lungeQA.results.push(message.payload);
                }
                if (message.type === 'damage' && message.payload?.kind === 'bleed' &&
                    message.payload.targetId === targetId && message.payload.sourceId === game.player.id) {
                    window.__lungeQA.bleed.push(message.payload);
                }
                if (message.type === 'damage') {
                    window.__lungeQA.damage.push({ kind: message.payload?.kind, amount: message.payload?.amount,
                        targetMatches: message.payload?.targetId === targetId, sourceMatches: message.payload?.sourceId === game.player.id });
                }
                if (message.type === 'ability' && message.payload?.skillName === 'Shadow Lunge') {
                    window.__lungeQA.casts.push({ targetMatches: message.payload.targetId === targetId,
                        sourceMatches: message.payload.sourceId === game.player.id });
                }
                const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
                for (const state of Object.values(states || {})) {
                    if (state.id === targetId || state.bleeding) window.__lungeQA.states.push({ targetMatches: state.id === targetId,
                        bleeding: state.bleeding, damage: state.bleedDamage, duration: state.bleedDuration, health: state.health });
                }
                return original(message);
            };
        }, target.id);
        // Respect the real global cooldown after the accepted mark.
        await page.waitForTimeout(600);
        // Enemies can cross the cursor while the previous skill resolves.
        // Reacquire the intended actor through ordinary hover before casting.
        const lungeSlot = await page.evaluate(() => window.game.player.hotbar.indexOf('Shadow Lunge'));
        expect(lungeSlot).toBeGreaterThanOrEqual(0);
        await expect.poll(async () => {
            const aim = await projectEntity(page, target.id);
            if (!aim?.visible) return false;
            await page.mouse.move(aim.x, aim.y);
            return page.evaluate(id => window.game.hoveredEntity?.id === id, target.id);
        }).toBe(true);
        await page.keyboard.press(String(lungeSlot + 1));
        await expect.poll(() => page.evaluate(() => window.__lungeQA.requests)).toEqual([
            { targetMatches: true, hoveredMatches: true, hasTarget: true }
        ]);
        await expect.poll(() => page.evaluate(() => window.__lungeQA.results.length)).toBe(1);
        expect(await page.evaluate(() => window.__lungeQA.results[0].accepted)).toBe(true);
        await expect.poll(() => page.evaluate(() => window.__lungeQA.casts)).toEqual([
            { targetMatches: true, sourceMatches: true }
        ]);
        await expect.poll(() => page.evaluate(() => {
            const p = window.game.player.position, before = window.__lungeQA.before;
            return Math.hypot(p.x - before[0], p.z - before[2]);
        })).toBeGreaterThan(.25);
        try {
            await expect.poll(() => page.evaluate(() => window.__lungeQA.bleed.some(event => event.amount > 0)), { timeout: 5000 }).toBe(true);
        } catch (error) {
            console.log('[lunge-diagnostic]', await page.evaluate(() => ({ requests: window.__lungeQA.requests, results: window.__lungeQA.results,
                casts: window.__lungeQA.casts, damage: window.__lungeQA.damage, states: window.__lungeQA.states.slice(-15) })));
            throw error;
        }
        console.log('[direct-target] trained Shadow Lunge moved the Rogue and delivered an attributed bleed tick');
    }
    await returnToTown(page);
    if (className === 'Rogue') {
        await page.reload({ waitUntil: 'networkidle' });
        await loginAndEnterWorld(page, credentials);
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.ROG_36 || 0)).toBe(5);
        expect(await page.evaluate(() => window.game.abilityController.getAbilityCastRange('Weak Point Mark'))).toBeCloseTo(11.5, 8);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
