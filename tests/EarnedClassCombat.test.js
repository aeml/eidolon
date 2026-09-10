import { jest } from '@jest/globals';

const wizardDefense = jest.fn();
const rangedDefense = jest.fn();
const projectGround = jest.fn();
jest.unstable_mockModule('./e2e/helpers.js', () => ({ projectGroundOffset: projectGround }));
jest.unstable_mockModule('./e2e/earned-wizard-defense.js', () => ({ createEarnedWizardDefense: wizardDefense,
    createEarnedRangedDefense: rangedDefense }));
const { createEarnedClassCombat } = await import('./e2e/earned-class-combat.js');

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test('Wizard retains its existing spacing and shield driver', async () => {
    const page = {}, driver = jest.fn();
    wizardDefense.mockResolvedValue(driver);
    expect(await createEarnedClassCombat(page, 'Wizard')).toBe(driver);
    expect(wizardDefense).toHaveBeenCalledWith(page, undefined);
});

test('unsupported classes fail without installing an observer or granting anything', async () => {
    const page = { evaluate: jest.fn() };
    await expect(createEarnedClassCombat(page, 'Unknown')).rejects.toThrow('No earned combat driver');
    expect(page.evaluate).not.toHaveBeenCalled();
});

test('Rogue receives ranged movement without becoming a Wizard', async () => {
    const page = {}, driver = jest.fn();
    rangedDefense.mockResolvedValue(driver);
    expect(await createEarnedClassCombat(page, 'Rogue')).toBe(driver);
    expect(rangedDefense).toHaveBeenCalledWith(page, undefined);
    expect(wizardDefense).not.toHaveBeenCalled();
});

test.each(['Wizard', 'Rogue'])('%s receives the explicit healthy-combat strategy without changing other classes', async className => {
    const page = {}, options = { retreatBelowHealthRatio: .8 };
    await createEarnedClassCombat(page, className, options);
    expect(className === 'Wizard' ? wizardDefense : rangedDefense).toHaveBeenCalledWith(page, options);
});

test('a fresh Cleric never tries to cast a locked heal', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue({ className: 'Cleric',
        healthRatio: .1, mana: 100, healCost: 25, hotbar: [], unlockedSkills: [] }),
    keyboard: { press: jest.fn() } };
    const driver = await createEarnedClassCombat(page, 'Cleric');
    expect(await driver(page)).toBe(false);
    expect(page.keyboard.press).not.toHaveBeenCalled();
});

test('an earned Cleric heal aims at the caster and uses normal hotbar input once', async () => {
    const state = Object.freeze({ className: 'Cleric', healthRatio: .4, mana: 25,
        healCost: 25, hotbar: ['Healing Light'], unlockedSkills: ['Healing Light'], cooldowns: {} });
    const page = { evaluate: jest.fn().mockResolvedValue(state),
        mouse: { move: jest.fn() }, keyboard: { press: jest.fn() }, waitForTimeout: jest.fn() };
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
    projectGround.mockResolvedValueOnce({ x: 310, y: 245, canvas: true });
    const driver = await createEarnedClassCombat(page, 'Cleric');
    expect(await driver(page, { id: 'skeleton' })).toBe(true);
    expect(projectGround).toHaveBeenCalledWith(page, 0, 0);
    expect(page.mouse.move).toHaveBeenCalledWith(310, 245);
    expect(page.keyboard.press).toHaveBeenCalledWith('1');
    expect(await driver(page, { id: 'skeleton' })).toBe(false);
    expect(page.keyboard.press).toHaveBeenCalledTimes(1);
    expect(state.mana).toBe(25); // Input selection never changes replicated resources.
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

test.each([null, undefined, '', 'overworld'])('fresh overworld marker %s reaches melee target selection', async instanceType => {
    const reachedTarget = new Error('reached ordinary melee target selection');
    const getTarget = jest.fn(() => { throw reachedTarget; });
    window.game = { currentInstanceType: instanceType, player: { state: 'IDLE' },
        handleServerMessage: jest.fn(), remotePlayers: { get: getTarget } };
    const page = { evaluate: jest.fn((callback, argument) => callback(argument)) };
    try {
        const driver = await createEarnedClassCombat(page, 'Fighter');
        await expect(driver(page, { id: 'ordinary-skeleton' })).rejects.toBe(reachedTarget);
        expect(getTarget).toHaveBeenCalledWith('ordinary-skeleton');
    } finally {
        delete window.game;
        delete window.__freshFighterCombat;
    }
});

test('reinstalling Fighter combat starts one new evidence segment, not another counting wrapper', async () => {
    const original = jest.fn();
    window.game = { handleServerMessage: original };
    const page = { evaluate: jest.fn(callback => callback()) };
    try {
        await createEarnedClassCombat(page, 'Fighter');
        await createEarnedClassCombat(page, 'Fighter');
        const accepted = { type: 'ability_result', payload: { skillName: 'Whirlwind', accepted: true } };
        window.game.handleServerMessage(accepted);
        expect(window.__freshFighterCombat.counts.accepted).toEqual({ Whirlwind: 1 });
        expect(original).toHaveBeenCalledTimes(1);
        expect(original).toHaveBeenCalledWith(accepted);
    } finally {
        delete window.game;
        delete window.__freshFighterCombat;
    }
});

test('a real dungeon still leaves melee input to the dungeon driver', async () => {
    const getTarget = jest.fn();
    window.game = { currentInstanceType: 'verdant_bastion_catacombs', player: { state: 'IDLE' },
        handleServerMessage: jest.fn(), remotePlayers: { get: getTarget } };
    const page = { evaluate: jest.fn((callback, argument) => callback(argument)) };
    try {
        const driver = await createEarnedClassCombat(page, 'Fighter');
        expect(await driver(page, { id: 'dungeon-skeleton' })).toBe(false);
        expect(getTarget).not.toHaveBeenCalled();
    } finally {
        delete window.game;
        delete window.__freshFighterCombat;
    }
});
