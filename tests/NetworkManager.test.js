/**
 * Unit tests for NetworkManager reconnect / session-resume logic.
 *
 * We avoid importing the real NetworkManager module because it imports
 * the protobuf runtime.  Instead we use jest.unstable_mockModule to stub
 * out the proto dependency and import the real implementation code.
 */

import { jest } from '@jest/globals';

const decodeStateEnvelopeMock = jest.fn(() => ({ full: null, delta: null }));

// Stub the protobuf import so NetworkManager can be loaded in Jest/jsdom.
jest.unstable_mockModule('../src/proto/state_pb.js', () => ({
    eidolon: {
        state: {
            StateEnvelope: {
                decode: decodeStateEnvelopeMock
            }
        }
    }
}));

const { NetworkManager } = await import('../src/core/NetworkManager.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock WebSocket that tracks its event handlers and
 * exposes a helper to simulate server messages / close events.
 */
function makeMockSocket(initialReadyState = WebSocket.OPEN) {
    const sock = {
        readyState: initialReadyState,
        sent: [],
        onmessage: null,
        onclose: null,
        onerror: null,
        onopen: null,

        send(data) { this.sent.push(JSON.parse(data)); },

        // Test helpers
        simulateMessage(obj) {
            if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
        },
        simulateClose() {
            if (this.onclose) this.onclose();
        },
        simulateError(err = new Event('error')) {
            if (this.onerror) this.onerror(err);
        }
    };
    return sock;
}

// Install a global WebSocket constructor that records created instances.
function installMockWebSocket() {
    const created = [];
    class MockWebSocket {
        static OPEN = 1;
        static CONNECTING = 0;
        static CLOSED = 3;
        constructor(url) {
            this.url = url;
            this.readyState = MockWebSocket.OPEN;
            this.sent = [];
            this.onopen = null;
            this.onclose = null;
            this.onerror = null;
            this.onmessage = null;
            created.push(this);
            // Expose helper on instance
            this.simulateMessage = (obj) => {
                if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
            };
            this.simulateClose = () => {
                if (this.onclose) this.onclose();
            };
            this.simulateError = (err = new Event('error')) => {
                if (this.onerror) this.onerror(err);
            };
            this.simulateOpen = () => {
                if (this.onopen) this.onopen();
            };
        }
        send(data) { this.sent.push(JSON.parse(data)); }
    }
    globalThis.WebSocket = MockWebSocket;
    return { MockWebSocket, created };
}

// ---------------------------------------------------------------------------
// Basic send / drainMessages (smoke)
// ---------------------------------------------------------------------------

describe('NetworkManager — basic send / queue', () => {
    test('send() serialises message when socket is OPEN', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.send('move', { x: 1, z: 2 });
        expect(sock.sent).toHaveLength(1);
        expect(sock.sent[0]).toEqual({ type: 'move', payload: { x: 1, z: 2 } });
    });

    test('send() is a no-op when socket is not OPEN', () => {
        const sock = makeMockSocket(0 /* CONNECTING */);
        const nm = new NetworkManager(sock);
        nm.send('move', { x: 1 });
        expect(sock.sent).toHaveLength(0);
    });

    test('drainMessages() returns and clears queued messages', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.setupListeners();
        sock.simulateMessage({ type: 'chat', payload: 'hello' });
        sock.simulateMessage({ type: 'chat', payload: 'world' });
        const msgs = nm.drainMessages();
        expect(msgs).toHaveLength(2);
        expect(nm.drainMessages()).toHaveLength(0);
    });

    test('drainMessages() respects limit and preserves remainder', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.setupListeners();
        for (let i = 0; i < 5; i++) sock.simulateMessage({ type: 'x', payload: i });
        const first = nm.drainMessages(3);
        expect(first).toHaveLength(3);
        expect(nm.messageQueue).toHaveLength(2);
    });

    test('drainMessages() prioritizes control messages and current state when backlogged', () => {
        const nm = new NetworkManager(null);
        nm.messageQueue = [
            { type: 'state', payload: { sequence: 1 } },
            { type: 'delta', payload: { sequence: 2 } },
            { type: 'state', payload: { sequence: 3 } },
            { type: 'chat', payload: { message: 'confirmed' } },
            { type: 'inventory', payload: [] }
        ];

        expect(nm.drainMessages(3)).toEqual([
            { type: 'chat', payload: { message: 'confirmed' } },
            { type: 'inventory', payload: [] },
            { type: 'state', payload: { sequence: 3 } }
        ]);
        expect(nm.messageQueue).toEqual([]);
    });

    test('drainMessages() compacts an extreme state backlog without losing current entities', () => {
        const nm = new NetworkManager(null);
        nm.messageQueue = [
            { type: 'state', payload: { player: { x: 0 }, stale: { id: 'stale' } } },
            ...Array.from({ length: 20 }, (_, index) => ({
                type: 'delta',
                payload: {
                    u: { player: { x: index + 1 } },
                    r: index === 4 ? ['stale'] : []
                }
            })),
            { type: 'chat', payload: { message: 'priority' } }
        ];

        const drained = nm.drainMessages(5);

        expect(drained[0]).toEqual({ type: 'chat', payload: { message: 'priority' } });
        expect(drained).toHaveLength(5);
        expect(drained[1]).toEqual(expect.objectContaining({
            type: 'state',
            payload: expect.objectContaining({ player: { x: 17 } })
        }));
        expect(drained[1].payload.stale).toBeUndefined();
        expect(drained.at(-1)).toEqual(expect.objectContaining({
            type: 'delta',
            payload: expect.objectContaining({ u: { player: { x: 20 } } })
        }));
        expect(nm.messageQueue).toEqual([]);
    });

    test('receive-path compaction bounds state traffic between animation frames', () => {
        const nm = new NetworkManager(null);

        nm._enqueueMessage({
            type: 'state',
            payload: { player: { id: 'player', x: 0 }, stale: { id: 'stale' } }
        });
        for (let index = 1; index <= 100; index += 1) {
            if (index === 50) {
                nm._enqueueMessage({ type: 'inventory', payload: [{ name: 'Authoritative Axe' }] });
            }
            nm._enqueueMessage({
                type: 'delta',
                payload: {
                    u: { player: { id: 'player', x: index } },
                    r: index === 25 ? ['stale'] : []
                }
            });
        }

        expect(nm.messageQueue.length).toBeLessThanOrEqual(64);

        const drained = nm.drainMessages(40);
        expect(drained[0]).toEqual({
            type: 'inventory',
            payload: [{ name: 'Authoritative Axe' }]
        });

        const latestState = drained.at(-1);
        expect(latestState.type).toBe('delta');
        expect(latestState.payload.u.player.x).toBe(100);
        expect(drained.some((message) => message.payload?.stale)).toBe(false);
    });

    test('combat-effect floods cannot starve controls or authoritative state', () => {
        const nm = new NetworkManager(null);
        nm._enqueueMessage({ type: 'state', payload: { player: { id: 'player', x: 0 } } });
        for (let index = 1; index <= 100; index += 1) {
            nm._enqueueMessage({ type: 'attack', payload: { sourceId: `enemy-${index}` } });
            nm._enqueueMessage({ type: 'damage', payload: { targetId: `enemy-${index}`, amount: index } });
            nm._enqueueMessage({
                type: 'delta',
                payload: { u: { player: { id: 'player', x: index } }, r: [] }
            });
        }
        nm._enqueueMessage({ type: 'chat', payload: { sender: 'System', message: 'Waypoint set' } });

        expect(nm.messageQueue.length).toBeLessThanOrEqual(64);

        const drained = nm.drainMessages(5);
        expect(drained[0].type).toBe('chat');
        expect(drained.some((message) =>
            (message.type === 'state' && message.payload.player?.x === 100) ||
            (message.type === 'delta' && message.payload.u.player?.x === 100)
        )).toBe(true);
        expect(drained.filter((message) =>
            message.type === 'attack' || message.type === 'damage'
        ).length).toBeLessThanOrEqual(3);
    });

    test('requests ordered ArrayBuffer delivery for binary state frames', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);

        nm.setupListeners();

        expect(sock.binaryType).toBe('arraybuffer');
    });

    test('decodes an ArrayBuffer state frame synchronously into queue order', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        decodeStateEnvelopeMock.mockReturnValueOnce({
            full: { entities: [{ id: 'player-one', x: 12 }] },
            delta: null
        });
        nm.setupListeners();

        const frame = new Uint8Array([0x45, 0x44, 0x50, 0x42, 0x02, 0x99]);
        sock.onmessage({ data: frame.buffer });

        expect(decodeStateEnvelopeMock).toHaveBeenCalledWith(new Uint8Array([0x99]));
        expect(nm.drainMessages()).toEqual([{
            type: 'state',
            payload: { 'player-one': { id: 'player-one', x: 12 } }
        }]);
    });

    test('attaches the authoritative server tick to every decoded transform sample', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        decodeStateEnvelopeMock.mockReturnValueOnce({
            serverTimeMs: 1_784_564_218_123,
            full: null,
            delta: {
                entities: [
                    { id: 'player-one', x: 12, moveSequence: 41 },
                    { id: 'player-two', x: 8 }
                ],
                removedIds: []
            }
        });
        nm.setupListeners();

        const frame = new Uint8Array([0x45, 0x44, 0x50, 0x42, 0x02, 0x99]);
        sock.onmessage({ data: frame.buffer });

        const [message] = nm.drainMessages();
        expect(message.payload.u['player-one']).toEqual(expect.objectContaining({
            moveSequence: 41,
            _serverTimeMs: 1_784_564_218_123
        }));
        expect(message.payload.u['player-two']._serverTimeMs).toBe(1_784_564_218_123);
    });

    test('removes protobuf synthetic empty quest presence from partial state entities', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        const player = { id: 'player-one', x: 12, quests: [] };
        expect(Object.hasOwn(player, 'quests')).toBe(true);
        decodeStateEnvelopeMock.mockReturnValueOnce({
            full: null,
            delta: { entities: [player], removedIds: [] }
        });
        nm.setupListeners();

        const frame = new Uint8Array([0x45, 0x44, 0x50, 0x42, 0x02, 0x99]);
        sock.onmessage({ data: frame.buffer });

        const decoded = nm.drainMessages()[0].payload.u['player-one'];
        expect(Object.hasOwn(decoded, 'quests')).toBe(false);
    });

    test('preserves a non-empty authoritative protobuf quest catalog', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        decodeStateEnvelopeMock.mockReturnValueOnce({
            full: {
                entities: [{
                    id: 'player-one',
                    quests: [{ id: 'daily_skeleton', accepted: false }]
                }]
            },
            delta: null
        });
        nm.setupListeners();

        const frame = new Uint8Array([0x45, 0x44, 0x50, 0x42, 0x02, 0x99]);
        sock.onmessage({ data: frame.buffer });

        expect(nm.drainMessages()[0].payload['player-one'].quests).toEqual([
            { id: 'daily_skeleton', accepted: false }
        ]);
    });
});

