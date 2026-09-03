import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { BASE_ITEMS } from '../src/core/ItemSystem.js';
import {
    PROCEDURAL_LOOT_IDENTITIES,
    createProceduralLootVisual,
    getProceduralLootCacheMetrics,
    resolveProceduralLootIdentity,
    setProceduralLootVisualState
} from '../src/art/ProceduralLoot.js';
import { EQUIPMENT_VISUAL_DESCRIPTORS } from '../src/art/ProceduralEquipment.js';
import { LootDrop, getLootDropCacheMetrics } from '../src/entities/LootDrop.js';

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Eidolic'];

function equipmentItem(baseName, index = 0) {
    const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
    return {
        id: `loot-${baseName.toLowerCase().replaceAll(' ', '-')}`,
        name: `Runed ${baseName} of the Vigil`,
        baseName,
        type: descriptor.slot === 'mainHand' ? 'WEAPON' : 'ARMOR',
        slot: descriptor.slot,
        rarity: { name: RARITIES[index % RARITIES.length], color: '#65a6ee' },
        level: 1 + index * 3,
        potency: index % 6,
        sockets: index % 3,
        gems: index % 3 ? [{ type: 'Ruby', quality: 'Flawless' }] : [],
        setId: index % 4 === 0 ? 'warlord_fury' : '',
        uniqueEffect: index % 3 === 0 ? 'vampiric' : ''
    };
}

function gemItem(name) {
    const [gemQuality, gemType] = name.split(' ');
    return {
        id: `loot-${name.toLowerCase().replaceAll(' ', '-')}`,
        name,
        type: 'GEM',
        slot: 'gem',
        gemType,
        gemQuality,
        rarity: { name: 'Rare', color: '#0070dd' }
    };
}

function assertFiniteAndVisible(root) {
    root.updateMatrixWorld(true);
    let meshes = 0;
    let visibleMeshes = 0;
    root.traverse((child) => {
        expect(child.matrixWorld.elements.every(Number.isFinite)).toBe(true);
        if (child.isMesh) {
            meshes++;
            if (child.visible) visibleMeshes++;
        }
    });
    expect(meshes).toBeGreaterThanOrEqual(5);
    expect(root.userData.parts).toBe(meshes);
    expect(root.userData.visibleParts).toBe(visibleMeshes);
    const content = root.getObjectByName('LootContent');
    const bounds = new THREE.Box3().setFromObject(content);
    const size = bounds.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeLessThanOrEqual(1.01);
    expect(bounds.min.y).toBeGreaterThanOrEqual(0.1);
}

