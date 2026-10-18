import { jest } from '@jest/globals';
import { InputManager } from '../src/core/InputManager.js';

let input, canvas, callbacks;
function enabled(value) {
    // The baseline manager ignored this loading-state flag. Keep that direct
    // contrast executable without substituting any input handler.
    input.setInputEnabled?.(value);
    input.inputEnabled = value;
}
const key = (type, value, options = {}) => window.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true, ...options }));
function touch(target, type, points) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const list = points.map(point => ({ target, clientY: 50, ...point }));
    Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : list }, changedTouches: { value: list } });
    target.dispatchEvent(event);
}
beforeEach(() => {
    document.body.innerHTML = '<canvas></canvas><div id="joystick-zone"><div id="joystick-knob"></div></div>' +
        '<button id="btn-mobile-attack"></button><button id="btn-mobile-ability"></button><button id="btn-mobile-interact"></button>';
    canvas = document.querySelector('canvas'); input = new InputManager(null, null, canvas);
    callbacks = Object.fromEntries(['onTeleport', 'onSpace', 'onHotbar', 'onDebugOverlay', 'onChat', 'onEscape',
        'onClick', 'onRightClick', 'onZoom', 'onManualMovement', 'onInteract'].map(name => [name, jest.fn()]));
    for (const [name, callback] of Object.entries(callbacks)) input.subscribe(name, callback);
});
afterEach(() => input.dispose());

test('loading-time keyboard input cannot recall, cast, open chat or move the camera', () => {
    enabled(false);
    for (const value of ['b', ' ', '1', 'Enter', 'Escape', 'w', 'Control', 'Shift']) key('keydown', value);
    key('keydown', 'F2', { code: 'F2' });
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    expect(Object.values(input.keys).some(Boolean)).toBe(false);
    expect(input.getMovementDirection().lengthSq()).toBe(0);
});

test('loading-time pointer input cannot start a move, attack, ability or zoom', () => {
    enabled(false);
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 40, clientY: 50 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2, clientX: 40, clientY: 50 }));
    canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }));
    expect(callbacks.onClick).not.toHaveBeenCalled(); expect(callbacks.onRightClick).not.toHaveBeenCalled();
    expect(callbacks.onZoom).not.toHaveBeenCalled(); expect(input.primaryMouseButtonDown).toBe(false);
});

test('a key held during loading needs release before its repeats can move or trigger actions', () => {
    enabled(false); key('keydown', 'w'); expect(input.keys.w).toBe(false);
    enabled(true); key('keydown', 'w', { repeat: true }); expect(input.keys.w).toBe(false);
    key('keyup', 'w'); key('keydown', 'w'); expect(input.keys.w).toBe(true);
    enabled(false); key('keydown', 'b'); enabled(true);
    key('keydown', 'b', { repeat: true }); expect(callbacks.onTeleport).not.toHaveBeenCalled();
    key('keyup', 'b'); key('keydown', 'b'); expect(callbacks.onTeleport).toHaveBeenCalledTimes(1);
});

test('loading-time phone buttons cannot attack, cast or interact', () => {
    input.setupMobileControls(); enabled(false);
    for (const id of ['btn-mobile-attack', 'btn-mobile-ability', 'btn-mobile-interact']) {
        const button = document.getElementById(id);
        button.click(); touch(button, 'touchstart', [{ identifier: 1, clientX: 40 }]);
    }
    expect(callbacks.onClick).not.toHaveBeenCalled(); expect(callbacks.onRightClick).not.toHaveBeenCalled();
    expect(callbacks.onInteract).not.toHaveBeenCalled();
});

test('a fresh canvas tap while loading cannot become a queued click on release', () => {
    input.setupMobileControls(); enabled(false);
    touch(canvas, 'touchstart', [{ identifier: 1, clientX: 40 }]);
    touch(canvas, 'touchend', [{ identifier: 1, clientX: 40 }]);
    expect(callbacks.onClick).not.toHaveBeenCalled(); expect(input.worldTapState).toBeNull();
});

test('loading-time joystick gestures cannot create movement or manual-movement callbacks', () => {
    const zone = document.getElementById('joystick-zone');
    zone.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    input.setupMobileControls(); enabled(false);
    touch(zone, 'touchstart', [{ identifier: 1, clientX: 80 }]);
    expect(input.joystickVector.lengthSq()).toBe(0); expect(callbacks.onManualMovement).not.toHaveBeenCalled();
});

test('suspension flushes active gestures and enabling does not replay them', () => {
    input.primaryMouseButtonDown = true; input.keys.w = true; input.joystickVector.set(1, 0);
    input.worldTapState = { id: 1 }; input.pinchState = { ids: [1, 2] };
    expect(typeof input.setInputEnabled).toBe('function');
    input.setInputEnabled(false);
    expect(input.getMovementDirection().lengthSq()).toBe(0); expect(input.primaryMouseButtonDown).toBe(false);
    expect(input.worldTapState).toBeNull(); expect(input.pinchState).toBeNull();
    input.setInputEnabled(true); expect(input.getMovementDirection().lengthSq()).toBe(0);
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 40, clientY: 50 }));
    expect(callbacks.onClick).toHaveBeenCalledTimes(1);
});
