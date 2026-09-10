import { GEM_TYPES } from '../src/core/ItemSystem.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard,
    createProceduralCleric } from '../src/art/ProceduralHumanoid.js';
import { applyProceduralEquipment, createProceduralEquipmentVisual,
    equipmentVisualSignature } from '../src/art/ProceduralEquipment.js';
import { getProceduralItemIcon } from '../src/art/ProceduralIcons.js';
import { socketGemAppearanceName } from '../src/art/SocketGemAppearance.js';

const sword = gem => ({ id: 'socketed-sword', name: 'Iron Sword', baseName: 'Iron Sword',
    type: 'WEAPON', slot: 'mainHand', level: 1, rarity: 'Rare', sockets: 1, gems: [gem] });
const types = Object.keys(GEM_TYPES).filter(key => key === key.toUpperCase());

test.each(types)('%s has matching socket color and icon across supported field/name forms', type => {
    const canonical = sword({ type: GEM_TYPES[type].name, quality: 'Flawed' });
    const expected = createProceduralEquipmentVisual(canonical).getObjectByName('Gear_Socket1').material;
    const icon = getProceduralItemIcon(canonical);
    for (const field of ['type', 'gemType']) {
        for (const name of [type, GEM_TYPES[type].name]) {
            const data = sword({ [field]: name, quality: 'Flawed' });
            const material = createProceduralEquipmentVisual(data).getObjectByName('Gear_Socket1').material;
            expect(material.color.getHex()).toBe(expected.color.getHex());
            expect(material).toBe(expected);
            expect(getProceduralItemIcon(data)).toBe(icon);
        }
    }
});

test.each([
    ['Fighter', createProceduralFighter], ['Rogue', createProceduralRogue],
    ['Wizard', createProceduralWizard], ['Cleric', createProceduralCleric]
])('%s gemType replacement refreshes equipped sockets without relogging or replacing item identity', (_name, factory) => {
    const root = factory();
    const equipment = { mainHand: sword({ gemType: 'Ruby', quality: 'Flawed' }) };
    applyProceduralEquipment(root, equipment);
    const previous = root.getObjectByName('Gear_Socket1');
    const signature = equipmentVisualSignature(equipment);
    equipment.mainHand.gems[0] = { gemType: 'Sapphire', quality: 'Flawed' };
    expect(equipmentVisualSignature(equipment)).not.toBe(signature);
    expect(applyProceduralEquipment(root, equipment).changed).toBe(true);
    const next = root.getObjectByName('Gear_Socket1');
    expect(next).not.toBe(previous);
    expect(next.material.color.getHex()).not.toBe(previous.material.color.getHex());
    expect(root.getObjectByName('EquippedVisual_mainHand').userData.itemId).toBe('socketed-sword');
    expect(applyProceduralEquipment(root, equipment).changed).toBe(false);
});

test('equivalent canonical and uppercase socket records do not rebuild equipped meshes', () => {
    const root = createProceduralFighter();
    const equipment = { mainHand: sword({ type: 'Ruby', quality: 'Flawed' }) };
    applyProceduralEquipment(root, equipment);
    const previous = root.getObjectByName('Gear_Socket1');
    equipment.mainHand.gems[0] = { gemType: 'RUBY', quality: 'Flawed' };
    expect(applyProceduralEquipment(root, equipment).changed).toBe(false);
    expect(root.getObjectByName('Gear_Socket1')).toBe(previous);
});

test.each([null, undefined, {}, { type: 'Unknown' }, { type: 17 }, { type: {} },
    { type: '__proto__' }, { type: 'constructor' }])('unknown or malformed gem %j stays neutral without altering item data', gem => {
    expect(socketGemAppearanceName(gem)).toBeNull();
    const data = sword(gem), snapshot = JSON.stringify(data);
    const visual = createProceduralEquipmentVisual(data);
    if (gem) expect(visual.getObjectByName('Gear_Socket1').material.color.getHex()).toBe(0x26262d);
    expect(getProceduralItemIcon(data)).toContain('data:image/svg+xml');
    expect(JSON.stringify(data)).toBe(snapshot);
});

test('socket normalization preserves primary-field precedence and accepts an empty primary fallback', () => {
    expect(socketGemAppearanceName({ type: 'RUBY', gemType: 'SAPPHIRE' })).toBe('Ruby');
    expect(socketGemAppearanceName({ type: '', gemType: 'SAPPHIRE' })).toBe('Sapphire');
    expect(socketGemAppearanceName({ type: 'Unknown', gemType: 'RUBY' })).toBeNull();
});
