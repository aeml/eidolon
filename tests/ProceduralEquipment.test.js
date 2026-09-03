import * as THREE from 'three';
import { BASE_ITEMS } from '../src/core/ItemSystem.js';
import {
    createProceduralFighter,
    createProceduralRogue,
    createProceduralWizard,
    createProceduralCleric
} from '../src/art/ProceduralHumanoid.js';
import {
    applyProceduralEquipment,
    clearProceduralEquipment,
    EQUIPMENT_RENDER_SLOTS,
    EQUIPMENT_VISUAL_DESCRIPTORS,
    equipmentVisualSignature,
    getProceduralEquipmentCacheMetrics,
    resolveEquipmentVisualDescriptor
} from '../src/art/ProceduralEquipment.js';

const SOURCE_SLOT_FOR_RENDER_SLOT = Object.freeze({
    ring1: 'ring',
    ring2: 'ring',
    trinket1: 'trinket',
    trinket2: 'trinket'
});

function item(baseName, slot, overrides = {}) {
    return {
        id: `${slot}-${baseName.toLowerCase().replaceAll(' ', '-')}`,
        name: overrides.name || baseName,
        baseName: overrides.baseName || baseName,
        slot: SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot,
        type: 'ARMOR',
        rarity: overrides.rarity || 'Rare',
        level: overrides.level || 42,
        potency: overrides.potency || 0,
        sockets: overrides.sockets || 0,
        gems: overrides.gems || [],
        setId: overrides.setId || '',
        uniqueEffect: overrides.uniqueEffect || '',
        statScaleVersion: overrides.statScaleVersion || 1
    };
}

function visualGroups(root) {
    const groups = [];
    root.traverse((child) => {
        if (child.userData?.equipmentVisual) groups.push(child);
    });
    return groups;
}

function finiteTransforms(root) {
    root.updateMatrixWorld(true);
    let finite = true;
    root.traverse((child) => {
        finite &&= child.matrixWorld.elements.every(Number.isFinite);
    });
    return finite;
}

