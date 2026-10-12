import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Fixed, local authoring checks only. Fail rather than repair generated inputs:
// installation and CI must not hide a stale committed client/server catalog.
if (process.argv.length !== 2) throw new Error('Usage: npm run check:content');
const root = fileURLToPath(new URL('../', import.meta.url));
const checks = ['world-geography', 'world-locations', 'world-elevation',
    'chronicle-investigations', 'chronicle-expeditions', 'chronicle-hunts', 'dark-realm-chronicle',
    'earth-outcrops', 'world-population', 'cosmetics', 'authored-equipment', 'animation-coverage', 'gameplay-geometry-precomputed'];
for (const name of checks) {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', `generate-${name}.mjs`), '--check'], {cwd: root, stdio: 'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Verified ${checks.length} generated content groups without rewriting them.`);
