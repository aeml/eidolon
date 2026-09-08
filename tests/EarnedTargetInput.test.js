import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { readEarnedAttackTarget, selectEarnedAttackTarget } from './e2e/earned-target-input.js';

afterEach(() => { delete window.game; });
const enemy = Object.freeze({ id: 'skeleton', health: 20, state: 'ATTACK', isActive: true });
const page = () => ({ evaluate: fn => fn(), mouse: { click: jest.fn() } });

test('retains a living selected enemy without repeated clicks or state writes', async () => {
    window.game = { pendingInteraction: enemy, isHostileActorTarget: () => true };
    const input = page();
    expect(await selectEarnedAttackTarget(input, enemy, { x: 12, y: 34 })).toBe(enemy);
    expect(input.mouse.click).not.toHaveBeenCalled();
    expect(window.game.pendingInteraction).toBe(enemy);
    expect(await readEarnedAttackTarget(input)).toEqual({ id: enemy.id });
});

test('normal input reacquires canceled selection and observes the actual overlapping hit', async () => {
    const front = Object.freeze({ ...enemy, id: 'front', secret: 'never-copied' });
    window.game = { pendingInteraction: null, isHostileActorTarget: () => true };
    const input = page();
    input.mouse.click.mockImplementation(() => { window.game.pendingInteraction = front; });
    expect(await selectEarnedAttackTarget(input, enemy, { x: 12, y: 34 })).toEqual({ id: front.id });
    expect(input.mouse.click).toHaveBeenCalledTimes(1);
    expect(input.mouse.click).toHaveBeenCalledWith(12, 34);
});

test.each([
    null, { ...enemy, state: 'DEAD' }, { ...enemy, health: 0 },
    { ...enemy, isActive: false }, { ...enemy, health: undefined, stats: { hp: 0 } }
])('does not retain unavailable targets: %j', async target => {
    window.game = { pendingInteraction: target, isHostileActorTarget: () => true };
    expect(await readEarnedAttackTarget(page())).toBeNull();
});

test('NPC selection is not considered an attack and failed clicks do not invent a hit', async () => {
    const npc = Object.freeze({ id: 'ilyra' });
    window.game = { pendingInteraction: npc, isHostileActorTarget: () => false };
    const input = page();
    expect(await readEarnedAttackTarget(input)).toBeNull();
    expect(await selectEarnedAttackTarget(input, enemy, { x: 12, y: 34 })).toBe(enemy);
    expect(window.game.pendingInteraction).toBe(npc);
    expect(input.mouse.click).toHaveBeenCalledTimes(1);
});

test('both uninterrupted story combat loops use ordinary retained-target input', () => {
    for (const file of ['fresh-opening-gameplay.spec.js', 'fresh-story-hunt-route.js']) {
        const source = readFileSync(new URL(`./e2e/${file}`, import.meta.url), 'utf8');
        expect(source).toContain('await selectEarnedAttackTarget(page,');
        expect(source).not.toContain('await page.mouse.click(point.x, point.y);');
    }
    const hunt = readFileSync(new URL('./e2e/fresh-story-hunt-route.js', import.meta.url), 'utf8');
    expect(hunt).toContain('observed.selected?.alive ? observed.selected : observed.goal');
    expect(hunt).toContain("expect(deaths, 'Expedition exceeded two ordinary respawns').toBeLessThanOrEqual(2)");
    expect(hunt).toContain('const deadline = Date.now() + 120_000');
    expect(hunt).toContain('enemy = await findExpeditionTarget(page, hunt, deadline)');
    expect(hunt).toContain('step < 100 && Date.now() < deadline');
    expect(hunt).toContain('toBeGreaterThan(credit)');
});
