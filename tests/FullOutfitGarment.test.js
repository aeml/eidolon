import * as THREE from 'three';
import { jest } from '@jest/globals';
import { equipmentWithAppearances } from '../src/core/EquipmentAppearance.js';
import { prepareFittedEquipment, applyFittedEquipment, clearFittedEquipment } from '../src/art/FittedEquipment.js';
import { GARMENT_MODELS } from '../src/assets/garments.generated.js';
import { equipmentVisualSignature } from '../src/art/ProceduralEquipment.js';

const look = { baseName: 'Iron Oath Regalia', rarity: 'Common', slot: 'outfit' };
const garment = GARMENT_MODELS.outfits[look.baseName];
const equipment = () => Object.fromEntries([
    ['head', 'Iron Helm'], ['chest', 'Robes'], ['legs', 'Leather Pants'], ['feet', 'Iron Boots'],
    ['gloves', 'Silk Gloves'], ['shoulders', 'Velvet Mantle'], ['belt', 'Studded Belt'],
    ['neck', 'Necklace'], ['ring1', 'Ruby Ring'], ['ring2', 'Silver Ring'], ['trinket1', 'Amulet of Power'],
    ['trinket2', 'Orb of Mana'], ['mainHand', 'Iron Sword'], ['offHand', 'Wooden Shield']
].map(([slot, name]) => [slot, { id: `real-${slot}`, name, baseName: name, slot, type: slot === 'mainHand' ? 'WEAPON' : 'ARMOR', rarity: 'Rare', stats: { defense: 7 } }]));

function fixture(actorClass = 'Fighter') {
    const root = new THREE.Group(), scene = new THREE.Group(); root.add(scene);
    Object.assign(root.userData, { authoredClass: actorClass, authoredScale: 2.25, authoredQuality: 'high', fittedEquipmentBatching: false, updateWeaponProfile: jest.fn() });
    const pelvis = new THREE.Bone(); pelvis.name = 'pelvis'; scene.add(pelvis);
    for (const name of ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'neck_01', 'socket_mainHand', 'socket_offHand']) {
        const bone = new THREE.Bone(); bone.name = name; bone.position.set(0, name === 'neck_01' ? 1.9 : 1, 0); scene.add(bone);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.1, .9, 0, .1, .9, 0, 0, 1, .1], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1], 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(12), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    geometry.setIndex([0, 1, 2]);
    const material = new THREE.MeshStandardMaterial(), skeleton = new THREE.Skeleton([pelvis]);
    const body = new THREE.SkinnedMesh(geometry, material); body.name = `${actorClass}_Body`; body.bind(skeleton); scene.add(body);
    const model = (slots, skinned = true) => {
        const source = new THREE.Group();
        for (const slot of slots) {
            const part = skinned ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
            if (skinned) part.bind(skeleton);
            // Multi-primitive GLBs can carry node extras on an enclosing group.
            const group = new THREE.Group(); group.userData.garmentSlot = slot; group.add(part); source.add(group);
        }
        return { scene: source };
    };
    const full = model(Object.keys(garment.coverage)), ordinary = model(['chest']), held = model(['held'], false);
    const loader = jest.fn(async file => file.includes('/garments/') ? full : /iron-sword|wooden-shield/.test(file) ? held : ordinary);
    prepareFittedEquipment(root, scene, loader);
    return { root, scene, body, geometry, material, full, model, loader };
}

test('outfit projection is separate from actual gear and preserves independent hand/body appearance choices', () => {
    const gear = equipment(), appearances = { outfit: look, mainHand: { baseName: 'Grovekeeper Blade', rarity: 'Common', slot: 'mainHand' },
        chest: { baseName: 'Robes', rarity: 'Legendary', slot: 'chest' } };
    const before = JSON.stringify({ gear, appearances }), rendered = equipmentWithAppearances(gear, appearances);
    expect(rendered.outfit).toEqual(look); expect(rendered.outfit).not.toBe(look);
    expect(rendered.mainHand.baseName).toBe('Grovekeeper Blade'); expect(rendered.chest.rarity).toBe('Legendary');
    expect(rendered.mainHand.equipmentBaseName).toBe('Iron Sword');
    expect(equipmentVisualSignature(rendered)).not.toBe(equipmentVisualSignature(equipmentWithAppearances(gear, { ...appearances, outfit: undefined })));
    expect(JSON.stringify({ gear, appearances })).toBe(before);
    expect(equipmentWithAppearances(gear, { ...appearances, outfit: undefined }).outfit).toBeUndefined();
    expect(equipmentWithAppearances({ ...gear, outfit: look }, {}).outfit).toBeUndefined();
    expect(equipmentWithAppearances(gear, { outfit: { ...look, baseName: 'invented outfit' } }).outfit).toBeUndefined();
});

