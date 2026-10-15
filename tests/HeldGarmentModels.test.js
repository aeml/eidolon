import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HELD_GARMENT_MODELS } from '../src/assets/heldGarments.generated.js';
import { COSMETIC_CATALOGUE } from '../src/data/cosmetics.generated.js';
import { BASE_ITEMS } from '../src/core/ItemSystem.js';
import { equipmentWithAppearances } from '../src/core/EquipmentAppearance.js';
import { prepareFittedEquipment, applyFittedEquipment, clearFittedEquipment } from '../src/art/FittedEquipment.js';

const sources = new Map();
async function load(file) {
    if (!sources.has(file)) {
        const bytes = readFileSync(file), data = new ArrayBuffer(bytes.length);
        new Uint8Array(data).set(bytes);
        sources.set(file, await new GLTFLoader().parseAsync(data, ''));
    }
    return sources.get(file);
}
function fixture(actorClass, quality) {
    const root = new THREE.Group(), scene = new THREE.Group(); root.add(scene);
    Object.assign(root.userData, { authoredClass: actorClass, authoredScale: 2.25, authoredQuality: quality,
        fittedEquipmentBatching: false, updateWeaponProfile: jest.fn() });
    const bone = new THREE.Bone(); bone.name = 'pelvis'; scene.add(bone);
    for (const name of ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'neck_01', 'socket_mainHand', 'socket_offHand']) {
        const node = new THREE.Bone(); node.name = name; node.position.y = name.startsWith('lower') ? 1.5 : 1; scene.add(node);
    }
    const body = new THREE.SkinnedMesh(new THREE.BoxGeometry(.3, 1.5, .2), new THREE.MeshStandardMaterial());
    body.name = `${actorClass}_Body`; body.bind(new THREE.Skeleton([bone])); scene.add(body);
    const loader = jest.fn(load); prepareFittedEquipment(root, scene, loader);
    return { root, scene, body, loader };
}
const item = name => ({ ...BASE_ITEMS.find(item => item.name === name), id: `real-${name}`, baseName: name, rarity: 'Eidolic', potency: 20 });

test('six distinct registered held designs preserve existing catalogue identities and source equipment bytes', () => {
    expect(Object.values(HELD_GARMENT_MODELS).map(model => model.base).sort()).toEqual(
        ['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace', 'Wooden Shield', 'Spell Tome'].sort());
    for (const model of Object.values(HELD_GARMENT_MODELS)) {
        expect(COSMETIC_CATALOGUE.find(offer => offer.id === model.id)).toMatchObject({ name: model.name, base: model.base });
        for (const source of model.provenance) expect(createHash('sha256').update(readFileSync(source.reference)).digest('hex')).toBe(source.sha256);
    }
});

test.each(Object.values(HELD_GARMENT_MODELS).flatMap(model => ['high', 'low'].map(quality => [model.name, quality])))('%s %s exports real finite rigid geometry, normals and UVs with exact cache identity', async (name, quality) => {
    const model = HELD_GARMENT_MODELS[name].models[quality], bytes = readFileSync(model.file);
    expect(bytes.length).toBe(model.bytes); expect(createHash('sha256').update(bytes).digest('hex')).toBe(model.sha256);
    const gltf = await load(model.file); let vertices = 0;
    gltf.scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        expect(mesh.isSkinnedMesh).toBeUndefined();
        const position = mesh.geometry.getAttribute('position'); vertices += position.count;
        for (const attribute of ['position', 'normal', 'uv']) {
            const data = mesh.geometry.getAttribute(attribute);
            expect(data.count).toBe(position.count); expect([...data.array].every(Number.isFinite)).toBe(true);
        }
        mesh.geometry.computeBoundingBox();
        expect(mesh.geometry.boundingBox.min.length()).toBeLessThan(1.5);
        expect(mesh.geometry.boundingBox.max.length()).toBeLessThan(1.5);
    });
    expect(vertices).toBeGreaterThan(100);
});

