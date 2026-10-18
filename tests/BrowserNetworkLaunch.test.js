import { existsSync, rmSync, statSync } from 'node:fs';
import { isolatedBrowserLaunchOptions } from '../scripts/qa-browser-launch-options.mjs';

test('hosted and ordinary launches preserve the original options without allocating a capsule', () => {
    const options = { executablePath: '/configured/chrome', args: ['--existing-flag'], timeout: 1234 };
    expect(isolatedBrowserLaunchOptions(options, {})).toBe(options);
    expect(isolatedBrowserLaunchOptions(options, { EIDOLON_E2E_ISOLATE_CHROME: '0' })).toBe(options);
});

test('isolation requires an explicit System Chrome launch', () => {
    expect(() => isolatedBrowserLaunchOptions({}, { EIDOLON_E2E_ISOLATE_CHROME: '1' }))
        .toThrow('Linux System Chrome');
});

test('isolated launches retain flags and deadlines with an owned shared download directory', () => {
    const args = ['--enable-webgl', '--host-resolver-rules=MAP fixture.invalid 192.0.2.1'];
    const env = { EIDOLON_E2E_ISOLATE_CHROME: '1', CI: 'true', EIDOLON_E2E_WEB_PORT: '41873' };
    const options = { executablePath: '/usr/bin/google-chrome', args, timeout: 1234 };
    const isolated = isolatedBrowserLaunchOptions(options, env);
    try {
        expect(isolated.args).toBe(args);
        expect(isolated.timeout).toBe(options.timeout);
        expect(options).toEqual({ executablePath: '/usr/bin/google-chrome', args, timeout: 1234 });
        expect(isolated.env.EIDOLON_QA_REAL_CHROME).toBe('/usr/bin/google-chrome');
        expect(isolated.env.CI).toBe('true');
        expect(isolated.env.EIDOLON_E2E_WEB_PORT).toBe('41873');
        expect(isolated.env.EIDOLON_QA_DOWNLOADS).toBe(isolated.downloadsPath);
        expect(statSync(isolated.downloadsPath).mode & 0o777).toBe(0o700);
        expect(statSync(isolated.downloadsPath).uid).toBe(process.getuid());
        expect(existsSync(isolated.executablePath)).toBe(true);
    } finally {
        rmSync(isolated.downloadsPath, { recursive: true, force: true });
    }
});
