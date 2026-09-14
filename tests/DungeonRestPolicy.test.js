import { dungeonRestReason, partyDungeonRestNeeded } from './dungeonRestPolicy.js';

const resources = { hp: 1000, maxHP: 1000, mana: 1000, maxMana: 1000, castCost: 30, dead: false };
const boundary = { cleared: true, nearbyHostiles: false };

describe('ordinary dungeon expedition recovery', () => {
    test('healthy pools continue, including exactly80%', () => {
        expect(dungeonRestReason(resources, boundary)).toBeNull();
        expect(dungeonRestReason({ ...resources, hp: 800, mana: 800 }, boundary)).toBeNull();
    });
    test.each([{ mana: 799 }, { hp: 799 }, { mana: 0 }])('spent pools request town rest: %j', spent => {
        expect(dungeonRestReason({ ...resources, ...spent }, boundary)).toBe(spent.hp ? 'health' : 'mana');
    });
    test.each([
        { cleared: false, nearbyHostiles: false },
        { cleared: true, nearbyHostiles: true },
        { cleared: false, nearbyHostiles: true }
    ])('never abandons an unfinished encounter: %j', encounter => {
        expect(dungeonRestReason({ ...resources, hp: 1, mana: 0 }, encounter)).toBeNull();
    });
    test('death cannot become a free recovery stop', () => {
        expect(dungeonRestReason({ ...resources, dead: true, hp: 0 }, boundary)).toBeNull();
    });
    test('malformed observations fail rather than concealing a stale resource read', () => {
        expect(() => dungeonRestReason({ ...resources, mana: NaN }, boundary)).toThrow('Invalid collection');
    });
});

describe('four-role party recovery avoids redundant early town trips', () => {
    const party = spent => [{ ...resources, ...spent }, resources, resources, resources];
    test.each(['hp', 'mana'])('prove recovery early, then keep fighting above half %s', pool => {
        expect(partyDungeonRestNeeded(party({ [pool]: 799 }), { ...boundary, townRests: 0 })).toBe(true);
        expect(partyDungeonRestNeeded(party({ [pool]: 799 }), { ...boundary, townRests: 1 })).toBe(false);
        expect(partyDungeonRestNeeded(party({ [pool]: 500 }), { ...boundary, townRests: 2 })).toBe(false);
        expect(partyDungeonRestNeeded(party({ [pool]: 499 }), { ...boundary, townRests: 2 })).toBe(true);
    });
    test.each([{ cleared: false }, { nearbyHostiles: true }])('never abandons a live room: %j', encounter => {
        expect(partyDungeonRestNeeded(party({ mana: 1 }), { ...boundary, townRests: 1, ...encounter })).toBe(false);
    });
    test.each([{ dead: true, hp: 0 }, { mana: NaN }])('never disguises death or stale observations: %j', spent => {
        expect(() => partyDungeonRestNeeded(party(spent), { ...boundary, townRests: 1 })).toThrow();
    });
    test('invalid party or recovery counter fails explicitly', () => {
        expect(() => partyDungeonRestNeeded([], { ...boundary, townRests: 0 })).toThrow('Invalid party');
        expect(() => partyDungeonRestNeeded(party({}), { ...boundary, townRests: -1 })).toThrow('Invalid party');
    });
});
