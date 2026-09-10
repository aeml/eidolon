import { collectionRestReason, huntDisengageReason } from './collectionRestPolicy.js';

const healthy = { hp: 110, maxHP: 110, mana: 110, maxMana: 110, castCost: 30, dead: false };
test('unfinished hunts disengage below one actual cast, not while a finishing cast remains', () => {
    expect(huntDisengageReason({ ...healthy, mana: 29 })).toBe('mana');
    expect(huntDisengageReason({ ...healthy, mana: 30 })).toBeNull();
    expect(huntDisengageReason({ ...healthy, hp: 38 })).toBe('health');
    expect(huntDisengageReason({ ...healthy, hp: 39 })).toBeNull();
});
test('dead characters and impossible full-pool costs do not create endless recovery loops', () => {
    expect(huntDisengageReason({ ...healthy, hp: 0, dead: true })).toBeNull();
    expect(huntDisengageReason({ ...healthy, mana: 20, maxMana: 20 })).toBeNull();
    expect(huntDisengageReason({ ...healthy, mana: 0, castCost: 0 })).toBeNull();
    expect(() => huntDisengageReason({ ...healthy, mana: NaN })).toThrow();
});
test('does not turn a dead character into an uncounted recovery', () => {
    expect(collectionRestReason({ ...healthy, hp: 0, mana: 0, dead: true })).toBeNull();
});
test('returns to town before starting another encounter with less than two casts', () => {
    expect(collectionRestReason({ ...healthy, mana: 59 })).toBe('mana');
    expect(collectionRestReason({ ...healthy, mana: 60 })).toBeNull();
});
test('recovers before another encounter below the existing defensive health threshold', () => {
    expect(collectionRestReason({ ...healthy, hp: 87 })).toBe('health');
    expect(collectionRestReason({ ...healthy, hp: 88 })).toBeNull();
});
test('a small full pool does not require impossible extra mana', () => {
    expect(collectionRestReason({ ...healthy, mana: 30, maxMana: 30 })).toBeNull();
});
test.each([{ mana: NaN }, { hp: 0 }, { maxMana: 0 }, { castCost: -1 }, { mana: 111 }])(
    'malformed observations fail closed %j', invalid => {
        expect(() => collectionRestReason({ ...healthy, ...invalid })).toThrow();
    });
