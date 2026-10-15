import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { URL as NodeURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
        put('src/core/ItemSystem.js', readFileSync(path.join(root, 'src/core/ItemSystem.js'), 'utf8'));
        put('src/core/EquipmentSlots.js', readFileSync(path.join(root, 'src/core/EquipmentSlots.js'), 'utf8'));
        put('server/internal/game/content/cosmetics.json', [{id: 'fixture-look', name: 'Fixture Look', realm: 'fire', base: 'Robes', priceEP: 25, primary: 0x894a32, secondary: 0xe5aa45, description: 'Synthetic cosmetic.'}]);
        put('server/internal/game/content/season-cosmetics.json', []);
        put('server/internal/game/content/garments.json', []);
        mkdirSync(path.join(fixture, 'src/data'), {recursive: true});
        return {script, output: 'src/data/cosmetics.generated.js'};
    }
    throw new Error(`Unsupported fixture: ${kind}`);
}

describe.each(['cosmetics'])('%s generation/check separation', kind => {
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

test.each([
    ['unknown equipment', offers => { offers[0].base = 'Missing robe'; }],
    ['non-equipment', offers => { offers[0].base = 'Eidolon Heart'; }],
    ['duplicate identity', offers => { offers.push({...offers[0], name: 'Another look'}); }],
    ['duplicate display name', offers => { offers.push({...offers[0], id: 'another-look'}); }],
    ['non-positive price', offers => { offers[0].priceEP = 0; }],
    ['fractional price', offers => { offers[0].priceEP = 1.5; }],
    ['invalid color', offers => { offers[0].primary = 0x1000000; }],
    ['unknown realm', offers => { offers[0].realm = 'invalid'; }],
    ['gameplay-power field', offers => { offers[0].stats = {strength: 100}; }],
    ['invalid medal', (_, earned) => { earned[0].medal = 'Diamond'; }],
    ['paid earned reward', (_, earned) => { earned[0].priceEP = 100; }],
    ['duplicate medal', (_, earned) => { earned.push({...earned[0], id: 'other-medal', name: 'Other medal'}); }],
    ['shop/earned name overlap', (offers, earned) => { earned[0].name = offers[0].name; }],
    ['shop/earned ID overlap', (offers, earned) => { earned[0].id = offers[0].id; }]
])('cosmetic authoring rejects %s before generating or checking', (_, corrupt) => {
    const {script, output} = prepare('cosmetics');
    const source = 'server/internal/game/content/cosmetics.json';
    const earnedSource = 'server/internal/game/content/season-cosmetics.json';
    const offers = JSON.parse(readFileSync(path.join(fixture, source), 'utf8'));
    const earned = [{id: 'fixture-medal', name: 'Fixture Medal', medal: 'Bronze', base: 'Pendant', primary: 0x998877, secondary: 0xeeddaa}];
    corrupt(offers, earned); put(source, offers); put(earnedSource, earned);
    for (const args of [[], ['--check']]) {
        const result = run(script, ...args);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('Invalid cosmetics');
        expect(existsSync(path.join(fixture, output))).toBe(false);
    }
});

test('valid earned styles generate, but later invalid input cannot overwrite the committed catalogue', () => {
    const {script, output} = prepare('cosmetics');
    put('server/internal/game/content/season-cosmetics.json', [{id: 'fixture-medal', name: 'Fixture Medal', medal: 'Bronze', base: 'Pendant', primary: 0x998877, secondary: 0xeeddaa}]);
    expect(run(script).status).toBe(0);
    expect(run(script, '--check').status).toBe(0);
    const target = path.join(fixture, output), original = readFileSync(target, 'utf8');
    const old = new Date('2000-01-01T00:00:00Z'); utimesSync(target, old, old);
    const source = 'server/internal/game/content/cosmetics.json';
    const offers = JSON.parse(readFileSync(path.join(fixture, source), 'utf8'));
    offers[0].stats = {strength: 100}; put(source, offers);
    for (const args of [[], ['--check']]) {
        expect(run(script, ...args).status).not.toBe(0);
        expect(readFileSync(target, 'utf8')).toBe(original);
        expect(statSync(target).mtimeMs).toBe(old.getTime());
    }
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

const contentGroups = ['world-geography', 'world-locations', 'world-elevation', 'town-neighborhood',
    'chronicle-investigations', 'chronicle-expeditions', 'chronicle-hunts', 'dark-realm-chronicle',
    'earth-outcrops', 'world-population', 'cosmetics', 'authored-equipment', 'garment-models', 'animation-coverage', 'gameplay-geometry-precomputed'];
function prepareGate(failingGroup) {
    mkdirSync(path.join(fixture, 'scripts'));
    copyFileSync(path.join(root, 'scripts/check-content.mjs'), path.join(fixture, 'scripts/check-content.mjs'));
    for (const group of contentGroups) {
        put(`scripts/generate-${group}.mjs`, `import { appendFileSync } from 'node:fs';
appendFileSync(new URL('../calls.jsonl', import.meta.url), JSON.stringify({group: '${group}', args: process.argv.slice(2)}) + '\\n');
process.exit(${group === failingGroup ? 7 : 0});`);
    }
}
const gateCalls = () => readFileSync(path.join(fixture, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));

test('aggregate gate invokes every fixed generator in check mode from outside the repository', () => {
    prepareGate();
    const result = spawnSync(process.execPath, [path.join(fixture, 'scripts/check-content.mjs')], {cwd: tmpdir(), encoding: 'utf8'});
    expect(result.status).toBe(0);
    expect(gateCalls()).toEqual(contentGroups.map(group => ({group, args: ['--check']})));
    expect(result.stdout).toContain('Verified 15 generated content groups');
});

test('aggregate gate propagates a failed generator and never runs later groups', () => {
    prepareGate('world-elevation');
    const result = run('check-content.mjs');
    expect(result.status).toBe(7);
    expect(gateCalls().map(call => call.group)).toEqual(contentGroups.slice(0, 3));
    expect(result.stdout).not.toContain('Verified');
});

test('aggregate gate refuses extra arguments before any generator runs', () => {
    prepareGate();
    expect(run('check-content.mjs', '--repair').status).not.toBe(0);
    expect(existsSync(path.join(fixture, 'calls.jsonl'))).toBe(false);
});
