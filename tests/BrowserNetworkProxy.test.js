import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBrowserProxy } from '../scripts/qa-browser-proxy.mjs';

const disposers = [];
afterEach(async () => {
    for (const dispose of disposers.splice(0).reverse()) await dispose();
});

async function fixture(options = {}) {
    const server = net.createServer(socket => socket.pipe(socket));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    disposers.push(() => new Promise(resolve => server.close(resolve)));
    const policy = typeof options === 'function' ? options(server.address().port) : options;
    const proxy = await createBrowserProxy({ host: '127.0.0.1', clientAddress: () => '127.0.0.1',
        origins: [], allowLoopback: true, ...policy });
    disposers.push(() => proxy.close());
    const socket = net.connect(proxy.port, '127.0.0.1');
    socket.on('error', () => {});
    disposers.push(() => socket.destroy());
    await new Promise(resolve => socket.once('connect', resolve));
    let received = Buffer.alloc(0), ended = false;
    const waiters = [];
    const notify = () => { for (const wake of waiters.splice(0)) wake(); };
    socket.on('data', chunk => { received = Buffer.concat([received, chunk]); notify(); });
    socket.on('close', () => { ended = true; notify(); });
    const read = async size => {
        while (received.length < size && !ended) await new Promise(resolve => waiters.push(resolve));
        if (received.length < size) throw new Error('Proxy closed before expected bytes');
        const result = received.subarray(0, size);
        received = received.subarray(size);
        return result;
    };
    const connect = address => {
        const bytes = Buffer.from(address);
        const request = Buffer.from([5, 1, 0, 3, bytes.length, ...bytes, 0, 0]);
        request.writeUInt16BE(server.address().port, request.length - 2);
        return request;
    };
    return { socket, read, connect, port: server.address().port };
}

test('fragmented greeting and CONNECT retain binary payload bytes and backpressure', async () => {
    const f = await fixture();
    f.socket.write(Buffer.from([5]));
    f.socket.write(Buffer.from([2, 2, 0]));
    expect([...await f.read(2)]).toEqual([5, 0]);
    const request = f.connect('localhost');
    for (const byte of request) f.socket.write(Buffer.from([byte]));
    expect([...await f.read(10)]).toEqual([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
    const payload = randomBytes(384 * 1024);
    f.socket.write(payload);
    expect(await f.read(payload.length)).toEqual(payload);
});

test('coalesced greeting, IPv4 CONNECT and first application bytes remain intact', async () => {
    const f = await fixture();
    const request = Buffer.from([5, 1, 0, 1, 127, 0, 0, 1, 0, 0]);
    request.writeUInt16BE(f.port, 8);
    const payload = Buffer.from([0, 255, 1, 0, 241]);
    f.socket.write(Buffer.concat([Buffer.from([5, 1, 0]), request, payload]));
    expect([...await f.read(2)]).toEqual([5, 0]);
    expect((await f.read(10))[1]).toBe(0);
    expect(await f.read(payload.length)).toEqual(payload);
});

test('a declared hostname with an undeclared port is refused', async () => {
    const f = await fixture({ origins: ['http://server.eidolonrealms.com:1'], allowLoopback: false,
        backendOriginIP: '127.0.0.1' });
    // The deliberately wrong allowed port must fail without connecting.
    f.socket.write(Buffer.concat([Buffer.from([5, 1, 0]), f.connect('server.eidolonrealms.com')]));
    expect([...await f.read(2)]).toEqual([5, 0]);
    expect((await f.read(10))[1]).toBe(2);
});

test('the exact declared backend origin maps to its IP while preserving binary bytes', async () => {
    const f = await fixture(port => ({ origins: [`http://server.eidolonrealms.com:${port}`],
        allowLoopback: false, backendOriginIP: '127.0.0.1' }));
    const payload = randomBytes(1024);
    f.socket.write(Buffer.concat([Buffer.from([5, 1, 0]), f.connect('server.eidolonrealms.com'), payload]));
    expect([...await f.read(2)]).toEqual([5, 0]);
    expect((await f.read(10))[1]).toBe(0);
    expect(await f.read(payload.length)).toEqual(payload);
});

test.each([
    ['unsupported authentication', [5, 1, 2], 2, 255],
    ['unsupported command', [5, 1, 0, 5, 2, 0, 1], 12, 7],
    ['unsupported address', [5, 1, 0, 5, 1, 0, 9], 12, 8]
])('%s fails visibly', async (_name, request, count, expected) => {
    const f = await fixture();
    f.socket.write(Buffer.from(request));
    const response = await f.read(count);
    expect(response[count === 2 ? 1 : 3]).toBe(expected);
});

test('a connection from any other client address is closed', async () => {
    const f = await fixture({ clientAddress: () => '192.0.2.1' });
    f.socket.write(Buffer.from([5, 1, 0]));
    await expect(f.read(2)).rejects.toThrow('closed');
});

test('unknown external destinations and disabled loopback are refused', async () => {
    const f = await fixture({ allowLoopback: false });
    f.socket.write(Buffer.concat([Buffer.from([5, 1, 0]), f.connect('localhost')]));
    expect([...await f.read(2)]).toEqual([5, 0]);
    expect((await f.read(10))[1]).toBe(2);
});

test('private Unix socket is accessible only through its owned directory and mode', async () => {
    const root = mkdtempSync(join(tmpdir(), 'eidolon-proxy-test-'));
    disposers.push(() => rmSync(root, { recursive: true, force: true }));
    const socketPath = join(root, 'proxy.sock');
    const proxy = await createBrowserProxy({ socketPath, origins: [], allowLoopback: true });
    disposers.push(() => proxy.close());
    expect(statSync(root).mode & 0o777).toBe(0o700);
    expect(statSync(socketPath).mode & 0o777).toBe(0o600);
    const socket = net.connect(socketPath);
    disposers.push(() => socket.destroy());
    const reply = new Promise(resolve => socket.once('data', resolve));
    socket.write(Buffer.from([5, 1, 0]));
    expect([...await reply]).toEqual([5, 0]);
});

async function capsule(command, payload) {
    const child = spawn(process.execPath, ['scripts/qa-browser-capsule.mjs', '/unused-fixture.sock',
        '/bin/bash', '-c', command], { stdio: ['pipe', 'pipe', 'pipe'] });
    disposers.push(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
    const stdout = [], stderr = [];
    child.stdout.on('data', data => stdout.push(data));
    child.stderr.on('data', data => stderr.push(data));
    child.stdin.on('error', () => {});
    const closed = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', code => resolve({ code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
    });
    child.stdin.end(payload);
    return await closed;
}

test('capsule keeps DevTools descriptors blocking and relays binary bytes separately from diagnostics', async () => {
    const bytes = randomBytes(64 * 1024);
    const result = await capsule('echo diagnostic; cat <&3 >&4', bytes);
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(bytes);
    expect(result.stderr.toString()).toBe('diagnostic\n');
});

test('capsule propagates the original browser failure exit code', async () => {
    const result = await capsule('exit 23', Buffer.alloc(0));
    expect(result.code).toBe(23);
    expect(result.stdout.length).toBe(0);
});
