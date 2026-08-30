import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';
import { resolveRemoteSkillVisual } from '../src/skills/skillVisuals.js';

describe('skill visuals registry', () => {
    test('resolves fighter charge to its authoritative destination impact radius', () => {
        const entity = Object.create(Fighter.prototype);
        entity.position = new THREE.Vector3(1, 2, 3);

        const visual = resolveRemoteSkillVisual(entity, 'Charge', new THREE.Vector3(9, 0, 4));

        expect(visual).toEqual({
            color: 0xff5500,
            type: 'wave',
            origin: new THREE.Vector3(9, 0, 4),
            radius: 16
        });
    });

    test('passes exact range and arc to cone presentations', () => {
        const entity = Object.create(Fighter.prototype);
        entity.position = new THREE.Vector3(1, 0, 2);

        const visual = resolveRemoteSkillVisual(entity, 'Sweeping Strike', new THREE.Vector3(5, 0, 2));

        expect(visual).toEqual({
            color: 0xf5f7ff,
            type: 'cone',
            origin: entity.position,
            radius: 5,
            arc: Math.PI
        });
    });

    test('resolves wizard meteor into explicit telegraph and impact layers', () => {
        const entity = Object.create(Wizard.prototype);
        entity.position = new THREE.Vector3(0, 0, 0);
        const target = new THREE.Vector3(7, 0, 8);

        const visual = resolveRemoteSkillVisual(entity, 'Meteor Drop', target);

        expect(visual).toEqual({
            layers: [
                { color: 0xff3324, type: 'telegraph', origin: target, radius: 26.4 },
                { color: 0xff9b32, type: 'ring', origin: target, radius: 26.4 }
            ]
        });
    });

    test('shows Healing Light boundary only for the Beacon rune', () => {
        const target = new THREE.Vector3(7, 0, 8);
        const base = Object.create(Cleric.prototype);
        base.position = new THREE.Vector3();
        base.skillRunes = {};
        expect(resolveRemoteSkillVisual(base, 'Healing Light', target)).toEqual({
            layers: [
                { color: 0x55ff9b, type: 'pillar', origin: target },
                { color: 0xc8ffe0, type: 'burst', origin: target }
            ]
        });

        const beacon = Object.create(Cleric.prototype);
        beacon.position = new THREE.Vector3();
        beacon.skillRunes = { 'Healing Light': 'healinglight_beacon' };
        expect(resolveRemoteSkillVisual(beacon, 'Healing Light', target)).toEqual({
            layers: [
                { color: 0x55ff9b, type: 'pillar', origin: target },
                { color: 0xc8ffe0, type: 'burst', origin: target },
                { color: 0x7dffc0, type: 'ring', origin: target, radius: 5 }
            ]
        });
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
