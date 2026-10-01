import { canEquipItem, isActiveEquipment, isDualWieldingRogue } from '../src/core/EquipmentSlots.js';
import { Rogue } from '../src/entities/Rogue.js';

const item = (name, slot = 'chest', type = 'ARMOR') => ({ id: name, name: `Rare ${name} of Might`, slot, type, level: 1, stats: {} });
test.each([
    ['Wizard', 'Robes', true], ['Wizard', 'Leather Tunic', false], ['Wizard', 'Plate Mail', false],
    ['Rogue', 'Robes', true], ['Rogue', 'Leather Tunic', true], ['Rogue', 'Plate Mail', false],
    ['Fighter', 'Plate Mail', true], ['Cleric', 'Plate Mail', true]
])('%s armor: %s', (actorClass, name, allowed) => {
    expect(canEquipItem(actorClass, item(name), 'chest')).toBe(allowed);
    expect(isActiveEquipment('chest', item(name), actorClass)).toBe(allowed);
});
test('Sandals belong to cloth, despite leather straps', () => expect(canEquipItem('Wizard', item('Sandals', 'feet'), 'feet')).toBe(true));
test('Rogue weapons and offhand restrictions', () => {
    for (const name of ['Iron Sword', 'Steel Dagger', 'Cleric Mace']) {
        expect(canEquipItem('Rogue', item(name, 'mainHand', 'WEAPON'), 'mainHand')).toBe(true);
        expect(canEquipItem('Rogue', item(name, 'mainHand', 'WEAPON'), 'offHand')).toBe(true);
    }
    expect(canEquipItem('Rogue', item('Wooden Staff', 'mainHand', 'WEAPON'), 'mainHand')).toBe(false);
    for (const name of ['Wooden Shield', 'Spell Tome']) expect(canEquipItem('Rogue', item(name, 'offHand'), 'offHand')).toBe(false);
});
test('Fighter/Cleric may use all weapons; wizard staff/tome stays supported', () => {
    for (const actorClass of ['Fighter', 'Cleric']) for (const name of ['Iron Sword', 'Steel Dagger', 'Cleric Mace', 'Wooden Staff'])
        expect(canEquipItem(actorClass, item(name, 'mainHand', 'WEAPON'), 'mainHand')).toBe(true);
    expect(canEquipItem('Wizard', item('Spell Tome', 'offHand'), 'offHand')).toBe(true);
});
test('Dual-wield bonus requires two active weapons and Rogue class', () => {
    const equipment = { mainHand: item('Steel Dagger', 'mainHand', 'WEAPON'), offHand: item('Iron Sword', 'mainHand', 'WEAPON') };
    expect(isDualWieldingRogue('Rogue', equipment)).toBe(true);
    expect(isDualWieldingRogue('Fighter', equipment)).toBe(false);
    expect(isDualWieldingRogue('Rogue', { ...equipment, offHand: item('Wooden Staff', 'mainHand', 'WEAPON') })).toBe(false);
});
test('Rogue authoritative fallback cadence gets exactly two-thirds, without compounded recalculation', () => {
    const rogue = new Rogue('dual-test');
    rogue.recalculateStats(); const normal = rogue.stats.attackSpeed;
    rogue.equipment = { mainHand: item('Steel Dagger', 'mainHand', 'WEAPON'), offHand: item('Iron Sword', 'mainHand', 'WEAPON') };
    rogue.recalculateStats(); expect(rogue.stats.attackSpeed).toBeCloseTo(normal * 2 / 3);
    rogue.recalculateStats(); expect(rogue.stats.attackSpeed).toBeCloseTo(normal * 2 / 3);
    delete rogue.equipment.offHand; rogue.recalculateStats(); expect(rogue.stats.attackSpeed).toBeCloseTo(normal);
    rogue.dispose();
});
