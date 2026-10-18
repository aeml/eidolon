import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

let directory, publication, fixtures, plain, prepared;
const game = 'export const shippedGame = true;';
const fixture = 'export const preparedAtlas = true;';
const request = (origin, pathname, method = 'GET') => new Promise((resolve, reject) => {
    get(origin + pathname, { method }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body, headers: response.headers }));
        response.on('error', reject);
    }).on('error', reject);
});

async function start(testRoot) {
    const socket = createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', EIDOLON_STATIC_ROOT: publication };
    delete env.EIDOLON_STATIC_TEST_ROOT;
    delete env.EIDOLON_STATIC_WS_URL;
    if (testRoot) env.EIDOLON_STATIC_TEST_ROOT = testRoot;
    const child = spawn(process.execPath, ['scripts/serve-static.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = once(child, 'exit');
    const origin = `http://127.0.0.1:${port}`;
    try {
        for (let i = 0; i < 50; i++) {
            if (child.exitCode !== null) throw Error('Owned fixture server exited before readiness');
            try { if ((await request(origin, '/')).status === 200) return { child, exited, origin }; }
            catch { /* Readiness only; retain the same owned process. */ }
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw Error('Owned fixture server did not become ready');
    } catch (error) {
        child.kill('SIGTERM'); await exited; throw error;
    }
}

beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'eidolon-static-fixtures-'));
    publication = path.join(directory, 'publication'); fixtures = path.join(directory, 'fixtures');
    await mkdir(path.join(publication, 'src'), { recursive: true });
    await mkdir(path.join(publication, 'tests'));
    await mkdir(path.join(fixtures, 'src'), { recursive: true });
    await writeFile(path.join(publication, 'index.html'), '<p>Exact copied game</p>');
    await writeFile(path.join(publication, 'src/game.js'), game);
    await writeFile(path.join(fixtures, 'darkRealmFixture.js'), fixture);
    await writeFile(path.join(fixtures, 'src/game.js'), 'This must never override the game.');
    await writeFile(path.join(publication, 'tests/not-in-fixtures.js'), 'No fallback to copied game.');
    await writeFile(path.join(directory, 'outside.js'), 'Private outside bytes.');
    await symlink(path.join(directory, 'outside.js'), path.join(fixtures, 'escape.js'));
    plain = await start(); prepared = await start(fixtures);
});

afterAll(async () => {
    for (const server of [plain, prepared]) {
        if (server) { server.child.kill('SIGTERM'); await server.exited; }
    }
    if (directory) await rm(directory, { recursive: true, force: true });
});

test('test fixtures remain unavailable without explicit opt-in', async () => {
    expect((await request(plain.origin, '/tests/darkRealmFixture.js')).status).toBe(404);
    expect((await request(plain.origin, '/src/game.js')).body).toBe(game);
});

test('opt-in serves the exact fixture module with ordinary JavaScript headers and HEAD', async () => {
    const response = await request(prepared.origin, '/tests/darkRealmFixture.js');
    expect(response.status).toBe(200); expect(response.body).toBe(fixture);
    expect(response.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(response.headers['cache-control']).toBe('no-store');
    const head = await request(prepared.origin, '/tests/darkRealmFixture.js', 'HEAD');
    expect(head.status).toBe(200); expect(head.body).toBe('');
    expect(Number(head.headers['content-length'])).toBe(Buffer.byteLength(fixture));
});

test('the fixture root cannot substitute game modules or alter copied publication bytes', async () => {
    expect((await request(prepared.origin, '/src/game.js')).body).toBe(game);
    expect(await readFile(path.join(publication, 'src/game.js'), 'utf8')).toBe(game);
    expect((await request(prepared.origin, '/tests/not-in-fixtures.js')).status).toBe(404);
});

test.each(['/tests/..%2foutside.js', '/tests/escape.js'])(
    'fixture delivery rejects escaping the configured test root: %s', async pathname => {
        const response = await request(prepared.origin, pathname);
        expect(response.status).toBe(403); expect(response.body).not.toContain('Private outside bytes');
    });
