import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Document, NodeIO, Accessor, VertexLayout } from '@gltf-transform/core';
import { AUTHORED_ASSETS } from '../src/assets/authoredEquipment.generated.js';

// New rigid garment models use the delivered grip coordinate system. Original
// equipment, actors, sockets and animation banks remain byte-for-byte intact.
const check = process.argv.includes('--check');
assert(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: generate-held-garments.mjs [--check]');
const designs = JSON.parse(await readFile('assets/garments/held-designs.json', 'utf8'));
const catalogue = JSON.parse(await readFile('server/internal/game/content/cosmetics.json', 'utf8'));
const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = {};

function polygon(points, depth, bevel = .004) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
        bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
}

function model(design, quality) {
    const high = quality === 'high', groups = new Map();
    const add = (role, geometry, x = 0, y = 0, z = 0) => {
        geometry.translate(x, y, z);
        const list = groups.get(role) || []; list.push(geometry.index ? geometry.toNonIndexed() : geometry);
        if (geometry.index) geometry.dispose();
        groups.set(role, list);
    };
    const shaft = (role, radius, length, y, x = 0, z = 0) => add(role, new THREE.CylinderGeometry(radius, radius, length, high ? 12 : 8), x, y, z);
    const band = (role, radius, y, x = 0, z = 0) => shaft(role, radius, .015, y, x, z);
    const stone = (radius, x, y, z, stretch = [1, 1, 1]) => {
        const geometry = new THREE.OctahedronGeometry(radius); geometry.scale(...stretch); add('crystal', geometry, x, y, z);
    };
    const line = (points, radius, role = 'gold') => {
        const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
        add(role, new THREE.TubeGeometry(curve, high ? 16 : 8, radius, high ? 6 : 4, false));
    };
    const handle = length => {
        shaft('leather', .019, length, -.06);
        for (let i = 0; i < 5; i++) band('gold', .021, -.06 - length / 2 + (i + .5) * length / 5);
        stone(.032, 0, -.06 - length / 2 - .025, 0, [1, .8, 1]);
    };
    if (design === 'thornblade') {
        handle(.22);
        add('steel', polygon([[0, .96], [.032, .85], [.043, .63], [.065, .51], [.042, .53], [.048, .27], [.065, .19], [.043, .2], [.04, .065], [-.04, .065], [-.043, .2], [-.065, .19], [-.048, .27], [-.042, .53], [-.065, .51], [-.043, .63], [-.032, .85]], .026));
        add('crystal', polygon([[0, .86], [.011, .69], [.012, .17], [0, .11], [-.012, .17], [-.011, .69]], .005, .001), 0, 0, .019);
        for (const sign of [-1, 1]) {
            line([[0, .055, 0], [sign * .07, .07, 0], [sign * .12, .12, 0], [sign * .14, .2, 0]], .013);
            add('gold', polygon([[0, 0], [sign * .043, .025], [sign * .06, .08], [sign * .015, .055]], .014), sign * .075, .08, 0);
        }
        band('gold', .031, .055); stone(.035, 0, .055, .03, [1, 1, .5]);
    } else if (design === 'crescent-dagger') {
        handle(.2);
        add('steel', polygon([[0, .045], [.042, .1], [.08, .21], [.087, .32], [.055, .44], [.001, .49], [.027, .39], [.023, .29], [-.016, .19], [-.035, .1]], .022));
        add('crystal', polygon([[.019, .13], [.057, .25], [.058, .35], [.04, .4], [.036, .3], [.005, .2]], .004, .001), 0, 0, .017);
        for (const sign of [-1, 1]) line([[0, .04, 0], [sign * .065, .075, 0], [sign * .1, .035, 0], [sign * .08, -.005, 0]], .011);
        stone(.032, 0, .045, .025, [1, 1, .6]);
    } else if (design === 'phoenix-staff') {
        shaft('wood', .022, 1.42, 0);
        shaft('leather', .027, .24, 0);
        for (const y of [-.68, -.14, .14, .63]) band('gold', .033, y);
        for (const sign of [-1, 1]) {
            add('gold', polygon([[sign * .02, .62], [sign * .08, .68], [sign * .17, .89], [sign * .2, .97], [sign * .15, .91], [sign * .14, 1.03], [sign * .1, .94], [sign * .075, 1.05], [sign * .05, .9], [sign * .01, .8]], .024));
            line([[sign * .025, .65, .025], [sign * .07, .75, .025], [sign * .11, .88, .025]], .006, 'steel');
        }
        stone(.105, 0, .86, 0, [.7, 1.5, .7]);
        stone(.035, 0, -.74, 0);
    } else if (design === 'tide-mace') {
        handle(.24); shaft('steel', .022, .35, .18);
        for (const y of [.1, .28, .51]) band('gold', .035, y);
        shaft('gold', .036, .24, .4);
        stone(.1, 0, .41, 0, [.7, 1.4, .7]);
        for (let i = 0; i < 4; i++) {
            const flange = polygon([[.028, .29], [.095, .27], [.145, .34], [.13, .45], [.09, .57], [.06, .6], [.075, .49], [.05, .35]], .022);
            flange.rotateY(i * Math.PI / 2); add('steel', flange);
        }
        stone(.033, 0, .59, 0);
    } else if (design === 'oak-shield') {
        const outline = [[0, .39], [.14, .32], [.26, .28], [.28, .12], [.25, -.08], [.19, -.26], [0, -.4], [-.19, -.26], [-.25, -.08], [-.28, .12], [-.26, .28], [-.14, .32]];
        add('gold', polygon(outline, .055, .012), 0, 0, .075);
        add('wood', polygon(outline.map(([x, y]) => [x * .88, y * .88]), .024, .008), 0, 0, .113);
        line([[0, -.28, .14], [-.015, -.08, .17], [.018, .09, .17], [0, .3, .14]], .016);
        for (const sign of [-1, 1]) for (const offset of [0, .13]) {
            line([[0, -.1 + offset, .165], [sign * .08, .04 + offset, .17], [sign * .19, .1 + offset, .15]], .011);
            add('steel', polygon([[0, 0], [sign * .05, .015], [sign * .055, .06], [0, .04]], .008), sign * .13, .15 + offset, .163);
        }
        stone(.052, 0, .03, .195, [1, 1.4, .6]);
        // Rear handle stays in the same delivered hand-grip envelope.
        const grip = new THREE.TorusGeometry(.06, .012, high ? 6 : 4, high ? 16 : 10, Math.PI);
        grip.rotateY(Math.PI / 2); add('leather', grip, 0, 0, .015);
    } else if (design === 'astral-tome') {
        add('vellum', new THREE.BoxGeometry(.225, .3, .055), -.01, .1, .064);
        for (const z of [.025, .103]) add('leather', polygon([[-.14, -.07], [.125, -.07], [.125, .27], [-.14, .27]], .016, .006), 0, 0, z);
        shaft('gold', .012, .33, .1, -.135, .065);
        for (const x of [-.112, .097]) for (const y of [-.04, .24]) {
            add('gold', polygon([[0, -.025], [.023, 0], [0, .025], [-.023, 0]], .009, .002), x, y, .12);
        }
        const crescent = new THREE.Shape();
        crescent.absarc(0, 0, .077, .35 * Math.PI, 1.65 * Math.PI, false);
        crescent.quadraticCurveTo(-.012, 0, Math.cos(.35 * Math.PI) * .077, Math.sin(.35 * Math.PI) * .077);
        const geometry = new THREE.ExtrudeGeometry(crescent, { depth: .01, bevelEnabled: true, bevelSegments: 1, bevelSize: .002, bevelThickness: .002, steps: 1, curveSegments: high ? 16 : 8 });
        add('gold', geometry, -.012, .1, .12);
        stone(.036, .022, .1, .145, [.7, 1, .5]);
        for (const y of [-.035, .235]) line([[-.09, y, .123], [0, y + .008, .123], [.075, y, .123]], .004, 'steel');
    } else throw Error(`Unknown held garment model design: ${design}`);
    return groups;
}

