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
        `--host-resolver-rules=MAP eserver.mendola.tech ${backendOriginIP}, MAP server.eidolonrealms.com ${backendOriginIP}`,
        // The repository runner and production origin share a private network.
        // Chrome 142+ otherwise blocks the public game page's WebSocket after
        // DNS resolves it to that local address. This QA-only launch exception
        // is paired with the exact hostname mapping above; normal browsers and
        // public traffic retain Local Network Access protection.
        '--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets'
    ];
}

// Hosted CI proves rendering behavior on its available WebGL implementation.
// Local visual qualification and the mandatory native release step require GPU
// hardware explicitly; software output never establishes native acceptance.
export function requiresHardwareWebGL(env = process.env) {
    return env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1' || !env.CI;
}
