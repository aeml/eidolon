import { partyAuraFollowSpacing, selectPartyHealTarget } from './partyHealingControls.js';

const member = (id, hp, x, extra = {}) => ({ id, hp, maxHP: 855, x, z: 0, instance: 'party-dungeon', dead: false, ...extra });
const healer = member('healer', 845, 0, { maxHP: 845 });

test('heal the injured reachable tank instead of chasing a lower-health distant Rogue', () => {
    // Reproduces the selection defect, not a replay of an entire native tick:
    // the failed Matron trace had a distant critical Rogue and ready healing.
    const tank = member('tank', 301, 10), rogue = member('rogue', 66, 28);
    expect(selectPartyHealTarget([tank, healer, rogue], healer, 14)).toBe(tank);
});

test('self-healing is useful while the lowest-health teammate is out of range', () => {
    const injuredHealer = { ...healer, hp: 400 };
    expect(selectPartyHealTarget([member('rogue', 20, 28), injuredHealer], injuredHealer, 14)).toBe(injuredHealer);
});

test('prioritize lowest health among reachable targets, without a fixed class bias', () => {
    const tank = member('tank', 301, 10), rogue = member('rogue', 66, 12);
    expect(selectPartyHealTarget([tank, healer, rogue], healer, 14)).toBe(rogue);
});

test('retain the most injured distant target for approach when nobody reachable needs healing', () => {
    const rogue = member('rogue', 66, 28);
    expect(selectPartyHealTarget([healer, member('tank', 400, 20), rogue], healer, 14)).toBe(rogue);
});

test.each([
    { dead: true }, { hp: 0 }, { hp: -1 }, { hp: NaN }, { maxHP: 0 }, { maxHP: NaN },
    { x: Infinity }, { instance: 'town' }, { hp: 855 }
])('exclude unavailable or healthy recipients: %j', extra => {
    expect(selectPartyHealTarget([member('invalid', 10, 1, extra)], healer, 14)).toBeNull();
});

test('range boundary is inclusive and selection does not reorder the supplied party', () => {
    const edge = member('edge', 400, 14), distant = member('distant', 20, 14.01);
    const states = [distant, edge, healer], before = [...states];
    expect(selectPartyHealTarget(states, healer, 14)).toBe(edge);
    expect(states).toEqual(before);
});

test('a dead healer cannot plan a heal', () => {
    expect(selectPartyHealTarget([member('tank', 20, 1)], { ...healer, dead: true }, 14)).toBeNull();
});

test.each([-1, NaN, Infinity])('invalid range fails explicitly: %s', range => {
    expect(() => selectPartyHealTarget([], healer, range)).toThrow('finite position');
});

const activeAura = { allowMovement: true, cooldown: 2.6367, auraActive: true, auraRadius: 10 };
test('recorded Warden cooldown gap moves the healer back inside the active aura', () => {
    const tank = member('tank', 322, 11.558409295);
    expect(partyAuraFollowSpacing(healer, tank, activeAura)).toBe(7);
    expect(partyAuraFollowSpacing(healer, tank, { ...activeAura, auraRadius: 12.5 })).toBe(9.5);
});
test.each([
    { allowMovement: false }, { cooldown: 0 }, { cooldown: .37 }, { cooldown: NaN },
    { auraActive: false }, { auraRadius: 0 }, { auraRadius: Infinity }
])('aura following never delays ready healing or ignores warnings/invalid state: %j', override => {
    expect(partyAuraFollowSpacing(healer, member('tank', 140, 11.5584), { ...activeAura, ...override })).toBeNull();
});
test.each([{ dead: true }, { hp: 0 }, { hp: NaN }, { hp: undefined }, { instance: 'town' }, { x: NaN }])('unavailable target is not an aura destination: %j', override => {
    expect(partyAuraFollowSpacing(healer, member('tank', 140, 11.5584, override), activeAura)).toBeNull();
});
test('already-covered allies and a dead healer do not get movement input', () => {
    expect(partyAuraFollowSpacing(healer, member('tank', 140, 8.9), activeAura)).toBeNull();
    expect(partyAuraFollowSpacing({ ...healer, dead: true }, member('tank', 140, 12), activeAura)).toBeNull();
});
