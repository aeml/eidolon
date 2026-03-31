import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Wizard } from '../src/entities/Wizard.js';
import { resolveRemoteSkillVisual } from '../src/skills/skillVisuals.js';

describe('skill visuals registry', () => {
    test('resolves fighter charge to wave effect at entity position', () => {
        const entity = Object.create(Fighter.prototype);
        entity.position = new THREE.Vector3(1, 2, 3);

        const visual = resolveRemoteSkillVisual(entity, 'Charge', new THREE.Vector3(9, 0, 4));

        expect(visual).toEqual({
            color: 0xff5500,
            type: 'wave',
            origin: entity.position
        });
    });

    test('resolves wizard meteor as intentionally handled without spawn payload', () => {
        const entity = Object.create(Wizard.prototype);
        entity.position = new THREE.Vector3(0, 0, 0);
        const target = new THREE.Vector3(7, 0, 8);

        const visual = resolveRemoteSkillVisual(entity, 'Meteor Drop', target);

        expect(visual).toEqual({ handled: true });
    });

    test('returns class fallback when skill is unmapped', () => {
        const entity = Object.create(Wizard.prototype);
        entity.position = new THREE.Vector3(3, 0, 4);

        const visual = resolveRemoteSkillVisual(entity, 'Unknown Spell', new THREE.Vector3(10, 0, 11));

        expect(visual).toEqual({
            color: 0x66bbff,
            type: 'ring',
            origin: entity.position,
            fallback: true
        });
    });
});
