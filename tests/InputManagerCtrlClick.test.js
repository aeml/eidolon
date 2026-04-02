import { jest } from '@jest/globals';
import * as THREE from 'three';
import { InputManager } from '../src/core/InputManager.js';

describe('InputManager ctrl-click propagation', () => {
    let addEventListenerSpy;
    let removeEventListenerSpy;

    beforeEach(() => {
        addEventListenerSpy = jest.spyOn(window, 'addEventListener');
        removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    test('left click forwards the original mouse event to onClick subscribers', () => {
        const manager = new InputManager({}, {});
        const callback = jest.fn();
        manager.subscribe('onClick', callback);

        manager.onMouseDown({
            target: { tagName: 'CANVAS' },
            button: 0,
            ctrlKey: true,
            clientX: 100,
            clientY: 80
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0][0]).toEqual(expect.objectContaining({
            ctrlKey: true,
            button: 0
        }));
        manager.dispose();
    });

    test('right click forwards the original mouse event to onRightClick subscribers', () => {
        const manager = new InputManager(new THREE.PerspectiveCamera(), {});
        const callback = jest.fn();
        manager.subscribe('onRightClick', callback);

        manager.onMouseDown({
            target: { tagName: 'CANVAS' },
            button: 2,
            ctrlKey: false
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0][0]).toEqual(expect.objectContaining({
            button: 2
        }));
        manager.dispose();
    });

    test('ground intersection can be resolved directly from click coordinates without a prior mousemove', () => {
        const manager = new InputManager(new THREE.PerspectiveCamera(), {});
        manager.mouse.set(-0.9, -0.9);
        manager.raycaster.setFromCamera = jest.fn();
        manager.raycaster.ray.intersectPlane = jest.fn((plane, target) => {
            target.set(5, 0, 7);
            return target;
        });

        const point = manager.getGroundIntersectionFromEvent({
            clientX: window.innerWidth * 0.75,
            clientY: window.innerHeight * 0.25
        });

        expect(manager.raycaster.setFromCamera).toHaveBeenCalledWith(
            expect.objectContaining({ x: 0.5, y: 0.5 }),
            manager.camera
        );
        expect(point).toEqual(expect.objectContaining({ x: 5, y: 0, z: 7 }));
        manager.dispose();
    });

    test('F2 forwards dungeon debug overlay toggles to subscribers', () => {
        const manager = new InputManager({}, {});
        const callback = jest.fn();
        manager.subscribe('onDebugOverlay', callback);

        manager.onKeyDown({ key: 'F2', code: 'F2' });

        expect(callback).toHaveBeenCalledTimes(1);
        manager.dispose();
    });
});
