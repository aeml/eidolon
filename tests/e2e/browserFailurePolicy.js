export function isIgnoredBrowserRequest(method, url) {
    try {
        return method === 'POST' && new URL(url).pathname === '/cdn-cgi/rum';
    } catch {
        return false;
    }
}

export function isBenignCanceledAssetRequest() {
    // Procedural data-URI sigils do not issue replaceable image requests.
    // No production asset cancellation remains eligible for suppression.
    return false;
}
