// Keep this module graphics-library-free: login must not fetch the game engine
// or Three merely to explain an unavailable graphics context.
export const GRAPHICS_UNAVAILABLE_MESSAGE = '3D graphics (WebGL 2) are unavailable in this browser. Enable hardware acceleration and restart the browser, or try another browser or device.';

export function createRendererWithGraphicsError(options, createRenderer, createProbeCanvas = () => document.createElement('canvas')) {
    try { return createRenderer(options); }
    catch (cause) {
        // Some renderer releases mask context-creation failures with a logger
        // TypeError. Probe only after failure: successful creation is untouched.
        let context;
        try { context = createProbeCanvas().getContext('webgl2', options); }
        catch { /* Unavailable or blocked context. */ }
        if (context) {
            // The failed constructor had a different cause; never mislabel it.
            try { context.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* Best-effort owned probe release. */ }
            throw cause;
        }
        const error = new Error(GRAPHICS_UNAVAILABLE_MESSAGE, { cause });
        error.name = 'GraphicsUnavailableError'; error.code = 'WEBGL2_UNAVAILABLE';
        throw error;
    }
}

export function gameStartupFailureMessage(error) {
    const kind = gameStartupFailureKind(error);
    if (kind === 'graphics-unavailable') return GRAPHICS_UNAVAILABLE_MESSAGE;
    if (kind === 'module-download') return 'Some game files could not be downloaded. Reload the page and try again.';
    if (kind === 'module-export') return 'The game files could not initialise. Reload the page to load the latest version.';
    return 'The game could not start. Please try again.';
}

// Public diagnostic categories only: never expose arbitrary error text,
// URLs, account identifiers or credentials through the login DOM.
export function gameStartupFailureKind(error) {
    if (error?.code === 'WEBGL2_UNAVAILABLE') return 'graphics-unavailable';
    const message = typeof error?.message === 'string' ? error.message : '';
    if (/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(message)) return 'module-download';
    if (/does not provide an export named|ambiguous indirect export/i.test(message)) return 'module-export';
    return 'unknown';
}
