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

jest.unstable_mockModule('@playwright/test', () => ({ expect: jest.fn() }));
const { collectBrowserFailures } = await import('./e2e/helpers.js');

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
