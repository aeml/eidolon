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
    const valid = ['verify', 'reset'].includes(kind) && typeof username === 'string'
        && username.length > 0 && username.length <= 128 && /^[0-9a-f]{64}$/.test(token || '')
        && params.getAll('eidolon-recovery').length === 1 && params.getAll('account').length === 1 && params.getAll('token').length === 1;
    Object.defineProperty(window, '__eidolonRecoveryHandoff', {
        configurable: true, value: valid ? { kind, username, token, scrubbed } : { invalid: true, scrubbed }
    });
}());
