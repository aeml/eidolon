import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'src');
const output = join(root, 'dist');
if (dirname(output) !== root.replace(/[\\/]$/, '') || relative(root, output) !== 'dist') {
  throw new Error('Build output must be the website/dist directory.');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of await readdir(source)) {
  await cp(join(source, entry), join(output, entry), { recursive: true });
}
// Share the same production tag configuration as the independently deployed game.
await cp(fileURLToPath(new URL('../../src/analytics/GoogleAnalytics.js', import.meta.url)), join(output, 'GoogleAnalytics.js'));
console.log('Website built successfully → website/dist');