test.each(['Fighter', 'Rogue', 'Cleric', 'Wizard'])('%s loads its complete garment fit and hides underlying body/accessory visuals', async actorClass => {
    const current = fixture(actorClass), gear = equipment(), before = JSON.stringify(gear);
    applyFittedEquipment(current.root, equipmentWithAppearances(gear, { outfit: look })); await current.root.userData.equipmentReady;
    expect(current.root.userData.equipmentVisualGarment).toBe(garment.id);
    expect(current.root.userData.equipmentVisualMissing).toEqual([]);
    expect(current.loader.mock.calls.some(([file]) => file === garment.models[actorClass].high.file)).toBe(true);
    expect(current.loader.mock.calls.some(([file]) => /ruby-ring|necklace|leather-pants|robes/.test(file))).toBe(false);
    expect(current.root.userData.updateWeaponProfile.mock.calls[0][0].mainHand.name).toBe('Iron Sword');
    expect(JSON.stringify(gear)).toBe(before);
    clearFittedEquipment(current.root); expect(current.body.geometry).toBe(current.geometry);
    expect(current.root.userData.equipmentVisualGarment).toBe('');
});

test('gear changes under a garment restore the latest real gear and retained per-slot appearances when removed', async () => {
    const current = fixture(), gear = equipment(), appearances = { outfit: look, chest: { baseName: 'Robes', rarity: 'Legendary', slot: 'chest' } };
    applyFittedEquipment(current.root, equipmentWithAppearances(gear, appearances)); await current.root.userData.equipmentReady;
    gear.chest = { ...gear.chest, id: 'new-earned-chest', potency: 8 };
    expect(applyFittedEquipment(current.root, equipmentWithAppearances(gear, appearances)).changed).toBe(false);
    delete appearances.outfit;
    applyFittedEquipment(current.root, equipmentWithAppearances(gear, appearances)); await current.root.userData.equipmentReady;
    expect(current.root.userData.equipmentVisualGarment).toBe('');
    expect(current.loader.mock.calls.some(([file]) => file.includes('robes-legendary'))).toBe(true);
    expect(gear.chest.id).toBe('new-earned-chest'); expect(gear.chest.potency).toBe(8);
    clearFittedEquipment(current.root);
});

test('a missing garment section retains the committed outfit and cleans up staged owned resources', async () => {
    const current = fixture(), gear = equipment();
    applyFittedEquipment(current.root, equipmentWithAppearances(gear, { outfit: look })); await current.root.userData.equipmentReady;
    const prior = current.body.geometry, priorChildren = [...current.scene.children];
    current.loader.mockImplementation(async () => current.model(['chest']));
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const sourceDispose = jest.spyOn(current.geometry, 'dispose');
    try {
        applyFittedEquipment(current.root, equipmentWithAppearances(gear, { outfit: look }), { force: true }); await current.root.userData.equipmentReady;
        expect(warning).toHaveBeenCalled(); expect(current.body.geometry).toBe(prior);
        expect(current.scene.children).toEqual(priorChildren); expect(sourceDispose).not.toHaveBeenCalled();
        expect(current.root.userData.equipmentVisualSignature).toBe('');
    } finally { warning.mockRestore(); clearFittedEquipment(current.root); }
});

test('a garment covers an unequipped body without creating weapons or changing weapon animation identity', async () => {
    const current = fixture();
    applyFittedEquipment(current.root, equipmentWithAppearances({}, { outfit: look })); await current.root.userData.equipmentReady;
    expect(current.root.userData.equipmentVisualItemCount).toBe(7);
    expect(current.loader).toHaveBeenCalledTimes(1);
    expect(current.root.userData.updateWeaponProfile).toHaveBeenCalledWith({});
    clearFittedEquipment(current.root);
});
