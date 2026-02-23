// ============================================================================
// NetworkManager — owns WebSocket lifecycle, binary decode, message queue
// ============================================================================

import eidolonProto from '../proto/state_pb.js';

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
                if (typeof alert !== 'undefined') {
                    alert('Disconnected from server. Returning to menu.');
                }
                window.location.reload();
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    // ------------------------------------------------------------------
    // Queue drain (called once per game tick)
    // ------------------------------------------------------------------

    /**
     * Returns all queued messages and clears the queue.
     * @returns {Object[]}
     */
    drainMessages() {
        if (this.messageQueue.length === 0) return this.messageQueue;
        const msgs = this.messageQueue;
        this.messageQueue = [];
        return msgs;
    }

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------

    destroy() {
        this.isExpectedDisconnect = true;
        if (this.socket) {
            this.socket.onmessage = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
        }
    }
}
