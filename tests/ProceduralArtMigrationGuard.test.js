import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const assetsRoot = path.join(repoRoot, 'assets');
const legacyModelExtensions = new Set(['.dae', '.fbx', '.glb', '.gltf', '.obj']);
const authoredRasterExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tga']);
const runtimeRoots = ['src', 'scripts'];
const runtimeFiles = ['index.html', 'sw.js'];
const nonAuthoredMigrationBridges = new Set([
    'assets/plants/birch.glb',
    'assets/plants/pine.glb',
    'assets/plants/willow.glb'
]);
// Owner-requested character deliveries and their runtime candidates are explicit
// exceptions. Only Fighter is integrated; retired actor/environment assets stay banned.
const stagedCharacterExports = new Set([
    'assets/archetypes/Fighter/fighter.glb',
    'assets/archetypes/Fighter/fighter-runtime-high.glb',
    'assets/archetypes/Fighter/fighter-runtime-low.glb',
    'assets/archetypes/Wizard/wizard.glb',
    'assets/archetypes/Wizard/wizard-runtime-high.glb',
    'assets/archetypes/Wizard/wizard-runtime-low.glb',
    'assets/archetypes/Cleric/cleric.glb',
    'assets/archetypes/Cleric/cleric-runtime-high.glb',
    'assets/archetypes/Cleric/cleric-runtime-low.glb',
    'assets/archetypes/Rogue/rogue.glb',
    'assets/archetypes/Rogue/rogue-runtime-high.glb',
    'assets/archetypes/Rogue/rogue-runtime-low.glb'
]);
// Owner-requested equipment delivery: exact catalog names, tiers and character
// fits. This exception stages files only and does not permit runtime references.
const equipmentTiers = ['standard', 'legendary'];
const fittedEquipmentIds = [
    'leather-cap', 'iron-helm', 'silk-hood',
    'leather-tunic', 'plate-mail', 'robes',
    'leather-pants', 'plate-greaves', 'silk-skirt',
    'leather-boots', 'iron-boots', 'sandals',
    'leather-gloves', 'iron-gauntlets', 'silk-gloves',
    'reinforced-spaulders', 'steel-pauldrons', 'velvet-mantle',
    'studded-belt', 'plated-girdle', 'silk-sash',
    'gold-ring', 'silver-ring', 'ruby-ring',
    'pendant', 'choker', 'necklace',
    'amulet-of-power', 'talisman-of-speed', 'orb-of-mana'
];
const stagedEquipmentExports = new Set([
    ...['Fighter', 'Wizard', 'Cleric', 'Rogue'].map(character => `assets/equipment/authored/motions/${character}.glb`),
    ...['iron-sword', 'steel-dagger', 'wooden-staff', 'cleric-mace', 'wooden-shield', 'spell-tome']
        .flatMap(id => equipmentTiers.map(tier => `assets/equipment/authored/weapons/${id}-${tier}.glb`)),
    ...['Fighter', 'Wizard', 'Cleric', 'Rogue'].flatMap(character => fittedEquipmentIds
        .flatMap(id => equipmentTiers.map(tier => `assets/equipment/authored/fits/${character}/${id}-${tier}.glb`)))
]);
const currentLegacyReferenceFiles = new Set([
    'scripts/serve-static.mjs'
]);

const INITIAL_LEGACY_MODEL_COUNT = 106;
const INITIAL_LEGACY_MODEL_BYTES = 814551864;
const MAX_LEGACY_MODEL_COUNT = 0;
const MAX_LEGACY_MODEL_BYTES = 0;
const MAX_RUNTIME_GLB_TOKENS = 1;
const fighterReferenceAllowlist = new Map([
    ['src/art/AuthoredFighter.js', new Set(['./assets/archetypes/Fighter/fighter-runtime-high.glb', './assets/archetypes/Fighter/fighter-runtime-low.glb'])],
    ['src/assets/authoredEquipment.generated.js', new Set([
        ...[...stagedCharacterExports].filter(file => file.includes('-runtime-')).map(file => `./${file}`),
        ...[...stagedEquipmentExports].map(file => `./${file}`)
    ])],
    ['scripts/derive-fighter-runtime.mjs', new Set(['fighter.glb', 'fighter-runtime-${quality}.glb'])]
]);

function walkFiles(root) {
    if (!fs.existsSync(root)) return [];

    return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(root, entry.name);
        return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
    });
}

function relative(filePath) {
    return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}