for (const design of designs) {
    const offer = catalogue.find(offer => offer.id === design.id); assert(offer, 'Held garment must retain an existing owned unlock');
    const base = AUTHORED_ASSETS.items[offer.base]; assert(['mainHand', 'offHand'].includes(base.slot));
    const record = { id: offer.id, name: offer.name, base: offer.base, slot: base.slot, design: design.design, description: design.description, models: {}, provenance: [] };
    for (const quality of ['high', 'low']) {
        const reference = base.runtimeModels.standard.universal[quality], source = await readFile(reference);
        record.provenance.push({ quality, reference, sha256: digest(source), purpose: 'Delivered rigid grip-coordinate and size reference; source geometry is unchanged.' });
        const document = new Document(), buffer = document.createBuffer(), scene = document.createScene(offer.name);
        document.getRoot().setDefaultScene(scene);
        const colors = { steel: '#b3bec7', gold: '#bfa371', leather: '#293039', wood: '#394e44', vellum: '#c8bea0', crystal: offer.secondary };
        const mesh = document.createMesh(offer.name);
        for (const [role, pieces] of model(design.design, quality)) {
            const geometry = mergeGeometries(pieces); assert(geometry, 'Incompatible held garment attribute streams');
            pieces.forEach(piece => piece.dispose());
            const material = document.createMaterial(`${role === 'gold' ? 'Antique gold settings' : role === 'steel' ? 'Forged silver' : role === 'wood' ? 'Dark ashwood' : role === 'leather' ? 'Wrapped oxblood leather' : role === 'vellum' ? 'Vellum' : 'Garment | cut crystal'}`)
                .setBaseColorFactor([...new THREE.Color(colors[role]).toArray(), 1])
                .setMetallicFactor(['gold', 'steel'].includes(role) ? .8 : 0).setRoughnessFactor(role === 'crystal' ? .2 : ['gold', 'steel'].includes(role) ? .4 : .82);
            if (role === 'crystal') material.setEmissiveFactor(new THREE.Color(offer.secondary).multiplyScalar(.15).toArray());
            const primitive = document.createPrimitive().setMaterial(material);
            for (const [semantic, name, type] of [['POSITION', 'position', Accessor.Type.VEC3], ['NORMAL', 'normal', Accessor.Type.VEC3], ['TEXCOORD_0', 'uv', Accessor.Type.VEC2]]) {
                const attribute = geometry.getAttribute(name); assert(attribute?.array.every(Number.isFinite), `Invalid ${semantic}`);
                primitive.setAttribute(semantic, document.createAccessor().setBuffer(buffer).setType(type).setArray(attribute.array.slice()));
            }
            mesh.addPrimitive(primitive); geometry.dispose();
        }
        scene.addChild(document.createNode(offer.name).setMesh(mesh));
        const bytes = await io.writeBinary(document), file = `assets/garments/${offer.id}/universal-${quality}.glb`;
        record.models[quality] = { file: `./${file}`, bytes: bytes.length, sha256: digest(bytes) };
        if (check) assert.equal(digest(await readFile(file)), digest(bytes), `Stale held garment ${file}`);
        else { await mkdir(`assets/garments/${offer.id}`, { recursive: true }); await writeFile(file, bytes); }
    }
    assert(!manifest[offer.name]); manifest[offer.name] = record;
}
const versions = Object.fromEntries(Object.values(manifest).flatMap(record => Object.values(record.models).map(model => [model.file, model.sha256.slice(0, 16)])));
const result = `// Generated by scripts/generate-held-garments.mjs. Do not edit.\nexport const HELD_GARMENT_MODELS = ${JSON.stringify(manifest, null, 2)};\nexport const HELD_GARMENT_ASSET_VERSIONS = ${JSON.stringify(versions, null, 2)};\n`;
const output = 'src/assets/heldGarments.generated.js';
if (check) assert.equal(await readFile(output, 'utf8'), result, 'Stale held garment manifest');
else await writeFile(output, result);
console.log(`${check ? 'Verified' : 'Generated'} ${designs.length} distinct held garment models, High/Low, unchanged existing unlocks and grips.`);
