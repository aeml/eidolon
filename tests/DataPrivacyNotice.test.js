import { jest } from '@jest/globals';
import fs from 'node:fs';
import { mountDataPrivacyNotices } from '../src/ui/DataPrivacyNotice.js';

afterEach(() => jest.restoreAllMocks());
test('notice is available before authentication without reading storage, sending data or adding analytics', () => {
    document.body.innerHTML = '<div data-eidolon-data-notice data-notice-style="login">Fallback</div>';
    const get = jest.spyOn(Storage.prototype, 'getItem'), set = jest.spyOn(Storage.prototype, 'setItem');
    const priorFetch=globalThis.fetch;globalThis.fetch=jest.fn();
    const priorTag=window.gtag;window.gtag=jest.fn();
    try {
        mountDataPrivacyNotices();
        const details=document.querySelector('details');expect(details.open).toBe(false);expect(details.classList.contains('auth-session-help')).toBe(true);
        expect(document.querySelectorAll('script,input,button')).toHaveLength(0);
        expect(get).not.toHaveBeenCalled();expect(set).not.toHaveBeenCalled();expect(globalThis.fetch).not.toHaveBeenCalled();expect(window.gtag).not.toHaveBeenCalled();
        expect(details.querySelector('a').getAttribute('href')).toBe(`${location.pathname}?eidolon-private=account`);
    } finally {globalThis.fetch=priorFetch;window.gtag=priorTag;}
});
test('same notice is idempotent and explains existing providers, retention, limitations and review boundaries', () => {
    document.body.innerHTML = '<div data-eidolon-data-notice></div><div data-eidolon-data-notice></div>';
    mountDataPrivacyNotices();const first=document.querySelector('details');first.open=true;mountDataPrivacyNotices();
    expect(document.querySelectorAll('.data-privacy-notice')).toHaveLength(2);expect(document.querySelector('details')).toBe(first);expect(first.open).toBe(true);
    for(const phrase of ['Google Analytics','Postmark','7–365','90 days','no generic account-deletion timer','no automatic diagnostics','current password','Prepare and Save','do not claim complete account exports','separately authorized removal','not active-play or AFK','Menu → Report Bug / Feature'])expect(first.textContent.toLowerCase()).toContain(phrase.toLowerCase());
    expect(first.textContent).toBe(document.querySelectorAll('details')[1].textContent);
});
test('login, settings and private report surfaces keep source fallbacks and share the mounted notice', () => {
    const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');document.body.innerHTML=html;
    for(const id of ['start-screen','settings-screen','report-screen'])expect(document.querySelector(`#${id} [data-eidolon-data-notice]`)).not.toBeNull();
    expect(document.querySelector('#start-screen [data-eidolon-data-notice]').textContent).toContain('No automatic deletion');
    mountDataPrivacyNotices();expect(document.querySelectorAll('.data-privacy-notice')).toHaveLength(3);
    const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');expect(main.indexOf('mountDataPrivacyNotices();')).toBeLessThan(main.indexOf('if (!await ensureGameStylesReady())'));
});
