import { jest } from '@jest/globals';
import * as THREE from 'three';
import { InputManager } from '../src/core/InputManager.js';
import { TouchAbilityAim } from '../src/core/TouchAbilityAim.js';
import { AbilityController } from '../src/core/AbilityController.js';

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
        document.body.innerHTML = '<canvas></canvas><button id="btn-mobile-ability"></button><div class="hotbar-slot"></div>';
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

    test.each(['clear', 'death', 'menu', 'reassign'])('%s cancels an active aim', reason => {
        touch('touchstart', finger(), button);
        touch('touchmove', finger(180));
        if (reason === 'clear') input.clearInputState();
        if (reason === 'death') engine.player.state = 'DEAD';
        if (reason === 'menu') engine.uiManager.isEscMenuOpen = true;
        if (reason === 'reassign') engine.player.abilityName = 'Ice Lance';
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
