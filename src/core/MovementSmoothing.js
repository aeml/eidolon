import * as THREE from 'three';

export const MOVEMENT_ARRIVAL_DISTANCE = 0.1;
export const MOVEMENT_TARGET_EQUIVALENCE_DISTANCE = 0.025;
export const LOCAL_SERVER_ADJUSTMENT_TOLERANCE = 0.04;
export const REMOTE_INTERPOLATION_DELAY_SECONDS = 0.1;
export const REMOTE_MAX_EXTRAPOLATION_SECONDS = 0.08;
export const REMOTE_TELEPORT_DISTANCE = 10;
export const REMOTE_TRANSFORM_BUFFER_LIMIT = 32;

const TWO_PI = Math.PI * 2;

export function horizontalDistanceSquared(a, b) {
    if (!a || !b) return Infinity;
    const dx = Number(a.x) - Number(b.x);
    const dz = Number(a.z) - Number(b.z);
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return Infinity;
    return dx * dx + dz * dz;
}

export function horizontalDistance(a, b) {
    return Math.sqrt(horizontalDistanceSquared(a, b));
}

export function isFiniteTransformPosition(position) {
    return Boolean(position) &&
        Number.isFinite(Number(position.x)) &&
        Number.isFinite(Number(position.y)) &&
        Number.isFinite(Number(position.z));
}

export function exponentialSmoothingFactor(rate, dt) {
    const safeRate = Math.max(0, Number(rate) || 0);
    const safeDt = Math.max(0, Math.min(0.25, Number(dt) || 0));
    return 1 - Math.exp(-safeRate * safeDt);
}

export function shortestAngleDelta(from, to) {
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
    let delta = (to - from) % TWO_PI;
    if (delta > Math.PI) delta -= TWO_PI;
    if (delta < -Math.PI) delta += TWO_PI;
    return delta;
}

export function interpolateAngle(from, to, alpha) {
    const clampedAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    return from + shortestAngleDelta(from, to) * clampedAlpha;
}

function monotonicNowSeconds() {
    return (globalThis.performance?.now?.() ?? Date.now()) / 1000;
}

/**
 * Small timestamped transform timeline for remote actors.
 *
 * Server timestamps preserve the intended 30 Hz spacing when packet arrival is
 * uneven. The first sample establishes a local monotonic-clock offset, so wall
 * clock differences between browser and server never affect playback.
 */
export class RemoteTransformBuffer {
    constructor(options = {}) {
        this.delay = options.delay ?? REMOTE_INTERPOLATION_DELAY_SECONDS;
        this.maxExtrapolation = options.maxExtrapolation ?? REMOTE_MAX_EXTRAPOLATION_SECONDS;
        this.teleportDistance = options.teleportDistance ?? REMOTE_TELEPORT_DISTANCE;
        this.limit = options.limit ?? REMOTE_TRANSFORM_BUFFER_LIMIT;
        this.samples = [];
        this.serverClockOffset = null;
        this.lastServerTimeSeconds = null;
        this.metrics = {
            accepted: 0,
            stale: 0,
            teleports: 0,
            interpolated: 0,
            extrapolated: 0,
            underruns: 0
        };
    }

    clear() {
        this.samples.length = 0;
        this.serverClockOffset = null;
        this.lastServerTimeSeconds = null;
    }

    resolveLocalSampleTime(serverTimeMs, receiptTimeSeconds) {
        const serverSeconds = Number(serverTimeMs) / 1000;
        if (!Number.isFinite(serverSeconds) || serverSeconds <= 0) {
            return receiptTimeSeconds;
        }

        if (this.serverClockOffset === null) {
            this.serverClockOffset = receiptTimeSeconds - serverSeconds;
        }
        this.lastServerTimeSeconds = serverSeconds;
        return serverSeconds + this.serverClockOffset;
    }

