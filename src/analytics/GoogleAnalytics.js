export const MEASUREMENT_ID = 'G-BD9DTMF3HC';

const PRODUCTION_HOSTS = new Set(['eidolonrealms.com', 'www.eidolonrealms.com', 'play.eidolonrealms.com']);
const CLASSES = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric', 'Unknown']);
const PLACEMENTS = new Set(['header', 'hero', 'closing', 'footer', 'guide']);
const GAME_EVENTS = new Set(['gameplay_start', 'gameplay_engagement', 'gameplay_end']);

function sensitivePage(win) {
    if (win.__eidolonRecoverySensitivePage) return true;
    const query = new URLSearchParams(win.location.search);
    const fragment = new URLSearchParams((win.location.hash || '').slice(1));
    return query.has('eidolon-private') || query.has('eidolon-recovery') || fragment.has('eidolon-private') || fragment.has('eidolon-recovery');
}

// A closed collection contract, not an arbitrary event forwarding API. Never
// enumerate/serialize extra properties or forward URL/identity overrides.
function eventParameters(surface, name, parameters) {
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return null;
    const value = key => {
        const field = Object.getOwnPropertyDescriptor(parameters, key);
        return field && Object.hasOwn(field, 'value') ? field.value : undefined;
    };
    if (surface === 'website') {
        const placement = value('cta_location');
        return name === 'play_click' && PLACEMENTS.has(placement) ? {cta_location:placement} : null;
    }
    if (!GAME_EVENTS.has(name)) return null;
    const playerClass = value('player_class');
    const safe = {player_class:CLASSES.has(playerClass) ? playerClass : 'Unknown'};
    const duration = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 365 * 86400;
    if (name === 'gameplay_engagement') {
        const active = value('active_play_seconds');
        if (!duration(active) || active === 0) return null;
        safe.active_play_seconds = active;
    } else if (name === 'gameplay_end') {
        const total = value('total_active_play_seconds'), elapsed = value('elapsed_session_seconds');
        if (!duration(total) || !duration(elapsed) || total > elapsed) return null;
        safe.total_active_play_seconds = total;
        safe.elapsed_session_seconds = elapsed;
        safe.end_reason = value('end_reason') === 'pagehide' ? 'pagehide' : 'exit';
    }
    return safe;
}

/** One tag and cookie scope for the public website and game; no QA traffic. */
export function initializeAnalytics(surface, win = window, doc = document) {
    if (!['game', 'website'].includes(surface) || sensitivePage(win)) return () => {};
    if (!PRODUCTION_HOSTS.has(win.location.hostname)) return () => {};
    let referrer = '';
    try { referrer = doc.referrer ? new URL(doc.referrer).origin + '/' : ''; } catch { /* Invalid referrer. */ }
    const page = {page_location:`https://${win.location.hostname}/`, page_referrer:referrer,
        page_title:surface === 'game' ? 'Eidolon Online' : 'Eidolon — Multiplayer Browser Action RPG'};
    if (!win.__eidolonGoogleTagInitialized) {
        win.__eidolonGoogleTagInitialized = true;
        win.dataLayer = win.dataLayer || [];
        win.gtag = win.gtag || function () { win.dataLayer.push(arguments); };
        win.gtag('js', new Date());
        // Both surfaces are single-document apps. Canonical public root URLs
        // exclude arbitrary paths as well as query strings/fragments. This
        // governs our tag configuration, not dashboard-enabled automatic events.
        win.gtag('config', MEASUREMENT_ID, {
            cookie_domain: 'eidolonrealms.com',
            cookie_flags: 'SameSite=Lax;Secure',
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            ...page,
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
            if (sensitivePage(win) || !PRODUCTION_HOSTS.has(win.location.hostname)) return;
            const safe = eventParameters(surface, name, parameters);
            // Repeat safe page context rather than inheriting a location/title
            // that provider-owned automatic history events may have changed.
            if (safe) win.gtag('event', name, { ...safe, ...page, site_surface: surface, send_to: MEASUREMENT_ID });
        } catch { /* Analytics must never interrupt the game or navigation. */ }
    };
}
