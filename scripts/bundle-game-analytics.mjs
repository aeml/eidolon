import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceURL = './src/analytics/game.js';
const bundleURL = './src/analytics/game.bundle.js';

// Analytics is a small, independent document entry. Publishing one closed
// module graph removes three startup requests, including the observer request
// that failed with HTTP408 in the documentation-push Alpha59 live check.
// Keep privacy/lifecycle code intact and the editable source tree untouched.
export async function bundleGameAnalytics(root) {
    const destination = await realpath(root);
    const copied = async filename => {
        const value = await realpath(filename);
        if (!value.startsWith(`${destination}${path.sep}`)) throw new Error('Analytics inputs must be copied inside the publication tree');
        return value;
    };
    const index = path.join(destination, 'index.html');
    let html;
    try { html = await readFile(await copied(index), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    // Preserve offsets while ignoring commented-out scripts. Only actual src
    // attributes of the module entry can be changed; data-src is not an entry.
    const document = html.replace(/<!--[\s\S]*?-->/g, value => ' '.repeat(value.length));
    const entries = [...document.matchAll(/<script\b[^>]*>/gi)].map(match => {
        const src = match[0].match(/\ssrc\s*=\s*(['"])(.*?)\1/i);
        return { match, src: src?.[2], valueOffset: src && src.index + src[0].indexOf(src[2]),
            module: /\stype\s*=\s*(['"])module\1/i.test(match[0]) };
    }).filter(entry => entry.src?.split('?')[0] === sourceURL || entry.src?.split('?')[0] === bundleURL);
    if (!entries.length) return false;
    if (destination === await realpath(repository)) throw new Error('Analytics bundling requires a copied publication tree');
    if (entries.length !== 1 || !entries[0].module) throw new Error('Expected one game analytics module entry');
    const entry = path.join(destination, 'src/analytics/game.js');
    const output = path.join(destination, 'src/analytics/game.bundle.js');
    await copied(path.dirname(output));
    try {
        if ((await lstat(output)).isSymbolicLink()) throw new Error('Analytics output cannot be a symbolic link');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (entries[0].src.split('?')[0] === bundleURL) {
        await copied(output); // Versioning an already prepared copy is harmless.
        return false;
    }
    await copied(entry);
    const { build } = await import('esbuild');
    const result = await build({ absWorkingDir: destination, entryPoints: [entry], outfile: output,
        bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
        packages: 'external', write: false, metafile: true, keepNames: true,
        minifyWhitespace: true, legalComments: 'inline', logLevel: 'silent',
        plugins: [{ name: 'copied-analytics-inputs', setup(builder) {
            builder.onLoad({ filter: /.*/ }, async args => {
                const filename = await copied(args.path);
                if (!/\.m?js$/.test(filename)) throw new Error('Analytics graph accepts JavaScript inputs only');
                return { contents: await readFile(filename, 'utf8'), loader: 'js' };
            });
        } }] });
    const metadata = Object.values(result.metafile.outputs)[0];
    const contents = result.outputFiles[0]?.text;
    if (result.outputFiles.length !== 1 || metadata.imports.length ||
        /\bimport\s*(?:\(|['"*{])/.test(contents)) throw new Error('Published analytics must have no module requests');
    await writeFile(output, contents);
    const tag = entries[0].match;
    const offset = entries[0].valueOffset;
    const rewritten = tag[0].slice(0, offset) + bundleURL + tag[0].slice(offset + entries[0].src.length);
    await writeFile(index, html.slice(0, tag.index) + rewritten + html.slice(tag.index + tag[0].length));
    return { output: 'src/analytics/game.bundle.js', bytes: Buffer.byteLength(contents),
        bundledModules: Object.keys(result.metafile.inputs).length, externalImports: [] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (!process.argv[2]) throw new Error('Usage: node scripts/bundle-game-analytics.mjs <copied-site-root>');
    console.log(JSON.stringify(await bundleGameAnalytics(process.argv[2])));
}
