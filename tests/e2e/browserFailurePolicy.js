export function isIgnoredBrowserRequest(method, url) {
    try {
        return method === 'POST' && new URL(url).pathname === '/cdn-cgi/rum';
    } catch {
        return false;
    }
}
