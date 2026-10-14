import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';

function fixture() {
    jest.spyOn(Math, 'random').mockReturnValue(.99);
    const source = new Cleric('sanctuary-caster'), ally = new Fighter('sanctuary-ally'), enemy = new Imp('sanctuary-enemy');
    source.mesh = new THREE.Group(); source.level = 100; source.unlockedSkills.push('Consecrated Ground', 'Spirit Guardians Boost');
    Object.assign(source.stats, { mana: 1000, wisdom: 41, hp: 1000, maxHp: 10000, hpRegen: 0, manaRegen: 0 });
    Object.assign(ally.stats, { hp: 1000, maxHp: 10000, hpRegen: 0 }); ally.position.set(2, 0, 0);
    Object.assign(enemy.stats, { hp: 10000, maxHp: 10000, defense: 0 }); enemy.position.set(2, 0, 0);
    const engine = { effectScene: new THREE.Group(), chunkManager: { getActiveEntities: () => [ally, enemy] },
        isHostileActorTarget: e => e === enemy, spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
    return { source, ally, enemy, engine, cast: skill => source.useAbility(enemy.position.clone(), engine, skill),
        pulse: dt => source.update(dt, null, null, engine.chunkManager, engine.floatingTextManager),
        dispose: () => { source.dispose(); ally.dispose(); enemy.dispose(); jest.restoreAllMocks(); } };
}
test.each(['Spirit Guardians', 'Spirit Guardians Boost'])('%s captures Sanctuary protection until expiry', skill => {
    const f = fixture();
    try {
        f.source.skillRunes = { 'Spirit Guardians': 'spirits_sanctuary' }; f.cast(skill); f.source.skillRunes = {};
        let before = f.source.stats.hp; f.source.takeDamage(100, f.enemy); expect(before - f.source.stats.hp).toBe(80);
        f.pulse(skill === 'Spirit Guardians' ? 8 : 10);
        before = f.source.stats.hp; f.source.takeDamage(100, f.enemy); expect(before - f.source.stats.hp).toBe(100);
    } finally { f.dispose(); }
});
test('Holy Ground protects eligible recipients, uses the stronger overlap and expires after leaving', () => {
    const f = fixture();
    try {
        f.source.skillRunes = { 'Spirit Guardians': 'spirits_sanctuary', 'Consecrated Ground': 'consecratedground_sanctuary' };
        f.cast('Spirit Guardians'); f.cast('Consecrated Ground'); f.source.skillRunes = {}; f.pulse(0);
        let before = f.source.stats.hp; f.source.takeDamage(100, f.enemy); expect(before - f.source.stats.hp).toBe(70);
        before = f.ally.stats.hp; f.ally.takeDamage(100, f.enemy); expect(before - f.ally.stats.hp).toBe(70);
        expect(f.enemy.consecratedSanctuaryTimer || 0).toBe(0);
        f.ally.position.x = 100; f.ally.update(2.1); f.pulse(0);
        before = f.ally.stats.hp; f.ally.takeDamage(100, f.enemy); expect(before - f.ally.stats.hp).toBe(100);
        f.source.die(); expect(f.source.spiritSanctuaryTimer).toBe(0); expect(f.source.consecratedSanctuaryTimer).toBe(0);
    } finally { f.dispose(); }
});
test.each([false, true])('Vengeful spirit healing and trained damage agree, boosted=%s', boosted => {
    const f = fixture();
    try {
        const skill = boosted ? 'Spirit Guardians Boost' : 'Spirit Guardians';
        f.source.skillRunes = { 'Spirit Guardians': 'spirits_vengeful' }; f.source.talentRanks = { [boosted ? 'CLR_15' : 'CLR_01']: 5 };
        f.source.activeSetBonuses = { divine: { specials: { spiritGuardiansHeal: 1 } } };
        f.cast(skill); f.pulse(0);
        const raw = boosted ? 81 : 51;
        expect(10000 - f.enemy.stats.hp).toBe(Math.floor(Math.floor(raw * 1.2) * 1.5));
        expect(f.ally.stats.hp).toBe(1018);
    } finally { f.dispose(); }
});
test.each(['immune', 'stronger'])('boosted spirits preserve %s control boundaries', mode => {
    const f = fixture();
    try {
        f.enemy.ccImmune = mode === 'immune'; if (mode === 'stronger') { f.enemy.slowTimer = 9; f.enemy.slowFactor = .7; }
        f.cast('Spirit Guardians Boost'); f.pulse(0);
        expect(f.enemy.stats.hp).toBeLessThan(10000);
        expect(f.enemy.slowTimer).toBe(mode === 'immune' ? 0 : 9);
        if (mode === 'stronger') expect(f.enemy.slowFactor).toBe(.7);
    } finally { f.dispose(); }
});
