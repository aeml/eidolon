import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { URL as NodeURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new NodeURL('../', import.meta.url));
let fixture;
const put = (relative, content) => {
    const target = path.join(fixture, relative);
    mkdirSync(path.dirname(target), {recursive: true});
    writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
};
const run = (script, ...args) => spawnSync(process.execPath, [path.join(fixture, 'scripts', script), ...args], {cwd: fixture, encoding: 'utf8'});
beforeEach(() => { fixture = mkdtempSync(path.join(tmpdir(), 'eidolon-content-check-')); });
afterEach(() => { rmSync(fixture, {recursive: true, force: true}); });

function prepare(kind) {
    const script = `generate-${kind}.mjs`;
    mkdirSync(path.join(fixture, 'scripts'));
    copyFileSync(path.join(root, 'scripts', script), path.join(fixture, 'scripts', script));
    if (kind === 'cosmetics') {
        put('server/internal/game/content/cosmetics.json', [{id: 'fixture-look', name: 'Fixture Look', base: 'Robes', description: 'Synthetic cosmetic.'}]);
        put('server/internal/game/content/season-cosmetics.json', []);
        mkdirSync(path.join(fixture, 'src/data'), {recursive: true});
        return {script, output: 'src/data/cosmetics.generated.js'};
    }
    const model = file => { put(file, 'synthetic hash-only fixture, not a validated GLB'); return {file, sha256: createHash('sha256').update(readFileSync(path.join(fixture, file))).digest('hex')}; };
    const high = model('assets/fighter-runtime-high.glb'), low = model('assets/fighter-runtime-low.glb');
    put('assets/fighter-runtime.manifest.json', {variants: {high, low}});
    put('assets/equipment/authored/manifest.json', {characters: {Fighter: {reference: 'assets/fighter.glb'}}, items: [{id: 'sword', name: 'Iron Sword', slot: 'mainHand', models: {standard: {universal: model('assets/sword.glb')}}}], sets: []});
    put('assets/equipment/authored/motion-profiles.json', {characters: {Fighter: model('assets/motion.glb')}});
    put('assets/equipment/authored/grip-transforms.json', {characters: {Fighter: {}}});
    mkdirSync(path.join(fixture, 'src/assets'), {recursive: true});
    return {script, output: 'src/assets/authoredEquipment.generated.js'};
}

describe.each(['cosmetics', 'authored-equipment'])('%s generation/check separation', kind => {
    test('explicit generation followed by a matching check never rewrites output', () => {
        const {script, output} = prepare(kind), target = path.join(fixture, output);
        expect(run(script).status).toBe(0);
        const original = readFileSync(target, 'utf8');
        const old = new Date('2000-01-01T00:00:00Z'); utimesSync(target, old, old);
        const checked = run(script, '--check');
        expect(checked.status).toBe(0);
        expect(readFileSync(target, 'utf8')).toBe(original);
        expect(statSync(target).mtimeMs).toBe(old.getTime());
    });
    test('stale output fails without repairing or hiding the mismatch', () => {
        const {script, output} = prepare(kind);
        put(output, 'stale fixture catalog');
        const checked = run(script, '--check');
        expect(checked.status).not.toBe(0);
        expect(checked.stderr).toContain('Stale');
        expect(readFileSync(path.join(fixture, output), 'utf8')).toBe('stale fixture catalog');
    });
    test('missing output fails without creating the file', () => {
        const {script, output} = prepare(kind);
        expect(run(script, '--check').status).not.toBe(0);
        expect(existsSync(path.join(fixture, output))).toBe(false);
    });
    test('unknown flags refuse without creating an output', () => {
        const {script, output} = prepare(kind);
        expect(run(script, '--dry-run').status).not.toBe(0);
        expect(existsSync(path.join(fixture, output))).toBe(false);
    });
});

test('authored checks refuse tampered delivered bytes without replacing the catalog', () => {
    const {script, output} = prepare('authored-equipment');
    expect(run(script).status).toBe(0);
    const original = readFileSync(path.join(fixture, output), 'utf8');
    put('assets/sword.glb', 'changed bytes');
    const checked = run(script, '--check');
    expect(checked.status).not.toBe(0); expect(checked.stderr).toContain('hash mismatch');
    expect(readFileSync(path.join(fixture, output), 'utf8')).toBe(original);
});

test('install preparation cannot regenerate tracked cosmetics and CI invokes the read-only content gate', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['prepare:client']).not.toContain('generate-cosmetics');
    expect(pkg.scripts['check:content']).toBe('node scripts/check-content.mjs');
    expect(readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')).toContain('run: npm run check:content');
});

test('animation coverage check does not rewrite the actual documentation', () => {
    const target = path.join(root, 'docs/ANIMATION_COVERAGE.md');
    const before = readFileSync(target, 'utf8'), modified = statSync(target).mtimeMs;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/generate-animation-coverage.mjs'), '--check'], {cwd: root, encoding: 'utf8'});
    expect(result.status).toBe(0);
    expect(readFileSync(target, 'utf8')).toBe(before); expect(statSync(target).mtimeMs).toBe(modified);
    expect(before).toContain('declarative inventory, not a test receipt');
    expect(before).not.toContain('No player currently has a dedicated Jump clip');
});
