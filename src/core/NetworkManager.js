// ============================================================================
// NetworkManager — owns WebSocket lifecycle, binary decode, message queue
// ============================================================================

import { eidolon as eidolonProto } from '../proto/state_pb.js';

export class NetworkManager {
    /**
     * @param {WebSocket} socket  — an already-authenticated WebSocket
     */
    constructor(socket) {
        this.socket = socket;

        /** @type {Object[]} Queued incoming messages (drained each tick) */
        this.messageQueue = [];

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
        this.socket.onmessage = (event) => {
            try {
                let data = event.data;

                // --- Binary (protobuf) path ---
                if (data instanceof Blob) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const compressed = new Uint8Array(reader.result);

                            // EDPB + version byte + protobuf payload
                            if (
                                compressed.length > 5 &&
                                compressed[0] === 0x45 &&
                                compressed[1] === 0x44 &&
                                compressed[2] === 0x50 &&
                                compressed[3] === 0x42
                            ) {
                                const wireVersion = compressed[4];
                                if (wireVersion !== 1) {
                                    console.warn('Unsupported state proto wire version:', wireVersion);
                                    return;
                                }

                                const payloadBytes = compressed.subarray(5);
                                const env = eidolonProto.state.StateEnvelope.decode(payloadBytes);

                                if (env.full) {
                                    const entities = env.full.entities || [];
                                    const payload = {};
                                    for (const e of entities) payload[e.id] = e;
                                    this.messageQueue.push({ type: 'state', payload });
                                    return;
                                }

                                if (env.delta) {
                                    const entities = env.delta.entities || [];
                                    const u = {};
                                    for (const e of entities) u[e.id] = e;
                                    const r = env.delta.removedIds || [];
                                    this.messageQueue.push({ type: 'delta', payload: { u, r } });
                                    return;
                                }

                                return;
                            }

                            console.warn('Unknown binary payload; ignoring (expected EDPB protobuf)');
                        } catch (e) {
                            console.error('Decompression error:', e);
                        }
                    };
                    reader.readAsArrayBuffer(data);
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
                    this.messageQueue.push(msg);
                } else if (msg.type === 'error' && this._reconnecting) {
                    // Server rejected the resume token.
                    this._reconnecting = false;
                    if (this.onConnectionStateChange) this.onConnectionStateChange('lost');
                    if (this.onReconnectFailed) this.onReconnectFailed();
                } else {
                    this.messageQueue.push(msg);
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
        if (this.messageQueue.length <= limit) {
            const msgs = this.messageQueue;
            this.messageQueue = [];
            return msgs;
        }
        // Take only `limit` messages; keep the rest for next frame
        return this.messageQueue.splice(0, limit);
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
