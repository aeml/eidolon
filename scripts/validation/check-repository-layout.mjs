import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = directory => readdirSync(path.join(root, directory), { withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => entry.name);
const violations = [];
for (const [directory, pattern, home] of [
    ['server', /\.go$/, 'cmd/<command> or internal/<package>; keep Go tests with their package'],
    ['scripts', /\.(?:m?js|sh|ps1|py|go)$/, 'a script responsibility directory'],
    ['tests', /\.(?:m?js)$/, 'unit, tooling, release, support, or e2e'],
    ['docs/plans', /^\d{4}-\d{2}-\d{2}-/, 'records/<year>/<month>/<day> or records/releases/<version>']
]) {
    for (const name of files(directory)) if (pattern.test(name)) {
        violations.push(`${directory}/${name}: use ${home}`);
    }
}
for (const directory of ['src', 'docs']) {
    const allowed = directory === 'src' ? new Set(['main.js', 'repro.js', 'animationGallery.js', 'README.md']) : new Set(['README.md', 'ROADMAP.md']);
    for (const name of files(directory)) if (!allowed.has(name)) {
        violations.push(`${directory}/${name}: place new implementation or documentation under its owning area`);
    }
}
if (violations.length) {
    console.error(`Repository layout violations:\n${violations.map(value => `- ${value}`).join('\n')}`);
    process.exitCode = 1;
} else {
    console.log('Repository layout verified: package roots, grouped tooling/tests, and separate plans/records.');
}
