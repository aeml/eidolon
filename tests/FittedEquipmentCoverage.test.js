import * as THREE from 'three';
import { jest } from '@jest/globals';
import { applyFittedEquipment, clearFittedEquipment, prepareFittedEquipment } from '../src/art/FittedEquipment.js';

function coverageGeometry() {
    const geometry = new THREE.BufferGeometry();
    // Two concealed hip faces, one lower face, and one crossing the cutoff.
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        -.1, 1, 0, .1, 1, 0, 0, 1.02, .1,
        -.1, .85, 0, .1, .85, 0, 0, .87, .1,
        -.1, .5, 0, .1, .5, 0, 0, .52, .1,
        -.1, .9, 0, .1, .8, 0, 0, .7, .1
    ], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(48), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: 48 }, (_, i) => i % 4 === 0 ? 1 : 0), 4));
    geometry.setIndex(Array.from({ length: 12 }, (_, i) => i));
    return geometry;
}

function fixture(type) {
    const root = new THREE.Group(), scene = new THREE.Group();
    root.userData.authoredClass = type;
    root.userData.authoredScale = 4.5 / 2;
    root.userData.fittedEquipmentBatching = false;
    root.add(scene);
    const pelvis = new THREE.Bone(); pelvis.name = 'pelvis'; scene.add(pelvis);
    for (const name of ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'neck_01']) {
        const bone = new THREE.Bone(); bone.name = name;
        bone.position.y = name === 'neck_01' ? 1.9 : name.startsWith('lower') ? 1.4 : 1;
        scene.add(bone);
    }
    const body = new THREE.SkinnedMesh(coverageGeometry(), new THREE.MeshStandardMaterial());
    body.name = `${type}_Body`; body.bind(new THREE.Skeleton([pelvis])); scene.add(body);
    const shorts = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    shorts.name = `${type}_Undershorts`; scene.add(shorts);
    const sourceScene = new THREE.Group();
    const source = new THREE.SkinnedMesh(coverageGeometry(), new THREE.MeshStandardMaterial());
    source.bind(new THREE.Skeleton([pelvis])); sourceScene.add(source);
    prepareFittedEquipment(root, scene, async () => ({ scene: sourceScene }));
    return { root, body, shorts, source };
}

const item = (name, slot) => ({ id: `${slot}-${name}`, baseName: name, name, slot, type: 'ARMOR', rarity: 'Rare' });
const gearParts = root => {
    const parts = [];
    root.traverse(part => { if (part.userData.authoredEquipment) parts.push(part); });
    return parts;
};

test.each(['Fighter', 'Cleric', 'Wizard', 'Rogue'])('%s long garments hide hip skin/underwear, retain crossing faces and restore unequipped coverage', async type => {
    for (const equipment of [{ chest: item('Robes', 'chest') }, { legs: item('Silk Skirt', 'legs') }]) {
        const current = fixture(type), other = fixture(type);
        const original = current.body.geometry, originalShorts = current.shorts.visible;
        const sourceDispose = jest.spyOn(original, 'dispose');
        applyFittedEquipment(current.root, equipment); await current.root.userData.equipmentReady;
        expect(current.root.userData.equipmentVisualMissing).toEqual([]);
        expect(current.shorts.visible).toBe(false);
        expect(current.body.geometry).not.toBe(original);
        expect(Array.from(current.body.geometry.index.array)).toEqual([6, 7, 8, 9, 10, 11]);
        expect(other.shorts.visible).toBe(true);
        expect(other.body.geometry.index.count).toBe(12);
        expect(original.index.count).toBe(12);
        const ownedDispose = jest.spyOn(current.body.geometry, 'dispose');
        clearFittedEquipment(current.root); clearFittedEquipment(current.root);
        expect(current.body.geometry).toBe(original);
        expect(current.shorts.visible).toBe(originalShorts);
        expect(ownedDispose).toHaveBeenCalledTimes(1);
        expect(sourceDispose).not.toHaveBeenCalled();
    }
});

