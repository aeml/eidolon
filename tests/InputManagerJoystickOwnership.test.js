import { jest } from '@jest/globals';
import { InputManager } from '../src/core/InputManager.js';

describe('manual joystick ownership', () => {
    let input, zone, knob, manual;
    const finger = (identifier, clientX = 74) => ({ identifier, clientX, clientY: 50 });
    function touch(type, changedTouches) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
            touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : changedTouches.map(point => ({ ...point, target: zone })) },
            changedTouches: { value: changedTouches }
        });
        zone.dispatchEvent(event);
    }
    beforeEach(() => {
        document.body.innerHTML = '<div id="joystick-zone"><div id="joystick-knob"></div></div>';
        zone = document.getElementById('joystick-zone');
        knob = document.getElementById('joystick-knob');
        zone.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
        input = new InputManager(null, null);
        manual = jest.fn();
        input.subscribe('onManualMovement', manual);
        input.setupMobileControls();
    });
    afterEach(() => input.dispose());

    test('only crossing the dead zone begins a new manual movement intent', () => {
        touch('touchstart', [finger(1, 50)]);
        expect(manual).not.toHaveBeenCalled();
        touch('touchmove', [finger(1)]);
        expect(manual).toHaveBeenCalledTimes(1);
        touch('touchmove', [finger(1, 80)]);
        expect(manual).toHaveBeenCalledTimes(1);
        touch('touchmove', [finger(1, 50)]);
        touch('touchmove', [finger(1)]);
        expect(manual).toHaveBeenCalledTimes(2);
    });

    test('a second finger cannot steal or release the active joystick', () => {
        touch('touchstart', [finger(1)]);
        const vector = input.joystickVector.clone();
        touch('touchstart', [finger(2, 20)]);
        expect(input.joystickVector.equals(vector)).toBe(true);
        touch('touchend', [finger(2)]);
        expect(input.joystickVector.equals(vector)).toBe(true);
        touch('touchend', [finger(1)]);
        expect(input.joystickVector.lengthSq()).toBe(0);
    });

    test.each(['blur', 'reset', 'cancel'])('%s resets the knob and rejects the stale finger until a fresh gesture', kind => {
        touch('touchstart', [finger(1)]);
        if (kind === 'blur') window.dispatchEvent(new Event('blur'));
        if (kind === 'reset') input.clearInputState();
        if (kind === 'cancel') touch('touchcancel', [finger(1)]);
        expect(input.joystickVector.lengthSq()).toBe(0);
        expect(knob.style.transform).toBe('translate(-50%, -50%)');
        touch('touchmove', [finger(1)]);
        expect(input.joystickVector.lengthSq()).toBe(0);
        touch('touchstart', [finger(2)]);
        expect(input.joystickVector.lengthSq()).toBeGreaterThan(0);
    });
});
