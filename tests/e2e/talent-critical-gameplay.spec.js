import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    findOverworldTarget, loginAndEnterWorld, moveByGroundClick, projectEntity,
    returnToTown, useCombatQAWaypoint
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('ordinary critical-talent purchases persist and retain real targeted combat', async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable character QA');
    const credentials = credentialsFromEnvironment();
    const className = process.env.EIDOLON_E2E_CLASS;
    const config = {
        Rogue: { skill: 'Piercing Throw', talents: [['ROG_02', 'Piercing Throw - Technique'], ['ROG_32', 'Needle Precision']] },
        Wizard: { skill: 'Fireball', talents: [['WIZ_39', 'Sigil Mastery']] },
        Fighter: { skill: 'Charge', talents: [['FTR_39', 'Battlefield Awareness']] }
    }[className];
    expect(config, 'route must select a class with critical training').toBeDefined();
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    // Prepared functional level only: all talent purchases and combat below
    // use ordinary controls. This is not an earned-progression measurement.
    await ensureDungeonReadyLevel(page);

    async function installObserver() {
        await page.evaluate(({ skill, ids }) => {
            const game = window.game;
            window.__criticalQA = { ranks: Object.fromEntries(ids.map(id => [id, game.player.talentRanks?.[id] || 0])),
                results: [], hits: [], requests: [], targetId: null };
            const handle = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const qa = window.__criticalQA;
                const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
                for (const state of Object.values(states || {})) {
                    if (state.id !== game.player.id || !state.talentRanks) continue;
                    for (const id of ids) if (state.talentRanks[id] !== undefined) qa.ranks[id] = state.talentRanks[id];
                }
                if (message.type === 'ability_result' && message.payload?.skillName === skill) qa.results.push(message.payload);
                if (message.type === 'damage' && message.payload?.sourceId === game.player.id && message.payload?.targetId === qa.targetId) {
                    qa.hits.push({ amount: message.payload.amount, kind: message.payload.kind });
                }
                return handle(message);
            };
            const send = game.network.send.bind(game.network);
            game.network.send = (kind, payload) => {
                if (kind === 'ability' && payload?.skillName === skill) {
                    window.__criticalQA.requests.push({ selectedTarget: payload.targetId === window.__criticalQA.targetId });
                }
                return send(kind, payload);
            };
        }, { skill: config.skill, ids: config.talents.map(([id]) => id) });
    }

    async function verifyCombat(label) {
        await returnToTown(page);
        await useCombatQAWaypoint(page);
        const target = await findOverworldTarget(page);
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
            const offset = await page.evaluate(id => {
                const enemy = window.game.remotePlayers.get(id), player = window.game.player;
                if (!enemy?.isActive || enemy.state === 'DEAD') return null;
                return { x: enemy.position.x - player.position.x, z: enemy.position.z - player.position.z };
            }, target.id);
            expect(offset, 'selected real enemy must remain alive').not.toBeNull();
            const distance = Math.hypot(offset.x, offset.z);
            if (distance < 7) break;
            const scale = Math.min(8, distance - 5) / distance;
            await moveByGroundClick(page, offset.x * scale, offset.z * scale, { allowJumpFallback: false });
        }
        await expect.poll(() => page.evaluate(skill => window.game.player.cooldowns?.[skill] || 0, config.skill)).toBe(0);
        expect(await page.evaluate(() => window.game.player.abilityName)).toBe(config.skill);
        await page.evaluate(id => Object.assign(window.__criticalQA, { results: [], hits: [], requests: [], targetId: id }), target.id);
        let aim;
        await expect.poll(async () => {
            aim = await projectEntity(page, target.id);
            if (!aim?.visible) return false;
            await page.mouse.move(aim.x, aim.y);
            return page.evaluate(id => window.game.hoveredEntity?.id === id &&
                window.game.hoveredEntity.position.distanceTo(window.game.player.position) < 9, target.id);
        }).toBe(true);
        // These are the class primary abilities, not specialization slots.
        await page.mouse.click(aim.x, aim.y, { button: 'right' });
        await expect.poll(() => page.evaluate(() => window.__criticalQA.results.length)).toBe(1);
        const result = await page.evaluate(() => window.__criticalQA.results[0]);
        expect(result.accepted).toBe(true);
        expect(Number.isFinite(result.cooldownRemaining)).toBe(true);
        expect(result.cooldownRemaining).toBeGreaterThan(0);
        expect(await page.evaluate(() => window.__criticalQA.requests)).toEqual([{ selectedTarget: true }]);
        await expect.poll(() => page.evaluate(() => window.__criticalQA.hits.some(hit => hit.amount > 0))).toBe(true);
        console.log(`[critical-gameplay] ${className} ${label}: accepted ${config.skill}, selected enemy damage and normal cooldown`,
            await page.evaluate(() => ({ hits: window.__criticalQA.hits, ranks: window.__criticalQA.ranks })));
    }

    await installObserver();
    await verifyCombat('before purchase');
    await returnToTown(page);
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Talents', exact: true }).click();
    for (const [id, name] of config.talents) {
        const initial = await page.evaluate(id => window.__criticalQA.ranks[id], id);
        for (let rank = initial + 1; rank <= 5; rank++) {
            const node = skills.locator('.skill-node').filter({ has: page.locator('.skill-node-title', { hasText: name }) });
            await expect(node).toHaveCount(1);
            await node.scrollIntoViewIfNeeded();
            await node.click();
            await expect.poll(() => page.evaluate(id => window.__criticalQA.ranks[id], id)).toBe(rank);
        }
    }
    await page.locator('#btn-close-skills').click();
    await verifyCombat('trained');
    await returnToTown(page);
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    for (const [id] of config.talents) {
        await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id], id)).toBe(5);
    }
    await installObserver();
    await verifyCombat('fresh login');
    expect(failures, failures.join('\n')).toEqual([]);
    // Deterministic Go casts prove critical thresholds and multiplier math.
    // These browser hits prove real controls, accepted casts and persistence,
    // not a statistical critical-rate claim from three attacks.
});