test.each([
    ['Fighter', 'Leather Pants'], ['Fighter', 'Plate Greaves'],
    ['Cleric', 'Leather Pants'], ['Cleric', 'Plate Greaves'], ['Rogue', 'Leather Pants']
])('%s %s preserves visible lower armor, masks hips only under robes, and disposes owned masks', async (type, name) => {
    const current = fixture(type), source = current.source.geometry;
    const sourceDispose = jest.spyOn(source, 'dispose');
    const equipment = { chest: item('Robes', 'chest'), legs: item(name, 'legs') };
    applyFittedEquipment(current.root, equipment); await current.root.userData.equipmentReady;
    const pants = gearParts(current.root).find(part => part.userData.slot === 'legs');
    expect(pants.geometry).not.toBe(source);
    expect(Array.from(pants.geometry.index.array)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(pants.geometry.attributes.position.array).toEqual(source.attributes.position.array);
    expect(pants.geometry.attributes.skinIndex.array).toEqual(source.attributes.skinIndex.array);
    expect(pants.geometry.attributes.skinWeight.array).toEqual(source.attributes.skinWeight.array);
    const ownedDispose = jest.spyOn(pants.geometry, 'dispose');
    applyFittedEquipment(current.root, { legs: equipment.legs }); await current.root.userData.equipmentReady;
    expect(ownedDispose).toHaveBeenCalledTimes(1);
    expect(gearParts(current.root)[0].geometry).toBe(source);
    expect(source.index.count).toBe(12);
    expect(sourceDispose).not.toHaveBeenCalled();
    clearFittedEquipment(current.root);
});

test('failed robe loads do not hide underwear or mask trousers', async () => {
    const current = fixture('Cleric');
    const scene = current.body.parent;
    prepareFittedEquipment(current.root, scene, async path => {
        if (path.includes('robes-')) throw new Error('Missing robe');
        return { scene: current.source.parent };
    });
    applyFittedEquipment(current.root, { chest: item('Robes', 'chest') }); await current.root.userData.equipmentReady;
    expect(current.root.userData.equipmentVisualMissing).toEqual(['chest']);
    expect(current.shorts.visible).toBe(true);
    expect(current.body.geometry.index.count).toBe(12);
    applyFittedEquipment(current.root, { chest: item('Robes', 'chest'), legs: item('Leather Pants', 'legs') });
    await current.root.userData.equipmentReady;
    expect(gearParts(current.root)[0].geometry).toBe(current.source.geometry);
    clearFittedEquipment(current.root);
});

test('a skirt without chest armor preserves exposed skin above its waistband', async () => {
    const current = fixture('Wizard'), geometry = current.body.geometry;
    const position = geometry.attributes.position;
    for (let i = 0; i < 3; i++) position.setY(i, 1.12);
    applyFittedEquipment(current.root, { legs: item('Silk Skirt', 'legs') }); await current.root.userData.equipmentReady;
    expect(Array.from(current.body.geometry.index.array)).toEqual([0, 1, 2, 6, 7, 8, 9, 10, 11]);
    clearFittedEquipment(current.root);
    expect(current.body.geometry).toBe(geometry);
});

test('knee-only leg submeshes remain shared rather than allocating an unnecessary mask', async () => {
    const current = fixture('Cleric'), knee = current.source.clone(false);
    knee.geometry = current.source.geometry.clone();
    const position = knee.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i, .5);
    current.source.parent.add(knee);
    const sourceDispose = jest.spyOn(knee.geometry, 'dispose');
    applyFittedEquipment(current.root, { chest: item('Robes', 'chest'), legs: item('Plate Greaves', 'legs') });
    await current.root.userData.equipmentReady;
    const pants = gearParts(current.root).filter(part => part.userData.slot === 'legs');
    expect(pants).toHaveLength(2);
    expect(pants[0].userData.fittedOwnedGeometry).toBe(true);
    expect(pants[1].userData.fittedOwnedGeometry).toBeUndefined();
    expect(pants[1].geometry).toBe(knee.geometry);
    clearFittedEquipment(current.root);
    expect(sourceDispose).not.toHaveBeenCalled();
});
