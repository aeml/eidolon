import { cp, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundleGameEngine } from './bundle-game-engine.mjs';
import { versionPagesRuntime } from './version-pages-runtime.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Match the game inputs in the Pages job; coverage reports are added afterward.
export const PUBLISHED_CLIENT_INPUTS = ['index.html', 'assets', 'src', 'vendor', 'sw.js', 'release.json'];

export async function preparePublishedClient(destination, release, source = repository) {
    if (!/^[a-f0-9]{40}(?:-dirty)?$/.test(release)) throw Error('A copied client requires its exact source commit');
    const input = await realpath(source), output = path.resolve(destination);
    if (output === input) throw Error('Client preparation requires a separate copied tree');
    // A caller owns a fresh destination. Never overwrite a previous proof or an
    // editable checkout, even if it happens to contain the same release.
    await mkdir(output);
    for (const name of PUBLISHED_CLIENT_INPUTS) {
        await cp(await realpath(path.join(input, name)), path.join(output, name), {
            recursive: true, errorOnExist: true, force: false
        });
    }
    const engine = await bundleGameEngine(output);
    const versioning = await versionPagesRuntime(output, release);
    return { root: output, source: release, inputs: PUBLISHED_CLIENT_INPUTS, engine, versioning };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const [destination, release] = process.argv.slice(2);
    if (!destination || !release) throw Error('Usage: node scripts/prepare-published-client.mjs <fresh-copied-root> <source-commit>');
    console.log(JSON.stringify(await preparePublishedClient(destination, release)));
}
