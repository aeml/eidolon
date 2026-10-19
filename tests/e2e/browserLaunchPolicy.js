import { isIP } from 'node:net';
import { isolatedBrowserLaunchOptions } from '../../scripts/qa-browser-launch-options.mjs';

// Explicit peer processes and per-file launch overrides do not inherit the
// executable chosen in playwright.config.js. Apply the same opt-in isolation
// without changing ordinary/hosted launches or sharing peers in one process.
export function qaChromeLaunchOptions(options, env = process.env) {
    // A per-file args override replaces the config's launchOptions object.
    // Preserve an explicitly selected browser in the private native capsule.
    const configured = options.executablePath || env.EIDOLON_E2E_BROWSER_PATH;
    if (env.EIDOLON_E2E_ISOLATE_CHROME !== '1') return configured ? { ...options, executablePath: configured } : options;
    return isolatedBrowserLaunchOptions({
        ...options,
        executablePath: options.executablePath || env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome'
    }, env);
}

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
