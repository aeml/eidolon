import { initializeAnalytics } from './GoogleAnalytics.js';

const send = initializeAnalytics('website');
document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || new URL(link.href).hostname !== 'play.eidolonrealms.com') return;
    const placement = link.closest('header') ? 'header'
        : link.closest('.hero') ? 'hero'
            : link.closest('.closing') ? 'closing'
                : link.closest('footer') ? 'footer' : 'guide';
    send('play_click', { cta_location: placement });
});
