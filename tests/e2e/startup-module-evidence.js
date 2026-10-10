import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let repositoryModules;
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
    let observed = 0;
    const modulePath = request => {
        try {
            const url = new URL(request.url());
            return request.method() === 'GET' && request.resourceType() === 'script' &&
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
        record({ module, kind: 'request', code: /^net::ERR_[A-Z0-9_]{1,64}$/.test(raw || '') ? raw : 'unknown' });
    };
    const response = result => {
        const module = modulePath(result.request()), status = result.status();
        if (module && Number.isInteger(status) && status >= 400 && status <= 599) record({ module, kind: 'http', status });
    };
    const dispose = () => {
        page.removeListener('requestfailed', failed); page.removeListener('response', response);
        page.removeListener('close', dispose);
    };
    page.on('requestfailed', failed); page.on('response', response); page.once('close', dispose);
    return {
        reset() { observed = 0; failures.length = 0; },
        snapshot() { return { observed, dropped: Math.max(0, observed - failures.length), failures: failures.map(entry => ({ ...entry })) }; },
        dispose
    };
}
