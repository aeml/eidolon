import { jest } from '@jest/globals';
import { InputManager } from '../src/core/InputManager.js';

describe('mobile canvas pinch isolation', () => {
    let input, canvas, menu, zoom;
    beforeEach(() => {
        document.body.innerHTML = '<canvas id="world"></canvas><div id="quest-window"></div><canvas id="minimap-canvas"></canvas>';
        canvas = document.getElementById('world');
        menu = document.getElementById('quest-window');
        input = new InputManager(null, null, canvas);
        zoom = jest.fn();
        input.subscribe('onZoom', zoom);
        input.setupMobileControls();
    });
    afterEach(() => { input.dispose(); document.body.innerHTML = ''; });

    const finger = (identifier, clientX, target) => ({ identifier, clientX, clientY: 20, target });
    const pair = (distance, target) => [finger(1, 20, target), finger(2, 20 + distance, target)];
    function dispatch(type, touches, target = canvas) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: touches });
        Object.defineProperty(event, 'changedTouches', { value: touches });
        target.dispatchEvent(event);
        return event;
    }

    test('only a world-canvas pair zooms and consumes the native pinch gesture', () => {
        expect(dispatch('touchstart', pair(50, canvas)).defaultPrevented).toBe(true);
        expect(dispatch('touchmove', pair(80, canvas)).defaultPrevented).toBe(true);
        expect(zoom).toHaveBeenCalledTimes(1);
        expect(zoom.mock.calls[0][0]).toBeLessThan(0);
        dispatch('touchmove', pair(40, canvas));
        expect(zoom.mock.calls[1][0]).toBeGreaterThan(0);
    });

    test.each(['menu', 'minimap', 'mixed'])('%s touches neither zoom nor consume UI gestures', kind => {
        const target = kind === 'minimap' ? document.getElementById('minimap-canvas') : menu;
        const touches = distance => kind === 'mixed'
            ? [finger(1, 20, canvas), finger(2, 20 + distance, target)] : pair(distance, target);
        expect(dispatch('touchstart', touches(50), target).defaultPrevented).toBe(false);
        expect(dispatch('touchmove', touches(80), target).defaultPrevented).toBe(false);
        expect(zoom).not.toHaveBeenCalled();
    });

    test('zoom depends on finger distance, not the number of delivered move events', () => {
        const gesture = distances => {
            zoom.mockClear();
            dispatch('touchstart', pair(50, canvas));
            for (const distance of distances) dispatch('touchmove', pair(distance, canvas));
            dispatch('touchend', []);
            return zoom.mock.calls.reduce((sum, [delta]) => sum + delta, 0);
        };
        expect(gesture([100])).toBeCloseTo(gesture([60, 70, 80, 90, 100]), 8);
    });

    test.each(['cancel', 'blur', 'clear', 'third finger', 'replacement'])('%s invalidates the old pinch until a new touchstart', reason => {
        dispatch('touchstart', pair(50, canvas));
        if (reason === 'cancel') dispatch('touchcancel', pair(50, canvas));
        if (reason === 'blur') window.dispatchEvent(new Event('blur'));
        if (reason === 'clear') input.clearInputState();
        if (reason === 'third finger') dispatch('touchstart', [...pair(50, canvas), finger(3, 120, canvas)]);
        if (reason === 'replacement') dispatch('touchmove', [finger(1, 20, canvas), finger(3, 100, canvas)]);
        dispatch('touchmove', pair(80, canvas));
        expect(zoom).not.toHaveBeenCalled();
        dispatch('touchstart', pair(50, canvas));
        dispatch('touchmove', pair(80, canvas));
        expect(zoom).toHaveBeenCalledTimes(1);
    });

    test('reordering the same fingers is safe and repeated setup does not duplicate listeners', () => {
        input.setupMobileControls();
        dispatch('touchstart', pair(50, canvas));
        dispatch('touchmove', pair(80, canvas).reverse());
        expect(zoom).toHaveBeenCalledTimes(1);
    });
});
