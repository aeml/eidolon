import net from 'node:net';
import { spawn } from 'node:child_process';
import { constants } from 'node:os';

// Runs in the ordinary browser container. Only the SOCKS byte stream crosses
// the private mounted Unix socket; no host TCP listener or Docker access.
const [socketPath, chrome, ...args] = process.argv.slice(2);
const sockets = new Set();
const server = net.createServer(client => {
    const upstream = net.connect(socketPath);
    for (const socket of [client, upstream]) {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        socket.on('error', () => { client.destroy(); upstream.destroy(); });
    }
    client.on('close', () => upstream.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const browser = spawn(chrome, [...args,
    `--proxy-server=socks5://127.0.0.1:${server.address().port}`, '--proxy-bypass-list=<-loopback>'], {
    // Chrome's stdout is diagnostic output. Only fd4 carries CDP responses.
    // Give Chrome the same dedicated pipes as Playwright. Docker's shared
    // stdout can return partial writes for large CDP messages; Node streams
    // forward every byte with backpressure instead of passing that fd to Chrome.
    stdio: ['ignore', 2, 2, 'pipe', 'pipe']
});
process.stdin.pipe(browser.stdio[3]);
browser.stdio[4].pipe(process.stdout, { end: false });
browser.stdio[3].on('error', () => process.stdin.destroy());
let signalCode;
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {
    signalCode = 128 + constants.signals[signal];
    browser.kill(signal);
});
try {
    const code = await new Promise((resolve, reject) => {
        browser.once('error', reject);
        browser.once('close', (code, signal) => resolve(code ?? (128 + constants.signals[signal])));
    });
    process.exitCode = signalCode ?? code;
} finally {
    process.stdin.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
}