// ---------------------------------------------------------------------------
// resume_session message handling
// ---------------------------------------------------------------------------

describe('NetworkManager — resume_session server message', () => {
    test('pushes resume_session into the queue and calls onResumeSuccess', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.setupListeners();

        const onResumeSuccess = jest.fn();
        nm.onResumeSuccess = onResumeSuccess;

        sock.simulateMessage({ type: 'resume_session', payload: { resumeToken: 'tok123' } });

        expect(onResumeSuccess).toHaveBeenCalledWith('tok123');
        const msgs = nm.drainMessages();
        expect(msgs[0].type).toBe('resume_session');
    });

    test('resets reconnect counters on resume_session ack', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm._reconnectAttempts = 3;
        nm._reconnecting = true;
        nm.setupListeners();

        sock.simulateMessage({ type: 'resume_session', payload: { resumeToken: 'abc' } });

        expect(nm._reconnecting).toBe(false);
        expect(nm._reconnectAttempts).toBe(0);
    });

    test('does not throw when onResumeSuccess is null', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.setupListeners();
        nm.onResumeSuccess = null;

        expect(() => {
            sock.simulateMessage({ type: 'resume_session', payload: { resumeToken: 'tok' } });
        }).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// error message while reconnecting
// ---------------------------------------------------------------------------

describe('NetworkManager — error during reconnect', () => {
    test('error during reconnect phase calls onReconnectFailed', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm._reconnecting = true;
        nm.setupListeners();

        const onReconnectFailed = jest.fn();
        nm.onReconnectFailed = onReconnectFailed;

        sock.simulateMessage({ type: 'error', payload: 'Session token invalid or expired.' });

        expect(onReconnectFailed).toHaveBeenCalledTimes(1);
        expect(nm._reconnecting).toBe(false);
    });

    test('error NOT during reconnect is pushed to queue normally', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm._reconnecting = false;
        nm.setupListeners();

        const onReconnectFailed = jest.fn();
        nm.onReconnectFailed = onReconnectFailed;

        sock.simulateMessage({ type: 'error', payload: 'Some other error' });

        expect(onReconnectFailed).not.toHaveBeenCalled();
        expect(nm.drainMessages()).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Reconnect scheduling
// ---------------------------------------------------------------------------

describe('NetworkManager — _scheduleReconnect', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('schedules _doReconnect after exponential back-off delay', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'mytoken';
        nm._maxReconnectAttempts = 3;

        nm._scheduleReconnect();
        expect(nm._reconnecting).toBe(true);
        expect(nm._reconnectAttempts).toBe(1);

        // First delay = 1000 * 2^0 = 1000 ms
        jest.advanceTimersByTime(999);
        expect(created).toHaveLength(0); // not yet
        jest.advanceTimersByTime(1);
        expect(created).toHaveLength(1); // new socket created
    });

    test('calls onReconnectFailed when max attempts exhausted', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm._maxReconnectAttempts = 2;
        nm._reconnectAttempts = 2; // already at max

        const onReconnectFailed = jest.fn();
        nm.onReconnectFailed = onReconnectFailed;

        nm._scheduleReconnect();

        expect(onReconnectFailed).toHaveBeenCalledTimes(1);
        expect(nm._reconnecting).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// _doReconnect
// ---------------------------------------------------------------------------

describe('NetworkManager — _doReconnect', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('calls onReconnectFailed immediately when reconnectUrl is null', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = null;
        const onReconnectFailed = jest.fn();
        nm.onReconnectFailed = onReconnectFailed;

        nm._doReconnect();

        expect(onReconnectFailed).toHaveBeenCalledTimes(1);
    });

    test('sends resume_session after new socket opens with a valid token', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'token-abc';

        nm._doReconnect();

        expect(created).toHaveLength(1);
        const newSock = created[0];

        // Simulate socket open
        newSock.simulateOpen();

        expect(newSock.sent).toHaveLength(1);
        expect(newSock.sent[0]).toMatchObject({ type: 'resume_session', payload: { token: 'token-abc' } });
    });

    test('calls onReconnectFailed when token is null on open', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => null;
        const onReconnectFailed = jest.fn();
        nm.onReconnectFailed = onReconnectFailed;

        nm._doReconnect();

        created[0].simulateOpen();

        expect(onReconnectFailed).toHaveBeenCalledTimes(1);
        expect(created[0].sent).toHaveLength(0);
    });

    test('retries when new socket closes before opening', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';
        nm._maxReconnectAttempts = 3;
        nm._reconnectAttempts = 0;

        nm._doReconnect();
        expect(created).toHaveLength(1);

        // The new socket closes before open
        created[0].simulateClose();

        // A new reconnect should be scheduled — advance past the delay
        expect(nm._reconnectAttempts).toBe(1);
        jest.advanceTimersByTime(5000);
        expect(created).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// onclose wires to _scheduleReconnect for unexpected disconnects
// ---------------------------------------------------------------------------

describe('NetworkManager — onclose reconnect integration', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('unexpected close schedules reconnect', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';
        nm.setupListeners();

        sock.simulateClose();

        expect(nm._reconnecting).toBe(true);
        jest.advanceTimersByTime(2000);
        expect(created).toHaveLength(1);
    });

    test('expected disconnect (destroy) does NOT trigger reconnect', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.setupListeners();
        nm.destroy();

        sock.simulateClose();

        jest.advanceTimersByTime(5000);
        expect(created).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// destroy() clears pending reconnect timer
// ---------------------------------------------------------------------------

describe('NetworkManager — destroy', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('destroy() cancels a pending reconnect timer', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';
        nm.setupListeners();

        // Trigger reconnect scheduling
        sock.simulateClose();
        expect(nm._reconnecting).toBe(true);

        // Destroy before the timer fires
        nm.destroy();

        jest.advanceTimersByTime(10000);
        expect(created).toHaveLength(0); // No new socket created
    });
});

// ---------------------------------------------------------------------------
// onConnectionStateChange — state transition callbacks
// ---------------------------------------------------------------------------

describe('NetworkManager — onConnectionStateChange', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('fires reconnecting on first close after unexpected disconnect', () => {
        installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';

        const states = [];
        nm.onConnectionStateChange = (s) => states.push(s);
        nm.setupListeners();

        sock.simulateClose();
        expect(states).toEqual(['reconnecting']);
    });

    test('fires reconnecting only once across multiple retry attempts', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';

        const states = [];
        nm.onConnectionStateChange = (s) => states.push(s);
        nm.setupListeners();

        // First close kicks off reconnect
        sock.simulateClose();
        jest.advanceTimersByTime(1500);

        // Second socket (attempt 1) closes before open
        const newSock1 = created[0];
        if (newSock1) newSock1.simulateClose();
        jest.advanceTimersByTime(3000);

        expect(states.filter(s => s === 'reconnecting')).toHaveLength(1);
    });

    test('fires connected when server sends resume_session ack', () => {
        installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';

        const states = [];
        nm.onConnectionStateChange = (s) => states.push(s);
        nm.setupListeners();

        // Simulate successful resume ack
        sock.simulateMessage({ type: 'resume_session', payload: { resumeToken: 'new-tok' } });
        expect(states).toContain('connected');
        expect(nm._reconnecting).toBe(false);
    });

    test('fires lost when server sends error during reconnect', () => {
        installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';

        const states = [];
        nm.onConnectionStateChange = (s) => states.push(s);
        nm.setupListeners();

        sock.simulateClose();          // → reconnecting
        nm._reconnecting = true;       // simulate we are mid-reconnect
        sock.simulateMessage({ type: 'error', payload: 'invalid token' });

        expect(states).toContain('lost');
    });

    test('fires lost when all reconnect attempts are exhausted', () => {
        installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';
        nm._maxReconnectAttempts = 1;

        const states = [];
        nm.onConnectionStateChange = (s) => states.push(s);
        nm.setupListeners();

        // Exhaust the single allowed attempt
        sock.simulateClose();
        jest.advanceTimersByTime(10000);
        // Trigger the max-attempts guard by calling schedule again
        nm._scheduleReconnect();

        expect(states).toContain('lost');
    });

    test('fires lost when no resume token is available on reconnect open', () => {
        const { created } = installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => null; // no token
        nm._reconnecting = true;

        const states = [];
        nm.onConnectionStateChange = (s) => states.push(s);
        nm.setupListeners();

        nm._doReconnect();
        jest.advanceTimersByTime(0);

        const newSock = created[0];
        if (newSock && newSock.onopen) newSock.onopen();

        expect(states).toContain('lost');
    });
});

