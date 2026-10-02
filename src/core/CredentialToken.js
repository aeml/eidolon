// Only a response on the current authenticated transport can reach this hook.
// undefined means unchanged; null means stop using the former resume token.
export function credentialTokenChange(payload) {
    if (payload?.resumeInvalidated === true) return null;
    if (payload?.success !== true) return undefined;
    return typeof payload.resumeToken === 'string' && /^[a-f0-9]{64}$/.test(payload.resumeToken)
        ? payload.resumeToken : null;
}
