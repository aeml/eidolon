import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Fighter } from '../src/entities/Fighter.js';
import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { getFighterEffectDuration } from '../src/skills/fighterEffectDuration.js';

test.each([0,1,5].flatMap(rank => [0,5].map(generic => ({rank,generic}))))(
    'paid Grip mastery rank$rank/generic$generic extends only root uptime', ({rank,generic}) => {
        const player = new Fighter('grip-master'), target = new Actor('grip-enemy', {});
        player.mesh = new THREE.Group(); player.unlockedSkills.push('Unbreakable Grip');
        player.stats.mana = 200; player.talentRanks = {FTR_15:rank,FTR_30:generic,FTR_37:generic};
        target.position.set(5,0,0); const hp = target.stats.hp;
        const engine = { chunkManager: {getActiveEntities: () => [target]}, spawnTransientEffect: jest.fn(() => true), floatingTextManager: {spawn:jest.fn()} };
        try {
            player.useAbility(target.position.clone(), engine, 'Unbreakable Grip');
            expect(player.stats.mana).toBe(165);
            expect(target.rootTimer).toBeCloseTo(1+.04*rank+.07*generic,8);
            expect(target.position.x).toBe(2); expect(target.stats.hp).toBe(hp); expect(target.stunTimer).toBe(0);
            const duration = target.rootTimer; player.talentRanks = {};
            expect(target.rootTimer).toBe(duration);
        } finally {player.dispose();target.dispose();}
    });

test('Grip Mastery describes bounded root duration instead of nonexistent damage', () => {
    const talent = CONSTANTS.PASSIVE_TALENTS.Fighter.find(t => t.id === 'FTR_15');
    expect(talent.abilityDuration).toEqual({skill:'Unbreakable Grip',duration:.04});
    expect(talent.abilityDamage).toBeUndefined();
    expect(talent.desc).toMatch(/root duration/i);
    const source = {talentRanks:{FTR_15:999,FTR_30:-1,FTR_37:-1,CLR_15:5}};
    const saved = {...source.talentRanks};
    expect(getFighterEffectDuration(source,1,'Unbreakable Grip')).toBeCloseTo(1.2,8);
    expect(source.talentRanks).toEqual(saved);
});
