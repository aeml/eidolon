import { build } from 'esbuild';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Explicit preparation only until the controller's frame/device gates qualify.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'src/core/ActorGameplayGeometryWorker.bundle.js');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('Worker output cannot be linked'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (await realpath(path.dirname(output)) !== path.join(await realpath(root), 'src/core')) throw new Error('Worker output must be owned by the working tree');
const license = await readFile(path.join(root, 'node_modules/meshoptimizer/LICENSE.md'), 'utf8');
const result = await build({ absWorkingDir: root, entryPoints: ['src/core/ActorGameplayGeometryWorker.js'], outfile: output,
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true,
    banner: { js: `/*! meshoptimizer 1.2.0\n${license.replaceAll('*/', '* /')}\n*/` }, logLevel: 'silent' });
const imports = Object.values(result.metafile.outputs).flatMap(row => row.imports);
if (imports.length) throw new Error('Worker must have no external runtime imports');
console.log(JSON.stringify({ output: path.relative(root, output), bytes: Object.values(result.metafile.outputs)[0].bytes,
    modules: Object.keys(result.metafile.inputs).length, imports }));
