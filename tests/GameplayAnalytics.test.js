import { jest } from '@jest/globals';
import { GameSessionTracker } from '../src/analytics/GameSessionTracker.js';
import { GameSessionObserver } from '../src/analytics/GameSessionObserver.js';
import { initializeAnalytics, MEASUREMENT_ID } from '../src/analytics/GoogleAnalytics.js';

function session() {
    let time = 0;
    const events = [];
    const tracker = new GameSessionTracker((name, params) => events.push({ name, ...params }), { now: () => time });
    tracker.start('Wizard');
    tracker.setActive(true);
    return { tracker, events, advance: ms => { time += ms; } };
}

describe('gameplay duration accounting', () => {
    test('heartbeat increments sum to the final total without counting it twice', () => {
        const { tracker, events, advance } = session();
        advance(30000); tracker.tick();
        advance(15000); tracker.end();
        const increments = events.filter(event => event.name === 'gameplay_engagement');
        expect(increments.map(event => event.active_play_seconds)).toEqual([30, 15]);
        expect(events.at(-1)).toMatchObject({ name: 'gameplay_end', total_active_play_seconds: 45, elapsed_session_seconds: 45 });
        expect(events.at(-1).active_play_seconds).toBeUndefined();
    });

    test('a hidden or disconnected interval is excluded and reconnect keeps one session', () => {
        const { tracker, events, advance } = session();
        advance(10000); tracker.setActive(false);
        advance(20000); tracker.tick();
        tracker.setActive(true);
        advance(10000); tracker.end();
        expect(events.at(-1).total_active_play_seconds).toBe(20);
        expect(events.at(-1).elapsed_session_seconds).toBe(40);
        expect(events.filter(event => event.name === 'gameplay_start')).toHaveLength(1);
    });

    test('an unattended tab stops accumulating at 60 seconds, including timer suspension', () => {
        const { tracker, events, advance } = session();
        advance(300000); tracker.tick();
        tracker.activity();
        advance(12000); tracker.end();
        expect(events.filter(event => event.name === 'gameplay_engagement').map(event => event.active_play_seconds)).toEqual([60, 12]);
        expect(events.at(-1).total_active_play_seconds).toBe(72);
    });

    test('frequent input preserves continuous active play past the idle window', () => {
        const { tracker, events, advance } = session();
        advance(45000); tracker.activity();
        advance(45000); tracker.activity();
        advance(10000); tracker.end();
        expect(events.at(-1).total_active_play_seconds).toBe(100);
    });

    test('multiple lifecycle notifications do not duplicate session ends or flushes', () => {
        const { tracker, events, advance } = session();
        tracker.start('Rogue');
        advance(1000); tracker.setActive(false); tracker.flush(); tracker.end('pagehide'); tracker.end();
        expect(events.map(event => event.name)).toEqual(['gameplay_start', 'gameplay_engagement', 'gameplay_end']);
        expect(events[0].player_class).toBe('Wizard');
    });

    test('starting inactive never counts loading or background time', () => {
        let time = 0;
        const send = jest.fn();
        const tracker = new GameSessionTracker(send, { now: () => time });
        tracker.start('Fighter');
        time = 40000;
        tracker.end();
        expect(send).toHaveBeenLastCalledWith('gameplay_end', expect.objectContaining({ total_active_play_seconds: 0 }));
        expect(send.mock.calls.some(([name]) => name === 'gameplay_engagement')).toBe(false);
    });

    test('unrecognized class data is not transmitted and delivery failures do not escape', () => {
        const events = [];
        const tracker = new GameSessionTracker((name, params) => { events.push(params); throw new Error('blocked'); });
        expect(() => { tracker.start('private account name'); tracker.end(); }).not.toThrow();
        expect(events[0].player_class).toBe('Unknown');
    });
});

describe('game lifecycle observation', () => {
    test('waits for character sync, pauses reconnects, and handles destruction/re-entry', () => {
        const tracker = { start: jest.fn(), end: jest.fn(), setActive: jest.fn(), tick: jest.fn() };
        const observer = new GameSessionObserver(tracker);
        const game = { playerType: 'Cleric', player: {}, network: { socket: { readyState: 1 } } };
        observer.sample(game, true);
        game._firstStateReceived = true;
        observer.sample(game, true);
        expect(tracker.start).not.toHaveBeenCalled();
        game.player.hasSyncedLevel = true;
        observer.sample(game, true);
        expect(tracker.start).toHaveBeenCalledWith('Cleric');
        expect(tracker.setActive).toHaveBeenLastCalledWith(true);
        game.network._reconnecting = true;
        observer.sample(game, true);
        expect(tracker.setActive).toHaveBeenLastCalledWith(false);
        game.network._reconnecting = false;
        observer.sample(game, false);
        expect(tracker.setActive).toHaveBeenLastCalledWith(false);
        observer.sample(game, true);
        expect(tracker.start).toHaveBeenCalledTimes(1);
        game.isDestroyed = true;
        observer.sample(game, true);
        observer.sample(undefined, true);
        expect(tracker.end).toHaveBeenCalledTimes(1);
        observer.sample({ ...game, isDestroyed: false }, true);
        expect(tracker.start).toHaveBeenCalledTimes(2);
    });
});

describe('GA4 production bootstrap', () => {
    function browser(hostname) {
        const win = { location: { hostname, origin: `https://${hostname}`, pathname: '/', search: '?token=private', hash: '#private' } };
        const doc = { referrer: 'https://example.com/account/private?email=private@example.com', head: { appendChild: jest.fn() }, createElement: () => ({}) };
        return { win, doc };
    }

    test.each(['localhost', '127.0.0.1', 'preview.pages.dev', 'eidolonrealms.com.evil.example'])('does not load or send analytics on %s', host => {
        const { win, doc } = browser(host);
        initializeAnalytics('game', win, doc)('gameplay_start');
        expect(doc.head.appendChild).not.toHaveBeenCalled();
        expect(win.dataLayer).toBeUndefined();
    });

    test.each(['eidolonrealms.com', 'play.eidolonrealms.com'])('shares the tag and cookie scope on %s without URL secrets', host => {
        const { win, doc } = browser(host);
        const send = initializeAnalytics(host.startsWith('play.') ? 'game' : 'website', win, doc);
        send('play_click', { cta_location: 'hero' });
        const config = [...win.dataLayer[1]];
        expect(config.slice(0, 2)).toEqual(['config', MEASUREMENT_ID]);
        expect(config[2]).toMatchObject({ cookie_domain: 'eidolonrealms.com', page_location: `https://${host}/`, page_referrer: 'https://example.com/', allow_google_signals: false, allow_ad_personalization_signals: false });
        expect(JSON.stringify(win.dataLayer)).not.toContain('private');
        expect(doc.head.appendChild.mock.calls[0][0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`);
        expect([...win.dataLayer[2]]).toEqual(['event', 'play_click', expect.objectContaining({ cta_location: 'hero', send_to: MEASUREMENT_ID })]);
    });

    test('initializes once so repeated imports do not duplicate page views', () => {
        const { win, doc } = browser('eidolonrealms.com');
        initializeAnalytics('website', win, doc);
        initializeAnalytics('website', win, doc);
        expect(doc.head.appendChild).toHaveBeenCalledTimes(1);
        expect(win.dataLayer).toHaveLength(2);
    });
});
