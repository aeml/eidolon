import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Document, NodeIO, Accessor } from '@gltf-transform/core';
import { mergeDocuments, compactPrimitive, prune, unpartition } from '@gltf-transform/functions';
import { AUTHORED_ASSETS } from '../src/assets/authoredEquipment.generated.js';

// Derive a complete fitted garment without modifying delivered actors, source
// equipment or animation banks. New modeled ornaments share their actual rig.
const check = process.argv.includes('--check');
assert(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: generate-garment-models.mjs [--check]');
const designs = JSON.parse(await readFile('server/internal/game/content/garments.json', 'utf8'));
const io = new NodeIO(), classes = ['Fighter', 'Rogue', 'Cleric', 'Wizard'];
const digest = data => createHash('sha256').update(data).digest('hex');
const linear = hex => [...new THREE.Color(hex).toArray(), 1];
const identity = new THREE.Matrix4().elements;
const manifest = { schemaVersion: 1, outfits: {} };

function vertices(primitive) {
    const position = primitive.getAttribute('POSITION'), result = [], value = [];
    for (let i = 0; i < position.getCount(); i++) result.push([...position.getElement(i, value)]);
    return result;
}
function bounds(primitives) {
    const points = primitives.flatMap(vertices);
    return new THREE.Box3().setFromPoints(points.map(point => new THREE.Vector3(...point)));
}
function frontSurface(primitives, x, y, z) {
    const ray = new THREE.Ray(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, -1));
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
    let closest;
    for (const primitive of primitives) {
        const positions = primitive.getAttribute('POSITION'), indices = primitive.getIndices(), values = [];
        for (let i = 0, count = indices?.getCount() || positions.getCount(); i < count; i += 3) {
            const index = offset => indices ? indices.getScalar(i + offset) : i + offset;
            a.fromArray(positions.getElement(index(0), values)); b.fromArray(positions.getElement(index(1), values)); c.fromArray(positions.getElement(index(2), values));
            if (ray.intersectTriangle(a, b, c, false, hit) && (!closest || hit.z > closest.z)) closest = hit.clone();
        }
    }
    assert(closest, 'Garment chest has no front surface at its seal anchor');
    return closest;
}
function addOrnament(document, scene, skin, source, geometry, anchor, name, material, slot) {
    let nearest, distance = Infinity;
    for (const primitive of source) {
        const positions = primitive.getAttribute('POSITION'), point = [];
        for (let i = 0; i < positions.getCount(); i++) {
            const d = new THREE.Vector3(...positions.getElement(i, point)).distanceToSquared(anchor);
            if (d < distance) { distance = d; nearest = { primitive, i }; }
        }
    }
    assert(nearest, `No skin anchor for ${name}`);
    const indices = nearest.primitive.getAttribute('JOINTS_0').getElement(nearest.i, []);
    const weights = nearest.primitive.getAttribute('WEIGHTS_0').getElement(nearest.i, []);
    const buffer = document.getRoot().listBuffers()[0], primitive = document.createPrimitive().setMaterial(material);
    for (const [semantic, attribute, type] of [['POSITION', geometry.attributes.position, Accessor.Type.VEC3],
        ['NORMAL', geometry.attributes.normal, Accessor.Type.VEC3], ['TEXCOORD_0', geometry.attributes.uv, Accessor.Type.VEC2]]) {
        primitive.setAttribute(semantic, document.createAccessor().setType(type).setBuffer(buffer).setArray(attribute.array.slice()));
    }
    const count = geometry.attributes.position.count;
    primitive.setAttribute('JOINTS_0', document.createAccessor().setType(Accessor.Type.VEC4).setBuffer(buffer)
        .setArray(Uint16Array.from({ length: count * 4 }, (_, i) => indices[i % 4])));
    primitive.setAttribute('WEIGHTS_0', document.createAccessor().setType(Accessor.Type.VEC4).setBuffer(buffer)
        .setArray(Float32Array.from({ length: count * 4 }, (_, i) => weights[i % 4])));
    if (geometry.index) primitive.setIndices(document.createAccessor().setType(Accessor.Type.SCALAR).setBuffer(buffer).setArray(geometry.index.array.slice()));
    scene.addChild(document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive)).setSkin(skin)
        .setExtras({ garmentSlot: slot, garmentOrnament: true }));
    geometry.dispose();
}

