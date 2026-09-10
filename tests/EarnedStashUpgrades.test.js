import { planEarnedStashUpgrade } from './earnedStashUpgrades.js';

const ring = (id, intelligence, extra = {}) => ({ id, type: 'ACCESSORY', slot: 'ring', level: 1,
    stats: { intelligence }, ...extra });
const state = () => ({ className: 'Wizard', level: 30, inventory: [null],
    equipment: { ring1: ring('strong', 8), ring2: ring('weak', 1) }, stash: [ring('stored', 4)] });

test('stored upgrade targets the weaker paired slot without mutating any items', () => {
    const p = state(), before = JSON.stringify(p);
    expect(planEarnedStashUpgrade(p)).toMatchObject({ id: 'stored', slot: 'ring2', previousId: 'weak', blockedByFullBag: false });
    expect(JSON.stringify(p)).toBe(before);
});
test('a full bag reports a blocked candidate instead of authorizing withdrawal', () => {
    const p = state(); p.inventory = [{ id: 'material', type: 'MATERIAL' }];
    expect(planEarnedStashUpgrade(p)).toMatchObject({ id: 'stored', blockedByFullBag: true });
});
test('better carried gear is considered before a stored replacement', () => {
    const p = state(); p.inventory = [ring('carried', 7), null];
    expect(planEarnedStashUpgrade(p)).toBeNull();
});
test.each([{ level: 31 }, { uniqueEffect: 'unknown' }, { setId: 'set' }, { type: 'MATERIAL' },
    { id: 'chronicle-item-fragment' }, { stats: { intelligence: 1 } }])('ineligible, special or non-improving gear stays stored: %j', extra => {
    const p = state(); p.stash = [ring('stored', 4, extra)];
    expect(planEarnedStashUpgrade(p)).toBeNull();
});
test('unknown storage fails rather than being treated as an empty stash', () => {
    const p = state(); delete p.stash;
    expect(() => planEarnedStashUpgrade(p)).toThrow('Opened stash');
});
