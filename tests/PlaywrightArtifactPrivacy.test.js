import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const password = 'private-fixture-quote"slash\\secret';
const credentialNames = ['EIDOLON_E2E_USERNAME', 'EIDOLON_E2E_PASSWORD',
    'EIDOLON_E2E_USERNAME_SECONDARY', 'EIDOLON_E2E_PASSWORD_SECONDARY'];
const anonymousEnv = () => ({ ...process.env, ...Object.fromEntries(credentialNames.map(name => [name, ''])) });
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

// Archive utilities need Node's native Request global, which the game's
// jsdom setup does not provide. Run these fixture operations in ordinary Node
// just like the production sanitizer, without altering the shared DOM setup.
const zipFixtureScript = `
import fs from 'node:fs';
import bundle from 'playwright-core/lib/utilsBundle';
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (input.operation === 'write') {
    const zip = new bundle.yazl.ZipFile();
    const completed = new Promise((resolve, reject) => {
        const chunks = [];
        zip.outputStream.on('data', chunk => chunks.push(chunk));
        zip.outputStream.once('error', reject);
        zip.outputStream.once('end', () => resolve(Buffer.concat(chunks)));
    });
    zip.addBuffer(Buffer.from(input.contents), input.name);
    zip.end();
    console.log((await completed).toString('base64'));
} else {
    const contents = await new Promise((resolve, reject) => {
        bundle.yauzl.fromBuffer(Buffer.from(input.encoded, 'base64'), { lazyEntries: true }, (error, zip) => {
            if (error) { reject(error); return; }
            zip.once('error', reject);
            zip.once('entry', entry => zip.openReadStream(entry, (failure, stream) => {
                if (failure) { zip.close(); reject(failure); return; }
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.once('error', reject);
                stream.once('end', () => { zip.close(); resolve(Buffer.concat(chunks)); });
            }));
            zip.readEntry();
        });
    });
    console.log(contents.toString());
}
`;

function zipFixture(input) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', zipFixtureScript], {
        input: JSON.stringify(input), encoding: 'utf8', timeout: 5000, maxBuffer: 4 * 1024 * 1024
    });
    expect(result.status).toBe(0);
    return result.stdout.trim();
}

function fixture() {
    const root = mkdtempSync(path.join(os.tmpdir(), 'eidolon-artifact-privacy-'));
    roots.push(root);
    return root;
}

async function archive(name, contents) {
    return Buffer.from(zipFixture({ operation: 'write', name, contents }), 'base64');
}

function report(compressed) {
    return '<html><body>Readable report</body><template id="playwrightReportBase64">data:application/zip;base64,' +
        compressed.toString('base64') + '</template></html>';
}

async function reportPayload(html) {
    const encoded = html.match(/data:application\/zip;base64,([^<]+)</)[1];
    return JSON.parse(zipFixture({ operation: 'read', encoded }));
}

function sanitize(root, credentials = true) {
    return spawnSync(process.execPath, ['scripts/sanitize-playwright-artifacts.mjs', root], {
        encoding: 'utf8', timeout: 5000,
        env: { ...anonymousEnv(), ...(credentials ? { EIDOLON_E2E_PASSWORD: password } : {}) }
    });
}

test('compressed and JSON-escaped credentials are removed without corrupting the report ZIP', async () => {
    const root = fixture();
    const original = report(await archive('report.json', JSON.stringify({ status: 'failed', detail: password })));
    // Demonstrate why scanning the outer raw bytes gives a false negative.
    expect(Buffer.from(original).includes(Buffer.from(password))).toBe(false);
    writeFileSync(path.join(root, 'index.html'), original);
    const result = sanitize(root);
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(password);
    const sanitized = readFileSync(path.join(root, 'index.html'), 'utf8');
    const payload = await reportPayload(sanitized);
    expect(payload.status).toBe('failed');
    expect(payload.detail).toMatch(/^\*+$/);
    expect(payload.detail).not.toContain(password);
    expect(sanitized).toContain('Readable report');
    // A second run verifies the decoded content and leaves the bytes stable.
    expect(sanitize(root).status).toBe(0);
    expect(readFileSync(path.join(root, 'index.html'), 'utf8')).toBe(sanitized);
});

test('standalone escaped JSON is sanitized and missing roots remain harmless', () => {
    const root = fixture();
    writeFileSync(path.join(root, 'result.json'), JSON.stringify({ detail: password, count: 1 }));
    expect(sanitize(root).status).toBe(0);
    const parsed = JSON.parse(readFileSync(path.join(root, 'result.json'), 'utf8'));
    expect(parsed.count).toBe(1);
    expect(parsed.detail).toMatch(/^\*+$/);
    expect(sanitize(path.join(root, 'absent')).status).toBe(0);
});

test.each(['trace.zip', 'video.webm', 'video.mp4'])('credentialed %s fails closed without editing or deleting evidence', async name => {
    const root = fixture();
    const contents = name.endsWith('.zip') ? await archive('trace.json', JSON.stringify({ password })) : Buffer.from('opaque recording');
    writeFileSync(path.join(root, name), contents);
    const result = sanitize(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unexpected recording/archive');
    expect(result.stdout + result.stderr).not.toContain(password);
    expect(readFileSync(path.join(root, name))).toEqual(contents);
});

test.each(['invalid-encoding', 'non-json', 'oversized'])('unreadable or unbounded %s report data cannot pass the upload gate', async kind => {
    const root = fixture();
    const contents = kind === 'invalid-encoding'
        ? '<template id="playwrightReportBase64">data:application/zip;base64,not-valid!</template>'
        : report(await archive(kind === 'non-json' ? 'opaque.bin' : 'large.json',
            kind === 'non-json' ? password : JSON.stringify('x'.repeat(17 * 1024 * 1024))));
    writeFileSync(path.join(root, 'index.html'), contents);
    expect(sanitize(root).status).not.toBe(0);
    expect(readFileSync(path.join(root, 'index.html'), 'utf8')).toBe(contents);
});

test('anonymous recording evidence is retained byte-for-byte', async () => {
    const root = fixture();
    const contents = await archive('trace.json', JSON.stringify({ synthetic: 'anonymous' }));
    writeFileSync(path.join(root, 'trace.zip'), contents);
    expect(sanitize(root, false).status).toBe(0);
    expect(readFileSync(path.join(root, 'trace.zip'))).toEqual(contents);
});

test.each(credentialNames)('%s alone disables automatic recordings and failure input snapshots', name => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
        'import config from "./playwright.config.js"; console.log(JSON.stringify({screenshot:config.use.screenshot,trace:config.use.trace,video:config.use.video,copy:process.env.PLAYWRIGHT_NO_COPY_PROMPT}));'], {
        encoding: 'utf8', timeout: 5000, env: { ...anonymousEnv(), [name]: 'configuration-only-fixture' }
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ screenshot: 'off', trace: 'off', video: 'off', copy: '1' });
});

test('anonymous configuration keeps diagnostic recordings', () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
        'import config from "./playwright.config.js"; console.log(JSON.stringify({screenshot:config.use.screenshot,trace:config.use.trace,video:config.use.video}));'], {
        encoding: 'utf8', timeout: 5000, env: anonymousEnv()
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'retain-on-failure' });
});