for (const design of designs) {
    assert.equal(design.kind, 'outfit'); assert.equal(design.id, 'iron-oath-regalia-v1', 'Add a deliberate model design before extending the catalog');
    const garment = { id: design.id, name: design.name, coverage: {}, models: {}, provenance: [] };
    for (const [slot, name] of Object.entries(design.pieces)) {
        const item = AUTHORED_ASSETS.items[name]; assert.equal(item?.slot, slot);
        garment.coverage[slot] = item.id;
    }
    assert.equal(Object.keys(garment.coverage).length, 7);
    for (const actorClass of classes) {
        garment.models[actorClass] = {};
        for (const quality of ['high', 'low']) {
            const document = new Document(), scene = document.createScene(design.name);
            document.getRoot().setDefaultScene(scene);
            const sources = {};
            let skin;
            for (const [slot, name] of Object.entries(design.pieces)) {
                const path = AUTHORED_ASSETS.items[name].runtimeModels.standard[actorClass][quality];
                const bytes = await readFile(path), source = await io.readBinary(bytes), map = mergeDocuments(document, source);
                const incoming = map.get(source.getRoot().listSkins()[0]);
                if (!skin) {
                    skin = incoming;
                    for (const child of map.get(source.getRoot().listScenes()[0]).listChildren()) scene.addChild(child);
                } else {
                    assert.deepEqual(incoming.listJoints().map(joint => joint.getName()), skin.listJoints().map(joint => joint.getName()));
                    assert.deepEqual(incoming.getInverseBindMatrices().getArray(), skin.getInverseBindMatrices().getArray());
                }
                const meshes = source.getRoot().listNodes().filter(node => node.getMesh());
                sources[slot] = [];
                for (const original of meshes) {
                    assert(original.getWorldMatrix().every((value, i) => Math.abs(value - identity[i]) < 1e-6), 'Nonidentity fitted garment source');
                    const node = map.get(original); node.setSkin(skin).setExtras({ garmentSlot: slot });
                    scene.addChild(node);
                    for (const primitive of node.getMesh().listPrimitives()) {
                        compactPrimitive(primitive); sources[slot].push(primitive);
                    }
                }
                if (incoming !== skin) {
                    const redundantJoints = incoming.listJoints();
                    incoming.dispose();
                    for (const joint of redundantJoints) {
                        assert(!skin.listJoints().includes(joint), 'Cannot retire the canonical garment rig');
                        joint.dispose();
                    }
                }
                garment.provenance.push({ actorClass, quality, slot, path, sha256: digest(bytes) });
            }
            for (const other of document.getRoot().listScenes()) if (other !== scene) other.dispose();
            for (const material of document.getRoot().listMaterials()) {
                const trim = /edges|gold/i.test(material.getName());
                material.setBaseColorFactor(linear(trim ? design.secondary : design.primary));
                const soft = /cloth|leather|undersuit/i.test(material.getName());
                material.setMetallicFactor(soft ? 0 : .8).setRoughnessFactor(soft ? .86 : trim ? .3 : .48);
            }
            const gold = document.createMaterial('Antique gold settings').setBaseColorFactor(linear(design.secondary)).setMetallicFactor(.85).setRoughnessFactor(.3);
            const steel = document.createMaterial('Forged silver').setBaseColorFactor(linear(design.primary)).setMetallicFactor(.82).setRoughnessFactor(.4);
            const gem = document.createMaterial('Oath crystal').setBaseColorFactor(linear(0x8bcbdc)).setMetallicFactor(.1).setRoughnessFactor(.18)
                .setEmissiveFactor([.018, .065, .085]);
            const helmet = bounds(sources.head), shoulders = bounds(sources.shoulders), chest = bounds(sources.chest);
            const size = helmet.getSize(new THREE.Vector3()), scale = size.x / .3;
            const ornament = (geometry, anchor, name, material, slot) => addOrnament(document, scene, skin, sources[slot], geometry, anchor, name, material, slot);
            for (let i = -1; i <= 1; i++) {
                const anchor = new THREE.Vector3(i * size.x * .21, helmet.max.y - .015 * scale, helmet.getCenter(new THREE.Vector3()).z);
                const height = (i ? .075 : .12) * scale;
                const crown = new THREE.ConeGeometry(.023 * scale, height, quality === 'high' ? 8 : 6);
                crown.translate(anchor.x, anchor.y + height / 2, anchor.z);
                ornament(crown, anchor, `Oath crown ${i}`, gold, 'head');
            }
            for (const sign of [-1, 1]) for (let i = 0; i < 2; i++) {
                const anchor = new THREE.Vector3(sign * shoulders.max.x * (.73 + i * .13), shoulders.max.y - .025 * scale, .02 * scale);
                const direction = new THREE.Vector3(sign * (.5 + i * .15), .9, -.1).normalize(), height = (.115 - i * .015) * scale;
                const fin = new THREE.ConeGeometry(.03 * scale, height, quality === 'high' ? 8 : 6);
                fin.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
                fin.translate(...anchor.clone().addScaledVector(direction, height / 2).toArray());
                ornament(fin, anchor, `Swept oath fin ${sign} ${i}`, steel, 'shoulders');
            }
            const y = chest.min.y + (chest.max.y - chest.min.y) * .68;
            const anchor = frontSurface(sources.chest, 0, y, chest.max.z + 1);
            const seal = new THREE.TorusGeometry(.052 * scale, .007 * scale, quality === 'high' ? 6 : 4, quality === 'high' ? 24 : 16);
            seal.translate(anchor.x, anchor.y, anchor.z + .008 * scale); ornament(seal, anchor, 'Covenant seal bezel', gold, 'chest');
            const crystal = new THREE.OctahedronGeometry(.035 * scale);
            crystal.scale(.75, 1, .4); crystal.translate(anchor.x, anchor.y, anchor.z + .018 * scale);
            ornament(crystal, anchor, 'Pale covenant stone', gem, 'chest');
            await document.transform(prune(), unpartition());
            const output = await io.writeBinary(document), file = `assets/garments/${design.id}/${actorClass}-${quality}.glb`;
            garment.models[actorClass][quality] = { file: `./${file}`, bytes: output.length, sha256: digest(output) };
            if (check) assert.equal(digest(await readFile(file)), digest(output), `Stale garment model ${file}`);
            else { await mkdir(`assets/garments/${design.id}`, { recursive: true }); await writeFile(file, output); }
        }
    }
    manifest.outfits[design.name] = garment;
}
const output = `// Generated by scripts/generate-garment-models.mjs. Do not edit.\nexport const GARMENT_MODELS = ${JSON.stringify(manifest, null, 2)};\n`;
const file = 'src/assets/garments.generated.js';
if (check) assert.equal(await readFile(file, 'utf8'), output, 'Stale garment model manifest');
else await writeFile(file, output);
console.log(`${check ? 'Verified' : 'Generated'} ${Object.keys(manifest.outfits).length} complete outfit model, four class fits, High/Low.`);
