import { observePartyWarning, selectPartyDamageBuff } from './partyDamageRoleControls.js';

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
