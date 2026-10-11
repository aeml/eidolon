import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { PROVENANCE_PATHS, CATALOG_PATH, buildGeometryArtifact, parseCatalog, serializeCatalog } from '../scripts/lib/gameplay-geometry-artifact.mjs';

const execute = promisify(execFile);
async function checkGeometryArtifact(root) {
    const source = "import {checkGeometryArtifact} from './scripts/lib/gameplay-geometry-artifact.mjs';console.log(JSON.stringify(await checkGeometryArtifact(process.argv[1])));";
    const { stdout } = await execute(process.execPath, ['--input-type=module', '--eval', source, root]);
    return JSON.parse(stdout);
}
const roots = [];
async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), 'eidolon-precomputed-check-')); roots.push(root);
    const catalog = parseCatalog(await readFile(CATALOG_PATH, 'utf8'));
    for (const filename of [...PROVENANCE_PATHS, 'package-lock.json', CATALOG_PATH, catalog.url.slice(6)]) {
        await mkdir(path.dirname(path.join(root, filename)), { recursive: true });
        await cp(filename, path.join(root, filename));
    }
    return { root, catalog, save: () => writeFile(path.join(root, CATALOG_PATH), serializeCatalog(catalog)) };
}
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

test('committed artifact decodes every bounded row and matches source provenance without rewriting', async () => {
    const f = await fixture(), before = await readFile(path.join(f.root, CATALOG_PATH));
    expect(await checkGeometryArtifact(f.root)).toEqual({ path: f.catalog.url.slice(6), sha256: f.catalog.sha256, bytes: 777321, entries: 133 });
    expect(await readFile(path.join(f.root, CATALOG_PATH))).toEqual(before);
});

test.each(['algorithm', 'generator', 'encoding'])('refuses stale %s provenance instead of silently regenerating', async change => {
    const f = await fixture(), name = change === 'algorithm' ? 'src/art/GameplayBodyIndices.js' : change === 'encoding' ? 'src/core/GameplayGeometryIndexCodec.js' : 'scripts/generate-gameplay-geometry-precomputed.mjs';
    const filename = path.join(f.root, name), original = await readFile(filename);
    await writeFile(filename, Buffer.concat([original, Buffer.from('\n// Stale source fixture\n')]));
    await expect(checkGeometryArtifact(f.root)).rejects.toThrow('Stale geometry');
    expect(await readFile(filename)).not.toEqual(original);
});

test('corrupt bytes cannot retain an immutable artifact name', async () => {
    const f = await fixture(), filename = path.join(f.root, f.catalog.url.slice(6)), bytes = await readFile(filename);
    bytes[0] ^= 1; await writeFile(filename, bytes);
    await expect(checkGeometryArtifact(f.root)).rejects.toThrow('byte identity mismatch');
});

test('a valid artifact hash cannot conceal a corrupt individual output hash', async () => {
    const f = await fixture(); Object.values(f.catalog.entries)[0].sha256 = '0'.repeat(64); await f.save();
    await expect(checkGeometryArtifact(f.root)).rejects.toThrow('output identity mismatch');
});

test('copied publications cannot read geometry inputs linked outside the destination', async () => {
    const f = await fixture(), filename = path.join(f.root, 'src/core/GameplayGeometryFingerprint.js');
    await rm(filename); await symlink(path.resolve('src/core/GameplayGeometryFingerprint.js'), filename);
    await expect(checkGeometryArtifact(f.root)).rejects.toThrow('must be copied');
});

test('artifact generation is independent of request order and never modifies source indices', () => {
    const a = { key: 'a'.repeat(64), kind: 'body', sourceIndexCount: 6, vertices: 3, fallback: null, indices: new Uint32Array([0, 1, 2]) };
    const b = { ...a, key: 'b'.repeat(64), kind: 'rigid', indices: new Uint32Array([2, 1, 0]) };
    const first = buildGeometryArtifact([a, b], {}), second = buildGeometryArtifact([b, a], {});
    expect(first.bytes).toEqual(second.bytes); expect(first.catalog).toEqual(second.catalog);
    expect(a.indices).toEqual(new Uint32Array([0, 1, 2])); expect(b.indices).toEqual(new Uint32Array([2, 1, 0]));
});

test.each(['duplicate-key', 'source-count', 'vertices', 'kind'])('generator refuses %s before emitting a catalog', mode => {
    const row = { key: 'a'.repeat(64), kind: 'body', sourceIndexCount: 6, vertices: 3, fallback: null, indices: new Uint32Array([0, 1, 2]) };
    if (mode === 'source-count') row.sourceIndexCount = 1;
    if (mode === 'vertices') row.vertices = 2;
    if (mode === 'kind') row.kind = 'unsupported';
    expect(() => buildGeometryArtifact(mode === 'duplicate-key' ? [row, row] : [row], {})).toThrow();
});