describe('procedural world loot forge', () => {
    test('covers the exact 36 equipment, 42 soulstones, and two currencies', () => {
        const equipmentNames = BASE_ITEMS
            .filter((item) => !['material', 'relic'].includes(item.slot))
            .map((item) => item.name)
            .sort();

        expect(PROCEDURAL_LOOT_IDENTITIES.equipment).toHaveLength(36);
        expect([...PROCEDURAL_LOOT_IDENTITIES.equipment].sort()).toEqual(equipmentNames);
        expect(PROCEDURAL_LOOT_IDENTITIES.gems).toHaveLength(42);
        expect(new Set(PROCEDURAL_LOOT_IDENTITIES.gems)).toHaveProperty('size', 42);
        expect(PROCEDURAL_LOOT_IDENTITIES.currency).toEqual(['Eidolon Heart', 'Eidolon Shard']);

        const serverItems = readFileSync('server/internal/game/items.go', 'utf8');
        const baseItemsBlock = serverItems.match(/var BaseItems = \[\]BaseItem\{([\s\S]*?)\n\}/)?.[1] || '';
        const serverBaseNames = [...baseItemsBlock.matchAll(/\{"([^"]+)",\s*Item/g)]
            .map((match) => match[1])
            .sort();
        expect(serverBaseNames).toHaveLength(38);
        expect(serverBaseNames).toEqual([
            ...PROCEDURAL_LOOT_IDENTITIES.equipment,
            ...PROCEDURAL_LOOT_IDENTITIES.currency
        ].sort());
    });

    test.each(PROCEDURAL_LOOT_IDENTITIES.equipment)('%s has its exact equipped silhouette on the ground', (baseName) => {
        const index = PROCEDURAL_LOOT_IDENTITIES.equipment.indexOf(baseName);
        const visual = createProceduralLootVisual(equipmentItem(baseName, index));

        expect(visual.userData).toEqual(expect.objectContaining({
            proceduralLoot: true,
            identity: baseName,
            kind: 'equipment',
            family: EQUIPMENT_VISUAL_DESCRIPTORS[baseName].family,
            motif: EQUIPMENT_VISUAL_DESCRIPTORS[baseName].variant,
            quality: 'high'
        }));
        expect(visual.getObjectByName(`LootEquipment_${baseName.replaceAll(' ', '_')}`)).toBeTruthy();
        assertFiniteAndVisible(visual);
    });

    test.each(PROCEDURAL_LOOT_IDENTITIES.gems)('%s has a quality-ranked faceted soulstone', (name) => {
        const visual = createProceduralLootVisual(gemItem(name));
        const rank = ['Chipped', 'Flawed', 'Normal', 'Flawless', 'Perfect', 'Radiant'].indexOf(name.split(' ')[0]) + 1;

        expect(visual.userData).toEqual(expect.objectContaining({
            identity: name,
            kind: 'gem',
            family: name.split(' ')[1],
            motif: name.split(' ')[0]
        }));
        expect(visual.getObjectByName('LootContent').children.filter((child) => child.name.startsWith('LootGem_Crown')))
            .toHaveLength(rank);
        assertFiniteAndVisible(visual);
    });

    test.each(PROCEDURAL_LOOT_IDENTITIES.currency)('%s has a dedicated relic construction', (name) => {
        const visual = createProceduralLootVisual({
            name,
            type: name.includes('Heart') ? 'RELIC' : 'MATERIAL',
            rarity: 'Eidolic'
        });

        expect(visual.userData).toEqual(expect.objectContaining({
            identity: name,
            kind: 'currency',
            rarity: 'Eidolic'
        }));
        expect(visual.getObjectByName('LootContent').children.some((child) =>
            child.name.startsWith(name.includes('Heart') ? 'LootHeart_' : 'LootShard_')
        )).toBe(true);
        assertFiniteAndVisible(visual);
    });

    test('low quality keeps identity while reducing only optional gem ornaments', () => {
        const high = createProceduralLootVisual(gemItem('Radiant Opal'), { quality: 'high' });
        const low = createProceduralLootVisual(gemItem('Radiant Opal'), { quality: 'low' });

        expect(high.userData.identity).toBe(low.userData.identity);
        expect(high.getObjectByName('LootGem_Core')).toBeTruthy();
        expect(low.getObjectByName('LootGem_Core')).toBeTruthy();
        expect(high.userData.visibleParts).toBeGreaterThan(low.userData.visibleParts);
        expect(low.userData.quality).toBe('low');
    });

    test('unknown server items fail closed instead of silently becoming another item', () => {
        expect(resolveProceduralLootIdentity({ name: 'Future Thing', type: 'UNKNOWN' })).toBeNull();
        expect(createProceduralLootVisual({ name: 'Future Thing', type: 'UNKNOWN' })).toBeNull();
    });

    test('pickup feedback is independent despite shared immutable materials', () => {
        const first = createProceduralLootVisual(equipmentItem('Iron Sword'));
        const second = createProceduralLootVisual(equipmentItem('Iron Sword'));
        const firstRune = first.getObjectByName('LootReliquary_Rune');
        const secondRune = second.getObjectByName('LootReliquary_Rune');
        const originalOpacity = firstRune.material.opacity;

        expect(firstRune.material).toBe(secondRune.material);
        setProceduralLootVisualState(first, 'targeted');

        expect(first.getObjectByName('LootReliquary_Targeted').visible).toBe(true);
        expect(second.getObjectByName('LootReliquary_Targeted').visible).toBe(false);
        expect(first.scale.x).toBeCloseTo(1.14);
        expect(second.scale.x).toBe(1);
        expect(firstRune.material.opacity).toBe(originalOpacity);
        expect(secondRune.material.opacity).toBe(originalOpacity);
    });

    test('LootDrop keeps selection scaling and rotation away from its fixed hitbox and label', () => {
        const drop = new LootDrop(equipmentItem('Iron Sword'), 2, 3, 'exact-loot');
        const hitbox = drop.mesh.getObjectByName('LootHitbox');
        const hitboxScale = hitbox.scale.clone();
        const meshScale = drop.mesh.scale.clone();

        drop.setPickupVisualState('targeted');
        drop.update(0.5);

        expect(drop.visualRoot.getObjectByName('LootReliquary_Targeted').visible).toBe(true);
        expect(drop.visualRoot.scale.x).toBeCloseTo(1.14);
        expect(drop.visualRoot.getObjectByName('LootContent').rotation.y).toBeCloseTo(0.36);
        expect(hitbox.scale).toEqual(hitboxScale);
        expect(hitbox.position.y).toBe(0);
        expect(drop.mesh.scale).toEqual(meshScale);
        expect(drop.mesh.position.y).toBe(0);
        drop.dispose();
    });

    test('referenced labels survive cache pressure and idle entries are bounded', () => {
        const drop = new LootDrop(equipmentItem('Iron Sword'), 0, 0, 'label-cache-owner');
        const labels = Array.from({ length: 105 }, (_, index) => {
            const label = drop.createTextSprite(`Cache pressure relic ${index}`, '#decf9a');
            drop.mesh.add(label);
            return label;
        });
        const underPressure = getLootDropCacheMetrics();

        expect(underPressure.referencedTextTextures).toBeGreaterThanOrEqual(105);
        labels.forEach((label) => expect(label.material.map.image).toBeTruthy());
        drop.dispose();

        const released = getLootDropCacheMetrics();
        expect(released.textTextures).toBeLessThanOrEqual(released.maxIdleTextTextures);
        expect(released.textTextureReferences).toBe(0);
    });

    test('shared labels retain a reference until their last owning drop is disposed', () => {
        const first = new LootDrop(equipmentItem('Gold Ring'), 0, 0, 'shared-label-a');
        const second = new LootDrop(equipmentItem('Gold Ring'), 1, 0, 'shared-label-b');
        const firstLabel = first.createTextSprite('Shared reliquary label', '#ffffff');
        const secondLabel = second.createTextSprite('Shared reliquary label', '#ffffff');
        first.mesh.add(firstLabel);
        second.mesh.add(secondLabel);

        expect(firstLabel.material.map).toBe(secondLabel.material.map);
        first.dispose();
        expect(secondLabel.material.map.image).toBeTruthy();
        second.dispose();
        expect(getLootDropCacheMetrics().textTextureReferences).toBe(0);
    });

    test('procedural resource caches stay finite across the complete catalog', () => {
        PROCEDURAL_LOOT_IDENTITIES.equipment.forEach((name, index) =>
            createProceduralLootVisual(equipmentItem(name, index))
        );
        PROCEDURAL_LOOT_IDENTITIES.gems.forEach((name) => createProceduralLootVisual(gemItem(name)));
        PROCEDURAL_LOOT_IDENTITIES.currency.forEach((name) => createProceduralLootVisual({ name }));
        const metrics = getProceduralLootCacheMetrics();

        expect(metrics.geometries).toBeLessThan(40);
        expect(metrics.materials).toBeLessThan(50);
    });
});
