import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import {
    isBenignCanceledAssetRequest,
    isIgnoredBrowserRequest
} from './e2e/browserFailurePolicy.js';
import {
    backendOriginBrowserArgs,
    hardwareWebGLBrowserArgs
} from './e2e/browserLaunchPolicy.js';

const playwrightExpect = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: playwrightExpect }));
const { collectBrowserFailures, returnToTown, jumpByGroundClick } = await import('./e2e/helpers.js');

describe('jump landing failure evidence', () => {
    afterEach(() => playwrightExpect.mockReset());
    const attempt = async (cause, diagnosticAvailable = true) => {
        playwrightExpect.mockReturnValue({ toBe: jest.fn() });
        playwrightExpect.poll = jest.fn()
            .mockReturnValueOnce({ toBeGreaterThan: jest.fn().mockResolvedValue(undefined) })
            .mockReturnValueOnce({ toBe: jest.fn().mockRejectedValue(cause) });
        const evaluate = jest.fn().mockResolvedValueOnce({ x: 0, z: 0 })
            .mockResolvedValueOnce({ canvas: true, x: 400, y: 300 });
        if (diagnosticAvailable) evaluate.mockResolvedValueOnce({ jump: { progress: .984 } });
        else evaluate.mockRejectedValueOnce(new Error('page closed during diagnostics'));
        const page = { evaluate, mouse: { move: jest.fn(), click: jest.fn() },
            keyboard: { down: jest.fn(), up: jest.fn() } };
        let failure;
        try { await jumpByGroundClick(page, 25, 0); } catch (error) { failure = error; }
        expect(failure).toBeInstanceOf(Error);
        expect(failure.cause).toBe(cause);
        expect(failure.message).toContain(cause.message);
        expect(page.keyboard.up).toHaveBeenCalledWith('Control');
        expect(playwrightExpect.poll.mock.calls.map(call => call[1])).toEqual([
            { timeout: 4_000 }, { timeout: 8_000 }
        ]);
        return failure;
    };
    test('an overall route timeout remains distinguishable from a stalled jump', async () => {
        const failure = await attempt(new Error('Test timeout of 3600000ms exceeded'));
        expect(failure.message).toContain('"progress":0.984');
    });
    test('an actual landing assertion failure still fails with its original cause', async () => {
        await attempt(new Error('Landing poll timed out after 8000ms'));
    });
    test('lost diagnostic access cannot replace the original failure', async () => {
        const failure = await attempt(new Error('Test timeout of 3600000ms exceeded'), false);
        expect(failure.message).toContain('"unavailable":true');
        expect(failure.message).not.toContain('page closed');
    });
});

describe('unfinished hunt recall', () => {
    test('a death between the resource observation and Recall cannot become a free rest stop', async () => {
        const page = { evaluate: jest.fn(async () => ({ state: 'DEAD' })),
            locator: jest.fn(), keyboard: { press: jest.fn() } };
        await expect(returnToTown(page, { allowRespawn: false })).rejects.toThrow('cannot hide a respawn');
        expect(page.locator).not.toHaveBeenCalled();
        expect(page.keyboard.press).not.toHaveBeenCalled();
    });
    test('a living retreat still uses the ordinary Recall key', async () => {
        const page = { evaluate: jest.fn(async () => ({ state: 'IDLE' })), locator: jest.fn(),
            keyboard: { press: jest.fn(async () => { throw new Error('input receipt'); }) } };
        await expect(returnToTown(page, { allowRespawn: false })).rejects.toThrow('input receipt');
        expect(page.keyboard.press).toHaveBeenCalledWith('b');
        expect(page.locator).not.toHaveBeenCalled();
    });
    test('existing explicit recovery callers retain their respawn action', async () => {
        const click = jest.fn(async () => { throw new Error('respawn receipt'); });
        const page = { evaluate: jest.fn(async () => ({ state: 'DEAD' })),
            locator: jest.fn(() => ({ click })) };
        await expect(returnToTown(page)).rejects.toThrow('respawn receipt');
        expect(page.locator).toHaveBeenCalledWith('#btn-death-respawn');
    });
});

