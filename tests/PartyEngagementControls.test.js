import { recordPartyOutgoingDamage, partyTankHasEngaged } from './partyEngagementControls.js';

function evidence() { return { damageDone: 0, damageByTarget: {} }; }

test('DPS waits for damage to this enemy, not movement, a cast acknowledgement or another enemy', () => {
    const tank = evidence();
    expect(partyTankHasEngaged(tank, 'pack-two')).toBe(false);
    recordPartyOutgoingDamage(tank, { sourceId: 'tank', targetId: 'pack-one', amount: 80 }, 'tank');
    expect(partyTankHasEngaged(tank, 'pack-two')).toBe(false);
    recordPartyOutgoingDamage(tank, { sourceId: 'tank', targetId: 'pack-two', amount: 30 }, 'tank');
    expect(partyTankHasEngaged(tank, 'pack-two')).toBe(true);
    recordPartyOutgoingDamage(tank, { sourceId: 'tank', targetId: 'pack-two', amount: 20 }, 'tank');
    expect(tank).toEqual({ damageDone: 130, damageByTarget: { 'pack-one': 80, 'pack-two': 50 } });
});

test.each([
    { sourceId: 'rogue', targetId: 'enemy', amount: 80 },
    { sourceId: 'tank', targetId: 'enemy', amount: 0 },
    { sourceId: 'tank', targetId: 'enemy', amount: -10 },
    { sourceId: 'tank', targetId: 'enemy', amount: NaN },
    { sourceId: 'tank', targetId: 'enemy', amount: Infinity },
    { sourceId: 'tank', targetId: '', amount: 10 },
    { sourceId: 'tank', skillName: 'Iron Fortress', accepted: true }
])('only positive damage from the tank establishes its opener: %j', message => {
    const tank = evidence();
    recordPartyOutgoingDamage(tank, message, 'tank');
    expect(partyTankHasEngaged(tank, 'enemy')).toBe(false);
    expect(tank.damageDone).toBe(0);
});
