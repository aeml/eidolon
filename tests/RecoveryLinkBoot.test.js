import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { initializeAnalytics } from '../src/analytics/GoogleAnalytics.js';

const source = readFileSync(new NodeURL('../src/core/RecoveryLinkBoot.js', import.meta.url), 'utf8');
const html = readFileSync(new NodeURL('../index.html', import.meta.url), 'utf8');
function boot(fragment, blocked = false) {
    const win = { location: new URL(`https://play.eidolonrealms.com/?release=fixture#${fragment}`) };
    win.history = { replaceState: jest.fn((_, __, path) => { if (blocked) throw new Error('blocked'); win.location = new URL(path, win.location.origin); }) };
    new Function('window', 'URLSearchParams', source)(win, URLSearchParams);
    return win;
}
test('blocking private-link handoff precedes analytics and game modules', () => {
    expect(html.indexOf('src/core/RecoveryLinkBoot.js')).toBeLessThan(html.indexOf('src/analytics/game.js'));
    const script = new DOMParser().parseFromString(html, 'text/html').querySelector('script[src="./src/core/RecoveryLinkBoot.js"]');
    expect(script.hasAttribute('async')).toBe(false); expect(script.hasAttribute('defer')).toBe(false); expect(script.hasAttribute('type')).toBe(false);
});
test.each(['verify', 'reset'])('%s handoff scrubs before analytics and stores proof only in non-enumerable RAM', kind => {
    const fragment = new URLSearchParams({ 'eidolon-recovery': kind, account: 'owner with & symbols', token: 'a'.repeat(64) }).toString();
    const win = boot(fragment);
    expect(win.location.hash).toBe(''); expect(win.location.search).toBe('?release=fixture');
    expect(win.__eidolonRecoveryHandoff).toEqual({ kind, username: 'owner with & symbols', token: 'a'.repeat(64), scrubbed: true });
    expect(Object.keys(win)).not.toContain('__eidolonRecoveryHandoff');
    const doc = { head: { appendChild: jest.fn() }, createElement: jest.fn() };
    initializeAnalytics('game', win, doc)('gameplay_start');
    expect(doc.head.appendChild).not.toHaveBeenCalled(); expect(win.dataLayer).toBeUndefined();
    delete win.__eidolonRecoveryHandoff; expect(win.__eidolonRecoveryHandoff).toBeUndefined();
});
test('blocked history still suppresses analytics and flags the private address bar', () => {
    const win = boot(`eidolon-recovery=reset&account=owner&token=${'a'.repeat(64)}`, true);
    expect(win.__eidolonRecoveryHandoff.scrubbed).toBe(false); expect(win.__eidolonRecoverySensitivePage).toBe(true);
    const doc = { head: { appendChild: jest.fn() } };
    initializeAnalytics('game', win, doc)('gameplay_start'); expect(doc.head.appendChild).not.toHaveBeenCalled();
});
test.each(['eidolon-recovery=evil', 'eidolon-recovery=reset&account=owner&token=bad', `eidolon-recovery=reset&account=owner&account=other&token=${'a'.repeat(64)}`])('malformed private link is scrubbed without giving the UI a token', fragment => {
    const win = boot(fragment); expect(win.location.hash).toBe(''); expect(win.__eidolonRecoveryHandoff).toEqual({ invalid: true, scrubbed: true });
});
test('unrelated game anchors are not consumed or treated as account recovery', () => {
    const win = boot('quest-log'); expect(win.history.replaceState).not.toHaveBeenCalled(); expect(win.__eidolonRecoveryHandoff).toBeUndefined();
});