function request(url, resourceType = 'document', errorText = 'net::ERR_ABORTED') {
    return {
        url: () => url,
        method: () => 'GET',
        resourceType: () => resourceType,
        failure: () => ({ errorText })
    };
}

function response(url, status = 200, resourceType = 'document') {
    return {
        url: () => url,
        status: () => status,
        request: () => ({
            method: () => 'GET',
            resourceType: () => resourceType
        })
    };
}

describe('browser failure collection', () => {
    test('ignores only Cloudflare-injected RUM posts', () => {
        expect(isIgnoredBrowserRequest(
            'POST',
            'https://eidolon.mendola.tech/cdn-cgi/rum?'
        )).toBe(true);
        expect(isIgnoredBrowserRequest(
            'GET',
            'https://eidolon.mendola.tech/cdn-cgi/rum?'
        )).toBe(false);
        expect(isIgnoredBrowserRequest(
            'POST',
            'https://eidolon.mendola.tech/src/main.js'
        )).toBe(false);
    });

    test('does not suppress asset cancellations after the procedural icon cutover', () => {
        const iconURL = 'https://eidolon.mendola.tech/assets/icons/wizard/inferno_cataclysm.png';
        expect(isBenignCanceledAssetRequest('image', 'net::ERR_ABORTED', iconURL)).toBe(false);
        expect(isBenignCanceledAssetRequest('image', 'net::ERR_FAILED', iconURL)).toBe(false);
        expect(isBenignCanceledAssetRequest(
            'fetch',
            'net::ERR_ABORTED',
            'https://eidolon.mendola.tech/assets/models/wizard.glb'
        )).toBe(false);
        expect(isBenignCanceledAssetRequest(
            'image',
            'net::ERR_ABORTED',
            'https://eidolon.mendola.tech/src/main.js'
        )).toBe(false);
    });

    test('scopes the backend origin mapping to a validated literal address', () => {
        expect(hardwareWebGLBrowserArgs()).toEqual(expect.arrayContaining([
            '--use-angle=vulkan',
            '--enable-features=Vulkan'
        ]));
        expect(backendOriginBrowserArgs('')).toEqual([]);
        expect(backendOriginBrowserArgs('192.0.2.10')).toEqual(expect.arrayContaining([
            expect.stringContaining('MAP eserver.mendola.tech 192.0.2.10'),
            expect.stringContaining('MAP server.eidolonrealms.com 192.0.2.10'),
            expect.stringContaining('LocalNetworkAccessChecks')
        ]));
        expect(() => backendOriginBrowserArgs('backend.example.com')).toThrow(/literal IPv4 or IPv6/);
    });
});

describe('live browser failure reconciliation', () => {
    test('a successful retry clears an earlier failed document request for the same route', () => {
        const page = new EventEmitter();
        const failures = collectBrowserFailures(page, 'https://eidolon.example');

        page.emit('requestfailed', request('https://eidolon.example/?release=old'));
        expect(failures).toHaveLength(1);

        page.emit('response', response('https://eidolon.example/?release=current'));
        expect(failures).toEqual([]);
    });

    test('an unrecovered failed document remains actionable', () => {
        const page = new EventEmitter();
        const failures = collectBrowserFailures(page, 'https://eidolon.example');

        page.emit('requestfailed', request('https://eidolon.example/?release=current'));

        expect(failures).toEqual([
            'requestfailed: GET https://eidolon.example/?release=current (net::ERR_ABORTED)'
        ]);
    });

    test('success on a different document route does not hide the failure', () => {
        const page = new EventEmitter();
        const failures = collectBrowserFailures(page, 'https://eidolon.example');

        page.emit('requestfailed', request('https://eidolon.example/game?release=current'));
        page.emit('response', response('https://eidolon.example/repro.html'));

        expect(failures).toHaveLength(1);
    });
});