// ---------------------------------------------------------------------------
// 0.36.4 — second-drop resilience and state-reapplication guarantees
// ---------------------------------------------------------------------------

describe('NetworkManager — 0.36.4 second-drop and state-reapplication', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('resume_session ack pushes message to queue for game-engine state reapplication', () => {
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.setupListeners();

        sock.simulateMessage({ type: 'resume_session', payload: { resumeToken: 'fresh-tok' } });

        const msgs = nm.drainMessages();
        expect(msgs.some(m => m.type === 'resume_session')).toBe(true);
    });

    test('a second disconnect after a successful resume gets a fresh set of 5 attempts', () => {
        installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';
        nm.setupListeners();

        // First disconnect → counter advances to 1, timer scheduled.
        sock.simulateClose();
        expect(nm._reconnectAttempts).toBe(1);

        // Resume ack → counter resets to 0, reconnecting flag cleared.
        sock.simulateMessage({ type: 'resume_session', payload: { resumeToken: 'tok2' } });
        expect(nm._reconnectAttempts).toBe(0);
        expect(nm._reconnecting).toBe(false);

        // Cancel the pending timer so it doesn't interfere with the second drop.
        clearTimeout(nm._reconnectTimer);

        // Second disconnect: starts fresh — attempt count should be 1, not 6 or 2.
        sock.simulateClose();
        expect(nm._reconnectAttempts).toBe(1);
        expect(nm._reconnecting).toBe(true);
    });

    test('resume_session ack resets _reconnecting so onConnectionStateChange can fire reconnecting again later', () => {
        installMockWebSocket();
        const sock = makeMockSocket();
        const nm = new NetworkManager(sock);
        nm.reconnectUrl = 'ws://localhost:8080/ws';
        nm.getResumeToken = () => 'tok';

        const states = [];
        nm.onConnectionStateChange = (s) => states.push(s);
        nm.setupListeners();

        // First disconnect + resume
        sock.simulateClose();
        expect(states).toContain('reconnecting');

        sock.simulateMessage({ type: 'resume_session', payload: { resumeToken: 'tok2' } });
        expect(states).toContain('connected');
        expect(nm._reconnecting).toBe(false);

        // Second disconnect should fire 'reconnecting' again.
        nm._reconnectAttempts = 0;
        nm._scheduleReconnect();
        const reconnectingCount = states.filter(s => s === 'reconnecting').length;
        expect(reconnectingCount).toBeGreaterThanOrEqual(2);
    });
});
