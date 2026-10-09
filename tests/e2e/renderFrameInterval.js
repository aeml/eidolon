// Use the browser's reported decimal timestamps exactly. Ordinary binary
// subtraction can turn a33.4ms interval into33.400000000001455ms. This is
// neither duration rounding nor a budget tolerance:33.4001 still exceeds33.4.
export function renderFrameInterval(now, previous) {
    const values = [now, previous].map(String);
    if (values.some(value => !/^\d+(?:\.\d+)?$/.test(value))) return now - previous;
    const parts = values.map(value => value.split('.'));
    const places = Math.max(...parts.map(([, fraction = '']) => fraction.length));
    const integers = parts.map(([whole, fraction = '']) => BigInt(whole + fraction.padEnd(places, '0')));
    return Number(integers[0] - integers[1]) / 10 ** places;
}
