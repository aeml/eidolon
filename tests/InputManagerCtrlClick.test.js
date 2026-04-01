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
});
