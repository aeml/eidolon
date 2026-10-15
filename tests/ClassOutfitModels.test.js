import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GARMENT_MODELS } from '../src/assets/garments.generated.js';
import { COSMETIC_CATALOGUE } from '../src/data/cosmetics.generated.js';
import { equipmentWithAppearances } from '../src/core/EquipmentAppearance.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const names = ['Iron Oath Regalia', 'Nightglass Cowl', 'Dawn Reliquary', 'Astral Sovereign'];

test('four distinct class-themed outfits retain unrestricted appearance selection and all original gear', () => {
    expect(Object.keys(GARMENT_MODELS.outfits)).toEqual(names);
    const gear = { chest: { id: 'actual', baseName: 'Plate Mail', rarity: 'Eidolic', stats: { defense: 123 } },
        mainHand: { id: 'sword', baseName: 'Iron Sword', type: 'WEAPON', slot: 'mainHand', rarity: 'Rare' } };
    const saved = JSON.stringify(gear);
    for (const name of names) {
        const model = GARMENT_MODELS.outfits[name], offer = COSMETIC_CATALOGUE.find(offer => offer.name === name);
        expect(offer).toMatchObject({ id: model.id, kind: 'outfit', priceEP: 25 });
        expect(Object.keys(model.models).sort()).toEqual(['Cleric', 'Fighter', 'Rogue', 'Wizard']);
        const rendered = equipmentWithAppearances(gear, { outfit: { baseName: name, rarity: 'Common', slot: 'outfit' } });
        expect(rendered.outfit.baseName).toBe(name); expect(rendered.mainHand).toBe(gear.mainHand); expect(rendered.chest).toBe(gear.chest);
    }
    expect(JSON.stringify(gear)).toBe(saved);
});

test.each(names.flatMap(name => ['Fighter', 'Rogue', 'Cleric', 'Wizard'].flatMap(actorClass => ['high', 'low'].map(quality => [name, actorClass, quality]))))('%s %s %s has complete actual skinned geometry and canonical UV/joint streams', async (name, actorClass, quality) => {
    const outfit = GARMENT_MODELS.outfits[name], asset = outfit.models[actorClass][quality], bytes = readFileSync(asset.file);
    expect(bytes.length).toBe(asset.bytes); expect(hash(bytes)).toBe(asset.sha256);
    const data = new ArrayBuffer(bytes.length); new Uint8Array(data).set(bytes);
    const model = await new GLTFLoader().parseAsync(data, ''); model.scene.updateMatrixWorld(true);
    const slots = new Set(); let canonical, ornaments = 0, meshes = 0;
    model.scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        meshes++; expect(mesh.isSkinnedMesh).toBe(true);
        let owner = mesh;
        while (owner && !owner.userData.garmentSlot) owner = owner.parent;
        expect(outfit.coverage[owner?.userData.garmentSlot]).toBeDefined(); slots.add(owner.userData.garmentSlot);
        if (owner.userData.garmentOrnament) ornaments++;
        const bones = mesh.skeleton.bones.map(bone => bone.name); expect(bones).toHaveLength(53);
        if (canonical) expect(bones).toEqual(canonical); else canonical = bones;
        for (const inverse of mesh.skeleton.boneInverses) expect(inverse.elements.every(Number.isFinite)).toBe(true);
        const count = mesh.geometry.attributes.position.count;
        for (const attribute of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
            const stream = mesh.geometry.attributes[attribute];
            expect(stream.count).toBe(count); expect(stream.isInterleavedBufferAttribute).not.toBe(true);
            expect([...stream.array].every(Number.isFinite)).toBe(true);
        }
        for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 12))) {
            const point = mesh.getVertexPosition(i, new THREE.Vector3());
            expect(point.toArray().every(Number.isFinite)).toBe(true); expect(point.length()).toBeLessThan(3);
        }
    });
    expect([...slots].sort()).toEqual(Object.keys(outfit.coverage).sort()); expect(meshes).toBeGreaterThan(7); expect(ornaments).toBeGreaterThan(4);
});
