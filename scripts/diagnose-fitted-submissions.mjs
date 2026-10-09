import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAuthoredCharacter } from '../src/art/AuthoredCharacters.js';
import { applyFittedEquipment } from '../src/art/FittedEquipment.js';
globalThis.self = globalThis;
globalThis.ProgressEvent = class ProgressEvent { constructor(type, properties) { this.type = type; Object.assign(this, properties); } };
const loader = new GLTFLoader(), cache = new Map();
const load = async path => {
    if (!cache.has(path)) cache.set(path, readFile(new URL(`../${path.replace(/^\.\//, '')}`, import.meta.url))
        .then(bytes => loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')));
    return cache.get(path);
};
const outfits = {
    Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
    Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
    Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
    Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
};
const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'neck', 'ring1', 'ring2', 'trinket1', 'trinket2'];
const reports = [];
for (const [type, names] of Object.entries(outfits)) {
    const root = await createAuthoredCharacter(type, 'high', load);
    root.userData.fittedEquipmentSurfaceBatching = process.argv.includes('--surface-batches');
    const gear = Object.fromEntries([...names, 'Necklace', 'Ruby Ring', 'Silver Ring', 'Amulet of Power', 'Orb of Mana'].map((name, i) => [slots[i], {
        id: `${type}-${slots[i]}`, name, baseName: name, slot: slots[i] === 'offHand' && type === 'Rogue' ? 'mainHand' : slots[i],
        type: ['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace'].includes(name) ? 'WEAPON' : 'ARMOR', rarity: 'Rare'
    }]));
    applyFittedEquipment(root, gear); await root.userData.equipmentReady;
    const meshes = [], appearance = new Map(), appearanceWithoutColor = new Map();
    const serialization = { textures: {}, images: {} };
    root.traverseVisible(mesh => {
        if (!mesh.isMesh) return;
        const materials = [].concat(mesh.material);
        meshes.push({ name: mesh.name, skin: Boolean(mesh.isSkinnedMesh), equipment: Boolean(mesh.userData.authoredEquipment),
            triangles: (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, materials: materials.length,
            joints: mesh.skeleton?.bones.length ?? 0, vertices: mesh.geometry.attributes.position.count,
            attributeBytes: [...new Set(Object.values(mesh.geometry.attributes).map(attribute =>
                attribute.isInterleavedBufferAttribute ? attribute.data : attribute))]
                .reduce((sum, attribute) => sum + attribute.array.byteLength, 0) });
        if (!mesh.isSkinnedMesh || !mesh.userData.authoredEquipment || materials.length !== 1) return;
        const object = materials[0].toJSON(serialization);
        for (const key of ['uuid', 'name', 'metadata', 'userData']) delete object[key];
        for (const [map, stripColor] of [[appearance, false], [appearanceWithoutColor, true]]) {
            const value = { ...object }; if (stripColor) delete value.color;
            const key = JSON.stringify(value);
            if (!map.has(key)) map.set(key, []); map.get(key).push(mesh);
        }
    });
    const summarize = map => [...map.values()].map(parts => ({ count: parts.length, names: parts.map(mesh => mesh.name),
        sameBones: parts.every(mesh => mesh.skeleton.bones.every((bone, i) => bone === parts[0].skeleton.bones[i])),
        sameInverses: parts.every(mesh => mesh.skeleton.boneInverses.every((matrix, i) => matrix.equals(parts[0].skeleton.boneInverses[i]))),
        sameBind: parts.every(mesh => mesh.bindMatrix.equals(parts[0].bindMatrix)) }));
    reports.push({ type, items: root.userData.equipmentVisualItemCount, meshes, appearance: summarize(appearance), appearanceWithoutColor: summarize(appearanceWithoutColor) });
    root.userData.disposeInstance();
}
console.log(JSON.stringify({ scope: 'CPU-only exact delivered GLBs and fitted fourteen-slot gear census; no renderer/animation/device budget claim',
    surfaceBatches: process.argv.includes('--surface-batches'), reports }, null, 2));
