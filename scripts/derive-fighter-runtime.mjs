import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Generated binary assets, not handwritten source edits. Keep the owner's
// full-detail export and provenance untouched; never prune attachment leaves.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'assets/archetypes/Fighter');
const source = path.join(directory, 'fighter.glb');
const tool = '@gltf-transform/cli@4.5.1';
const workspace = mkdtempSync(path.join(tmpdir(), 'eidolon-fighter-derive-'));
const expectedSourceHash = '453bfdc9c775db7283fd2cf0ecbdde2c443e62181324b1fd25403eb4e7505703';

function inspect(file) {
    const bytes = readFileSync(file);
    if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error(`Invalid GLB: ${file}`);
    const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    return { data, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function command(name, input, output, ...options) {
    execFileSync('npm', ['exec', '--yes', `--package=${tool}`, '--', 'gltf-transform', name, input, output, ...options], { cwd: root, stdio: 'inherit' });
}

function summary(result) {
    const { data } = result;
    return {
        bytes: result.bytes, sha256: result.sha256,
        triangles: data.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((count, primitive) => count + (primitive.mode === undefined || primitive.mode === 4 ? data.accessors[primitive.indices].count / 3 : 0), 0), 0),
        joints: data.skins.map(skin => skin.joints.length),
        animations: data.animations.map(animation => animation.name).sort(),
        sockets: data.nodes.filter(node => node.name?.startsWith('socket_')).map(node => node.name).sort(),
        skinnedMeshes: data.nodes.filter(node => node.skin !== undefined).map(node => node.name).sort(),
        morphTargets: data.meshes.flatMap(mesh => mesh.extras?.targetNames || []).sort(),
        images: data.images?.length || 0,
        externalDependencies: [...(data.images || []), ...(data.buffers || [])].filter(resource => resource.uri && !resource.uri.startsWith('data:')).map(resource => resource.uri)
    };
}

try {
    const input = inspect(source);
    if (input.sha256 !== expectedSourceHash) throw new Error('Source export changed. Review it before updating the pinned derivation hash.');
    const sourceSummary = summary(input);
    const welded = path.join(workspace, 'welded.glb');
    const resampled = path.join(workspace, 'resampled.glb');
    command('weld', source, welded);
    command('resample', welded, resampled, '--tolerance', '0.00001');
    const variants = {};
    for (const [quality, ratio, error, textureSize] of [['high', '.45', '.002', '1024'], ['low', '.18', '.006', '512']]) {
        const simplified = path.join(workspace, `${quality}-geometry.glb`);
        const resized = path.join(workspace, `${quality}-textures.glb`);
        const output = path.join(directory, `fighter-runtime-${quality}.glb`);
        command('simplify', resampled, simplified, '--ratio', ratio, '--error', error, '--lock-border', 'true');
        command('resize', simplified, resized, '--width', textureSize, '--height', textureSize);
        command('webp', resized, output, '--quality', '90', '--effort', '80');
        execFileSync('npm', ['exec', '--yes', `--package=${tool}`, '--', 'gltf-transform', 'validate', output], { cwd: root, stdio: 'inherit' });
        const result = summary(inspect(output));
        for (const field of ['joints', 'animations', 'sockets', 'skinnedMeshes', 'morphTargets', 'externalDependencies']) {
            if (JSON.stringify(result[field]) !== JSON.stringify(sourceSummary[field])) throw new Error(`${quality}: ${field} changed`);
        }
        if (result.bytes >= input.bytes || result.triangles >= sourceSummary.triangles) throw new Error(`${quality}: payload/geometry did not improve`);
        variants[quality] = { ...result, maximumTextureSize: Number(textureSize), ratio: Number(ratio), maximumSimplificationError: Number(error) };
    }
    writeFileSync(path.join(directory, 'fighter-runtime.manifest.json'), JSON.stringify({ source: sourceSummary, tool, variants }, null, 2) + '\n');
    console.log(JSON.stringify({ sourceBytes: input.bytes, variants }, null, 2));
} finally {
    // Only this invocation's freshly created derivation directory is removed.
    rmSync(workspace, { recursive: true, force: true });
}
