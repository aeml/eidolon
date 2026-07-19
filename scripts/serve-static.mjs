import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.HOST || '127.0.0.1';
const port = Number.parseInt(process.env.PORT || '4173', 10);
const indexPath = path.join(repoRoot, 'index.html');

function configuredWebSocketURL() {
    if (!process.env.EIDOLON_STATIC_WS_URL) return null;
    const parsed = new URL(process.env.EIDOLON_STATIC_WS_URL);
    if (!['ws:', 'wss:'].includes(parsed.protocol)) {
        throw new Error('EIDOLON_STATIC_WS_URL must use ws:// or wss://');
    }
    return parsed.href;
}

const webSocketOverride = configuredWebSocketURL();

const mimeTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.glb', 'model/gltf-binary'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.map', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webp', 'image/webp']
]);

function resolveRequestPath(requestUrl) {
    const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const resolved = path.resolve(repoRoot, `.${requestedPath}`);
    if (resolved !== repoRoot && !resolved.startsWith(`${repoRoot}${path.sep}`)) return null;
    return resolved;
}

const server = createServer(async (request, response) => {
    const filePath = resolveRequestPath(request.url || '/');
    if (!filePath) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) throw new Error('Not a file');
        if (filePath === indexPath && webSocketOverride) {
            const source = await readFile(filePath, 'utf8');
            const rendered = source.replace(
                /(<input type="hidden" id="server-address" value=")[^"]+(">)/,
                (_match, prefix, suffix) => `${prefix}${webSocketOverride}${suffix}`
            );
            const contents = Buffer.from(rendered);
            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Length': contents.length,
                'Content-Type': mimeTypes.get('.html')
            });
            response.end(request.method === 'HEAD' ? undefined : contents);
            return;
        }
        response.writeHead(200, {
            'Cache-Control': 'no-store',
            'Content-Length': fileStat.size,
            'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
        });
        if (request.method === 'HEAD') {
            response.end();
            return;
        }
        createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
    }
});

server.listen(port, host, () => {
    console.log(`Eidolon static server listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
