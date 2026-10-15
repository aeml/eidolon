import { isMobileDevice, useMobileLayout } from '../src/core/InputLayout.js';

test.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5, true],
    ['Mozilla/5.0 (Linux; Android 15)', 'Linux', 5, true],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 5, true],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 0, false],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 10, false]
])('wide device input layout: %s', (userAgent, platform, maxTouchPoints, expected) => {
    const device = { userAgent, platform, maxTouchPoints };
    expect(isMobileDevice(device)).toBe(expected);
    expect(useMobileLayout(1280, device)).toBe(expected);
    expect(useMobileLayout(390, device)).toBe(true);
});

test('desktop viewport policy responds in both directions and at the existing 800px boundary', () => {
    expect([1280, 390, 800, 801, 1280].map(width => useMobileLayout(width, {}))).toEqual([false, true, true, false, false]);
});
