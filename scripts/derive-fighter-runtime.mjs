import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, resample, simplifyPrimitive, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

// Generated binary assets, not handwritten source edits. Keep the owner's
// full-detail export and provenance untouched; never prune attachment leaves.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'assets/archetypes/Fighter');
const source = path.join(directory, 'fighter.glb');
const tool = '@gltf-transform/cli@4.5.1';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const expectedSourceHash = 'dcb48696059094dc5d79e8539fd9368b9932ebb8f3bc57d14b1c4098caae2a3a';

function inspect(file) {
    const bytes = readFileSync(file);
    if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error(`Invalid GLB: ${file}`);
    const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    return { data, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function summary(result) {
    const { data } = result;
    return {
        bytes: result.bytes, sha256: result.sha256,
        triangles: data.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((count, primitive) => count + (primitive.mode === undefined || primitive.mode === 4 ? data.accessors[primitive.indices].count / 3 : 0), 0), 0),
        meshTriangles: Object.fromEntries(data.nodes.filter(node => node.mesh !== undefined).map(node => [node.name, data.meshes[node.mesh].primitives.reduce((sum, primitive) => sum + data.accessors[primitive.indices].count / 3, 0)])),
        joints: data.skins.map(skin => skin.joints.length),
        animations: data.animations.map(animation => animation.name).sort(),
        sockets: data.nodes.filter(node => node.name?.startsWith('socket_')).map(node => node.name).sort(),
        skinnedMeshes: data.nodes.filter(node => node.skin !== undefined).map(node => node.name).sort(),
        morphTargets: data.meshes.flatMap(mesh => mesh.extras?.targetNames || []).sort(),
        images: data.images?.length || 0,
        externalDependencies: [...(data.images || []), ...(data.buffers || [])].filter(resource => resource.uri && !resource.uri.startsWith('data:')).map(resource => resource.uri)
    };
}

{
    const input = inspect(source);
    if (input.sha256 !== expectedSourceHash) throw new Error('Source export changed. Review it before updating the pinned derivation hash.');
    const sourceSummary = summary(input);
    await MeshoptSimplifier.ready;
    const variants = {};
    for (const [quality, ratio, error, textureSize] of [['high', .45, .002, 1024], ['low', .18, .006, 512]]) {
        const document = await io.read(source);
        await document.transform(weld({ overwrite: false }), resample({ tolerance: .00001 }));
        const body = document.getRoot().listNodes().find(node => node.getName() === 'Fighter_Body')?.getMesh();
        if (!body) throw new Error('Missing Fighter body for selective simplification');
        // Close-fitting hair, shorts, seams and layered eyes must retain their
        // matching silhouette. Independent decimation created scalp/cloth holes.
        for (const primitive of body.listPrimitives()) {
            simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier, ratio, error, lockBorder: true });
        }
        // Data maps must not acquire lossy color blocks that become specular
        // ripples. Preserve normal/ORM channels; only color maps use lossy WebP.
        await document.transform(
            textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [textureSize, textureSize], slots: /^(?:normalTexture|metallicRoughnessTexture|occlusionTexture)$/, lossless: true, effort: 80 }),
            textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [textureSize, textureSize], slots: /^(?:baseColorTexture)$/, quality: 90, effort: 80 })
        );
        const output = path.join(directory, `fighter-runtime-${quality}.glb`);
        await io.write(output, document);
        execFileSync('npm', ['exec', '--yes', `--package=${tool}`, '--', 'gltf-transform', 'validate', output], { cwd: root, stdio: 'inherit' });
        const result = summary(inspect(output));
        for (const field of ['joints', 'animations', 'sockets', 'skinnedMeshes', 'morphTargets', 'externalDependencies']) {
            if (JSON.stringify(result[field]) !== JSON.stringify(sourceSummary[field])) throw new Error(`${quality}: ${field} changed`);
        }
        if (result.bytes >= input.bytes || result.triangles >= sourceSummary.triangles) throw new Error(`${quality}: payload/geometry did not improve`);
        for (const [name, triangles] of Object.entries(sourceSummary.meshTriangles)) {
            if (name !== 'Fighter_Body' && result.meshTriangles[name] !== triangles) throw new Error(`${quality}: fitted mesh topology changed: ${name}`);
        }
        variants[quality] = { ...result, maximumTextureSize: Number(textureSize), ratio: Number(ratio), maximumSimplificationError: Number(error) };
    }
    writeFileSync(path.join(directory, 'fighter-runtime.manifest.json'), JSON.stringify({ source: sourceSummary, tool, policy: 'body-only simplification; fitted meshes preserved; lossless normal/ORM maps', variants }, null, 2) + '\n');
    console.log(JSON.stringify({ sourceBytes: input.bytes, variants }, null, 2));
}
