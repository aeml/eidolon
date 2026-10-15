import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Document, NodeIO, Accessor, VertexLayout } from '@gltf-transform/core';
import { mergeDocuments, compactPrimitive, prune, unpartition } from '@gltf-transform/functions';
import { SEASONAL_GARMENT_IDS, sculptSeasonalGarment } from './sculpt-seasonal-garments.mjs';
import { AUTHORED_ASSETS } from '../src/assets/authoredEquipment.generated.js';

// Derive a complete fitted garment without modifying delivered actors, source
// equipment or animation banks. New modeled ornaments share their actual rig.
const check = process.argv.includes('--check');
assert(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: generate-garment-models.mjs [--check]');
const designs = JSON.parse(await readFile('server/internal/game/content/garments.json', 'utf8'));
const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE), classes = ['Fighter', 'Rogue', 'Cleric', 'Wizard'];
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

function panel(points, depth, bevel = .002) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel,
        bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
    geometry.translate(0, 0, -depth / 2); return geometry;
}
function crescent(radius, depth, high) {
    const shape = new THREE.Shape(); shape.absarc(0, 0, radius, .35 * Math.PI, 1.65 * Math.PI, false);
    shape.quadraticCurveTo(-radius * .3, 0, Math.cos(.35 * Math.PI) * radius, Math.sin(.35 * Math.PI) * radius);
    // Low keeps the lunar outline but omits its subpixel bevel strips and
    // uses fewer arc samples; original robe, UV and skin streams stay intact.
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: high, bevelSize: depth / 4,
        bevelThickness: depth / 4, bevelSegments: 1, steps: 1, curveSegments: high ? 16 : 4 });
    geometry.translate(0, 0, -depth / 2); return geometry;
}
function sculptClassGarment(options) {
    const { design, quality, sources, ornament, gold, steel, gem, helmet, shoulders, chest, scale, material } = options;
    const high = quality === 'high';
    const place = (geometry, anchor, name, material, slot) => {
        geometry.translate(...anchor.toArray()); ornament(geometry, anchor, name, material, slot);
    };
    const headAnchor = new THREE.Vector3(0, helmet.max.y - .045 * scale, helmet.max.z + .01 * scale);
    const chestY = chest.min.y + (chest.max.y - chest.min.y) * (design.id === 'nightglass-cowl-v1' ? .6 : .82);
    const chestAnchor = frontSurface(sources.chest, 0, chestY, chest.max.z + 1);
    chestAnchor.z += .012 * scale;
    if (design.id === 'nightglass-cowl-v1') {
        const brow = panel([[-.1, .015], [-.07, .04], [0, -.035], [.07, .04], [.1, .015], [0, -.06]].map(([x, y]) => [x * scale, y * scale]), .008 * scale);
        place(brow, headAnchor, 'Nightglass brow diadem', steel, 'head');
        for (const sign of [-1, 1]) {
            const anchor = new THREE.Vector3(sign * helmet.max.x * .8, helmet.max.y - .035 * scale, helmet.min.z + .04 * scale);
            const vane = panel([[0, 0], [sign * .025, .1], [sign * .015, .18], [sign * .06, .12], [sign * .05, .02]].map(([x, y]) => [x * scale, y * scale]), .014 * scale);
            place(vane, anchor, `Raven hood vane ${sign}`, steel, 'head');
            for (let i = 0; i < 3; i++) {
                const anchor = new THREE.Vector3(sign * shoulders.max.x * (.74 + i * .1), shoulders.max.y - .025 * i * scale, shoulders.min.z + .08 * scale);
                const feather = panel([[0, 0], [sign * .11, .06], [sign * .15, .15], [sign * .04, .1], [-sign * .015, .035]].map(([x, y]) => [x * scale, y * scale]), .015 * scale);
                feather.rotateY(-sign * .25); place(feather, anchor, `Raven shoulder vane ${sign} ${i}`, i === 1 ? gold : steel, 'shoulders');
            }
        }
        const clasp = panel([[0, .07], [.06, 0], [0, -.07], [-.06, 0]].map(([x, y]) => [x * scale, y * scale]), .012 * scale);
        place(clasp, chestAnchor, 'Nightglass crossed clasp', gold, 'chest');
        const stone = new THREE.OctahedronGeometry(.04 * scale); stone.scale(.55, 1, .35);
        place(stone, chestAnchor.clone().add(new THREE.Vector3(0, 0, .016 * scale)), 'Nightglass cut stone', gem, 'chest');
    } else if (design.id === 'dawn-reliquary-v1') {
        const anchor = new THREE.Vector3(0, helmet.max.y - .025 * scale, helmet.min.z + .025 * scale);
        place(new THREE.TorusGeometry(.16 * scale, .009 * scale, high ? 6 : 4, high ? 32 : 20), anchor, 'Mounted solar crest', gold, 'head');
        for (let i = 0; i < 12; i++) {
            const angle = i * Math.PI / 6;
            const ray = panel([[-.008, .155], [0, .21], [.008, .155]].map(([x, y]) => [x * scale, y * scale]), .008 * scale);
            ray.rotateZ(angle); place(ray, anchor, `Solar crest ray ${i}`, gold, 'head');
        }
        for (const sign of [-1, 1]) {
            const brace = panel([[sign * .025, -.08], [sign * .04, .015], [sign * .015, .08], [0, -.08]].map(([x, y]) => [x * scale, y * scale]), .012 * scale);
            place(brace, anchor, `Solar crest support ${sign}`, steel, 'head');
            for (let i = 0; i < 3; i++) {
                const anchor = new THREE.Vector3(sign * shoulders.max.x * (.76 + .09 * i), shoulders.max.y - .018 * i * scale, .015 * scale);
                const leaf = panel([[0, 0], [sign * .025, .09], [sign * .09, .12], [sign * .13, .055], [sign * .08, .035]].map(([x, y]) => [x * scale, y * scale]), .018 * scale);
                leaf.rotateX(.3); place(leaf, anchor, `Gilded shoulder leaf ${sign} ${i}`, i === 1 ? steel : gold, 'shoulders');
            }
        }
        place(new THREE.TorusGeometry(.065 * scale, .009 * scale, high ? 6 : 4, high ? 24 : 16), chestAnchor, 'Radiant reliquary bezel', gold, 'chest');
        const sun = panel(Array.from({ length: 16 }, (_, i) => {
            const a = i * Math.PI / 8, r = (i % 2 ? .027 : .052) * scale; return [Math.sin(a) * r, Math.cos(a) * r];
        }), .012 * scale);
        place(sun, chestAnchor.clone().add(new THREE.Vector3(0, 0, .014 * scale)), 'Radiant reliquary star', gem, 'chest');
    } else if (design.id === 'astral-sovereign-v1') {
        const crest = crescent(.115 * scale, .015 * scale, high); crest.rotateZ(-Math.PI / 2);
        place(crest, headAnchor.clone().add(new THREE.Vector3(0, .045 * scale, -.005 * scale)), 'Sculpted lunar crown', gold, 'head');
        const star = new THREE.OctahedronGeometry(.035 * scale); star.scale(.6, 1.2, .4);
        place(star, headAnchor.clone().add(new THREE.Vector3(0, .08 * scale, .008 * scale)), 'Lunar crown stone', gem, 'head');
        for (const sign of [-1, 1]) for (let i = 0; i < 2; i++) {
            const anchor = new THREE.Vector3(sign * shoulders.max.x * (.78 + i * .11), shoulders.max.y - i * .035 * scale, .015 * scale);
            const plate = crescent((.075 - i * .012) * scale, .014 * scale, high);
            plate.rotateZ(sign < 0 ? Math.PI : 0); plate.rotateY(sign * .4);
            place(plate, anchor, `Swept lunar pauldron ${sign} ${i}`, i ? steel : gold, 'shoulders');
        }
        const rays = panel([[0, .08], [.016, .025], [.055, 0], [.016, -.025], [0, -.08], [-.016, -.025], [-.055, 0], [-.016, .025]].map(([x, y]) => [x * scale, y * scale]), .01 * scale);
        place(rays, chestAnchor, 'Astral eight-point setting', gold, 'chest');
        const stone = new THREE.OctahedronGeometry(.045 * scale); stone.scale(.7, 1, .35);
        place(stone, chestAnchor.clone().add(new THREE.Vector3(0, 0, .014 * scale)), 'Astral sapphire', gem, 'chest');
    } else if (design.id === 'winterthorn-revel-v1') {
        // Materials are created by the document-owned callback below, rather
        // than borrowing or mutating any source equipment material.
        const bark = material('Dark ashwood', 0x735640, .1, .8);
        const holly = material('Wrapped oxblood leather', 0x3f7059, 0, .85);
        const berries = material('Winter ruby berries', 0xc85957, .05, .4);
        const cloth = material('Undersuit charcoal', design.secondary, 0, .95);
        const tube = (points, radius, anchor, name) => {
            const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x * scale, y * scale, z * scale)));
            const segments = high ? 16 : 8, radial = high ? 6 : 4;
            const geometry = new THREE.TubeGeometry(curve, segments, radius * scale, radial, false), position = geometry.attributes.position;
            for (let ring = 0; ring <= segments; ring++) {
                const t = ring / segments, center = curve.getPointAt(t), taper = 1 - .98 * t * t;
                for (let i = 0; i <= radial; i++) {
                    const index = ring * (radial + 1) + i;
                    const point = new THREE.Vector3().fromBufferAttribute(position, index).sub(center).multiplyScalar(taper).add(center);
                    position.setXYZ(index, point.x, point.y, point.z);
                }
            }
            geometry.computeVertexNormals(); place(geometry, anchor, name, bark, 'head');
        };
        for (const sign of [-1, 1]) {
            const anchor = new THREE.Vector3(sign * helmet.max.x * .78, helmet.max.y - .055 * scale, helmet.min.z + .06 * scale);
            tube([[0, 0, 0], [sign * .055, .1, -.015], [sign * .07, .24, -.035], [sign * .045, .34, -.02]], .012, anchor, `Winter stag crown ${sign}`);
            tube([[sign * .055, .1, -.015], [sign * .125, .15, -.025], [sign * .15, .21, -.035]], .009, anchor, `Winter stag lower tine ${sign}`);
            tube([[sign * .07, .24, -.035], [sign * .13, .28, -.05], [sign * .14, .34, -.05]], .008, anchor, `Winter stag upper tine ${sign}`);
        }
        const collarAnchor = new THREE.Vector3(0, chest.max.y - .045 * scale, .045 * scale);
        const collar = new THREE.TorusGeometry(.15 * scale, .032 * scale, high ? 10 : 6, high ? 32 : 16);
        collar.rotateX(Math.PI / 2); place(collar, collarAnchor, 'Pale winter collar', cloth, 'chest');
        for (const [i, angle] of [-.75, .75, Math.PI].entries()) {
            const leaf = panel([[0, 0], [-.025, .025], [-.015, .04], [-.03, .055], [0, .09], [.03, .055], [.015, .04], [.025, .025]].map(([x, y]) => [x * scale, y * scale]), .008 * scale);
            leaf.rotateZ(angle); place(leaf, chestAnchor, `Holly seal leaf ${i}`, holly, 'chest');
        }
        for (let i = 0; i < 3; i++) {
            const berry = new THREE.OctahedronGeometry(.014 * scale, high ? 1 : 0);
            place(berry, chestAnchor.clone().add(new THREE.Vector3((i - 1) * .018 * scale, i === 1 ? .009 * scale : 0, .017 * scale)), `Holly seal berry ${i}`, berries, 'chest');
        }
    } else if (SEASONAL_GARMENT_IDS.includes(design.id)) {
        sculptSeasonalGarment({ ...options, headAnchor, chestAnchor, place, panel });
    } else throw Error('Unregistered sculpted garment');
}

