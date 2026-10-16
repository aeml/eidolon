// Blocking head script: capture/scrub the private fragment before deferred
// analytics or game modules run. Never consume a link merely by opening it.
(function () {
    const params = new URLSearchParams(window.location.hash.slice(1));
    // No account ID, proof or artifact in this marker. It is read before the
    // deferred analytics module; unknown/duplicate private markers fail closed.
    if (params.has('eidolon-private') || new URLSearchParams(window.location.search).has('eidolon-private')) {
        window.__eidolonRecoverySensitivePage = true;
        try { window.history.replaceState(null, '', window.location.pathname); } catch { /* Keep analytics off. */ }
    }
    const query = new URLSearchParams(window.location.search);
    if (params.has('invite') || query.has('invite')) {
        window.__eidolonRecoverySensitivePage = true;
        const token = params.get('invite') || '';
        const valid = !query.has('invite') && !params.has('eidolon-recovery') &&
            params.getAll('invite').length === 1 && token.length <= 1024 &&
            /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token);
        const cleanFragment = new URLSearchParams(params);
        const cleanQuery = new URLSearchParams(query);
        cleanFragment.delete('invite'); cleanQuery.delete('invite');
        let scrubbed = false;
        try {
            window.history.replaceState(null, '', window.location.pathname +
                (cleanQuery.size ? '?' + cleanQuery.toString() : '') +
                (cleanFragment.size ? '#' + cleanFragment.toString() : ''));
            scrubbed = true;
        } catch { /* Invitation pages stay private even when history is blocked. */ }
        Object.defineProperty(window, '__eidolonInvitationHandoff', {
            configurable: true, value: valid ? { token, scrubbed } : { invalid: true, scrubbed }
        });
    }
    if (!params.has('eidolon-recovery')) return;
    window.__eidolonRecoverySensitivePage = true;
    const kind = params.get('eidolon-recovery');
    const username = params.get('account');
    const token = params.get('token');
    let scrubbed = false;
    try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        scrubbed = true;
    } catch { /* Private-page analytics stays disabled even if history is blocked. */ }
    const valid = !params.has('invite') && !query.has('invite') && ['verify', 'reset'].includes(kind) && typeof username === 'string'
        && username.length > 0 && username.length <= 128 && /^[0-9a-f]{64}$/.test(token || '')
        && params.getAll('eidolon-recovery').length === 1 && params.getAll('account').length === 1 && params.getAll('token').length === 1;
    Object.defineProperty(window, '__eidolonRecoveryHandoff', {
        configurable: true, value: valid ? { kind, username, token, scrubbed } : { invalid: true, scrubbed }
    });
}());
