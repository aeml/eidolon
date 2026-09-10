import { dungeonRestReason } from './dungeonRestPolicy.js';

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
