import { jest } from '@jest/globals';
import { attackPartyDamageTarget, observePartyWarning, selectPartyDamageBuff } from './partyDamageRoleControls.js';

const wizard = { className: 'Wizard', distance: 15, range: 20, mana: 100, healthRatio: .8,
    sinceCastMs: 600, hotbar: ['Teleport', 'Arcane Shield'], unlockedSkills: ['Arcane Shield'],
    costs: { 'Arcane Shield': 40 }, cooldowns: {} };
test('injured Wizard selects a real equipped shield key', () => {
    expect(selectPartyDamageBuff(wizard)).toEqual({ skill: 'Arcane Shield', key: '2' });
});
test.each([
    { dead: true }, { distance: 21 }, { distance: NaN }, { mana: 39 }, { mana: NaN },
    { sinceCastMs: 100 }, { healthRatio: 1 }, { shieldActive: true }, { hotbar: [] },
    { unlockedSkills: [] }, { cooldowns: { 'Arcane Shield': 1 } }, { costs: {} },
    { hotbar: ['a', 'b', 'c', 'd', 'Arcane Shield'] }
])('unavailable shield produces no input: %j', unavailable => {
    expect(selectPartyDamageBuff({ ...wizard, ...unavailable })).toBeNull();
});
const rogue = { ...wizard, className: 'Rogue', healthRatio: 1,
    hotbar: ['Smoke Bomb', 'Poison Coating'], unlockedSkills: ['Poison Coating'], costs: { 'Poison Coating': 30 } };
test('Rogue uses equipped Poison Coating without requiring missing health', () => {
    expect(selectPartyDamageBuff(rogue)).toEqual({ skill: 'Poison Coating', key: '2' });
});
test.each([{ poisonActive: true }, { mana: 29 }, { cooldowns: { 'Poison Coating': 1 } }])('Rogue preserves active/cooling/unaffordable coating: %j', unavailable => {
    expect(selectPartyDamageBuff({ ...rogue, ...unavailable })).toBeNull();
});
const warning = { x: 0, z: 0, radius: 12.5, expires: 2000 };
test('already-safe actors are not credited with an escape', () => {
    expect(observePartyWarning(warning, { x: 15, z: 0 }, 500).firstSafeAt).toBeNull();
});
test('early escape is recorded once, while re-entry remains visible', () => {
    const inside = observePartyWarning(warning, { x: 5, z: 0 }, 500);
    const escaped = observePartyWarning(inside, { x: 15, z: 0 }, 1000);
    expect(escaped.firstSafeAt).toBe(1000);
    expect(observePartyWarning(escaped, { x: 16, z: 0 }, 1200).firstSafeAt).toBe(1000);
    expect(observePartyWarning(escaped, { x: 5, z: 0 }, 1900)).toMatchObject({ firstSafeAt: 1000, safe: false, lastObservedAt: 1900 });
});
test.each([2000, 2500])('escape at or after impact is not timely: %s', now => {
    const inside = observePartyWarning(warning, { x: 5, z: 0 }, 500);
    expect(observePartyWarning(inside, { x: 15, z: 0 }, now)).toMatchObject({ firstSafeAt: null, safe: true });
});

function damageInput(overrides = {}) {
    return {
        project: jest.fn(async () => ({ visible: true, x: 100, y: 200 })),
        move: jest.fn(async () => {}), settle: jest.fn(async () => {}),
        hoveredId: jest.fn(async () => 'boss'),
        read: jest.fn(async () => ({ alive: true, distance: 18, range: 24, cooldown: 0,
            allowCasts: true, allowApproach: true })),
        click: jest.fn(async () => {}), ...overrides
    };
}
test('damage inputs require witnessed hover and fresh range before each ordinary click', async () => {
    const input = damageInput();
    expect(await attackPartyDamageTarget(input, 'boss')).toEqual(['left', 'right']);
    expect(input.click.mock.calls).toEqual([['left'], ['right']]);
    expect(input.read).toHaveBeenCalledTimes(2);
    expect(input.hoveredId).toHaveBeenCalledTimes(2);
});
test('a visible projected boss covered by another entity never receives a blind click', async () => {
    const input = damageInput({ hoveredId: jest.fn(async () => 'ally') });
    expect(await attackPartyDamageTarget(input, 'boss')).toEqual([]);
    expect(input.project).toHaveBeenCalledTimes(6);
    expect(input.click).not.toHaveBeenCalled();
});
test('a side of the actual hitbox can be acquired after its center is covered', async () => {
    const input = damageInput({ hoveredId: jest.fn().mockResolvedValueOnce('ally').mockResolvedValue('boss') });
    expect(await attackPartyDamageTarget(input, 'boss')).toEqual(['left', 'right']);
    expect(input.project.mock.calls[1][1]).toEqual({ x: .5, y: .85, z: .5 });
});
test.each([
    { alive: false }, { allowCasts: false }, { distance: NaN }, { range: NaN }
])('invalid or newly unsafe combat state suppresses input: %j', state => {
    const input = damageInput({ read: jest.fn(async () => ({ alive: true, distance: 18, range: 24,
        cooldown: 0, allowCasts: true, allowApproach: true, ...state })) });
    return attackPartyDamageTarget(input, 'boss').then(result => {
        expect(result).toEqual([]);
        expect(input.click).not.toHaveBeenCalled();
    });
});
test('a safe player during a warning casts but never starts basic-attack pursuit', async () => {
    const input = damageInput({ read: jest.fn(async () => ({ alive: true, distance: 18, range: 24,
        cooldown: 0, allowCasts: true, allowApproach: false })) });
    expect(await attackPartyDamageTarget(input, 'boss')).toEqual(['right']);
});
test.each([{ distance: 25 }, { cooldown: 1 }, { alive: false }, { allowCasts: false }])(
    'state changes after a left click suppress the primary cast: %j', state => {
        const input = damageInput();
        input.read.mockResolvedValueOnce({ alive: true, distance: 18, range: 24, cooldown: 0,
            allowCasts: true, allowApproach: true }).mockResolvedValue({ alive: true,
            distance: 18, range: 24, cooldown: 0, allowCasts: true, allowApproach: true, ...state });
        return expect(attackPartyDamageTarget(input, 'boss')).resolves.toEqual(['left']);
    });
test('losing hover after the first input cannot cast at the covering entity', async () => {
    const input = damageInput({ hoveredId: jest.fn().mockResolvedValueOnce('boss').mockResolvedValue('ally') });
    expect(await attackPartyDamageTarget(input, 'boss')).toEqual(['left']);
});
test('projection errors fail the route rather than being recorded as a successful attack', async () => {
    const input = damageInput({ project: jest.fn(async () => { throw new Error('projection failed'); }) });
    await expect(attackPartyDamageTarget(input, 'boss')).rejects.toThrow('projection failed');
    expect(input.click).not.toHaveBeenCalled();
});
