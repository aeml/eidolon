export function isIgnoredBrowserRequest(method, url) {
    try {
        return method === 'POST' && new URL(url).pathname === '/cdn-cgi/rum';
    } catch {
        return false;
    }
}

export function isBenignCanceledAssetRequest(resourceType, errorText, url) {
    if (resourceType !== 'image' || errorText !== 'net::ERR_ABORTED') return false;
    try {
        // Skill/rune selection replaces the hotbar <img> source immediately.
        // Chrome reports the superseded icon fetch as an aborted request even
        // though the newly selected icon loads normally. HTTP errors and all
        // non-icon asset cancellations remain release-blocking.
        return new URL(url).pathname.startsWith('/assets/icons/');
    } catch {
        return false;
    }
}
