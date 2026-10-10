import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let repositoryModules;
const networkCodes = new Set([
    'net::ERR_ABORTED', 'net::ERR_FAILED', 'net::ERR_CONNECTION_CLOSED', 'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_ABORTED', 'net::ERR_CONNECTION_TIMED_OUT',
    'net::ERR_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED', 'net::ERR_NETWORK_CHANGED',
    'net::ERR_INTERNET_DISCONNECTED', 'net::ERR_EMPTY_RESPONSE', 'net::ERR_HTTP2_PROTOCOL_ERROR',
    'net::ERR_HTTP_RESPONSE_CODE_FAILURE', 'net::ERR_QUIC_PROTOCOL_ERROR',
    'net::ERR_CERT_AUTHORITY_INVALID', 'net::ERR_CERT_DATE_INVALID', 'net::ERR_CERT_COMMON_NAME_INVALID',
    'net::ERR_SSL_PROTOCOL_ERROR', 'net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH',
    'net::ERR_CACHE_MISS', 'net::ERR_CONTENT_LENGTH_MISMATCH', 'net::ERR_INCOMPLETE_CHUNKED_ENCODING',
    'net::ERR_INSUFFICIENT_RESOURCES', 'net::ERR_BLOCKED_BY_CLIENT', 'net::ERR_BLOCKED_BY_RESPONSE',
    'net::ERR_ACCESS_DENIED'
]);
function knownModules() {
    if (repositoryModules) return repositoryModules;
    repositoryModules = new Set(['/src/core/GameEngine.bundle.js']);
    for (const folder of ['src', 'vendor']) {
        const root = new URL(`../../${folder}/`, import.meta.url);
        const visit = (directory, relative) => {
            for (const entry of readdirSync(directory, { withFileTypes: true })) {
                const path = `${relative}/${entry.name}`;
                if (entry.isDirectory()) visit(`${directory}/${entry.name}`, path);
                else if (entry.isFile() && /\.m?js$/.test(entry.name)) repositoryModules.add(path);
            }
        };
        visit(fileURLToPath(root), `/${folder}`);
    }
    return repositoryModules;
}

// Node-side QA evidence only. Keep known static module paths and fixed browser
// error codes; never retain query strings, headers, bodies or arbitrary text.
export function observeStartupModules(page, baseURL, allowed = knownModules()) {
    const origin = new URL(baseURL).origin, failures = [];
    const requests = new WeakMap();
    let observed = 0, generation = 0;
    const started = request => requests.set(request, generation);
    const modulePath = request => {
        try {
            const url = new URL(request.url());
            return requests.get(request) === generation && request.method() === 'GET' && request.resourceType() === 'script' &&
                url.origin === origin && !url.username && !url.password && allowed.has(url.pathname)
                ? url.pathname : null;
        } catch { return null; }
    };
    const record = entry => {
        observed = Math.min(observed + 1, 1_000_000);
        failures.push(entry);
        if (failures.length > 8) failures.shift();
    };
    const failed = request => {
        const module = modulePath(request);
        if (!module) return;
        const raw = request.failure()?.errorText;
        record({ module, kind: 'request', code: networkCodes.has(raw) ? raw : 'unknown' });
    };
    const response = result => {
        const module = modulePath(result.request()), status = result.status();
        if (module && Number.isInteger(status) && status >= 400 && status <= 599) record({ module, kind: 'http', status });
    };
    const dispose = () => {
        page.removeListener('request', started);
        page.removeListener('requestfailed', failed); page.removeListener('response', response);
        page.removeListener('close', dispose);
    };
    page.on('request', started); page.on('requestfailed', failed); page.on('response', response); page.once('close', dispose);
    return {
        reset() { generation++; observed = 0; failures.length = 0; },
        snapshot() { return { observed, dropped: Math.max(0, observed - failures.length), failures: failures.map(entry => ({ ...entry })) }; },
        dispose
    };
}
