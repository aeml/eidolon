import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
const goMod = fs.readFileSync(path.join(repoRoot, 'server', 'go.mod'), 'utf8');
const dockerfile = fs.readFileSync(path.join(repoRoot, 'server', 'Dockerfile'), 'utf8');
const dockerignore = fs.readFileSync(path.join(repoRoot, 'server', '.dockerignore'), 'utf8');
const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');

describe('tooling baseline', () => {
    test('loads locked runtime dependencies from the generated local vendor tree', () => {
        expect(packageJson.dependencies.three).toMatch(/^\d+\.\d+\.\d+$/);
        expect(packageJson.devDependencies.protobufjs).toMatch(/^\d+\.\d+\.\d+$/);
        expect(indexHtml).toContain('"three": "./vendor/three/build/three.module.js"');
        expect(indexHtml).toContain('<script src="./vendor/protobuf/protobuf.min.js"></script>');
        expect(indexHtml).not.toContain('unpkg.com');
        expect(packageJson.scripts['prepare:client']).toBeTruthy();
        expect(fs.existsSync(path.join(repoRoot, 'scripts', 'sanitize-playwright-artifacts.mjs'))).toBe(true);
    });

    test('defines local quality scripts', () => {
        expect(packageJson.scripts['test:smoke']).toBeTruthy();
        expect(packageJson.scripts['test:e2e']).toBeTruthy();
        expect(packageJson.scripts.lint).toBeTruthy();
    });

    test('commits a lockfile for reproducible npm ci installs', () => {
        expect(fs.existsSync(path.join(repoRoot, 'package-lock.json'))).toBe(true);
    });

    test('aligns the declared CI and server toolchains', () => {
        expect(fs.readFileSync(path.join(repoRoot, '.nvmrc'), 'utf8').trim()).toBe('24');
        expect(packageJson.engines.node).toBe('>=24.0.0 <25.0.0');
        expect(workflow).toContain("node-version: '24'");
        expect(workflow).toContain("go-version: '1.24.5'");
        expect(goMod).toContain('go 1.24.5');
        expect(dockerfile).toContain('ARG GO_VERSION=1.24.5');
        expect(dockerignore).toContain('.env');
    });

    test('documents the local test and lint workflow in the README', () => {
        expect(readme).toContain('npm ci');
        expect(readme).toContain('npm test');
        expect(readme).toContain('npm run test:smoke');
        expect(readme).toContain('npm run lint');
    });
});
