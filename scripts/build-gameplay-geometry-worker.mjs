import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, lstat, realpath, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The publication build reads copied sources. Local preparation writes only
// the ignored worker artifact; neither path rewrites editable source modules.
export async function buildGameplayGeometryWorker(root = repository) {
    const destination = await realpath(root);
    const entry = path.join(destination, 'src/core/ActorGameplayGeometryWorker.js');
    const output = path.join(destination, 'src/core/ActorGameplayGeometryWorker.bundle.js');
    const delivery = path.join(destination, 'src/core/ActorGameplayGeometryDelivery.js');
    for (const name of [entry, path.join(destination, 'src/art/GameplayBodyIndices.js'), path.join(destination, 'src/art/GameplayColorIndices.js'), path.dirname(output)]) {
        if (!(await realpath(name)).startsWith(`${destination}${path.sep}`)) throw new Error('Worker sources must be copied inside the build tree');
    }
    try { if ((await lstat(output)).isSymbolicLink()) throw new Error('Worker output cannot be linked'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const dependency = JSON.parse(await readFile(path.join(repository, 'node_modules/meshoptimizer/package.json'), 'utf8'));
    if (dependency.version !== '1.2.0') throw new Error('Worker requires locked meshoptimizer1.2.0');
    const license = await readFile(path.join(repository, 'node_modules/meshoptimizer/LICENSE.md'), 'utf8');
    const result = await build({ absWorkingDir: destination, entryPoints: [entry], outfile: output,
        nodePaths: [path.join(repository, 'node_modules')],
        bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true, write: false,
        banner: { js: `/*! meshoptimizer 1.2.0\n${license.replaceAll('*/', '* /')}\n*/` }, logLevel: 'silent' });
    const imports = Object.values(result.metafile.outputs).flatMap(row => row.imports);
    if (imports.length) throw new Error('Worker must have no external runtime imports');
    const contents = result.outputFiles[0].contents, sha256 = createHash('sha256').update(contents).digest('hex');
    let artifact = output;
    if (destination !== await realpath(repository)) {
        if (!(await realpath(delivery)).startsWith(`${destination}${path.sep}`)) throw new Error('Worker delivery source must be copied');
        const source = await readFile(delivery, 'utf8');
        const marker = './ActorGameplayGeometryWorker.bundle.js';
        if (source.split(marker).length !== 2) throw new Error('Expected exactly one worker URL before publication');
        artifact = path.join(destination, `src/core/ActorGameplayGeometryWorker.${sha256.slice(0, 16)}.js`);
        try { if ((await lstat(artifact)).isSymbolicLink()) throw new Error('Worker output cannot be linked'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        await writeFile(artifact, contents);
        await writeFile(delivery, source.replace(marker, `./${path.basename(artifact)}`));
    } else await writeFile(artifact, contents);
    return { output: path.relative(destination, artifact), sha256, bytes: contents.length,
        modules: Object.keys(result.metafile.inputs).length, imports };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
    console.log(JSON.stringify(await buildGameplayGeometryWorker(process.argv[2])));
