import net from 'node:net';
import { chmodSync } from 'node:fs';

const loopback = new Set(['localhost', '127.0.0.1', '::1']);
const backendNames = new Set(['eserver.mendola.tech', 'server.eidolonrealms.com']);

// This is a TCP forwarder, not an HTTP intermediary. Chrome retains the real
// origin, certificate verification, HTTP/2, WebSockets and request deadlines.
export async function createBrowserProxy({ host, socketPath, clientAddress, origins, allowLoopback, backendOriginIP }) {
    if (backendOriginIP && !net.isIP(backendOriginIP)) throw new Error('Invalid backend origin IP');
    const allowed = new Set(origins.map(origin => {
        const url = new URL(origin);
        if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) throw new Error('Unsupported QA origin');
        return `${url.hostname.replace(/^\[|\]$/g, '')}:${url.port || (/^(https|wss):$/.test(url.protocol) ? 443 : 80)}`;
    }));
    const sockets = new Set();
    const server = net.createServer(client => {
        // A private Unix socket is protected by its owned 0700 directory and
        // 0600 mode. TCP fixtures additionally require an exact client address.
        if (!socketPath && client.remoteAddress !== clientAddress()) { client.destroy(); return; }
        sockets.add(client);
        client.on('close', () => sockets.delete(client));
        client.on('error', () => client.destroy());
        let buffer = Buffer.alloc(0), stage = 'greeting';
        const reject = code => {
            client.removeListener('data', receive);
            client.end(Buffer.from(stage === 'greeting' ? [5, 255] : [5, code, 0, 1, 0, 0, 0, 0, 0, 0]));
        };
        const receive = data => {
            buffer = Buffer.concat([buffer, data]);
            if (stage === 'greeting') {
                if (buffer.length < 2) return;
                if (buffer[0] !== 5 || buffer[1] === 0) return reject(1);
                const length = 2 + buffer[1];
                if (buffer.length < length) return;
                if (!buffer.subarray(2, length).includes(0)) return reject(1);
                buffer = buffer.subarray(length);
                client.write(Buffer.from([5, 0]));
                stage = 'request';
            }
            if (buffer.length < 4) return;
            if (buffer[0] !== 5 || buffer[1] !== 1 || buffer[2] !== 0) return reject(7);
            const type = buffer[3];
            if (![1, 3, 4].includes(type)) return reject(8);
            if (type === 3 && buffer.length < 5) return;
            const start = type === 3 ? 5 : 4;
            const size = type === 1 ? 4 : type === 4 ? 16 : buffer[4];
            if (size === 0) return reject(8);
            if (buffer.length < start + size + 2) return;
            const addressBytes = buffer.subarray(start, start + size);
            const address = type === 1 ? [...addressBytes].join('.') : type === 4
                ? Array.from({ length: 8 }, (_, i) => addressBytes.readUInt16BE(i * 2).toString(16)).join(':')
                : addressBytes.toString('ascii').toLowerCase();
            const port = buffer.readUInt16BE(start + size);
            // Domain bytes must be ASCII without embedded control characters.
            if (type === 3 && (!/^[a-z0-9.-]+$/.test(address) || addressBytes.some(byte => byte > 127))) return reject(8);
            const normalized = address === '0:0:0:0:0:0:0:1' ? '::1' : address;
            if (!port || !(allowed.has(`${normalized}:${port}`) || (allowLoopback && loopback.has(normalized)))) return reject(2);
            const remainder = buffer.subarray(start + size + 2);
            buffer = null;
            client.pause();
            client.removeListener('data', receive);
            stage = 'connecting';
            const upstream = net.connect({ host: backendNames.has(normalized) && backendOriginIP
                ? backendOriginIP : normalized === 'localhost' ? '127.0.0.1' : normalized, port });
            sockets.add(upstream);
            upstream.on('close', () => sockets.delete(upstream));
            client.on('close', () => upstream.destroy());
            upstream.on('error', () => {
                if (stage === 'connecting') reject(5);
                else client.destroy();
            });
            upstream.once('connect', () => {
                stage = 'stream';
                client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
                if (remainder.length) upstream.write(remainder);
                client.pipe(upstream);
                upstream.pipe(client);
                client.resume();
            });
        };
        client.on('data', receive);
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        if (socketPath) server.listen(socketPath, () => { chmodSync(socketPath, 0o600); resolve(); });
        else server.listen(0, host, resolve);
    });
    return {
        port: socketPath ? undefined : server.address().port,
        async close() {
            for (const socket of sockets) socket.destroy();
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        }
    };
}
