import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

function getImportMapThreeVersion(html) {
    const match = html.match(/three@(\d+\.\d+\.\d+)\/build\/three\.module\.js/);
    return match ? match[1] : null;
}

describe('tooling baseline', () => {
    test('keeps runtime and package three.js versions aligned', () => {
        expect(getImportMapThreeVersion(indexHtml)).toBe(packageJson.dependencies.three.replace('^', ''));
    });

    test('defines local quality scripts', () => {
        expect(packageJson.scripts['test:smoke']).toBeTruthy();
        expect(packageJson.scripts.lint).toBeTruthy();
    });

    test('commits a lockfile for reproducible npm ci installs', () => {
        expect(fs.existsSync(path.join(repoRoot, 'package-lock.json'))).toBe(true);
    });

    test('documents the local test and lint workflow in the README', () => {
        expect(readme).toContain('npm install');
        expect(readme).toContain('npm test');
        expect(readme).toContain('npm run test:smoke');
        expect(readme).toContain('npm run lint');
    });
});
