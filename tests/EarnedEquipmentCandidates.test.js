import { earnedEquipmentCandidates } from './earnedEquipmentCandidates.js';

const item = { id: 'earned-staff', name: 'Staff', slot: 'mainHand', type: 'WEAPON', level: 2 };
test('only equipment actually owned at an earned level is selected', () => {
    const bag = Object.freeze([null, Object.freeze(item), { ...item, id: 'later', level: 4 }]);
    expect(earnedEquipmentCandidates(bag, Object.freeze({}), 3)).toEqual([
        { id: 'earned-staff', name: 'Staff', slot: 'mainHand' }
    ]);
});
test('existing occupied slots are never overwritten', () => {
    expect(earnedEquipmentCandidates([item], { mainHand: { id: 'current' } }, 3)).toEqual([]);
});
test.each(['MATERIAL', 'RELIC', 'GEM'])('%s is never selected even with malformed equipment metadata', type => {
    expect(earnedEquipmentCandidates([{ ...item, type }], {}, 3)).toEqual([]);
});
test('unknown slots and invalid levels are not actionable equipment', () => {
    expect(earnedEquipmentCandidates([{ ...item, slot: 'quest' }, { ...item, level: NaN }], {}, 3)).toEqual([]);
});
test.each(['ring', 'trinket'])('%s can use a second empty slot but not replace two occupied slots', slot => {
    const accessory = { ...item, slot };
    expect(earnedEquipmentCandidates([accessory], { [`${slot}1`]: { id: 'one' } }, 3)).toHaveLength(1);
    expect(earnedEquipmentCandidates([accessory], { [`${slot}1`]: { id: 'one' },
        [`${slot}2`]: { id: 'two' } }, 3)).toHaveLength(0);
});
