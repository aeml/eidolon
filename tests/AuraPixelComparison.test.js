import { compareAuraPixels } from './auraPixelComparison.js';
import { runInNewContext } from 'node:vm';

test('pixel comparison runs inside the browser without downloading test modules or transferring raw images', () => {
    const compare = runInNewContext(`(${compareAuraPixels.toString()})`);
    expect(compare([20, 30, 40, 255], [20, 30, 40, 255], [0, 0, 0, 255]).relativeError).toBe(0);
});

test('equal visible aura frames have zero error, ignoring opaque output alpha', () => {
    expect(compareAuraPixels([20, 30, 40, 0], [20, 30, 40, 255], [10, 10, 10, 255]))
        .toEqual({ referenceSignal: 60, absoluteDifference: 0, changedPixels: 0, relativeError: 0 });
});
test('losing all aura detail cannot pass just because most of the frame is scenery', () => {
    const baseline = new Uint8Array(4 * 1000), reference = baseline.slice();
    reference[400] = 100;
    expect(compareAuraPixels(baseline, reference, baseline).relativeError).toBe(1);
});
test('a blank reference is not visual evidence', () => {
    expect(compareAuraPixels([0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]).relativeError).toBe(Infinity);
});
test.each([[[], [], []], [[1], [1], [1]], [[0, 0, 0, 0], [], [0, 0, 0, 0]]])(
    'incompatible frame shapes fail', (a, b, c) => expect(() => compareAuraPixels(a, b, c)).toThrow('RGBA')
);
