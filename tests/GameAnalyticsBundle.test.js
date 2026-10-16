import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { URL, URLSearchParams } from 'node:url';

const execute = promisify(execFile), fixtures = [];
const entry = '<script type="module" src="./src/analytics/game.js"></script>';
async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), 'eidolon-analytics-bundle-'));
    fixtures.push(root);
    await mkdir(path.join(root, 'src'), { recursive: true });
    await cp('src/analytics', path.join(root, 'src/analytics'), { recursive: true });
    await writeFile(path.join(root, 'index.html'), `<head><script src="./src/core/RecoveryLinkBoot.js"></script>${entry}</head>`);
    await writeFile(path.join(root, 'release.json'), '{"version":"Alpha 1.79.60"}');
    return root;
}
async function bundle(root) {
    const { stdout } = await execute(process.execPath, ['scripts/bundle-game-analytics.mjs', root]);
    return JSON.parse(stdout);
}
afterEach(async () => { await Promise.all(fixtures.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

test('publishing closes the actual analytics graph without changing source modules or private-link boot order', async () => {
    const root = await fixture(), original = await readFile(path.join(root, 'src/analytics/game.js'), 'utf8');
    const result = await bundle(root), html = await readFile(path.join(root, 'index.html'), 'utf8');
    expect(result).toMatchObject({ output: 'src/analytics/game.bundle.js', bundledModules: 4, externalImports: [] });
    expect(result.bytes).toBeGreaterThan(1000); expect(result.bytes).toBeLessThan(15000);
    expect(html).toContain('src="./src/analytics/game.bundle.js"');
    expect(html.indexOf('RecoveryLinkBoot.js')).toBeLessThan(html.indexOf('game.bundle.js'));
    expect(await readFile(path.join(root, 'src/analytics/game.js'), 'utf8')).toBe(original);
    const contents = await readFile(path.join(root, result.output), 'utf8');
    expect(contents).not.toMatch(/\bimport\s*(?:\(|['"*{])/);
    expect(await bundle(root)).toBe(false);
    expect(await readFile(path.join(root, result.output), 'utf8')).toBe(contents);
    await execute(process.execPath, ['scripts/version-pages-runtime.mjs', root, 'analyticsfixture20261016']);
    expect(await readFile(path.join(root, 'index.html'), 'utf8')).toContain('game.bundle.js?release=analyticsfixture20261016');
});

function browser(contents, head, fragment = '') {
    let now = 0, interval;
    const requests = [], events = new Map(), win = { location: new URL(`https://play.eidolonrealms.com/#${fragment}`) };
    const listen = (name, fn) => { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); };
    win.addEventListener = listen;
    win.history = { replaceState(_, __, address) { win.location = new URL(address, win.location); } };
    const doc = { visibilityState: 'visible', hasFocus: () => true, referrer: 'https://example.com/account/private',
        head: { appendChild: script => requests.push(script.src) }, createElement: () => ({}), addEventListener: listen };
    const context = { window: win, document: doc, URLSearchParams, performance: { now: () => now },
        setInterval(fn) { interval = fn; } };
    runInNewContext(head, context); runInNewContext(contents, context);
    win.game = { _firstStateReceived: true, playerType: 'Fighter', player: { hasSyncedLevel: true, username: 'must-not-leak' },
        network: { socket: { readyState: 1 }, _reconnecting: false, token: 'must-not-leak' } };
    interval(); now = 31000; interval();
    for (const listener of events.get('pagehide')) listener();
    return { win, requests, serialized: JSON.stringify(win.dataLayer || []) };
}
test('compiled public tracker retains connected-play start, heartbeat/end and excludes account data', async () => {
    const root = await fixture(), result = await bundle(root);
    const contents = await readFile(path.join(root, result.output), 'utf8'), head = await readFile('src/core/RecoveryLinkBoot.js', 'utf8');
    const resultBrowser = browser(contents, head);
    expect(resultBrowser.requests).toHaveLength(1);
    expect(resultBrowser.requests[0]).toContain('https://www.googletagmanager.com/gtag/js?id=');
    const events = resultBrowser.win.dataLayer.map(row => [...row]).filter(row => row[0] === 'event');
    expect(events.map(row => row[1])).toEqual(['gameplay_start', 'gameplay_engagement', 'gameplay_end']);
    expect(events[1][2].active_play_seconds).toBe(31);
    expect(events[2][2]).toMatchObject({ total_active_play_seconds: 31, end_reason: 'pagehide' });
    expect(resultBrowser.serialized).not.toContain('must-not-leak');
    expect(resultBrowser.serialized).not.toContain('/account/private');
});
test.each([
    `invite=v1.eyJ1c2VybmFtZSI6IkFub24ifQ.${'A'.repeat(43)}`,
    'invite=bad&invite=bad',
    `eidolon-recovery=reset&account=private-owner&token=${'a'.repeat(64)}`,
    'eidolon-private=account'
])('compiled analytics never requests the provider or records events on a private entry', async fragment => {
    const root = await fixture(), result = await bundle(root);
    const resultBrowser = browser(await readFile(path.join(root, result.output), 'utf8'), await readFile('src/core/RecoveryLinkBoot.js', 'utf8'), fragment);
    expect(resultBrowser.win.location.hash).toBe('');
    expect(resultBrowser.win.__eidolonRecoverySensitivePage).toBe(true);
    expect(resultBrowser.requests).toEqual([]); expect(resultBrowser.win.dataLayer).toBeUndefined();
});

test.each(['duplicate', 'non-module', 'external-import', 'missing-observer', 'linked-input', 'linked-json-input', 'linked-output'])('unsafe %s publication fails before rewriting HTML or outside files', async kind => {
    const root = await fixture(), outside = await mkdtemp(path.join(tmpdir(), 'eidolon-analytics-outside-'));
    fixtures.push(outside);
    const sentinel = path.join(outside, 'sentinel.js'); await writeFile(sentinel, 'outside remains unchanged');
    const index = path.join(root, 'index.html'), observer = path.join(root, 'src/analytics/GameSessionObserver.js');
    if (kind === 'duplicate') await writeFile(index, entry + entry);
    if (kind === 'non-module') await writeFile(index, '<script src="./src/analytics/game.js"></script>');
    if (kind === 'external-import') await writeFile(path.join(root, 'src/analytics/game.js'), "import 'unsupported-package';");
    if (kind === 'missing-observer' || kind === 'linked-input') await rm(observer);
    if (kind === 'linked-input') await symlink(sentinel, observer);
    if (kind === 'linked-json-input') {
        await writeFile(path.join(root, 'src/analytics/game.js'), "import value from './outside.json'; console.log(value);");
        await symlink(sentinel, path.join(root, 'src/analytics/outside.json'));
    }
    if (kind === 'linked-output') await symlink(sentinel, path.join(root, 'src/analytics/game.bundle.js'));
    const html = await readFile(index, 'utf8');
    await expect(bundle(root)).rejects.toThrow();
    expect(await readFile(index, 'utf8')).toBe(html);
    expect(await readFile(sentinel, 'utf8')).toBe('outside remains unchanged');
});
test('editable source cannot be bundled in place and unrelated pages/comments are left alone', async () => {
    const original = await readFile('index.html', 'utf8');
    await expect(bundle(process.cwd())).rejects.toThrow(/copied publication tree/);
    expect(await readFile('index.html', 'utf8')).toBe(original);
    const root = await fixture(), html = `<!-- ${entry} --><script data-src="./src/analytics/game.js"></script>`;
    await writeFile(path.join(root, 'index.html'), html);
    expect(await bundle(root)).toBe(false); expect(await readFile(path.join(root, 'index.html'), 'utf8')).toBe(html);
});
test('rewrites the real src even when an earlier data-src contains the identical URL', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'index.html'), '<script type="module" data-src="./src/analytics/game.js" src="./src/analytics/game.js"></script>');
    await bundle(root);
    expect(await readFile(path.join(root, 'index.html'), 'utf8')).toBe('<script type="module" data-src="./src/analytics/game.js" src="./src/analytics/game.bundle.js"></script>');
});