for (const design of designs) {
    assert.equal(design.kind, 'outfit'); assert(['iron-oath-regalia-v1', 'nightglass-cowl-v1', 'dawn-reliquary-v1', 'astral-sovereign-v1', 'winterthorn-revel-v1', ...SEASONAL_GARMENT_IDS].includes(design.id), 'Add a deliberate model design before extending the catalog');
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
            if (design.id !== 'iron-oath-regalia-v1') {
                sculptClassGarment({ design, quality, sources, ornament, gold, steel, gem, helmet, shoulders, chest, scale,
                    material: (name, color, metallic, roughness) => document.createMaterial(name).setBaseColorFactor(linear(color)).setMetallicFactor(metallic).setRoughnessFactor(roughness) });
            } else {
            const crownWidth = size.x * .45, crownBase = helmet.max.y - .065 * scale;
            const crownShape = new THREE.Shape();
            crownShape.moveTo(-crownWidth / 2, 0); crownShape.lineTo(crownWidth / 2, 0);
            crownShape.lineTo(crownWidth / 2, .027 * scale);
            for (let i = 4; i >= 0; i--) {
                const x = (i / 4 - .5) * crownWidth;
                crownShape.lineTo(x, (.13 - Math.abs(i - 2) * .021) * scale);
                if (i) crownShape.lineTo(x - crownWidth / 8, .035 * scale);
            }
            crownShape.lineTo(-crownWidth / 2, 0);
            const crown = new THREE.ExtrudeGeometry(crownShape, { depth: .008 * scale, bevelEnabled: true,
                bevelSize: .002 * scale, bevelThickness: .002 * scale, bevelSegments: 1, steps: 1, curveSegments: 1 });
            const crownPositions = crown.attributes.position;
            for (let i = 0; i < crownPositions.count; i++) {
                const x = crownPositions.getX(i), surface = frontSurface(sources.head, x, crownBase, helmet.max.z + 1);
                crownPositions.setXYZ(i, x, crownPositions.getY(i) + crownBase, crownPositions.getZ(i) + surface.z + .003 * scale);
            }
            crown.computeVertexNormals();
            ornament(crown, frontSurface(sources.head, 0, crownBase, helmet.max.z + 1), 'Crowned oath crest', gold, 'head');
            for (const sign of [-1, 1]) for (let i = 0; i < 2; i++) {
                const anchor = new THREE.Vector3(sign * shoulders.max.x * (.73 + i * .13), shoulders.max.y - .025 * scale, .02 * scale);
                const direction = new THREE.Vector3(sign * (.5 + i * .15), .9, -.1).normalize(), height = (.115 - i * .015) * scale;
                const fin = new THREE.ConeGeometry(.04 * scale, height * 1.15, quality === 'high' ? 8 : 6);
                fin.scale(1, 1, .38);
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
            }
            // Materials receive their shared maps at runtime; UVs are required
            // even though no texture is embedded in the model file. Separate
            // streams also preserve the existing guarded fitted batching route.
            await document.transform(prune({ keepAttributes: true }), unpartition());
            const output = await io.writeBinary(document), file = `assets/garments/${design.id}/${actorClass}-${quality}.glb`;
            const jsonLength = new DataView(output.buffer, output.byteOffset, output.byteLength).getUint32(12, true);
            const json = JSON.parse(new TextDecoder().decode(output.subarray(20, 20 + jsonLength)));
            for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
                for (const semantic of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) {
                    assert(Object.hasOwn(primitive.attributes, semantic), `Missing garment ${semantic}`);
                    const accessor = json.accessors[primitive.attributes[semantic]], view = json.bufferViews[accessor.bufferView];
                    const width = { VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type] * { 5121: 1, 5123: 2, 5126: 4 }[accessor.componentType];
                    assert(!view.byteStride || view.byteStride === width, `Interleaved garment ${semantic}`);
                }
            }
            garment.models[actorClass][quality] = { file: `./${file}`, bytes: output.length, sha256: digest(output) };
            if (check) assert.equal(digest(await readFile(file)), digest(output), `Stale garment model ${file}`);
            else { await mkdir(`assets/garments/${design.id}`, { recursive: true }); await writeFile(file, output); }
        }
    }
    manifest.outfits[design.name] = garment;
}
const versions = Object.fromEntries(Object.values(manifest.outfits).flatMap(outfit => Object.values(outfit.models)
    .flatMap(models => Object.values(models).map(model => [model.file, model.sha256.slice(0, 16)]))));
const output = `// Generated by scripts/generate-garment-models.mjs. Do not edit.\nexport const GARMENT_MODELS = ${JSON.stringify(manifest, null, 2)};\nexport const GARMENT_ASSET_VERSIONS = ${JSON.stringify(versions, null, 2)};\n`;
const file = 'src/assets/garments.generated.js';
if (check) assert.equal(await readFile(file, 'utf8'), output, 'Stale garment model manifest');
else await writeFile(file, output);
console.log(`${check ? 'Verified' : 'Generated'} ${Object.keys(manifest.outfits).length} complete outfit models, four class fits each, High/Low.`);
