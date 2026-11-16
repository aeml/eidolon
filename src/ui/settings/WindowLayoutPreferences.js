import { readPreference, writePreference } from './PreferenceStorage.js';

const KEY = 'eidolon.windowLayout.v1';
const validPoint = point => point && Number.isFinite(point.left) && Number.isFinite(point.top)
    && point.left >= 0 && point.top >= 0 && point.left <= 100000 && point.top <= 100000;

// Device-local presentation only. Never persist player or inventory state.
export class WindowLayoutPreferences {
    constructor() {
        this.positions = { wide: {}, compact: {} };
        try {
            const saved = JSON.parse(readPreference(KEY));
            if (saved?.version !== 1) return;
            for (const profile of ['wide', 'compact']) {
                for (const [id, point] of Object.entries(saved[profile] || {}).slice(0, 40)) {
                    if (/^[a-z][a-zA-Z0-9-]{0,63}$/.test(id) && !['constructor', 'prototype'].includes(id) && validPoint(point)) {
                        this.positions[profile][id] = { left: point.left, top: point.top };
                    }
                }
            }
        } catch { /* Unavailable or malformed preferences keep default placement. */ }
    }

    get(id, profile) {
        const positions = this.positions[profile];
        return positions && Object.hasOwn(positions, id) ? positions[id] : undefined;
    }

    remember(id, profile, point) {
        if (!id || !this.positions[profile] || !validPoint(point)) return;
        this.positions[profile][id] = { left: Math.round(point.left), top: Math.round(point.top) };
        this.save();
    }

    reset() {
        this.positions = { wide: {}, compact: {} };
        this.save();
    }

    save() { return writePreference(KEY, JSON.stringify({ version: 1, ...this.positions })); }
}
