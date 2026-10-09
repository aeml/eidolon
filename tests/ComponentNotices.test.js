import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('../', import.meta.url));
const filename = path.join(root, 'assets/notices/index.html');
const source = readFileSync(filename, 'utf8');
const document = new JSDOM(source, { url: 'https://example.invalid/assets/notices/index.html' }).window.document;

test('component notices are readable without JavaScript, fonts, media or account access', () => {
    expect(document.documentElement.lang).toBe('en');
    expect(document.querySelector('meta[name="viewport"]').content).toContain('width=device-width');
    expect(document.querySelectorAll('main h1')).toHaveLength(1);
    expect(document.querySelectorAll('section')).toHaveLength(3);
    expect(document.querySelectorAll('script,iframe,img,video,audio,form,link')).toHaveLength(0);
    expect(source).not.toMatch(/url\(|@import|on(?:click|load|error)\s*=/i);
    expect(Buffer.byteLength(source)).toBeLessThan(6000);
});

test('local notice links resolve to shipped source files or the two prepared vendor licenses', () => {
    const vendor = new Map([['vendor/three/LICENSE', 'three'], ['vendor/protobuf/LICENSE', 'protobufjs']]);
    for (const anchor of document.querySelectorAll('a')) {
        const target = new URL(anchor.href);
        expect(target.origin).toBe('https://example.invalid');
        expect(target.search).toBe('');
        expect(target.hash).toBe('');
        const local = target.pathname.slice(1);
        expect(local).toMatch(/^(?:index\.html|assets\/|vendor\/)/);
        const packageName = vendor.get(local);
        const file = packageName ? path.join(root, 'node_modules', packageName, 'LICENSE') : path.join(root, local);
        expect(existsSync(file)).toBe(true);
    }
    const prepare = readFileSync(path.join(root, 'scripts/prepare-client.mjs'), 'utf8');
    expect(prepare).toContain("path.join(threeSource, 'LICENSE')");
    expect(prepare).toContain("path.join(nodeModules, 'protobufjs', 'LICENSE')");
});

test('all four supplied class provenance and original CC0 notices remain linked', () => {
    for (const name of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
        expect(document.querySelector(`a[href="../archetypes/${name}/PROVENANCE.md"]`)).not.toBeNull();
        expect(document.querySelector(`a[href="../archetypes/${name}/LICENSE-MAKEHUMAN-CC0.txt"]`)).not.toBeNull();
    }
    expect(document.querySelector('a[href="../npcs/ilyra/README.md"]')).not.toBeNull();
});

test('original license text is linked, not rewritten or extended into a project license', () => {
    expect(document.body.textContent).toContain('not a separate license grant');
    expect(document.body.textContent).toContain('not a complete launch-rights certification');
    expect(document.body.textContent).toContain('differently licensed files');
    expect(document.body.textContent).not.toMatch(/Eidolon is (?:licensed|released) under/i);
});

test('login opens notices separately without replacing the game or weakening the GitHub credit', () => {
    const login = new JSDOM(readFileSync(path.join(root, 'index.html'), 'utf8')).window.document;
    const anchor = login.querySelector('#login-panel .auth-project-note #login-component-notices');
    expect(anchor?.getAttribute('href')).toBe('assets/notices/index.html');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel').split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    expect(anchor.getAttribute('aria-label')).toContain('opens in a new tab');
    expect(login.querySelector('.auth-project-note a[href="https://github.com/aeml/eidolon"]')).not.toBeNull();
});
