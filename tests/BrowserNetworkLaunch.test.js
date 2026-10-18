import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import * as espree from 'espree';
import { isolatedBrowserLaunchOptions } from '../scripts/qa-browser-launch-options.mjs';
import { qaChromeLaunchOptions } from './e2e/browserLaunchPolicy.js';

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

test('peer and explicit override options are unchanged when isolation is disabled', () => {
    const options = { args: [], headless: true, timeout: 9876 };
    expect(qaChromeLaunchOptions(options, {})).toBe(options);
    expect(qaChromeLaunchOptions(options, { EIDOLON_E2E_ISOLATE_CHROME: '0' })).toBe(options);
});

test.each([
    [{ executablePath: '/explicit/chrome' }, { EIDOLON_E2E_BROWSER_PATH: '/configured/chrome' }, '/explicit/chrome'],
    [{}, { EIDOLON_E2E_BROWSER_PATH: '/configured/chrome' }, '/configured/chrome'],
    [{}, {}, '/usr/bin/google-chrome']
])('isolated peers and overrides retain the selected Chrome and original options (%#)', (extra, env, expected) => {
    const args = ['--disable-gpu', '--disable-webgl'];
    const options = { ...extra, args, headless: true, timeout: 9876 };
    const launch = qaChromeLaunchOptions(options, { ...env, EIDOLON_E2E_ISOLATE_CHROME: '1' });
    try {
        expect(launch.env.EIDOLON_QA_REAL_CHROME).toBe(expected);
        expect(launch.args).toBe(args); expect(launch.headless).toBe(true); expect(launch.timeout).toBe(9876);
        expect(launch.executablePath).not.toBe(expected);
        expect(options).toEqual({ ...extra, args, headless: true, timeout: 9876 });
        expect(statSync(launch.downloadsPath).mode & 0o777).toBe(0o700);
    } finally { rmSync(launch.downloadsPath, { recursive: true, force: true }); }
});

test('every independent Chrome and explicit test launch override follows opt-in isolation', () => {
    const peers = [], overrides = [], bypasses = [];
    for (const name of readdirSync('tests/e2e').filter(name => name.endsWith('.js'))) {
        const source = readFileSync(`tests/e2e/${name}`, 'utf8');
        const ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
        const check = (value, group) => {
            group.push(name);
            if (value?.type !== 'CallExpression' || value.callee.name !== 'qaChromeLaunchOptions') bypasses.push(name);
        };
        const visit = node => {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
                const { object, property } = node.callee;
                if (property.name === 'launch' && object.type === 'CallExpression'
                    && object.callee.type === 'MemberExpression' && object.callee.property.name === 'browserType') check(node.arguments[0], peers);
                if (object.name === 'test' && property.name === 'use') {
                    for (const property of node.arguments[0]?.properties || []) {
                        if (property.key?.name === 'launchOptions') check(property.value, overrides);
                    }
                }
            }
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(visit);
                else if (value && typeof value === 'object') visit(value);
            }
        };
        visit(ast);
    }
    expect(peers).toContain('well-rested-party-gameplay.spec.js');
    expect(peers).toContain('multiplayer.spec.js');
    expect(overrides).toContain('party-quest-tracker-layout.spec.js');
    expect(bypasses).toEqual([]);
});
