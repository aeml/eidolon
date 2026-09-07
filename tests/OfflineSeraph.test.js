import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';
import { AvengingSeraph } from '../src/entities/AvengingSeraph.js';
import { getSeraphTraining } from '../src/entities/SeraphSummon.js';
import { readFileSync } from 'node:fs';

const trainingCases = JSON.parse(readFileSync('server/internal/game/testdata/seraph_training.json', 'utf8'));
test.each(trainingCases)('shared server/client Seraph training: $name', entry => {
    const ranks = { ...entry.ranks };
    const actual = getSeraphTraining({ meshType: 'Cleric', stats: { wisdom: 10 }, talentRanks: ranks,
        activeSetBonuses: entry.permanent ? { crusader: { specials: { permanentSeraph: 1 } } } : {} });
    expect(actual.damage).toBe(entry.damage); expect(actual.duration).toBeCloseTo(entry.duration);
    expect(ranks).toEqual(entry.ranks);
});

function fixture(ranks = {}) {
    const owner = new Cleric('owner'); owner.mesh = new THREE.Group();
    owner.stats.wisdom = 10; owner.stats.mana = owner.stats.maxMana = 1000;
    owner.stats.cooldownReduction = .1; owner.talentRanks = ranks;
    owner.unlockedSkills.push('Avenging Seraph'); owner.position.set(60000, 0, 60000);
    const enemy = new Actor('enemy', {}); enemy.position.set(60006, 0, 60000);
    enemy.stats.hp = enemy.stats.maxHp = 1000; enemy.stats.hpRegen = 0;
    const entities = [owner, enemy];
    const engine = { currentInstanceId: 'dungeon_seraph', spawnTransientEffect: jest.fn(() => true),
        floatingTextManager: { spawn: jest.fn() }, isHostileActorTarget: target => target === enemy,
        addEntity: jest.fn(entity => { entities.push(entity); entity.gameEngine = engine; }),
        chunkManager: { getActiveEntities: () => entities,
            removeEntity: jest.fn(entity => { entities.splice(entities.indexOf(entity), 1); entity.dispose(); }) } };
    const cast = () => { owner.useAbility(enemy.position, engine, 'Avenging Seraph'); return entities.find(e => e instanceof AvengingSeraph); };
    const cleanup = () => { for (const entity of [...entities]) entity.dispose(); };
    return { owner, enemy, engine, cast, cleanup };
}

test.each([0, 1, 5])('paid offline Seraph creates a real ally and trained attack, rank %s', rank => {
    const f = fixture({ CLR_17: rank, CLR_18: rank });
    try {
        const seraph = f.cast();
        expect(seraph).toBeInstanceOf(AvengingSeraph);
        expect(f.owner.stats.mana).toBe(940);
        expect(f.owner.cooldowns['Avenging Seraph']).toBeCloseTo(45*.9*(1-.03*rank));
        expect(seraph.summonRemaining).toBeCloseTo(15*(1+.02*rank));
        f.owner.talentRanks = {};
        const damage = Math.floor(70*(1+.04*rank)+1e-9);
        const receive = jest.spyOn(f.enemy, 'takeDamage');
        seraph.update(.05, null, f.owner, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(receive).toHaveBeenCalledWith(damage, f.owner);
        seraph.update(.5, null, f.owner, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(receive).toHaveBeenCalledTimes(1);
        seraph.update(1, null, f.owner, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(receive).toHaveBeenCalledTimes(2);
    } finally { f.cleanup(); }
});

test.each(['expiry', 'owner-death', 'owner-disconnect', 'instance-change', 'summon-death', 'owner-dispose'])('%s removes the ally without another attack', reason => {
    const f = fixture();
    try {
        const seraph = f.cast(); const receive = jest.spyOn(f.enemy, 'takeDamage');
        if (reason === 'expiry') seraph.summonRemaining = .01;
        if (reason === 'owner-death') f.owner.state = 'DEAD';
        if (reason === 'owner-disconnect') f.owner.disconnected = true;
        if (reason === 'instance-change') f.engine.currentInstanceId = '';
        if (reason === 'summon-death') seraph.state = 'DEAD';
        if (reason === 'owner-dispose') f.owner.dispose();
        else seraph.update(.05, null, f.owner, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(receive).not.toHaveBeenCalled();
        expect(seraph.isActive).toBe(false);
        expect(f.owner.offlineSeraphs.size).toBe(0);
        expect(f.engine.chunkManager.removeEntity).toHaveBeenCalledWith(seraph);
    } finally { f.cleanup(); }
});

test.each([false, true])('summon attacks obey canonical wall/door geometry: doorway=%s', doorway => {
    const f = fixture();
    try {
        f.engine.currentDungeonLayout = { walkRects: [
            { x: 60000, z: 60000, width: 4, height: 10 }, { x: 60006, z: 60000, width: 4, height: 10 },
            ...(doorway ? [{ x: 60003, z: 60000, width: 4, height: 4 }] : [])] };
        f.cast().update(.05, null, f.owner, f.engine.chunkManager, f.engine.floatingTextManager);
        expect(f.enemy.stats.hp).toBe(doorway ? 930 : 1000);
    } finally { f.cleanup(); }
});

test.each(['remote', 'multiplayer', 'engine'])('%s authority cannot create an offline duplicate', authority => {
    const f = fixture();
    try {
        if (authority === 'remote') f.owner.isRemote = true;
        if (authority === 'multiplayer') f.owner.isMultiplayer = true;
        if (authority === 'engine') f.engine.isMultiplayer = true;
        expect(f.cast()).toBeUndefined();
        expect(f.engine.addEntity).not.toHaveBeenCalled();
        expect(f.enemy.stats.hp).toBe(1000);
    } finally { f.cleanup(); }
});

test('locked or unaffordable summons do not spend mana, start cooldown or create an ally', () => {
    for (const reason of ['locked', 'mana']) {
        const f = fixture();
        try {
            if (reason === 'locked') f.owner.unlockedSkills = [];
            else f.owner.stats.mana = 59;
            const before = f.owner.stats.mana;
            expect(f.cast()).toBeUndefined();
            expect(f.owner.stats.mana).toBe(before);
            expect(f.owner.cooldowns['Avenging Seraph'] || 0).toBe(0);
        } finally { f.cleanup(); }
    }
});
