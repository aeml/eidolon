import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Imp } from '../src/entities/Imp.js';
import { CONSTANTS } from '../src/core/Constants.js';

const classes = { Fighter, Rogue, Wizard, Cleric };
const catalog = JSON.parse(readFileSync('server/internal/game/testdata/talent_economy.json', 'utf8'));
const cases = Object.entries(catalog).flatMap(([className, spec]) => spec.skills.flatMap((skill, index) =>
    [0, 5].flatMap(rank => [false, true].map(generic => ({ className, skill, spec, index, rank, generic })))));
afterEach(() => jest.restoreAllMocks());

test.each(cases)('$className $skill rank$rank generic$generic retains the paid cast economy', ({ className, skill, spec, index, rank, generic }) => {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const actor = new classes[className]('cooldown-consumer'), target = new Imp('cooldown-target');
    const spawned = [];
    try {
        actor.mesh = new THREE.Group(); target.mesh = new THREE.Group();
        actor.position.set(0, 0, 0); target.position.set(0, 0, 2);
        actor.level = 100; actor.unlockedSkills.push(skill);
        if (skill === 'Iron Fortress') actor.baseStats.intelligence = 50;
        // Keep mana below the Wizard's recalculated maximum: Time Warp
        // legitimately recalculates stats when applying its haste aura.
        const startingMana = 500;
        actor.stats.mana = startingMana; actor.stats.cooldownReduction = .2;
        actor.stats.hp = actor.stats.maxHp * .2; // Last Stand's real low-HP gate.
        actor.stats.manaCostReduction = .1;
        actor.stats.critChanceBonus = 0;
        actor.talentRanks = { [`${spec.prefix}_${String(index * 2 + 2).padStart(2, '0')}`]: rank };
        let skillCDR = .03 * rank;
        let manaReduction = (spec.techniqueManaOverrides?.[index * 2 + 2] ?? spec.techniqueMana) * rank;
        if (generic) for (const [id, effect] of Object.entries(spec.generic)) {
            actor.talentRanks[`${spec.prefix}_${id.padStart(2, '0')}`] = 5;
            if (!effect.skill || effect.skill === skill) {
                skillCDR += (effect.cdr || 0) * 5;
                manaReduction += (effect.manaReduction || 0) * 5;
            }
        }
        actor.scheduleTask = jest.fn();
        target.stats.hp = target.stats.maxHp = 100000;
        const engine = { player: actor, scene: new THREE.Scene(),
            chunkManager: { getActiveEntities: () => [actor, target] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
            addEntity: entity => spawned.push(entity), isHostileActorTarget: entity => entity === target };
        const config = CONSTANTS.ABILITY_CONFIG[className].skills[skill];
        const cost = Math.floor(Math.floor(config.mana * .9 + 1e-9) * (1 - manaReduction) + 1e-9);
        actor.useAbility(target.position.clone(), engine, skill);
        expect(actor.stats.mana).toBe(startingMana - cost);
        expect(actor.cooldowns[skill]).toBeCloseTo(config.cooldown * .8 * Math.max(0, 1 - skillCDR), 8);
        const cooldown = actor.cooldowns[skill], mana = actor.stats.mana;
        actor.useAbility(target.position.clone(), engine, skill);
        expect(actor.stats.mana).toBe(mana);
        expect(actor.cooldowns[skill]).toBe(cooldown);
    } finally {
        for (const entity of spawned) entity.dispose?.();
        actor.dispose(); target.dispose();
    }
});
