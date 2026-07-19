import { isIP } from 'node:net';

export function hardwareWebGLBrowserArgs() {
    return [
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--use-angle=vulkan',
        '--enable-features=Vulkan'
    ];
}

export function backendOriginBrowserArgs(backendOriginIP) {
    if (!backendOriginIP) return [];
    if (!isIP(backendOriginIP)) {
        throw new Error('EIDOLON_E2E_BACKEND_ORIGIN_IP must be a literal IPv4 or IPv6 address');
    }
    return [
        `--host-resolver-rules=MAP eserver.mendola.tech ${backendOriginIP}`,
        // The repository runner and production origin share a private network.
        // Chrome 142+ otherwise blocks the public game page's WebSocket after
        // DNS resolves it to that local address. This QA-only launch exception
        // is paired with the exact hostname mapping above; normal browsers and
        // public traffic retain Local Network Access protection.
        '--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets'
    ];
}
