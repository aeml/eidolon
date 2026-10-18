import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile), release = 'a'.repeat(40);
let parent, source;
const request = url => new Promise((resolve, reject) => {
    get(url, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body }));
        response.on('error', reject);
    }).on('error', reject);
});
const prepare = destination => execute(process.execPath, ['--input-type=module', '-e',
    `import {preparePublishedClient} from ${JSON.stringify(pathToFileURL(path.resolve('scripts/prepare-published-client.mjs')).href)};
    console.log(JSON.stringify(await preparePublishedClient(${JSON.stringify(destination)},${JSON.stringify(release)},${JSON.stringify(source)})));`]);

beforeAll(async () => {
    parent = await mkdtemp(path.join(tmpdir(), 'eidolon-published-client-test-'));
    source = path.join(parent, 'source'); await mkdir(source);
    // Use the actual geometry worker and vendored runtime. The tiny login/game
    // entry isolates publication and shared-session ownership, not game visuals.
    for (const name of ['src', 'vendor']) await cp(path.resolve(name), path.join(source, name), { recursive: true });
    await mkdir(path.join(source, 'assets'));
    await cp(path.resolve('assets/gameplay-geometry'), path.join(source, 'assets/gameplay-geometry'), { recursive: true });
    await writeFile(path.join(source, 'release.json'), JSON.stringify({ version: 'Alpha 1.79.80' }));
    await writeFile(path.join(source, 'sw.js'), 'export const fixture = true;');
    await writeFile(path.join(source, 'index.html'), '<input type="hidden" id="server-address" value="wss://unused.example/ws"><script type="module" src="./src/main.js"></script>');
    await writeFile(path.join(source, 'src/core/CredentialToken.js'), 'let token; export const setToken=value=>token=value; export const getToken=()=>token;');
    await writeFile(path.join(source, 'src/main.js'), "export {setToken} from './core/CredentialToken.js'; export const enter=()=>import('./core/GameEngine.js'); export const retry=()=>import('./core/GameEngine.js?startupRetry=1');");
    await writeFile(path.join(source, 'src/core/GameEngine.js'), "import {getToken} from './CredentialToken.js'; export class GameEngine {token(){return getToken()}}");
});
afterAll(async () => { if (parent) await rm(parent, { recursive: true, force: true }); });

test('copied client uses the published lazy bundle, retains login ownership and preserves source bytes', async () => {
    const original = await readFile(path.join(source, 'src/main.js'));
    const destination = path.join(parent, 'published');
    const { stdout } = await prepare(destination), metadata = JSON.parse(stdout);
    expect(metadata.inputs).toEqual(['index.html', 'assets', 'src', 'vendor', 'sw.js', 'release.json']);
    expect(metadata.source).toBe(release);
    expect(metadata.engine.worker.imports).toEqual([]);
    expect(await readFile(path.join(source, 'src/main.js'))).toEqual(original);
    expect((await readFile(path.join(destination, 'src/main.js'), 'utf8'))).toContain('GameEngine.bundle.js');
    expect(JSON.parse(await readFile(path.join(destination, 'release.json'), 'utf8')).commit).toBe(release);
    await writeFile(path.join(destination, 'package.json'), '{"type":"module"}');
    const probe = await execute(process.execPath, ['--input-type=module', '-e',
        `const login=await import(${JSON.stringify(pathToFileURL(path.join(destination, 'src/main.js')).href + '?release=' + release)});
        login.setToken('prepared-session'); const first=await login.enter(); const recovered=await login.retry();
        const a=new first.GameEngine(), b=new recovered.GameEngine(); const before=[a.token(),b.token()];
        login.setToken(null); console.log(JSON.stringify({before,after:[a.token(),b.token()],name:a.constructor.name}));`]);
    expect(JSON.parse(probe.stdout)).toEqual({ before: ['prepared-session', 'prepared-session'], after: [null, null], name: 'GameEngine' });
    expect(createHash('sha256').update(await readFile(path.join(destination, metadata.engine.worker.output))).digest('hex')).toBe(metadata.engine.worker.sha256);
});

test('preparation refuses the editable source and existing destinations without replacing data', async () => {
    const before = await readFile(path.join(source, 'src/main.js'));
    await expect(prepare(source)).rejects.toThrow('separate copied tree');
    const destination = path.join(parent, 'retained'); await mkdir(destination);
    await writeFile(path.join(destination, 'sentinel.txt'), 'retained proof');
    await expect(prepare(destination)).rejects.toThrow('EEXIST');
    expect(await readFile(path.join(destination, 'sentinel.txt'), 'utf8')).toBe('retained proof');
    expect(await readFile(path.join(source, 'src/main.js'))).toEqual(before);
});

test('static serving selects the copied client and WS override while retaining traversal rejection', async () => {
    const destination = path.join(parent, 'served'); await prepare(destination);
    const listener = createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
    const child = spawn(process.execPath, ['scripts/serve-static.mjs'], { env: { ...process.env, PORT: String(port),
        EIDOLON_STATIC_ROOT: destination, EIDOLON_STATIC_WS_URL: 'ws://127.0.0.1:12345/ws' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = once(child, 'exit');
    try {
        const origin = `http://127.0.0.1:${port}`;
        let response;
        for (let i = 0; i < 50; i++) {
            if (child.exitCode !== null) throw Error('Owned static server exited before readiness');
            try { response = await request(origin); } catch { /* Readiness only; the same process remains owned. */ }
            if (response?.status === 200) break;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        expect(response?.status).toBe(200);
        const html = response.body;
        expect(html).toContain('ws://127.0.0.1:12345/ws');
        expect(html).toContain(release);
        expect((await request(`${origin}/src/main.js`)).body).toContain('GameEngine.bundle.js');
        expect((await request(`${origin}/..%2foutside.txt`)).status).toBe(403);
        expect(await readFile(path.join(destination, 'index.html'), 'utf8')).toContain('wss://unused.example/ws');
    } finally { child.kill('SIGTERM'); await exited; }
});
