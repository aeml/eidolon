export const MEASUREMENT_ID = 'G-BD9DTMF3HC';

const PRODUCTION_HOSTS = new Set(['eidolonrealms.com', 'www.eidolonrealms.com', 'play.eidolonrealms.com']);

/** One tag and cookie scope for the public website and game; no QA traffic. */
export function initializeAnalytics(surface, win = window, doc = document) {
    if (!PRODUCTION_HOSTS.has(win.location.hostname)) return () => {};
    if (!win.__eidolonGoogleTagInitialized) {
        win.__eidolonGoogleTagInitialized = true;
        win.dataLayer = win.dataLayer || [];
        win.gtag = win.gtag || function () { win.dataLayer.push(arguments); };
        win.gtag('js', new Date());
        // Strip query strings/fragments: auth and other user-provided values
        // must not become page locations, referrers or custom event parameters.
        let referrer = '';
        try { referrer = doc.referrer ? new URL(doc.referrer).origin + '/' : ''; } catch { /* Invalid referrer. */ }
        win.gtag('config', MEASUREMENT_ID, {
            cookie_domain: 'eidolonrealms.com',
            cookie_flags: 'SameSite=Lax;Secure',
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            page_location: win.location.origin + win.location.pathname,
            page_referrer: referrer,
            page_title: surface === 'game' ? 'Eidolon Online' : 'Eidolon — Multiplayer Browser Action RPG',
            site_surface: surface,
            send_page_view: true
        });
        const script = doc.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
        doc.head.appendChild(script);
    }
    return (name, parameters = {}) => {
        try {
            win.gtag('event', name, { ...parameters, site_surface: surface, send_to: MEASUREMENT_ID });
        } catch { /* Analytics must never interrupt the game or navigation. */ }
    };
}
