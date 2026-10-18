import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only connected System Chrome jobs opt in. Hosted Playwright and the existing
// network-none native visual runner retain their original launch environment.
export function isolatedBrowserLaunchOptions(options, env = process.env) {
    if (env.EIDOLON_E2E_ISOLATE_CHROME !== '1') return options;
    if (process.platform !== 'linux' || !options.executablePath) {
        throw new Error('Browser network isolation requires Linux System Chrome');
    }
    const downloadsPath = mkdtempSync(join(tmpdir(), 'eidolon-browser-downloads-'));
    process.once('exit', () => rmSync(downloadsPath, { recursive: true, force: true }));
    return {
        ...options,
        executablePath: fileURLToPath(new URL('./qa-browser-network.mjs', import.meta.url)),
        downloadsPath,
        env: {
            ...env,
            EIDOLON_QA_REAL_CHROME: options.executablePath,
            EIDOLON_QA_DOWNLOADS: downloadsPath
        }
    };
}
