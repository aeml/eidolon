import { jest } from '@jest/globals';
import { readPlayerStateInPage, readGroundPointerInPage, readGroundClickReceiptInPage } from './groundInputObservations.js';

function fixture() {
    const game = { player: { id: 'player', name: 'Hero', level: 30, state: 'IDLE',
        position: { x: 4, y: .5, z: 8 }, stats: { hp: 70 }, inventory: [null, { id: 'item' }],
        targetPosition: { x: 10, z: 12 }, movementMetrics: { blockedStops: 2 } },
    currentInstanceId: 'instance', currentInstanceType: 'dungeon',
    isHostileActorTarget: entity => Boolean(entity.hostile),
    hoveredEntity: { id: 'enemy', hostile: true, state: 'IDLE', isActive: true, position: { x: 5, z: 9 } },
    inputManager: { getGroundIntersectionFromEvent: jest.fn(() => ({ x: 10, y: 0, z: 12 })) },
    handlePrimaryClick: jest.fn(function (event) {
        expect(this).toBe(game);
        if (!event.shiftKey) this.pendingInteraction = this.hoveredEntity;
        return 'accepted';
    }),
    requestDungeonStatus: jest.fn(function (...args) { expect(this).toBe(game); return args; }),
    handleServerMessage: jest.fn(function (value) { expect(this).toBe(game); return value; }) };
    window.game = game;
    return game;
}

afterEach(() => {
    delete window.game;
    delete window.__entranceClickProbe;
    delete window.__entranceClickProbeInstalled;
});

test('ordinary reads preserve the complete snapshot contract and do not install or reset hooks', () => {
    expect(readPlayerStateInPage()).toBeNull();
    const game = fixture(), click = game.handlePrimaryClick;
    expect(readPlayerStateInPage()).toEqual({ id: 'player', name: 'Hero', type: 'Object',
        level: 30, health: 70, state: 'IDLE', inventoryCount: 1, x: 4, y: .5, z: 8,
        instanceId: 'instance', instanceType: 'dungeon' });
    expect(game.handlePrimaryClick).toBe(click);
    expect(window.__entranceClickProbe).toBeUndefined();
    readPlayerStateInPage({ observeClicks: true });
    const probe = window.__entranceClickProbe;
    probe.requested = 3;
    expect(readPlayerStateInPage().health).toBe(70);
    expect(window.__entranceClickProbe).toBe(probe);
    expect(probe.requested).toBe(3);
});

test('combined setup and origin read observes each real call exactly once without issuing one', () => {
    const game = fixture(), click = game.handlePrimaryClick;
    const request = game.requestDungeonStatus, receive = game.handleServerMessage;
    expect(readPlayerStateInPage({ observeClicks: true }).x).toBe(4);
    expect(click).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled(); expect(receive).not.toHaveBeenCalled();
    const wrapped = game.handlePrimaryClick;
    readPlayerStateInPage({ observeClicks: true });
    expect(game.handlePrimaryClick).toBe(wrapped);
    const event = { target: { tagName: 'CANVAS' } };
    expect(game.handlePrimaryClick(event)).toBe('accepted');
    expect(click).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledWith(event);
    expect(window.__entranceClickProbe.click).toMatchObject({ before: { id: 'enemy', hostile: true },
        pending: { id: 'enemy' }, dom: 'CANVAS', result: 'accepted', player: { x: 4, z: 8 } });
    expect(game.requestDungeonStatus('normal', 30)).toEqual(['normal', 30]);
    const message = { type: 'get_dungeon_status' };
    expect(game.handleServerMessage(message)).toBe(message);
    expect(request).toHaveBeenCalledTimes(1); expect(receive).toHaveBeenCalledTimes(1);
    expect(window.__entranceClickProbe).toMatchObject({ requested: 1, received: 1 });
});

test('an exception in real input remains an exception and cannot create a successful receipt', () => {
    const game = fixture();
    game.handlePrimaryClick.mockImplementation(() => { throw new Error('click failed'); });
    readPlayerStateInPage({ observeClicks: true });
    expect(() => game.handlePrimaryClick({})).toThrow('click failed');
    expect(window.__entranceClickProbe.click).toBeNull();
});

test.each([true, false])('pointer observation retains actual hover and ray, covered=%s', covered => {
    const game = fixture();
    if (!covered) game.hoveredEntity = null;
    const pending = game.pendingInteraction = { id: 'prior-interaction' };
    const position = { ...game.player.position }, target = game.player.targetPosition;
    window.__entranceClickProbe = { click: { stale: true }, requested: 2, received: 3 };
    expect(readGroundPointerInPage({ x: 100, y: 200 })).toEqual({ isClearGround: !covered,
        groundPoint: { x: 10, y: 0, z: 12 } });
    expect(game.inputManager.getGroundIntersectionFromEvent).toHaveBeenCalledWith({ clientX: 100, clientY: 200 });
    expect(window.__entranceClickProbe).toEqual({ click: null, requested: 2, received: 3 });
    expect(game.player.position).toEqual(position); expect(game.player.targetPosition).toBe(target);
    expect(game.pendingInteraction).toBe(pending); expect(game.handlePrimaryClick).not.toHaveBeenCalled();
});

test('a missing ground ray stays missing', () => {
    const game = fixture();
    game.inputManager.getGroundIntersectionFromEvent.mockReturnValue(null);
    expect(readGroundPointerInPage({ x: 100, y: 200 }).groundPoint).toBeNull();
});

test('receipt combines real intent and diagnostic click without treating desired movement as actual movement', () => {
    const game = fixture();
    readPlayerStateInPage({ observeClicks: true });
    expect(readGroundClickReceiptInPage()).toEqual({ intent: { interactionId: null,
        interactionType: null, target: { x: 10, z: 12 }, blockedStops: 2 }, clickProbe: null });
    game.handlePrimaryClick({ shiftKey: true });
    expect(readGroundClickReceiptInPage().clickProbe.result).toBe('accepted');
    expect(game.player.position).toEqual({ x: 4, y: .5, z: 8 });
});
