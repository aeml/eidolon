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
        const surface = host.startsWith('play.') ? 'game' : 'website';
        const send = initializeAnalytics(surface, win, doc);
        const name = surface === 'game' ? 'gameplay_start' : 'play_click';
        const parameters = surface === 'game' ? {player_class:'Wizard'} : {cta_location:'hero'};
        send(name, parameters);
        const config = [...win.dataLayer[1]];
        expect(config.slice(0, 2)).toEqual(['config', MEASUREMENT_ID]);
        expect(config[2]).toMatchObject({ cookie_domain: 'eidolonrealms.com', page_location: `https://${host}/`, page_referrer: 'https://example.com/', allow_google_signals: false, allow_ad_personalization_signals: false });
        expect(JSON.stringify(win.dataLayer)).not.toContain('private');
        expect(doc.head.appendChild.mock.calls[0][0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`);
        expect([...win.dataLayer[2]]).toEqual(['event', name, expect.objectContaining({ ...parameters, send_to: MEASUREMENT_ID })]);
    });

    test('initializes once so repeated imports do not duplicate page views', () => {
        const { win, doc } = browser('eidolonrealms.com');
        initializeAnalytics('website', win, doc);
        initializeAnalytics('website', win, doc);
        expect(doc.head.appendChild).toHaveBeenCalledTimes(1);
        expect(win.dataLayer).toHaveLength(2);
    });

    test('canonical paths and closed event fields exclude arbitrary personal text and destination overrides', () => {
        const { win, doc } = browser('play.eidolonrealms.com');
        win.location.pathname='/private-owner@example.com/private-reset';
        const send=initializeAnalytics('game',win,doc);
        const extras={account:'private-owner',password:'private-proof',token:'private-link',report:'private-report',
            user_id:'private-identity',page_location:'https://private-url',page_referrer:'private-referrer',send_to:'private-tag',site_surface:'private-surface'};
        send('gameplay_start',{player_class:'Wizard',...extras});
        send('gameplay_engagement',{player_class:'Rogue',active_play_seconds:30,...extras});
        send('gameplay_end',{player_class:'Cleric',total_active_play_seconds:45,elapsed_session_seconds:60,end_reason:'pagehide',...extras});
        send('private-event-name',extras);send('play_click',{cta_location:'hero'});
        expect(win.dataLayer).toHaveLength(5);
        expect(JSON.stringify(win.dataLayer)).not.toContain('private-');
        expect([...win.dataLayer[1]][2].page_location).toBe('https://play.eidolonrealms.com/');
        expect(Object.keys([...win.dataLayer[2]][2]).sort()).toEqual(['page_location','page_referrer','page_title','player_class','send_to','site_surface']);
        win.location.pathname='/another-private-path';doc.referrer='https://private-path.example/account';
        send('gameplay_start',{player_class:'Wizard'});
        expect([...win.dataLayer[5]][2]).toMatchObject({page_location:'https://play.eidolonrealms.com/',page_referrer:'https://example.com/',page_title:'Eidolon Online'});
    });

    test('unrecognized enum values are normalized or refused and durations are bounded numbers', () => {
        const {win,doc}=browser('play.eidolonrealms.com');const send=initializeAnalytics('game',win,doc);
        send('gameplay_start',{player_class:'private-name'});
        send('gameplay_end',{player_class:'Wizard',total_active_play_seconds:0,elapsed_session_seconds:0,end_reason:'private-email@example.com'});
        const count=win.dataLayer.length;
        for(const value of ['private-duration',-1,NaN,Infinity,365*86400+1]){
            send('gameplay_engagement',{player_class:'Wizard',active_play_seconds:value});
            send('gameplay_end',{total_active_play_seconds:0,elapsed_session_seconds:value});
        }
        send('gameplay_engagement',{active_play_seconds:0});send('gameplay_end',{total_active_play_seconds:2,elapsed_session_seconds:1});
        send('gameplay_start',null);send('gameplay_start',[]);
        expect(win.dataLayer).toHaveLength(count);expect(JSON.stringify(win.dataLayer)).not.toContain('private-');
        expect([...win.dataLayer[2]][2].player_class).toBe('Unknown');expect([...win.dataLayer[3]][2].end_reason).toBe('exit');
    });

    test('website event uses only known placements and ignores unknown properties without reading getters', () => {
        const {win,doc}=browser('www.eidolonrealms.com');const send=initializeAnalytics('website',win,doc);
        const parameters={cta_location:'hero',get privateValue(){throw new Error('must not read');}};
        expect(()=>send('play_click',parameters)).not.toThrow();
        send('play_click',{cta_location:'private-player'});send('gameplay_start',{player_class:'Wizard'});
        expect(win.dataLayer).toHaveLength(3);expect([...win.dataLayer[2]][2]).toEqual({cta_location:'hero',site_surface:'website',send_to:MEASUREMENT_ID,
            page_location:'https://www.eidolonrealms.com/',page_referrer:'https://example.com/',page_title:'Eidolon — Multiplayer Browser Action RPG'});
    });

    test('known-field accessors and inherited properties cannot change value between validation and emission', () => {
        const {win,doc}=browser('play.eidolonrealms.com');const send=initializeAnalytics('game',win,doc);
        const read=jest.fn(()=> 'private-owner');
        const fields={get player_class(){return read();},get active_play_seconds(){return read();}};
        send('gameplay_start',fields);send('gameplay_engagement',fields);
        send('gameplay_start',Object.create({player_class:'private-owner'}));
        expect(read).not.toHaveBeenCalled();expect(win.dataLayer).toHaveLength(4);
        expect([...win.dataLayer[2]][2].player_class).toBe('Unknown');expect([...win.dataLayer[3]][2].player_class).toBe('Unknown');
        const website=browser('eidolonrealms.com');const click=initializeAnalytics('website',website.win,website.doc);
        click('play_click',{get cta_location(){return read();}});expect(website.win.dataLayer).toHaveLength(2);
        expect(read).not.toHaveBeenCalled();expect(JSON.stringify(win.dataLayer)).not.toContain('private-');
    });

    test.each(['?eidolon-private=account','?eidolon-recovery=invalid&account=private-owner','?eidolon-private=account&eidolon-private=invalid','#eidolon-private=invalid','#eidolon-recovery=reset&account=private-owner&token=private-proof'])('private marker %s independently suppresses initialization and later manual events', marker => {
        const {win,doc}=browser('play.eidolonrealms.com');const send=initializeAnalytics('game',win,doc);
        if(marker.startsWith('?'))win.location.search=marker;else win.location.hash=marker;
        const count=win.dataLayer.length;send('gameplay_start',{player_class:'Wizard'});expect(win.dataLayer).toHaveLength(count);
        const fresh=browser('play.eidolonrealms.com');
        if(marker.startsWith('?'))fresh.win.location.search=marker;else fresh.win.location.hash=marker;
        initializeAnalytics('game',fresh.win,fresh.doc)('gameplay_start',{player_class:'Wizard'});
        expect(fresh.doc.head.appendChild).not.toHaveBeenCalled();expect(fresh.win.dataLayer).toBeUndefined();
    });

    test('late sensitive flag and invalid surface stop our emitter without claiming to unload existing provider code', () => {
        const {win,doc}=browser('play.eidolonrealms.com');const send=initializeAnalytics('game',win,doc);
        win.__eidolonRecoverySensitivePage=true;send('gameplay_start',{player_class:'Wizard'});expect(win.dataLayer).toHaveLength(2);
        const fresh=browser('eidolonrealms.com');initializeAnalytics('private-owner',fresh.win,fresh.doc)('play_click',{cta_location:'hero'});
        expect(fresh.doc.head.appendChild).not.toHaveBeenCalled();
    });
});
