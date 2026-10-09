import { jest } from '@jest/globals';
import { createRendererWithGraphicsError, gameStartupFailureMessage, GRAPHICS_UNAVAILABLE_MESSAGE } from '../src/core/GraphicsStartup.js';

test('successful renderer creation retains exact options without another context probe', () => {
    const options = { antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' };
    const renderer = {}, create = jest.fn(() => renderer), probe = jest.fn();
    expect(createRendererWithGraphicsError(options, create, probe)).toBe(renderer);
    expect(create).toHaveBeenCalledWith(options); expect(probe).not.toHaveBeenCalled();
});

test.each([false, true])('null or throwing context probe yields owned actionable message, throws=%s', throws => {
    const cause = new TypeError('error is not a function'), options = { antialias: false };
    const getContext = jest.fn(() => { if (throws) throw new Error('driver failure'); return null; });
    let error;
    try { createRendererWithGraphicsError(options, () => { throw cause; }, () => ({ getContext })); }
    catch (value) { error = value; }
    expect(error).toMatchObject({ name: 'GraphicsUnavailableError', code: 'WEBGL2_UNAVAILABLE', cause });
    expect(getContext).toHaveBeenCalledWith('webgl2', options);
    expect(gameStartupFailureMessage(error)).toBe(GRAPHICS_UNAVAILABLE_MESSAGE);
    expect(error.message).not.toContain('driver failure');
});

test.each([false, true])('other initialization errors retain their identity and release the probe, releaseThrows=%s', releaseThrows => {
    const cause = new Error('different constructor bug');
    const loseContext = jest.fn(() => { if (releaseThrows) throw new Error('release failed'); });
    const getExtension = jest.fn(() => ({ loseContext }));
    expect(() => createRendererWithGraphicsError({}, () => { throw cause; },
        () => ({ getContext: () => ({ getExtension }) }))).toThrow(cause);
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context'); expect(loseContext).toHaveBeenCalledTimes(1);
    expect(gameStartupFailureMessage(cause)).toBe('The game could not start. Please try again.');
});

test('unknown failures never show raw arbitrary text in the login UI', () => {
    for (const error of [null, 'unsafe text', { message: '<script>arbitrary text</script>' }]) {
        expect(gameStartupFailureMessage(error)).toBe('The game could not start. Please try again.');
    }
});
