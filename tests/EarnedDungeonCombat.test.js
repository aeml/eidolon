import { jest } from '@jest/globals';

const createBase = jest.fn(), projectGround = jest.fn();
jest.unstable_mockModule('./e2e/earned-class-combat.js', () => ({ createEarnedClassCombat: createBase }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ projectGroundOffset: projectGround }));
const { createEarnedDungeonCombat } = await import('./e2e/earned-dungeon-combat.js');
let page, defend, state;
beforeEach(() => {
    jest.resetAllMocks();
    state = { className: 'Rogue', healthRatio: 1, targetValid: true, distance: 8, attackRange: 16,
        mana: 30, skillCosts: { 'Poison Coating': 30 }, hotbar: [null, 'Poison Coating'],
        unlockedSkills: ['Poison Coating'], cooldowns: {}, sinceCastMs: 1000 };
    defend = jest.fn().mockResolvedValue(false); createBase.mockResolvedValue(defend);
    page = { evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValue(state),
        mouse: { move: jest.fn() }, keyboard: { press: jest.fn() }, waitForTimeout: jest.fn() };
    projectGround.mockResolvedValue({ canvas: true, x: 100, y: 200 });
});
afterEach(() => {
    jest.restoreAllMocks(); delete window.game; delete window.__earnedDungeonCasts;
});
test.each(['Wizard', 'Fighter'])('%s keeps exactly its previous driver and observers', async className => {
    expect(await createEarnedDungeonCombat(page, className)).toBe(defend);
    expect(createBase).toHaveBeenCalledWith(page, className);
    expect(page.evaluate).not.toHaveBeenCalled();
});
test.each(['Rogue', 'Cleric'])('%s gives immediate defense/healing priority over support casting', async className => {
    defend.mockResolvedValue(true);
    const driver = await createEarnedDungeonCombat(page, className);
    expect(await driver(page, { id: 'hostile' })).toBe(true);
    expect(defend).toHaveBeenCalledWith(page, { id: 'hostile' });
    expect(page.evaluate).toHaveBeenCalledTimes(1); // Observer installation only.
    expect(page.keyboard.press).not.toHaveBeenCalled();
});
test.each(['Rogue', 'Cleric'])('%s uses ordinary self-aimed input, preserving state and throttling attempts', async className => {
    const skill = className === 'Rogue' ? 'Poison Coating' : 'Guardian Embrace';
    Object.assign(state, { className, healthRatio: .75, skillCosts: { [skill]: 30 },
        hotbar: [null, skill], unlockedSkills: [skill] });
    const before = JSON.stringify(state), now = jest.spyOn(Date, 'now').mockReturnValue(10_000);
    const driver = await createEarnedDungeonCombat(page, className);
    expect(await driver(page, { id: 'hostile' })).toBe(true);
    expect(page.evaluate).toHaveBeenLastCalledWith(expect.any(Function), 'hostile');
    expect(projectGround).toHaveBeenCalledWith(page, 0, 0);
    expect(page.mouse.move).toHaveBeenCalledWith(100, 200);
    expect(page.keyboard.press).toHaveBeenCalledWith('2');
    expect(await driver(page, { id: 'hostile' })).toBe(false);
    expect(page.keyboard.press).toHaveBeenCalledTimes(1);
    now.mockReturnValue(11_001);
    expect(await driver(page, { id: 'hostile' })).toBe(true);
    expect(page.keyboard.press).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(state)).toBe(before);
});
test('missing canvas projection does not invent a successful input', async () => {
    projectGround.mockResolvedValue(null);
    const driver = await createEarnedDungeonCombat(page, 'Rogue');
    expect(await driver(page, { id: 'hostile' })).toBe(false);
    expect(page.keyboard.press).not.toHaveBeenCalled();
});
test('unavailable support leaves ordinary combat in control', async () => {
    state.mana = 0;
    const driver = await createEarnedDungeonCombat(page, 'Rogue');
    expect(await driver(page, { id: 'hostile' })).toBe(false);
    expect(projectGround).not.toHaveBeenCalled();
    expect(page.keyboard.press).not.toHaveBeenCalled();
});
test('the observer preserves server messages and resets without double-counting after reinstall', async () => {
    const original = jest.fn(); window.game = { handleServerMessage: original };
    page.evaluate.mockImplementation(callback => callback());
    await createEarnedDungeonCombat(page, 'Cleric');
    await createEarnedDungeonCombat(page, 'Cleric');
    const accepted = { type: 'ability_result', payload: { skillName: 'Healing Light', accepted: true } };
    const rejected = { type: 'ability_result', payload: { skillName: 'Guardian Embrace', accepted: false } };
    const unrelated = { type: 'state', payload: {} };
    for (const message of [accepted, rejected, unrelated]) window.game.handleServerMessage(message);
    expect(window.__earnedDungeonCasts.accepted).toEqual({ 'Healing Light': 1 });
    expect(window.__earnedDungeonCasts.rejected).toEqual({ 'Guardian Embrace': 1 });
    expect(window.__earnedDungeonCasts.lastAcceptedAt).toBeGreaterThan(0);
    expect(original.mock.calls).toEqual([[accepted], [rejected], [unrelated]]);
});
