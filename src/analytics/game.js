import { initializeAnalytics } from './GoogleAnalytics.js';
import { GameSessionTracker } from './GameSessionTracker.js';
import { GameSessionObserver } from './GameSessionObserver.js';

const send = initializeAnalytics('game');
const tracker = new GameSessionTracker(send);
const observer = new GameSessionObserver(tracker);
let suspended = false;

function sample() {
    if (suspended) return;
    observer.sample(window.game, document.visibilityState === 'visible' && document.hasFocus());
}

setInterval(sample, 1000);
document.addEventListener('visibilitychange', sample);
window.addEventListener('focus', sample);
window.addEventListener('blur', sample);
window.addEventListener('pagehide', () => {
    observer.end('pagehide');
    suspended = true;
});
window.addEventListener('pageshow', () => { suspended = false; sample(); });
for (const type of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel']) {
    // Only the presence of interaction is used. Never inspect keys, chat,
    // target field values, account IDs or character names.
    document.addEventListener(type, event => {
        if (event.isTrusted) tracker.activity();
    }, { passive: true });
}
