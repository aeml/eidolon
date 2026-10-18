import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, simplifyPrimitive, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/prepare-meshy-fighter.mjs <original-pilot>');
const sourceHash = createHash('sha256').update(await readFile(source)).digest('hex');
if (sourceHash !== '7d7069c066504dde217992a9990b6aa5cb2816d00497f539f46959312105251a') throw new Error('Unreviewed Meshy source');
const names = { Hips: 'pelvis', Spine02: 'spine_01', Spine01: 'spine_02', Spine: 'spine_03', neck: 'neck_01', Head: 'head',
    LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
    RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
    LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
    RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r' };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const variants = {};
await MeshoptSimplifier.ready;
await mkdir(path.join(root, 'assets/archetypes/Fighter'), { recursive: true });
for (const [quality, resolution] of [['high', 1024], ['low', 512]]) {
    const document = await io.read(source), scene = document.getRoot();
    const armature = scene.listNodes().find(node => node.getName() === 'Armature');
    if (!armature || armature.getScale().some(value => Math.abs(value - .01) > .00001)) throw new Error('Unexpected source units');
    armature.setScale([1, 1, 1]);
    for (const node of scene.listNodes()) {
        node.setTranslation(node.getTranslation().map(value => value * .01));
        node.setName(names[node.getName()] || (node.getName() === 'char1' ? 'Fighter_Body' : node.getName()));
    }
    const scaled = new Set();
    const scaleAccessor = accessor => {
        if (scaled.has(accessor)) return;
        const array = accessor.getArray();
        for (let i = 0; i < array.length; i++) array[i] *= .01;
        scaled.add(accessor);
    };
    for (const mesh of scene.listMeshes()) for (const primitive of mesh.listPrimitives()) scaleAccessor(primitive.getAttribute('POSITION'));
    for (const skin of scene.listSkins()) {
        const array = skin.getInverseBindMatrices().getArray();
        for (let i = 0; i < array.length; i += 16) for (const offset of [12, 13, 14]) array[i + offset] *= .01;
    }
    const pelvis = scene.listNodes().find(node => node.getName() === 'pelvis');
    for (const animation of scene.listAnimations()) for (const channel of animation.listChannels()) {
        if (channel.getTargetPath() !== 'translation') continue;
        const output = channel.getSampler().getOutput();
        scaleAccessor(output);
        if (channel.getTargetNode() === pelvis) {
            // Server/world movement owns horizontal displacement. Preserve
            // vertical gait/death motion while removing exported root travel.
            const array = output.getArray(), rest = pelvis.getTranslation();
            for (let i = 0; i < array.length; i += 3) { array[i] = rest[0]; array[i + 2] = rest[2]; }
        }
    }
    await document.transform(weld({ overwrite: false }), resample({ tolerance: .00001 }));
    if (quality === 'low') for (const mesh of scene.listMeshes()) for (const primitive of mesh.listPrimitives()) {
        simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier, ratio: .5, error: .002, lockBorder: true });
    }
    await document.transform(
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [resolution, resolution], slots: /^(?:normalTexture|metallicRoughnessTexture|occlusionTexture)$/, lossless: true, effort: 80 }),
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [resolution, resolution], slots: /^baseColorTexture$/, quality: 90, effort: 80 })
    );
    const relative = `assets/archetypes/Fighter/meshy-pilot-${quality}.glb`;
    const bytes = await io.writeBinary(document);
    await writeFile(path.join(root, relative), bytes);
    variants[quality] = { path: `./${relative}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await writeFile(path.join(root, 'assets/archetypes/Fighter/meshy-pilot-manifest.json'), JSON.stringify({
    provider: 'Meshy API', sourceHash, variants, generated: '2026-10-18',
    modelTask: '01a14db9-f0a2-735b-bbe8-60a4e27f9350', rigTask: '01a14dbb-e927-74be-996c-606dd61e39f7',
    animations: ['Idle', 'Walk', 'Run', 'Attack', 'HitReaction', 'Death'],
    licenseSource: 'https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models',
    note: 'Original prompted paid-API asset; derived units, bone names, in-place motion and browser textures. Experimental shoulder/hand deformation remains under review.'
}, null, 2) + '\n');
console.log(JSON.stringify(variants, null, 2));
