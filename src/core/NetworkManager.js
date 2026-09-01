// ============================================================================
// NetworkManager — owns WebSocket lifecycle, binary decode, message queue
// ============================================================================

import { eidolon as eidolonProto } from '../proto/state_pb.js';

const INCOMING_STATE_COMPACTION_THRESHOLD = 64;
const INCOMING_STATE_RETAIN_LIMIT = 9;
const INCOMING_EFFECT_RETAIN_LIMIT = 16;
const TRANSIENT_MESSAGE_TYPES = new Set([
    'ability',
    'attack',
    'damage',
    'heal',
    'telegraph',
    'dungeon_room_state'
]);

export class NetworkManager {
    /**
     * @param {WebSocket} socket  — an already-authenticated WebSocket
     */
    constructor(socket) {
        this.socket = socket;

        /** @type {Object[]} Queued incoming messages (drained each tick) */
        this.messageQueue = [];

        /** Serial fallback for environments that still deliver binary frames as Blob. */
        this._binaryDecodeChain = Promise.resolve();

        /** Latest raw server time payload (string).  Kept outside queue for perf. */
        this.latestServerTime = null;

        /** Set to true before an intentional disconnect (e.g. menu return). */
        this.isExpectedDisconnect = false;

        // ------------------------------------------------------------------
        // Reconnect configuration — set by caller after construction.
        // ------------------------------------------------------------------

        /** WebSocket URL to reconnect to (e.g. 'wss://host/ws'). */
        this.reconnectUrl = null;

        /** () => string|null — returns the current session-resume token, or null. */
        this.getResumeToken = null;

        /** Called when all reconnect attempts are exhausted or the server rejects the token. */
        this.onReconnectFailed = null;

        /** Called with the fresh token string when the server confirms a successful resume. */
        this.onResumeSuccess = null;

        /**
         * Called with one of 'reconnecting' | 'connected' | 'lost' whenever the
         * connection state changes.  Wire this to UIManager.setConnectionState().
         */
        this.onConnectionStateChange = null;

        // Internal reconnect state
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 5;
        this._reconnectBaseDelay = 1000; // ms; doubles each attempt
        this._reconnecting = false;
        this._reconnectTimer = null;
    }

    // ------------------------------------------------------------------
    // Sending
    // ------------------------------------------------------------------

