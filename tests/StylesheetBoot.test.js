import { jest } from '@jest/globals';
import { ensureGameStylesReady, isStylesheetTreeReady } from '../src/assets/StylesheetBoot.js';

const ready = () => ({ cssRules: [{ type: 1 }] });
const sheet = imports => ({ cssRules: imports.map(styleSheet => ({ type: 3, styleSheet })) });
function install(state) {
    document.head.innerHTML = '<link rel="stylesheet" href="/src/styles/index.css?release=abc" data-eidolon-game-styles>';
    const link = document.querySelector('link');
    Object.defineProperty(link, 'sheet', { value: state });
    return link;
}
beforeEach(() => { document.body.innerHTML = ''; delete document.documentElement.dataset.eidolonStylesReady; });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('every nested import must exist; unreadable and empty master sheets are not ready', () => {
    expect(isStylesheetTreeReady(sheet([ready(), sheet([null])]))).toBe(false);
    expect(isStylesheetTreeReady(sheet([ready(), sheet([ready()])]))).toBe(true);
    expect(isStylesheetTreeReady({ cssRules: [] })).toBe(false);
    expect(isStylesheetTreeReady({ get cssRules() { throw Error('not loaded'); } })).toBe(false);
});

test('complete styles need no reload or blocking overlay', async () => {
    const link = install(sheet([ready()]));
    expect(await ensureGameStylesReady()).toBe(true);
    expect(document.querySelector('link')).toBe(link);
    expect(document.getElementById('style-boot-recovery')).toBeNull();
});

test('a partial load retries the same version and only admits a complete replacement', async () => {
    install(sheet([ready(), null]));
    const result = ensureGameStylesReady();
    const replacement = document.querySelector('link');
    const url = new URL(replacement.href);
    expect(url.searchParams.get('release')).toBe('abc');
    expect(url.searchParams.get('eidolonStyleRetry')).toBe('1');
    expect(document.documentElement.dataset.eidolonStylesReady).toBe('false');
    Object.defineProperty(replacement, 'sheet', { value: sheet([ready(), ready()]) });
    replacement.dispatchEvent(new Event('load'));
    expect(await result).toBe(true);
    expect(document.documentElement.dataset.eidolonStylesReady).toBe('true');
    expect(document.getElementById('style-boot-recovery')).toBeNull();
});

test('load events cannot certify missing imports and exhausting retries leaves usable recovery UI', async () => {
    install(sheet([null]));
    const result = ensureGameStylesReady({ attempts: 2 });
    let replacement = document.querySelector('link');
    Object.defineProperty(replacement, 'sheet', { value: sheet([null]) });
    replacement.dispatchEvent(new Event('load'));
    await Promise.resolve();
    replacement = document.querySelector('link');
    expect(new URL(replacement.href).searchParams.get('eidolonStyleRetry')).toBe('2');
    replacement.dispatchEvent(new Event('error'));
    expect(await result).toBe(false);
    const notice = document.getElementById('style-boot-recovery');
    expect(notice.style.pointerEvents).toBe('auto');
    expect(notice.querySelector('button').textContent).toBe('Retry loading');
    expect(document.documentElement.dataset.eidolonStylesReady).toBe('false');
});

test('a request that never finishes has a bounded wait', async () => {
    jest.useFakeTimers(); install(null);
    const result = ensureGameStylesReady({ attempts: 1, timeoutMs: 50 });
    await jest.advanceTimersByTimeAsync(50);
    expect(await result).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
});
