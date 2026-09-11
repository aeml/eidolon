export const productionWebSocketURL = 'wss://server.eidolonrealms.com/ws';
export const legacyWebSocketURL = 'wss://eserver.mendola.tech/ws';

// Keep the old site usable while DNS/TLS is being brought up for the new site.
// Explicit local/QA server addresses must never be redirected to production.
export function resolveServerAddress(configuredAddress, pageHostname) {
    if (configuredAddress === productionWebSocketURL && pageHostname === 'eidolon.mendola.tech') {
        return legacyWebSocketURL;
    }
    return configuredAddress;
}