describe('procedural art migration guard', () => {
    test('legacy authored model count and payload can only decrease from the audited baseline', () => {
        const modelFiles = walkFiles(assetsRoot).filter((filePath) => (
            legacyModelExtensions.has(path.extname(filePath).toLowerCase()) &&
            !nonAuthoredMigrationBridges.has(relative(filePath)) &&
            !stagedCharacterExports.has(relative(filePath)) &&
            !stagedEquipmentExports.has(relative(filePath))
        ));
        const totalBytes = modelFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);

        expect(MAX_LEGACY_MODEL_COUNT).toBeLessThan(INITIAL_LEGACY_MODEL_COUNT);
        expect(MAX_LEGACY_MODEL_BYTES).toBeLessThan(INITIAL_LEGACY_MODEL_BYTES);
        expect(modelFiles).toEqual([]);
        expect(modelFiles.length).toBe(MAX_LEGACY_MODEL_COUNT);
        expect(totalBytes).toBe(MAX_LEGACY_MODEL_BYTES);
    });

    test('only audited Fighter modules may refer to character exports', () => {
        const sourceFiles = [
            ...runtimeRoots.flatMap((root) => walkFiles(path.join(repoRoot, root))),
            ...runtimeFiles.map((file) => path.join(repoRoot, file)).filter(fs.existsSync)
        ].filter((filePath) => /\.(?:html|js|json|mjs)$/i.test(filePath));

        for (const [file, allowed] of fighterReferenceAllowlist) {
            const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
            const paths = [...source.matchAll(/['"`]([^'"`\n]*\.glb)['"`]/g)].map(match => match[1]);
            expect(paths.sort()).toEqual([...allowed].sort());
            expect(source.match(/\.glb\b/gi)?.length || 0).toBe(allowed.size);
        }
        const references = sourceFiles.filter(file => !fighterReferenceAllowlist.has(relative(file))).map((filePath) => ({
            file: relative(filePath),
            count: fs.readFileSync(filePath, 'utf8').match(/\.glb\b/gi)?.length || 0
        })).filter(({ count }) => count > 0);
        const unexpectedFiles = references
            .map(({ file }) => file)
            .filter((file) => !currentLegacyReferenceFiles.has(file));
        const totalTokens = references.reduce((sum, { count }) => sum + count, 0);

        expect(unexpectedFiles).toEqual([]);
        expect(totalTokens).toBeLessThanOrEqual(MAX_RUNTIME_GLB_TOKENS);
    });

    test('migrated regional actor directories cannot return to runtime references', () => {
        const retiredDirectories = [
            'assets/enemies/undead/skeleton/',
            'assets/enemies/undead/construct/',
            'assets/enemies/demons/demon_orc/',
            'assets/enemies/demons/imp/',
            'assets/enemies/demons/inferno_titan/',
            'assets/enemies/humanoid/mountain_troll/',
            'assets/enemies/golems/aqua_golem/',
            'assets/enemies/snow/siren/',
            'assets/enemies/snow/frostguardian/',
            'assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/',
            'assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/',
            'assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/',
            'assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/',
            'assets/plants/',
            'assets/buildings/trading_house.glb',
            'assets/buildings/blacksmith_forge.glb',
            'assets/buildings/two_story_building.glb',
            'assets/buildings/trading_post.glb',
            'assets/buildings/blacksmith.glb',
            'assets/buildings/camp_site.glb',
            'assets/objects/chests/stash_base.glb',
            'assets/buildings/dungeons/'
        ];
        const runtimeSource = [
            ...runtimeRoots.flatMap((root) => walkFiles(path.join(repoRoot, root))),
            ...runtimeFiles.map((file) => path.join(repoRoot, file)).filter(fs.existsSync)
        ].filter((filePath) => /\.(?:html|js|json|mjs)$/i.test(filePath))
            .map((filePath) => fs.readFileSync(filePath, 'utf8'))
            .join('\n');

        retiredDirectories.forEach((directory) => expect(runtimeSource).not.toContain(directory));
    });

    test('retired authored icon payload cannot return to assets or runtime paths', () => {
        const retiredRoots = ['assets/icons', 'assets/items'];
        retiredRoots.forEach((root) => expect(fs.existsSync(path.join(repoRoot, root))).toBe(false));

        const runtimeSource = [
            ...runtimeRoots.flatMap((root) => walkFiles(path.join(repoRoot, root))),
            ...walkFiles(path.join(repoRoot, 'server')),
            ...runtimeFiles.map((file) => path.join(repoRoot, file)).filter(fs.existsSync)
        ].filter((filePath) => /\.(?:html|js|json|mjs|go)$/i.test(filePath))
            .map((filePath) => fs.readFileSync(filePath, 'utf8'))
            .join('\n');

        expect(runtimeSource).not.toMatch(/assets\/icons\/(?:fighter|rogue|wizard|cleric|equipment|gems)\//);
        expect(runtimeSource).not.toMatch(/assets\/items\/(?:eidolon_heart|eidolon_shard)\//);
    });

    test('authored raster payload and runtime image routes cannot return', () => {
        const rasterFiles = walkFiles(assetsRoot).filter((filePath) => (
            authoredRasterExtensions.has(path.extname(filePath).toLowerCase())
        ));
        expect(rasterFiles).toEqual([]);

        const runtimeSource = [
            ...walkFiles(path.join(repoRoot, 'src')),
            ...walkFiles(path.join(repoRoot, 'server')),
            path.join(repoRoot, 'index.html'),
            path.join(repoRoot, 'repro.html'),
            path.join(repoRoot, 'sw.js')
        ].filter((filePath) => /\.(?:css|go|html|js|json|mjs)$/i.test(filePath) && fs.existsSync(filePath))
            .map((filePath) => fs.readFileSync(filePath, 'utf8'))
            .join('\n');

        expect(runtimeSource).not.toMatch(/assets\/(?:backgrounds\/[^?'"\s]+|favicon)\.(?:png|jpe?g|webp|gif|bmp|tga)\b/i);
    });
});
