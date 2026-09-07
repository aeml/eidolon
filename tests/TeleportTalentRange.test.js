import fs from 'node:fs';
import * as THREE from 'three';
import { AbilityController } from '../src/core/AbilityController.js';
import { Wizard } from '../src/entities/Wizard.js';

const contract = JSON.parse(fs.readFileSync('server/internal/game/testdata/talent_range.json', 'utf8'));

test.each(contract)('$name Teleport targeting matches the authoritative rune/talent range', entry => {
    const controller = Object.create(AbilityController.prototype);
    controller.engine = { player: { constructor: { name: 'Wizard' }, meshType: 'Wizard',
        abilityName: 'Teleport', talentRanks: entry.ranks, skillRunes: { Teleport: entry.rune } } };
    expect(controller.getAbilityCastRange('Teleport')).toBeCloseTo(entry.range, 8);
    expect(controller.getAbilityIntentRange()).toBeCloseTo(entry.range, 8);
});

test.each(contract)('$name offline Teleport lands at the same extended cast edge', entry => {
    const wizard = new Wizard('range-wizard');
    wizard.level = 100;
    wizard.position.set(0, 0, 0);
    wizard.mesh = new THREE.Group();
    wizard.unlockedSkills.push('Teleport');
    wizard.talentRanks = entry.ranks;
    wizard.skillRunes = { Teleport: entry.rune };
    wizard.useAbility(new THREE.Vector3(entry.range + 10, 0, 0), { scene: null }, 'Teleport');
    expect(wizard.position.x).toBeCloseTo(entry.range, 8);
    expect(wizard.mesh.position).toEqual(wizard.position);
});