    push(position, rotation, options = {}) {
        if (!isFiniteTransformPosition(position)) return { accepted: false, reason: 'non-finite' };

        const receiptTime = Number.isFinite(options.receiptTimeSeconds)
            ? options.receiptTimeSeconds
            : monotonicNowSeconds();
        let sampleTime = this.resolveLocalSampleTime(options.serverTimeMs, receiptTime);
        const last = this.samples[this.samples.length - 1];
        const serverTimeSeconds = Number(options.serverTimeMs) / 1000;

        if (last && Number.isFinite(serverTimeSeconds) && Number.isFinite(last.serverTimeSeconds)) {
            if (serverTimeSeconds < last.serverTimeSeconds) {
                this.metrics.stale += 1;
                return { accepted: false, reason: 'stale' };
            }
            if (serverTimeSeconds === last.serverTimeSeconds) {
                last.position.copy(position);
                if (Number.isFinite(rotation)) last.rotation = rotation;
                last.state = options.state || last.state;
                return { accepted: true, replaced: true, teleported: false };
            }
        }

        if (last && sampleTime <= last.time) {
            sampleTime = last.time + 0.000001;
        }

        const teleported = Boolean(last) && horizontalDistance(last.position, position) > this.teleportDistance;
        if (teleported) {
            this.samples.length = 0;
            this.metrics.teleports += 1;
        }

        this.samples.push({
            time: sampleTime,
            serverTimeSeconds: Number.isFinite(serverTimeSeconds) ? serverTimeSeconds : null,
            position: position.clone(),
            rotation: Number.isFinite(rotation) ? rotation : (last?.rotation ?? 0),
            state: options.state || ''
        });
        if (this.samples.length > this.limit) {
            this.samples.splice(0, this.samples.length - this.limit);
        }
        this.metrics.accepted += 1;
        return { accepted: true, teleported };
    }

    sample(options = {}) {
        if (this.samples.length === 0) return null;
        const now = Number.isFinite(options.nowSeconds) ? options.nowSeconds : monotonicNowSeconds();
        const renderTime = now - this.delay;

        while (this.samples.length > 2 && this.samples[1].time <= renderTime) {
            this.samples.shift();
        }

        const first = this.samples[0];
        const second = this.samples[1];
        if (!second || renderTime <= first.time) {
            if (!second && renderTime > first.time) this.metrics.underruns += 1;
            return {
                position: first.position.clone(),
                rotation: first.rotation,
                state: first.state,
                mode: second ? 'buffering' : 'hold',
                alpha: 0
            };
        }

        if (renderTime <= second.time) {
            const duration = Math.max(0.000001, second.time - first.time);
            const alpha = Math.max(0, Math.min(1, (renderTime - first.time) / duration));
            this.metrics.interpolated += 1;
            return {
                position: first.position.clone().lerp(second.position, alpha),
                rotation: interpolateAngle(first.rotation, second.rotation, alpha),
                state: alpha < 0.5 ? first.state : second.state,
                mode: 'interpolate',
                alpha
            };
        }

        const overrun = renderTime - second.time;
        const canExtrapolate = overrun <= this.maxExtrapolation && second.state === 'MOVING';
        if (!canExtrapolate) {
            this.metrics.underruns += 1;
            return {
                position: second.position.clone(),
                rotation: second.rotation,
                state: second.state,
                mode: 'hold',
                alpha: 1
            };
        }

        const duration = Math.max(0.000001, second.time - first.time);
        const extrapolation = Math.max(0, Math.min(this.maxExtrapolation, overrun));
        const velocity = second.position.clone().sub(first.position).multiplyScalar(1 / duration);
        const position = second.position.clone().addScaledVector(velocity, extrapolation);
        const angularVelocity = shortestAngleDelta(first.rotation, second.rotation) / duration;
        this.metrics.extrapolated += 1;
        return {
            position,
            rotation: second.rotation + angularVelocity * extrapolation,
            state: second.state,
            mode: 'extrapolate',
            alpha: 1 + extrapolation / duration
        };
    }

    getMetrics() {
        return {
            ...this.metrics,
            samples: this.samples.length,
            delay: this.delay,
            maxExtrapolation: this.maxExtrapolation
        };
    }
}
