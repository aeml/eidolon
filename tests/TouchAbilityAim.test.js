import { jest } from '@jest/globals';
import * as THREE from 'three';
import { InputManager } from '../src/core/InputManager.js';
import { TouchAbilityAim } from '../src/core/TouchAbilityAim.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

describe('phone skill drag aiming', () => {
    let input, aim, engine, button;
    const finger = (x = 100, y = 200, id = 7) => ({ clientX: x, clientY: y, identifier: id });
    function touch(type, point, target = window) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
            changedTouches: { value: [point] },
            touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : [point] }
        });
        target.dispatchEvent(event);
    }
    beforeEach(() => {
        document.body.innerHTML = '<canvas></canvas><div id="joystick-zone"><div id="joystick-knob"></div></div><button id="btn-mobile-ability"></button><div class="hotbar-slot"></div>';
        document.getElementById('joystick-zone').getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
        const camera = new THREE.PerspectiveCamera();
        camera.position.set(0, 10, 10); camera.lookAt(0, 0, 0);
        const scene = new THREE.Scene();
        input = new InputManager(camera, scene, document.querySelector('canvas'));
        input.setupMobileControls();
        engine = {
            inputManager: input, renderSystem: { camera, scene },
            player: { position: new THREE.Vector3(2, 40, 3), abilityName: 'Fireball', hotbar: ['Healing Light'], state: 'IDLE' },
            uiManager: {}, cancelMobilePursuit: jest.fn(),
            abilityController: {
                performAbility: jest.fn(), performHotbarAbility: jest.fn(),
                getAbilityCastRange: () => 12,
                isSelfCast: AbilityController.prototype.isSelfCast,
                canGroundAim: AbilityController.prototype.canGroundAim
            }
        };
        button = document.getElementById('btn-mobile-ability');
        aim = new TouchAbilityAim(engine);
    });
    afterEach(() => input.dispose());

    test('tap casts exactly once on release, never on press or compatibility click', () => {
        const legacy = jest.fn();
        input.subscribe('onRightClick', legacy);
        touch('touchstart', finger(), button);
        expect(engine.abilityController.performAbility).not.toHaveBeenCalled();
        touch('touchend', finger());
        button.click();
        expect(engine.abilityController.performAbility).toHaveBeenCalledTimes(1);
        expect(engine.abilityController.performAbility).toHaveBeenCalledWith();
        expect(legacy).not.toHaveBeenCalled();
    });

    test('drag previews and clamps range at realm elevation, then casts the preview once', () => {
        touch('touchstart', finger(), button);
        touch('touchmove', finger(260));
        expect(aim.preview.visible).toBe(true);
        expect(aim.hint.textContent).toContain('Max range');
        expect(aim.gesture.target.distanceTo(engine.player.position)).toBeCloseTo(12);
        expect(aim.gesture.target.y).toBe(40);
        const target = aim.gesture.target.clone();
        touch('touchend', finger(260));
        expect(engine.abilityController.performAbility).toHaveBeenCalledWith(target, 'Fireball');
        expect(aim.preview.visible).toBe(false);
    });

    test('slide back to the original button cancels without a cast', () => {
        touch('touchstart', finger(), button);
        touch('touchmove', finger(160));
        touch('touchmove', finger());
        expect(aim.hint.textContent).toBe('Release to cancel');
        touch('touchend', finger());
        expect(engine.abilityController.performAbility).not.toHaveBeenCalled();
    });

    test('elevated drag keeps horizontal range and grounds destination and preview vertices', () => {
        engine.terrainElevation = field;
        engine.player.position.set(-570, field.sample(-570, 410), 410);
        touch('touchstart', finger(), button);
        touch('touchmove', finger(260));
        const target = aim.gesture.target.clone();
        expect(Math.hypot(target.x - engine.player.position.x, target.z - engine.player.position.z)).toBeCloseTo(12, 9);
        expect(target.y).toBe(field.sample(target.x, target.z));
        expect(Math.abs(target.y - engine.player.position.y)).toBeGreaterThan(.1);
        aim.preview.updateMatrixWorld(true);
        for (const line of [aim.rangeRing, aim.endpoint, aim.aimLine]) {
            const vertices = line.geometry.attributes.position;
            for (let i = 0; i < vertices.count; i++) {
                const point = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(line.matrixWorld);
                expect(point.y - field.sample(point.x, point.z)).toBeCloseTo(.12, 5);
            }
        }
        touch('touchend', finger(260));
        expect(engine.abilityController.performAbility).toHaveBeenCalledWith(target, 'Fireball');
        // The same cached preview must return to a flat instance floor.
        engine.currentInstanceId = 'lanternhold-casino';
        engine.player.position.y = 8;
        touch('touchstart', finger(), button); touch('touchmove', finger(260));
        expect(aim.gesture.target.y).toBe(8);
        for (const line of [aim.rangeRing, aim.endpoint, aim.aimLine]) {
            const vertices = line.geometry.attributes.position;
            for (let i = 0; i < vertices.count; i++) expect(vertices.getY(i)).toBe(0);
        }
    });

    test('another finger cannot commit or move the skill aim', () => {
        touch('touchstart', finger(), button);
        touch('touchmove', finger(180));
        touch('touchend', finger(300, 200, 8));
        expect(engine.abilityController.performAbility).not.toHaveBeenCalled();
        expect(aim.gesture.target.x).toBeCloseTo(14);
        touch('touchcancel', finger(180));
        button.click();
        expect(engine.abilityController.performAbility).not.toHaveBeenCalled();
    });

    test.each([['touchend', true], ['touchcancel', true], ['touchcancel', false]])('a shared two-thumb %s (cancelable=%s) releases the stick as well as the skill', (type, cancelable) => {
        const zone = document.getElementById('joystick-zone');
        const movement = finger(80, 50, 1), skill = finger(180, 200, 7);
        touch('touchstart', movement, zone);
        touch('touchstart', finger(), button);
        expect(input.joystickVector.lengthSq()).toBeGreaterThan(0);
        const event = new Event(type, { bubbles: true, cancelable });
        const prevent = jest.spyOn(event, 'preventDefault');
        Object.defineProperties(event, {
            changedTouches: { value: [movement, skill] }, touches: { value: [] }
        });
        zone.dispatchEvent(event);
        expect(input.joystickVector.lengthSq()).toBe(0);
        expect(aim.gesture).toBeNull();
        if (!cancelable) expect(prevent).not.toHaveBeenCalled();
        expect(engine.abilityController.performAbility).toHaveBeenCalledTimes(type === 'touchend' ? 1 : 0);
        button.click();
        expect(engine.abilityController.performAbility).toHaveBeenCalledTimes(type === 'touchend' ? 1 : 0);
    });

    test.each(['clear', 'death', 'menu', 'reassign', 'panel', 'offline', 'resuming', 'typing'])('%s cancels an active aim', reason => {
        touch('touchstart', finger(), button);
        touch('touchmove', finger(180));
        if (reason === 'clear') input.clearInputState();
        if (reason === 'death') engine.player.state = 'DEAD';
        if (reason === 'menu') engine.uiManager.isEscMenuOpen = true;
        if (reason === 'reassign') engine.player.abilityName = 'Ice Lance';
        if (reason === 'panel') engine.uiManager.getOpenWindowIds = () => ['inventory'];
        if (reason === 'offline' || reason === 'resuming') {
            engine.isMultiplayer = true;
            engine.network = { socket: { readyState: reason === 'offline' ? 3 : 1 }, _reconnecting: reason === 'resuming' };
        }
        if (reason === 'typing') {
            const field = document.createElement('input'); document.body.append(field); field.focus();
        }
        aim.update();
        touch('touchend', finger(180));
        expect(aim.gesture).toBeNull();
        expect(aim.preview.visible).toBe(false);
        expect(engine.abilityController.performAbility).not.toHaveBeenCalled();
    });

    test('support hotbar taps retain ally selection; dragging cancels rather than ground-casting', () => {
        const slot = document.querySelector('.hotbar-slot');
        touch('touchstart', finger(), slot);
        touch('touchend', finger());
        expect(engine.abilityController.performHotbarAbility).toHaveBeenCalledWith(0);
        touch('touchstart', finger(), slot);
        touch('touchmove', finger(180));
        touch('touchend', finger(180));
        expect(engine.abilityController.performHotbarAbility).toHaveBeenCalledTimes(1);
        expect(engine.abilityController.performAbility).not.toHaveBeenCalled();
        expect(engine.abilityController.canGroundAim('Spirit Guardians')).toBe(false);
        for (const skill of ['Whirlwind', 'Guardian Roar', 'Smoke Bomb', 'Time Warp', 'Purifying Wave']) {
            expect(engine.abilityController.canGroundAim(skill)).toBe(false);
        }
        expect(engine.abilityController.canGroundAim('Juggernaut Charge')).toBe(true);
        engine.abilityController.getAbilityCastRange = () => 0;
        expect(engine.abilityController.canGroundAim('Iron Fortress')).toBe(false);
    });
});
