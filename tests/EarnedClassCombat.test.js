import { jest } from '@jest/globals';

const wizardDefense = jest.fn();
jest.unstable_mockModule('./e2e/earned-wizard-defense.js', () => ({ createEarnedWizardDefense: wizardDefense }));
const { createEarnedClassCombat } = await import('./e2e/earned-class-combat.js');

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test('Wizard retains its existing spacing and shield driver', async () => {
    const page = {}, driver = jest.fn();
    wizardDefense.mockResolvedValue(driver);
    expect(await createEarnedClassCombat(page, 'Wizard')).toBe(driver);
    expect(wizardDefense).toHaveBeenCalledWith(page);
});

test('unsupported classes fail without installing an observer or granting anything', async () => {
    const page = { evaluate: jest.fn() };
    await expect(createEarnedClassCombat(page, 'Rogue')).rejects.toThrow('No earned combat driver');
    expect(page.evaluate).not.toHaveBeenCalled();
});

test('Fighter uses ordinary earned hotbar input and throttles attempts', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(10_000);
    const state = { classAbility: 'Charge', distance: 3, attackRange: 4, mana: 30,
        hotbar: [null, 'Whirlwind'], cooldowns: {}, skillCosts: { Whirlwind: 30 } };
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValue(state),
        keyboard: { press: jest.fn() }, waitForTimeout: jest.fn() };
    const driver = await createEarnedClassCombat(page, 'Fighter');
    expect(await driver(page, { id: 'skeleton' })).toBe(true);
    expect(page.keyboard.press).toHaveBeenCalledWith('2');
    expect(page.evaluate).toHaveBeenLastCalledWith(expect.any(Function), 'skeleton');
    expect(await driver(page, { id: 'skeleton' })).toBe(false);
    expect(page.keyboard.press).toHaveBeenCalledTimes(1);
    now.mockReturnValue(11_100);
    page.evaluate.mockResolvedValue(null); // Dungeon driver owns casts, or no valid hostile.
    expect(await driver(page, { id: 'skeleton' })).toBe(false);
});

test('observer counts actual accepted and rejected server results without changing the payload', async () => {
    const original = jest.fn();
    window.game = { handleServerMessage: original };
    const page = { evaluate: jest.fn(callback => callback()) };
    try {
        await createEarnedClassCombat(page, 'Fighter');
        const accepted = { type: 'ability_result', payload: { skillName: 'Whirlwind', accepted: true } };
        const rejected = { type: 'ability_result', payload: { skillName: 'Shield Slam', accepted: false } };
        window.game.handleServerMessage(accepted);
        window.game.handleServerMessage(rejected);
        expect(window.__freshFighterCombat.counts).toEqual({ accepted: { Whirlwind: 1 }, rejected: { 'Shield Slam': 1 } });
        expect(window.__freshFighterCombat.lastAcceptedAt).toBeGreaterThan(0);
        expect(original).toHaveBeenNthCalledWith(1, accepted);
        expect(original).toHaveBeenNthCalledWith(2, rejected);
    } finally {
        delete window.game;
        delete window.__freshFighterCombat;
    }
});
