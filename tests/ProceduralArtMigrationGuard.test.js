import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const assetsRoot = path.join(repoRoot, 'assets');
const legacyModelExtensions = new Set(['.dae', '.fbx', '.glb', '.gltf', '.obj']);
const runtimeRoots = ['src', 'scripts'];
const runtimeFiles = ['index.html', 'sw.js'];
const currentLegacyReferenceFiles = new Set([
    'scripts/serve-static.mjs',
    'src/assets/assetManifest.js',
    'src/utils/MeshCatalog.js',
    'src/utils/MeshFactory.js',
    'src/world/WorldGenerator.js'
]);

const INITIAL_LEGACY_MODEL_COUNT = 106;
const INITIAL_LEGACY_MODEL_BYTES = 814551864;
const MAX_LEGACY_MODEL_COUNT = 14;
const MAX_LEGACY_MODEL_BYTES = 307109296;
const MAX_RUNTIME_GLB_TOKENS = 35;

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
            legacyModelExtensions.has(path.extname(filePath).toLowerCase())
        ));
        const totalBytes = modelFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);

        expect(modelFiles.length).toBeGreaterThan(0);
        expect(MAX_LEGACY_MODEL_COUNT).toBeLessThan(INITIAL_LEGACY_MODEL_COUNT);
        expect(MAX_LEGACY_MODEL_BYTES).toBeLessThan(INITIAL_LEGACY_MODEL_BYTES);
        expect(modelFiles.length).toBeLessThanOrEqual(MAX_LEGACY_MODEL_COUNT);
        expect(totalBytes).toBeLessThanOrEqual(MAX_LEGACY_MODEL_BYTES);
    });

    test('new runtime modules cannot introduce authored GLB dependencies', () => {
        const sourceFiles = [
            ...runtimeRoots.flatMap((root) => walkFiles(path.join(repoRoot, root))),
            ...runtimeFiles.map((file) => path.join(repoRoot, file)).filter(fs.existsSync)
        ].filter((filePath) => /\.(?:html|js|json|mjs)$/i.test(filePath));

        const references = sourceFiles.map((filePath) => ({
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
            'assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/'
        ];
        const runtimeSource = [
            ...runtimeRoots.flatMap((root) => walkFiles(path.join(repoRoot, root))),
            ...runtimeFiles.map((file) => path.join(repoRoot, file)).filter(fs.existsSync)
        ].filter((filePath) => /\.(?:html|js|json|mjs)$/i.test(filePath))
            .map((filePath) => fs.readFileSync(filePath, 'utf8'))
            .join('\n');

        retiredDirectories.forEach((directory) => expect(runtimeSource).not.toContain(directory));
    });
});
