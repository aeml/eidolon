import { build } from 'esbuild';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE_IMPORT = /\bimport\((['"])\.\/core\/GameEngine\.js\1\)/g;

// Build only a copied publishing tree. Editable source, development imports,
// login's lazy-engine boundary and the original source archive stay intact.
export async function bundleGameEngine(root) {
    const destination = await realpath(root);
    if (destination === await realpath(repository)) throw new Error('Game bundling requires a copied publication tree');
    const main = path.join(destination, 'src/main.js');
    const engine = path.join(destination, 'src/core/GameEngine.js');
    const output = path.join(destination, 'src/core/GameEngine.bundle.js');
    for (const filename of [main, engine, path.dirname(output)]) {
        if (!(await realpath(filename)).startsWith(`${destination}${path.sep}`)) throw new Error('Publication sources must be copied, not linked outside the tree');
    }
    try {
        if ((await lstat(output)).isSymbolicLink()) throw new Error('Bundle output cannot be a symbolic link');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const source = await readFile(main, 'utf8');
    if ([...source.matchAll(ENGINE_IMPORT)].length !== 1) throw new Error('Expected exactly one lazy game-engine import before bundling');

    const options = { absWorkingDir: destination, bundle: true, platform: 'browser',
        format: 'esm', target: 'es2022', packages: 'external', write: false,
        // Gameplay uses constructor.name for actor types, equipment and skills.
        // Bundling renames colliding identifiers even without identifier minification.
        metafile: true, minifyWhitespace: true, keepNames: true, legalComments: 'inline', logLevel: 'silent' };
    // Login and game must not acquire separate credential/session singletons.
    // Discover the entire static login graph, excluding its lazy engine entry;
    // any overlap remains an import of the original, already-cached module.
    const login = await build({ ...options, entryPoints: [main], external: [engine] });
    const shared = new Set(Object.keys(login.metafile.inputs).map(input => path.resolve(destination, input)));
    const bundled = await build({ ...options, entryPoints: [engine], outfile: output,
        plugins: [{ name: 'retain-login-singletons', setup(builder) {
            builder.onResolve({ filter: /^\./ }, args => {
                const resolved = path.resolve(args.resolveDir, args.path);
                if (!shared.has(resolved)) return;
                let relative = path.relative(path.dirname(output), resolved).split(path.sep).join('/');
                if (!relative.startsWith('.')) relative = `./${relative}`;
                return { path: relative, external: true };
            });
        } }] });
    if (bundled.outputFiles.length !== 1) throw new Error('Expected one game-engine bundle');
    const result = bundled.outputFiles[0];
    const metadata = Object.values(bundled.metafile.outputs)[0];
    if (!metadata.exports.includes('GameEngine')) throw new Error('Published bundle must export GameEngine');
    // Current in-game import.meta.url consumers live exactly two levels below
    // the site root, like this output. Reject future deeper consumers rather
    // than silently breaking asset/help URLs or the report's release identity.
    for (const input of Object.keys(bundled.metafile.inputs)) {
        const filename = path.resolve(destination, input);
        const text = await readFile(filename, 'utf8');
        if (text.includes('import.meta.url') && path.relative(destination, filename).split(path.sep).length !== 3) {
            throw new Error(`Review import.meta.url before bundling ${input}`);
        }
    }
    await writeFile(output, result.contents);
    await writeFile(main, source.replace(ENGINE_IMPORT, "import('./core/GameEngine.bundle.js')"));
    return { bundledModules: Object.keys(bundled.metafile.inputs).length,
        bytes: result.contents.byteLength, sharedLoginModules: shared.size,
        externalImports: [...new Set(metadata.imports.map(entry => entry.path))].sort() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (!process.argv[2]) throw new Error('Usage: node scripts/bundle-game-engine.mjs <copied-site-root>');
    console.log(JSON.stringify(await bundleGameEngine(process.argv[2])));
}