    /**
     * Send a JSON message to the server.
     * No-op if the socket is not open.
     *
     * @param {string} type     Message type (e.g. 'ability', 'move')
     * @param {Object} payload  Message payload
     */
    send(type, payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, payload }));
        }
    }

    // ------------------------------------------------------------------
    // Connection
    // ------------------------------------------------------------------

    /**
     * Reuses the authenticated socket and sends the initial `join` message.
     * Falls back to an error if no open socket is available.
     *
     * @param {string} playerType  e.g. 'Fighter'
     */
    connect(playerType) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.setupListeners();
            this.send('join', { type: playerType });
            return;
        }

        console.error('Connection lost or not authenticated. Please refresh and login.');
        if (typeof alert !== 'undefined') {
            alert('Connection lost! Please refresh the page and login again.');
        }
    }

    // ------------------------------------------------------------------
    // Incoming message wiring
    // ------------------------------------------------------------------

    /**
     * Wire the socket's onmessage / onclose / onerror handlers.
     * Binary blobs are decoded (protobuf EDPB envelope) and pushed into the
     * message queue.  Time messages are stored separately for perf.
     */
    setupListeners() {
        // ArrayBuffer avoids one asynchronous FileReader per 30 Hz state
        // packet. Besides reducing queue latency, synchronous decoding keeps
        // authoritative movement frames in WebSocket transport order.
        this.socket.binaryType = 'arraybuffer';
        this.socket.onmessage = (event) => {
            try {
                let data = event.data;

                // --- Binary (protobuf) path ---
                if (data instanceof ArrayBuffer) {
                    this._decodeBinaryState(data);
                    return;
                }
                if (data instanceof Blob) {
                    this._binaryDecodeChain = this._binaryDecodeChain
                        .then(() => data.arrayBuffer())
                        .then((buffer) => this._decodeBinaryState(buffer))
                        .catch((error) => console.error('Decompression error:', error));
                    return;
                }

                // --- JSON fast-path for time messages ---
                if (typeof data === 'string') {
                    if (data.includes('"type":"time"')) {
                        this.latestServerTime = data;
                        return;
                    }
                }

                const msg = JSON.parse(data);
                if (msg.type === 'time') {
                    this.latestServerTime = JSON.stringify(msg.payload);
                } else if (msg.type === 'resume_session') {
                    // Server confirmed the session resume.
                    this._reconnecting = false;
                    this._reconnectAttempts = 0;
                    const newToken = msg.payload && msg.payload.resumeToken;
                    if (newToken && this.onResumeSuccess) {
                        this.onResumeSuccess(newToken);
                    }
                    if (this.onConnectionStateChange) this.onConnectionStateChange('connected');
                    this._enqueueMessage(msg);
                } else if (msg.type === 'error' && this._reconnecting) {
                    // Server rejected the resume token.
                    this._reconnecting = false;
                    if (this.onConnectionStateChange) this.onConnectionStateChange('lost');
                    if (this.onReconnectFailed) this.onReconnectFailed();
                } else {
                    this._enqueueMessage(msg);
                }
            } catch (e) {
                console.error('Failed to parse server message:', e);
            }
        };

        this.socket.onclose = () => {
            console.log('Disconnected from server.');
            if (!this.isExpectedDisconnect) {
                this._scheduleReconnect();
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    _decodeBinaryState(buffer) {
        try {
            const compressed = new Uint8Array(buffer);

            // EDPB + version byte + protobuf payload
            if (
                compressed.length <= 5 ||
                compressed[0] !== 0x45 ||
                compressed[1] !== 0x44 ||
                compressed[2] !== 0x50 ||
                compressed[3] !== 0x42
            ) {
                console.warn('Unknown binary payload; ignoring (expected EDPB protobuf)');
                return;
            }

            const wireVersion = compressed[4];
            if (wireVersion !== 1) {
                console.warn('Unsupported state proto wire version:', wireVersion);
                return;
            }

            const payloadBytes = compressed.subarray(5);
            const env = eidolonProto.state.StateEnvelope.decode(payloadBytes);
            const serverTimeMs = Number(env.serverTimeMs || 0);

            if (env.full) {
                const entities = env.full.entities || [];
                const payload = {};
                for (const e of entities) {
                    this._normalizeDecodedEntityPresence(e);
                    if (serverTimeMs > 0) e._serverTimeMs = serverTimeMs;
                    payload[e.id] = e;
                }
                this._enqueueMessage({ type: 'state', payload });
                return;
            }

            if (env.delta) {
                const entities = env.delta.entities || [];
                const u = {};
                for (const e of entities) {
                    this._normalizeDecodedEntityPresence(e);
                    if (serverTimeMs > 0) e._serverTimeMs = serverTimeMs;
                    u[e.id] = e;
                }
                const r = env.delta.removedIds || [];
                this._enqueueMessage({ type: 'delta', payload: { u, r } });
            }
        } catch (error) {
            console.error('Decompression error:', error);
        }
    }

    /**
     * protobuf.js initializes repeated fields as own empty arrays even when
     * their field number was absent from the wire. Remove that synthetic
     * presence so partial movement/combat entities cannot masquerade as an
     * authoritative request to clear the daily quest catalog.
     */
    _normalizeDecodedEntityPresence(entity) {
        if (Array.isArray(entity?.quests) && entity.quests.length === 0) {
            delete entity.quests;
        }
    }

    /**
     * Queue a decoded server message while bounding obsolete state traffic.
     *
     * WebSocket callbacks can run far more often than requestAnimationFrame on
     * a throttled or CPU-starved browser. Compacting here prevents stale state
     * packets from growing without bound before the game loop gets a chance to
     * call drainMessages(). Control messages are never discarded.
     */
    _enqueueMessage(message) {
        this.messageQueue.push(message);
        if (this.messageQueue.length <= INCOMING_STATE_COMPACTION_THRESHOLD) return;

        const controlMessages = this.messageQueue.filter((queued) =>
            !this._isStateMessage(queued) && !this._isTransientMessage(queued)
        );
        const stateMessages = this.messageQueue.filter((queued) => this._isStateMessage(queued));
        const transientMessages = this.messageQueue.filter((queued) => this._isTransientMessage(queued));

        this.messageQueue = [
            ...controlMessages,
            ...this._compactStateMessages(stateMessages, INCOMING_STATE_RETAIN_LIMIT),
            ...transientMessages.slice(-INCOMING_EFFECT_RETAIN_LIMIT)
        ];
    }

    _isStateMessage(message) {
        return message.type === 'state' || message.type === 'delta';
    }

    _isTransientMessage(message) {
        return TRANSIENT_MESSAGE_TYPES.has(message.type);
    }

    // ------------------------------------------------------------------
    // Reconnect (internal)
    // ------------------------------------------------------------------

    /**
     * Schedule a reconnect attempt with exponential back-off.
     * Calls onReconnectFailed when max attempts are exhausted.
     */
    _scheduleReconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.log('Max reconnect attempts reached. Giving up.');
            this._reconnecting = false;
            if (this.onConnectionStateChange) this.onConnectionStateChange('lost');
            if (this.onReconnectFailed) this.onReconnectFailed();
            return;
        }
        const delay = this._reconnectBaseDelay * Math.pow(2, this._reconnectAttempts);
        this._reconnectAttempts++;
        if (!this._reconnecting) {
            this._reconnecting = true;
            if (this.onConnectionStateChange) this.onConnectionStateChange('reconnecting');
        }
        console.log(
            `Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})…`
        );
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => this._doReconnect(), delay);
    }

    /**
     * Open a fresh WebSocket and attempt a session resume.
     * Falls back to onReconnectFailed if no URL or no token is available.
     */
    _doReconnect() {
        if (!this.reconnectUrl) {
            this._reconnecting = false;
            if (this.onReconnectFailed) this.onReconnectFailed();
            return;
        }

        let newSocket;
        try {
            newSocket = new WebSocket(this.reconnectUrl);
        } catch (err) {
            console.warn('Failed to create reconnect socket:', err);
            this._scheduleReconnect();
            return;
        }

        this.socket = newSocket;

        newSocket.onopen = () => {
            const token = this.getResumeToken ? this.getResumeToken() : null;
            if (!token) {
                // No token available — cannot resume; tell the caller.
                this._reconnecting = false;
                if (this.onConnectionStateChange) this.onConnectionStateChange('lost');
                if (this.onReconnectFailed) this.onReconnectFailed();
                return;
            }
            // Wire full message / close / error listeners, then send the resume request.
            this.setupListeners();
            console.log('Socket open; sending resume_session…');
            this.send('resume_session', { token });
        };

        newSocket.onclose = () => {
            // Failed before open — retry.
            this._scheduleReconnect();
        };

        newSocket.onerror = (err) => {
            console.warn('Reconnect socket error:', err);
            // onclose will fire next; let it drive the retry.
        };
    }

    // ------------------------------------------------------------------
    // Queue drain (called once per game tick)
    // ------------------------------------------------------------------

    /**
     * Returns queued messages up to `limit` and removes them from the queue.
     * Remaining messages are preserved for the next drain call.
     * @param {number} [limit=Infinity] - Maximum number of messages to return.
     * @returns {Object[]}
     */
    drainMessages(limit = Infinity) {
        if (this.messageQueue.length === 0) return [];
        if (limit <= 0) return [];
        if (this.messageQueue.length <= limit) {
            const msgs = this.messageQueue;
            this.messageQueue = [];
            return msgs;
        }

        if (Number.isFinite(limit) && this.messageQueue.length > limit) {
            const controlMessages = this.messageQueue.filter((message) =>
                !this._isStateMessage(message) && !this._isTransientMessage(message)
            );
            const stateMessages = this.messageQueue.filter((message) => this._isStateMessage(message));
            const transientMessages = this.messageQueue.filter((message) => this._isTransientMessage(message));

            // Reserve a slot for authoritative state whenever it is present.
            // Realtime visual effects must never prevent movement, health, or
            // inventory truth from reaching the game loop.
            const controlCapacity = Math.max(0, limit - (stateMessages.length > 0 ? 1 : 0));
            const selectedControl = controlMessages.slice(0, controlCapacity);
            let remainingCapacity = limit - selectedControl.length;
            const stateCapacity = stateMessages.length > 0
                ? Math.min(INCOMING_STATE_RETAIN_LIMIT, remainingCapacity)
                : 0;
            const compactedState = stateCapacity > 0
                ? this._compactStateMessages(stateMessages, stateCapacity)
                : [];
            remainingCapacity -= compactedState.length;
            const selectedTransient = remainingCapacity > 0
                ? transientMessages.slice(-remainingCapacity)
                : [];

            // State compaction represents every authoritative packet present,
            // and stale effects are intentionally superseded by the recent
            // tail. Only lossless controls need to remain for a later frame.
            this.messageQueue = controlMessages.slice(controlCapacity);
            return [...selectedControl, ...compactedState, ...selectedTransient];
        }
    }

    _compactStateMessages(messages, limit) {
        if (messages.length <= limit) return messages;

        // Preserve a short recent tail so animation transitions can still be
        // observed, and fold the stale prefix into one authoritative update.
        const tailLength = Math.min(8, Math.max(0, limit - 1));
        const splitIndex = messages.length - tailLength;
        const prefix = messages.slice(0, splitIndex);
        const tail = messages.slice(splitIndex);
        if (prefix.length === 0) return tail;

        let latestFull = -1;
        for (let index = 0; index < prefix.length; index += 1) {
            if (prefix[index].type === 'state') latestFull = index;
        }

        if (latestFull !== -1) {
            const payload = { ...(prefix[latestFull].payload || {}) };
            for (const message of prefix.slice(latestFull + 1)) {
                for (const [id, update] of Object.entries(message.payload?.u || {})) {
                    payload[id] = { ...(payload[id] || {}), ...update };
                }
                for (const id of message.payload?.r || []) delete payload[id];
            }
            return [{ type: 'state', payload }, ...tail];
        }

        const updates = {};
        const removed = new Set();
        for (const message of prefix) {
            for (const [id, update] of Object.entries(message.payload?.u || {})) {
                updates[id] = { ...(updates[id] || {}), ...update };
                removed.delete(id);
            }
            for (const id of message.payload?.r || []) {
                delete updates[id];
                removed.add(id);
            }
        }
        return [{ type: 'delta', payload: { u: updates, r: [...removed] } }, ...tail];
    }

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------

    destroy() {
        this.isExpectedDisconnect = true;
        clearTimeout(this._reconnectTimer);
        if (this.socket) {
            this.socket.onmessage = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
        }
    }
}
