import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
    appendReleaseVersion,
    rewriteCss,
    rewriteHtml,
    rewriteJavaScript,
    versionPagesRuntime
} from '../scripts/version-pages-runtime.mjs';

const repoRoot = path.resolve(process.cwd());
const release = '19ccf4e3152206283ff9c35b9b08688d291e9c1d';

function parseGLTF(data) {
    return new Promise((resolve, reject) => {
        new GLTFLoader().parse(data, '', resolve, reject);
    });
}

describe('Pages runtime release versioning', () => {
    test('publishes the copied manifest version with the same commit as browser assets', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eidolon-pages-manifest-'));
        try {
            fs.writeFileSync(path.join(root, 'index.html'), '<script src="./main.js"></script>');
            fs.writeFileSync(path.join(root, 'release.json'), JSON.stringify({ commit: 'development', version: 'Alpha 9.8.7' }));
            await versionPagesRuntime(root, release);
            expect(JSON.parse(fs.readFileSync(path.join(root, 'release.json'), 'utf8')))
                .toEqual({ commit: release, version: 'Alpha 9.8.7' });
            expect(fs.readFileSync(path.join(root, 'index.html'), 'utf8')).toContain(`./main.js?release=${release}`);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
    test('versions local URLs while preserving queries and fragments', () => {
        expect(appendReleaseVersion('./module.js', release)).toBe(`./module.js?release=${release}`);
        expect(appendReleaseVersion('../module.js?mode=fast#entry', release))
            .toBe(`../module.js?mode=fast&release=${release}#entry`);
        expect(appendReleaseVersion('./module.js?release=old', release))
            .toBe(`./module.js?release=${release}`);
        expect(appendReleaseVersion('three', release)).toBe('three');
        expect(appendReleaseVersion('https://example.com/module.js', release)).toBe('https://example.com/module.js');
        expect(() => appendReleaseVersion('./module.js', '../unsafe')).toThrow(/Release id/);
    });

    test('versions the complete JavaScript module graph and worker imports', () => {
        const source = [
            "import './boot.js';",
            "import { Engine } from '../core/Engine.js';",
            "const lazy = import('./lazy.js?mode=high');",
            "importScripts('./worker.js');",
            "import * as THREE from 'three';"
        ].join('\n');
        const rewritten = rewriteJavaScript(source, release);

        expect(rewritten).toContain(`./boot.js?release=${release}`);
        expect(rewritten).toContain(`../core/Engine.js?release=${release}`);
        expect(rewritten).toContain(`./lazy.js?mode=high&release=${release}`);
        expect(rewritten).toContain(`./worker.js?release=${release}`);
        expect(rewritten).toContain("from 'three'");
    });

    test('versions entry scripts, stylesheets, CSS imports, and local texture URLs', () => {
        const html = rewriteHtml([
            '<link rel="stylesheet" href="src/styles/index.css">',
            '<script src="./vendor/protobuf.js"></script>',
            '<script type="module" src="./src/main.js"></script>',
            '<link href="https://fonts.example/font.css" rel="stylesheet">'
        ].join('\n'), release);
        expect(html).toContain(`src/styles/index.css?release=${release}`);
        expect(html).toContain(`./vendor/protobuf.js?release=${release}`);
        expect(html).toContain(`./src/main.js?release=${release}`);
        expect(html).toContain('https://fonts.example/font.css');

        const css = rewriteCss([
            "@import './variables.css';",
            "body { background: url('../../assets/background.png'); }",
            ".icon { background: url('data:image/svg+xml;base64,abc'); }"
        ].join('\n'), release);
        expect(css).toContain(`./variables.css?release=${release}`);
        expect(css).toContain(`../../assets/background.png?release=${release}`);
        expect(css).toContain('data:image/svg+xml;base64,abc');
    });

    test('keeps tiny, empty glTF migration bridges for stale pre-procedural clients', async () => {
        const bridgePaths = ['birch.glb', 'pine.glb', 'willow.glb'].map((name) =>
            path.join(repoRoot, 'assets', 'plants', name));

        for (const bridgePath of bridgePaths) {
            const contents = fs.readFileSync(bridgePath);
            expect(contents.byteLength).toBeLessThan(256);
            expect(contents.toString('utf8')).toContain('Eidolon procedural migration bridge');
            const browserBuffer = new ArrayBuffer(contents.byteLength);
            new Uint8Array(browserBuffer).set(contents);
            const parsed = await parseGLTF(browserBuffer);
            expect(parsed.scene.children).toHaveLength(0);
        }
    });

    test('the Pages workflow versions copied runtime files before publishing them', () => {
        const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
        const e2eHelpers = fs.readFileSync(path.join(repoRoot, 'tests/e2e/helpers.js'), 'utf8');
        expect(workflow).toContain('node scripts/version-pages-runtime.mjs public "${GITHUB_SHA}"');
        expect(workflow).toContain('cp sw.js release.json public/');
        expect(workflow.indexOf('cp sw.js release.json public/'))
            .toBeLessThan(workflow.indexOf('node scripts/version-pages-runtime.mjs public "${GITHUB_SHA}"'));
        expect(workflow).not.toMatch(/printf[^\n]*version[^\n]*> public\/release\.json/);
        expect(workflow.indexOf('node scripts/version-pages-runtime.mjs public "${GITHUB_SHA}"'))
            .toBeLessThan(workflow.indexOf('Upload Pages artifact'));
        expect(workflow).toContain('client_runtime_release=');
        expect(workflow).toContain('/?release=${EXPECTED_COMMIT}&attempt=${attempt}');
        expect(e2eHelpers).toContain('`/?release=${encodeURIComponent(expectedCommit)}`');
    });
});
