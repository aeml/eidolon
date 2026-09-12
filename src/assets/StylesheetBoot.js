// A successful master stylesheet request does not prove its @imports loaded.
// Missing login CSS can inherit pointer-events:none from the world HUD layer.
export function isStylesheetTreeReady(sheet, seen = new Set()) {
    if (!sheet) return false;
    if (seen.has(sheet)) return true;
    seen.add(sheet);
    try {
        const rules = [...sheet.cssRules];
        return rules.length > 0 && rules.every(rule => rule.type !== 3 || isStylesheetTreeReady(rule.styleSheet, seen));
    } catch { return false; }
}

export async function ensureGameStylesReady({ attempts = 3, timeoutMs = 10_000 } = {}) {
    let link = document.querySelector('link[data-eidolon-game-styles]');
    if (isStylesheetTreeReady(link?.sheet)) {
        document.documentElement.dataset.eidolonStylesReady = 'true';
        return true;
    }
    const notice = document.createElement('div');
    notice.id = 'style-boot-recovery';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    Object.assign(notice.style, { position: 'fixed', inset: '0', zIndex: '2147483647',
        display: 'grid', placeContent: 'center', gap: '16px', padding: '24px',
        background: '#090d15', color: '#f3ece0', font: '16px system-ui', textAlign: 'center', pointerEvents: 'auto' });
    const message = document.createElement('p');
    message.textContent = 'Reconnecting to load the interface…';
    notice.append(message);
    document.body.append(notice);
    document.documentElement.dataset.eidolonStylesReady = 'false';
    for (let attempt = 1; link && attempt <= attempts; attempt++) {
        const replacement = link.cloneNode(false);
        const url = new URL(link.href);
        url.searchParams.set('eidolonStyleRetry', String(attempt));
        replacement.href = url.href;
        await new Promise(resolve => {
            let timer;
            const finish = () => {
                clearTimeout(timer);
                replacement.removeEventListener('load', finish);
                replacement.removeEventListener('error', finish);
                resolve();
            };
            replacement.addEventListener('load', finish);
            replacement.addEventListener('error', finish);
            timer = setTimeout(finish, timeoutMs);
            link.replaceWith(replacement);
        });
        link = replacement;
        if (isStylesheetTreeReady(link.sheet)) {
            notice.remove();
            document.documentElement.dataset.eidolonStylesReady = 'true';
            return true;
        }
    }
    message.textContent = 'The interface could not finish loading. Check your connection and try again.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry loading';
    Object.assign(retry.style, { minHeight: '48px', padding: '12px 24px', font: 'inherit', cursor: 'pointer' });
    retry.addEventListener('click', () => window.location.reload());
    notice.append(retry);
    return false;
}