for (const actorClass of ['Fighter', 'Rogue', 'Cleric', 'Wizard']) for (const quality of ['high', 'low']) {
    test(`${actorClass} ${quality} uses actual held garment models with delivered grips and preserves real gear`, async () => {
        const current = fixture(actorClass, quality);
        const names = actorClass === 'Wizard' ? ['Wooden Staff', 'Spell Tome'] : actorClass === 'Cleric' ? ['Cleric Mace', 'Wooden Shield']
            : actorClass === 'Rogue' ? ['Steel Dagger', 'Iron Sword'] : ['Iron Sword', 'Wooden Shield'];
        const gear = { mainHand: item(names[0]), offHand: item(names[1]) };
        const find = base => Object.values(HELD_GARMENT_MODELS).find(model => model.base === base);
        const looks = Object.fromEntries(Object.entries(gear).map(([slot, real]) => [slot, { baseName: find(real.baseName).name, rarity: 'Common', slot: real.slot }]));
        // Compare against the actual delivered-gear path on the same actor,
        // including its existing TRS treatment of exported grip matrices.
        applyFittedEquipment(current.root, gear); await current.root.userData.equipmentReady;
        const originalGrips = Object.fromEntries(Object.keys(gear).map(slot => {
            const part = current.scene.getObjectByName(`socket_${slot}`).children.find(child => child.userData.slot === slot);
            part.updateMatrix(); return [slot, part.matrix.clone()];
        }));
        const saved = JSON.stringify(gear); applyFittedEquipment(current.root, equipmentWithAppearances(gear, looks));
        await current.root.userData.equipmentReady;
        expect(current.root.userData.equipmentVisualMissing).toEqual([]); expect(current.root.userData.equipmentVisualItemCount).toBe(2);
        for (const [slot, real] of Object.entries(gear)) {
            expect(current.loader).toHaveBeenCalledWith(find(real.baseName).models[quality].file, 8000);
            const socket = current.scene.getObjectByName(`socket_${slot}`), part = socket.children.find(child => child.userData.slot === slot);
            expect(part).toBeDefined(); part.updateMatrix();
            expect(part.matrix.equals(originalGrips[slot])).toBe(true);
            const sourceMaterials = new Map();
            (await load(find(real.baseName).models[quality].file)).scene.traverse(mesh => {
                if (mesh.isMesh) for (const material of [].concat(mesh.material)) sourceMaterials.set(material.name, material);
            });
            part.traverse(mesh => {
                if (mesh.isMesh) for (const material of [].concat(mesh.material)) {
                    expect(material.color.equals(sourceMaterials.get(material.name).color)).toBe(true);
                    expect(material.emissive.equals(sourceMaterials.get(material.name).emissive)).toBe(true);
                }
            });
        }
        expect(JSON.stringify(gear)).toBe(saved); clearFittedEquipment(current.root);
        expect(current.scene.getObjectByName('socket_mainHand').children).toHaveLength(0);
        expect(current.scene.getObjectByName('socket_offHand').children).toHaveLength(0);
    });
}

test('failed held garment download preserves the committed equipment and retries the same selection', async () => {
    const current = fixture('Fighter', 'low'), gear = { mainHand: item('Iron Sword') };
    applyFittedEquipment(current.root, gear); await current.root.userData.equipmentReady;
    const socket = current.scene.getObjectByName('socket_mainHand'), original = socket.children[0];
    const look = { mainHand: { baseName: 'Grovekeeper Blade', rarity: 'Common', slot: 'mainHand' } };
    const rendered = equipmentWithAppearances(gear, look);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    current.loader.mockRejectedValueOnce(Error('offline low')).mockRejectedValueOnce(Error('offline high'));
    applyFittedEquipment(current.root, rendered); await current.root.userData.equipmentReady;
    expect(socket.children).toEqual([original]); expect(current.root.userData.equipmentVisualMissing).toEqual(['mainHand']);
    expect(applyFittedEquipment(current.root, rendered).changed).toBe(true); await current.root.userData.equipmentReady;
    expect(socket.children[0]).not.toBe(original); expect(socket.children[0].userData.garmentId).toBe('grovekeeper-blade-v1');
    expect(current.root.userData.equipmentVisualMissing).toEqual([]);
    clearFittedEquipment(current.root); warning.mockRestore();
});
