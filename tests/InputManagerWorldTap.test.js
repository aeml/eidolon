import { jest } from '@jest/globals';
import { InputManager } from '../src/core/InputManager.js';

describe('deliberate canvas taps', () => {
    let input, canvas, menu, click;
    const finger = (identifier, target, clientX = 100) => ({ identifier, target, clientX, clientY: 100 });
    function touch(type, touches, changedTouches, target = canvas) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } });
        target.dispatchEvent(event);
        return event;
    }
    beforeEach(() => {
        document.body.innerHTML = '<canvas></canvas><button></button>';
        canvas = document.querySelector('canvas');
        menu = document.querySelector('button');
        input = new InputManager(null, null, canvas);
        click = jest.fn();
        input.subscribe('onClick', click);
        input.setupMobileControls();
    });
    afterEach(() => input.dispose());

    test('selects once on release, consumes the synthetic mouse event and updates raycast coordinates', () => {
        const point = finger(1, canvas);
        expect(touch('touchstart', [point], [point]).defaultPrevented).toBe(true);
        expect(click).not.toHaveBeenCalled();
        touch('touchend', [], [point]);
        expect(click).toHaveBeenCalledTimes(1);
        expect(click).toHaveBeenCalledWith(expect.objectContaining({ clientX: 100, clientY: 100 }));
        expect(input.mouse.x).toBeCloseTo(100 / innerWidth * 2 - 1);
        expect(input.primaryMouseButtonDown).toBe(false);
    });

    test.each(['drag', 'pinch', 'cancel', 'blur', 'reset'])('%s cannot become an attack or selection on release', reason => {
        const point = finger(1, canvas);
        touch('touchstart', [point], [point]);
        if (reason === 'drag') touch('touchmove', [finger(1, canvas, 130)], [finger(1, canvas, 130)]);
        if (reason === 'pinch') touch('touchstart', [point, finger(2, canvas, 150)], [finger(2, canvas, 150)]);
        if (reason === 'cancel') touch('touchcancel', [], [point]);
        if (reason === 'blur') window.dispatchEvent(new Event('blur'));
        if (reason === 'reset') input.clearInputState();
        touch('touchend', [], [point]);
        expect(click).not.toHaveBeenCalled();
    });

    test('a world tap can coexist with a held joystick finger but never originates in a menu', () => {
        const control = finger(2, menu);
        const world = finger(1, canvas);
        touch('touchstart', [control], [control], menu);
        touch('touchstart', [control, world], [world]);
        touch('touchend', [control], [world]);
        expect(click).toHaveBeenCalledTimes(1);
        touch('touchend', [], [control], menu);
        expect(click).toHaveBeenCalledTimes(1);
    });
});
