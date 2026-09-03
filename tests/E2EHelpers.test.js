import {
    isBenignCanceledAssetRequest,
    isIgnoredBrowserRequest
} from './e2e/browserFailurePolicy.js';
import {
    backendOriginBrowserArgs,
    hardwareWebGLBrowserArgs
} from './e2e/browserLaunchPolicy.js';

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
