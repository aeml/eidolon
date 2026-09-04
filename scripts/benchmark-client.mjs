import { performance } from 'node:perf_hooks';
import {
    horizontalDistance,
    shortestAngleDelta
} from '../src/core/MovementSmoothing.js';

const iterations = 1_000_000;
let checksum = 0;
const startedAt = performance.now();
for (let index = 0; index < iterations; index += 1) {
    const phase = index % 360;
    checksum += horizontalDistance(
        { x: phase, z: phase * 0.5 },
        { x: phase + 3, z: phase - 4 }
    );
    checksum += shortestAngleDelta(phase / 10, (phase + 180) / 10);
}
const elapsedMs = performance.now() - startedAt;

if (!Number.isFinite(checksum) || elapsedMs > 5_000) {
    throw new Error(`client hot-path benchmark failed: ${elapsedMs.toFixed(2)}ms checksum=${checksum}`);
}
console.log(JSON.stringify({ benchmark: 'movement-hot-path', iterations, elapsedMs, checksum }));