describe('procedural equipment visual manifest', () => {
    test('defines every equippable base item and excludes inventory-only materials', () => {
        const equippable = BASE_ITEMS.filter((entry) => !['material', 'relic'].includes(entry.slot));
        const inventoryOnly = BASE_ITEMS.filter((entry) => ['material', 'relic'].includes(entry.slot));

        expect(equippable).toHaveLength(36);
        expect(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).sort())
            .toEqual(equippable.map((entry) => entry.name).sort());
        equippable.forEach((entry) => {
            expect(EQUIPMENT_VISUAL_DESCRIPTORS[entry.name]).toEqual(expect.objectContaining({
                slot: entry.slot,
                family: expect.any(String),
                variant: expect.any(String),
                primary: expect.any(Number),
                secondary: expect.any(Number)
            }));
        });
        inventoryOnly.forEach((entry) => {
            expect(EQUIPMENT_VISUAL_DESCRIPTORS[entry.name]).toBeUndefined();
        });
    });

    test('resolves affixed server item names to an intentional family without fallback geometry', () => {
        expect(resolveEquipmentVisualDescriptor({
            id: 'affixed',
            name: 'Brilliant Iron Sword of the Bear',
            slot: 'mainHand'
        })).toEqual(expect.objectContaining({ baseName: 'Iron Sword', family: 'blade', variant: 'longsword' }));
        expect(resolveEquipmentVisualDescriptor({ name: 'Unknown Future Helmet', slot: 'head' })).toBeNull();
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s renders through its declared Fighter anchor', (baseName) => {
        const root = createProceduralFighter();
        const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
        const renderSlot = descriptor.slot === 'ring' ? 'ring1' : descriptor.slot === 'trinket' ? 'trinket1' : descriptor.slot;
        const result = applyProceduralEquipment(root, {
            [renderSlot]: item(baseName, renderSlot, {
                name: `Hearty ${baseName} of the Whale`,
                baseName: null,
                rarity: 'Legendary',
                level: 100,
                potency: 5,
                sockets: 2,
                gems: [{ type: 'Ruby', quality: 'Flawless' }],
                setId: 'warlord_fury',
                uniqueEffect: 'vampiric'
            })
        });
        const groups = visualGroups(root);

        expect(result).toEqual(expect.objectContaining({ supported: true, changed: true, items: 1, missing: [] }));
        expect(groups.length).toBe(root.userData.equipmentAnchors[renderSlot].length);
        groups.forEach((group) => {
            expect(group.userData).toEqual(expect.objectContaining({
                slot: renderSlot,
                baseName,
                family: descriptor.family,
                rarity: 'Legendary',
                tier: 3,
                potency: 5,
                sockets: 2,
                setId: 'warlord_fury',
                uniqueEffect: 'vampiric',
                statScaleVersion: 1
            }));
            expect(group.getObjectByName('Gear_SetRune')).toBeTruthy();
            expect(group.getObjectByName('Gear_UniqueRune')).toBeTruthy();
        });
        expect(result.parts).toBeGreaterThan(groups.length);
        expect(finiteTransforms(root)).toBe(true);
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s fits its declared Rogue anchor', (baseName) => {
        const root = createProceduralRogue();
        const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
        const renderSlot = descriptor.slot === 'ring' ? 'ring1' : descriptor.slot === 'trinket' ? 'trinket1' : descriptor.slot;
        const result = applyProceduralEquipment(root, {
            [renderSlot]: item(baseName, renderSlot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 2,
                gems: [{ type: 'Emerald', quality: 'Flawless' }],
                setId: 'shadow_embrace',
                uniqueEffect: 'swift'
            })
        });
        const groups = visualGroups(root);

        expect(result).toEqual(expect.objectContaining({ supported: true, changed: true, items: 1, missing: [] }));
        expect(groups).toHaveLength(root.userData.equipmentAnchors[renderSlot].length);
        groups.forEach((group) => {
            expect(group.userData).toEqual(expect.objectContaining({
                slot: renderSlot,
                baseName,
                fitScale: root.userData.equipmentScaleBySlot[renderSlot]
            }));
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(finiteTransforms(root)).toBe(true);
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s fits its declared Wizard anchor', (baseName) => {
        const root = createProceduralWizard();
        const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
        const renderSlot = descriptor.slot === 'ring' ? 'ring1' : descriptor.slot === 'trinket' ? 'trinket1' : descriptor.slot;
        const result = applyProceduralEquipment(root, {
            [renderSlot]: item(baseName, renderSlot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 2,
                gems: [{ type: 'Sapphire', quality: 'Flawless' }],
                setId: 'archmage_regalia',
                uniqueEffect: 'arcane'
            })
        });
        const groups = visualGroups(root);

        expect(result).toEqual(expect.objectContaining({ supported: true, changed: true, items: 1, missing: [] }));
        expect(groups).toHaveLength(root.userData.equipmentAnchors[renderSlot].length);
        groups.forEach((group) => {
            expect(group.userData).toEqual(expect.objectContaining({
                slot: renderSlot,
                baseName,
                fitScale: root.userData.equipmentScaleBySlot[renderSlot]
            }));
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(finiteTransforms(root)).toBe(true);
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s fits its declared Cleric anchor', (baseName) => {
        const root = createProceduralCleric();
        const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
        const renderSlot = descriptor.slot === 'ring' ? 'ring1' : descriptor.slot === 'trinket' ? 'trinket1' : descriptor.slot;
        const result = applyProceduralEquipment(root, {
            [renderSlot]: item(baseName, renderSlot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 2,
                gems: [{ type: 'Topaz', quality: 'Flawless' }],
                setId: 'divine_light',
                uniqueEffect: 'guardian'
            })
        });
        const groups = visualGroups(root);

        expect(result).toEqual(expect.objectContaining({ supported: true, changed: true, items: 1, missing: [] }));
        expect(groups).toHaveLength(root.userData.equipmentAnchors[renderSlot].length);
        groups.forEach((group) => {
            expect(group.userData).toEqual(expect.objectContaining({
                slot: renderSlot,
                baseName,
                fitScale: root.userData.equipmentScaleBySlot[renderSlot]
            }));
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(finiteTransforms(root)).toBe(true);
    });

    test('renders all fourteen equipped positions as eighteen independently attached regions', () => {
        const root = createProceduralFighter();
        const face = root.getObjectByName('Fighter_Head');
        const eyes = root.getObjectByName('Fighter_EyeGlow');
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((slot) => {
            const sourceSlot = SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot;
            const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS)
                .find((name) => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === sourceSlot);
            equipment[slot] = item(baseName, slot, {
                rarity: slot.endsWith('2') ? 'Legendary' : 'Rare',
                sockets: 1,
                gems: [{ type: slot.endsWith('2') ? 'Emerald' : 'Sapphire', quality: 'Perfect' }]
            });
        });

        const result = applyProceduralEquipment(root, equipment);

        expect(result).toEqual(expect.objectContaining({
            supported: true,
            changed: true,
            items: EQUIPMENT_RENDER_SLOTS.length,
            missing: []
        }));
        expect(visualGroups(root)).toHaveLength(18);
        expect(result.parts).toBeGreaterThanOrEqual(45);
        expect(face.visible).toBe(true);
        expect(eyes.visible).toBe(true);
        expect(finiteTransforms(root)).toBe(true);
    });

    test('fits the complete fourteen-slot armory to the procedural Rogue without hiding face identity', () => {
        const root = createProceduralRogue();
        const face = root.getObjectByName('Rogue_Head');
        const eyes = root.getObjectByName('Rogue_EyeGlow');
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((slot, index) => {
            const sourceSlot = SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot;
            const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS)
                .find((name) => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === sourceSlot);
            equipment[slot] = item(baseName, slot, {
                rarity: 'Legendary',
                level: 100,
                potency: 5,
                sockets: 1,
                gems: [{ type: index % 2 === 0 ? 'Emerald' : 'Onyx', quality: 'Perfect' }],
                setId: 'shadow_embrace',
                uniqueEffect: 'swift'
            });
        });

        const result = applyProceduralEquipment(root, equipment);

        expect(result).toEqual(expect.objectContaining({
            supported: true,
            changed: true,
            items: EQUIPMENT_RENDER_SLOTS.length,
            missing: []
        }));
        expect(visualGroups(root)).toHaveLength(18);
        expect(result.parts).toBeGreaterThanOrEqual(45);
        visualGroups(root).forEach((group) => {
            expect(group.userData.fitScale).toBe(root.userData.equipmentScaleBySlot[group.userData.slot]);
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(face.visible).toBe(true);
        expect(eyes.visible).toBe(true);
        expect(root.getObjectByName('Rogue_EyeGlowRight').visible).toBe(true);
        expect(root.getObjectByName('Rogue_HairCap').visible).toBe(false);
        expect(root.getObjectByName('Rogue_MainhandFang').visible).toBe(false);
        expect(root.getObjectByName('Rogue_OffhandFang').visible).toBe(false);
        expect(finiteTransforms(root)).toBe(true);

        clearProceduralEquipment(root);
        expect(root.getObjectByName('Rogue_MainhandFang').visible).toBe(true);
        expect(root.getObjectByName('Rogue_OffhandFang').visible).toBe(true);
    });

    test('fits the complete fourteen-slot armory to the procedural Wizard and restores both arcane tools', () => {
        const root = createProceduralWizard();
        const face = root.getObjectByName('Wizard_Head');
        const eyes = root.getObjectByName('Wizard_EyeGlow');
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((slot, index) => {
            const sourceSlot = SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot;
            const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS)
                .find((name) => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === sourceSlot);
            equipment[slot] = item(baseName, slot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 1,
                gems: [{ type: index % 2 === 0 ? 'Sapphire' : 'Amethyst', quality: 'Perfect' }],
                setId: 'archmage_regalia',
                uniqueEffect: 'arcane'
            });
        });

        const result = applyProceduralEquipment(root, equipment);

        expect(result).toEqual(expect.objectContaining({
            supported: true,
            changed: true,
            items: EQUIPMENT_RENDER_SLOTS.length,
            missing: []
        }));
        expect(visualGroups(root)).toHaveLength(18);
        expect(result.parts).toBeGreaterThanOrEqual(45);
        visualGroups(root).forEach((group) => {
            expect(group.userData.fitScale).toBe(root.userData.equipmentScaleBySlot[group.userData.slot]);
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(face.visible).toBe(true);
        expect(eyes.visible).toBe(true);
        expect(root.getObjectByName('Wizard_Stormstaff').visible).toBe(false);
        expect(root.getObjectByName('Rig_Focus').visible).toBe(false);
        expect(finiteTransforms(root)).toBe(true);

        clearProceduralEquipment(root);
        expect(root.getObjectByName('Wizard_Stormstaff').visible).toBe(true);
        expect(root.getObjectByName('Rig_Focus').visible).toBe(true);
    });

    test('fits the complete fourteen-slot armory to the procedural Cleric and restores both sacred tools', () => {
        const root = createProceduralCleric();
        const face = root.getObjectByName('Cleric_Head');
        const eyes = root.getObjectByName('Cleric_EyeGlow');
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((slot, index) => {
            const sourceSlot = SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot;
            const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS)
                .find((name) => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === sourceSlot);
            equipment[slot] = item(baseName, slot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 1,
                gems: [{ type: index % 2 === 0 ? 'Topaz' : 'Emerald', quality: 'Perfect' }],
                setId: 'divine_light',
                uniqueEffect: 'guardian'
            });
        });

        const result = applyProceduralEquipment(root, equipment);

        expect(result).toEqual(expect.objectContaining({
            supported: true,
            changed: true,
            items: EQUIPMENT_RENDER_SLOTS.length,
            missing: []
        }));
        expect(visualGroups(root)).toHaveLength(18);
        expect(result.parts).toBeGreaterThanOrEqual(45);
        visualGroups(root).forEach((group) => {
            expect(group.userData.fitScale).toBe(root.userData.equipmentScaleBySlot[group.userData.slot]);
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(face.visible).toBe(true);
        expect(eyes.visible).toBe(true);
        expect(root.getObjectByName('Cleric_EyeGlowRight').visible).toBe(true);
        expect(root.getObjectByName('Cleric_BrowLeft').visible).toBe(true);
        expect(root.getObjectByName('Cleric_BrowRight').visible).toBe(true);
        expect(root.getObjectByName('Cleric_Nose').visible).toBe(true);
        expect(root.getObjectByName('Cleric_Lips').visible).toBe(true);
        expect(root.getObjectByName('Cleric_TempleLockLeft').visible).toBe(true);
        expect(root.getObjectByName('Cleric_TempleLockRight').visible).toBe(true);
        expect(root.getObjectByName('Cleric_BraidLeft').visible).toBe(true);
        expect(root.getObjectByName('Cleric_BraidRight').visible).toBe(true);
        expect(root.getObjectByName('Cleric_HairCap').visible).toBe(false);
        expect(root.getObjectByName('Cleric_Oathmace').visible).toBe(false);
        expect(root.getObjectByName('Rig_Censer').visible).toBe(false);
        expect(finiteTransforms(root)).toBe(true);

        clearProceduralEquipment(root);
        expect(root.getObjectByName('Cleric_Oathmace').visible).toBe(true);
        expect(root.getObjectByName('Rig_Censer').visible).toBe(true);
    });

    test('diffs appearance state, reuses cached render resources, and restores the default kit on clear', () => {
        const root = createProceduralFighter();
        const equipment = {
            mainHand: item('Steel Dagger', 'mainHand', { potency: 3 }),
            offHand: item('Spell Tome', 'offHand')
        };
        const defaultSword = root.getObjectByName('Fighter_Oathblade');
        const defaultShield = root.getObjectByName('Fighter_KiteShield');

        const first = applyProceduralEquipment(root, equipment);
        const firstBlade = root.getObjectByName('Gear_Blade');
        const cacheAfterFirst = getProceduralEquipmentCacheMetrics();
        const unchanged = applyProceduralEquipment(root, equipment);
        const signatureBefore = equipmentVisualSignature(equipment);

        expect(first.changed).toBe(true);
        expect(defaultSword.visible).toBe(false);
        expect(defaultShield.visible).toBe(false);
        expect(unchanged.changed).toBe(false);
        expect(visualGroups(root)).toHaveLength(2);

        equipment.mainHand = { ...equipment.mainHand, potency: 4 };
        expect(equipmentVisualSignature(equipment)).not.toBe(signatureBefore);
        const replaced = applyProceduralEquipment(root, equipment);
        const secondBlade = root.getObjectByName('Gear_Blade');
        expect(replaced.changed).toBe(true);
        expect(secondBlade).not.toBe(firstBlade);
        expect(secondBlade.geometry).toBe(firstBlade.geometry);
        expect(getProceduralEquipmentCacheMetrics().geometries).toBe(cacheAfterFirst.geometries);

        const potencySignature = equipmentVisualSignature(equipment);
        equipment.mainHand = {
            ...equipment.mainHand,
            setId: 'bulwark_ages',
            uniqueEffect: 'guardian',
            statScaleVersion: 2
        };
        expect(equipmentVisualSignature(equipment)).not.toBe(potencySignature);
        const identified = applyProceduralEquipment(root, equipment);
        expect(identified.changed).toBe(true);
        expect(root.getObjectByName('Gear_SetRune')).toBeTruthy();
        expect(root.getObjectByName('Gear_UniqueRune')).toBeTruthy();

        expect(clearProceduralEquipment(root)).toBe(true);
        expect(visualGroups(root)).toHaveLength(0);
        expect(defaultSword.visible).toBe(true);
        expect(defaultShield.visible).toBe(true);
        expect(root.userData.equipmentVisualItemCount).toBe(0);
    });

    test('reports missing visual definitions instead of hiding them behind a generic fallback', () => {
        const root = createProceduralFighter();
        const result = applyProceduralEquipment(root, {
            head: item('Unknown Future Helmet', 'head')
        });

        expect(result.items).toBe(0);
        expect(result.missing).toEqual(['Unknown Future Helmet']);
        expect(visualGroups(root)).toHaveLength(0);
    });

    test('does not mutate model-backed actors that have not joined the procedural rig migration', () => {
        const legacy = new THREE.Group();
        const result = applyProceduralEquipment(legacy, { mainHand: item('Iron Sword', 'mainHand') });

        expect(result).toEqual({ supported: false, changed: false, items: 0, parts: 0, missing: [] });
        expect(legacy.children).toHaveLength(0);
    });
});
