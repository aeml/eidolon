import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { getClericEffectDuration } from '../src/skills/clericEffectDuration.js';

afterEach(() => jest.restoreAllMocks());

test.each([
    ['Spirit Guardians','CLR_02','',8,(p)=>p.spiritDuration],
    ['Spirit Guardians Boost','CLR_16','',10,(p)=>p.spiritDuration],
    ['Guardian Embrace','CLR_06','',10,(p)=>p.guardianEmbraceTimer],
    ['Divine Intervention','CLR_10','',10,(_p,_e,a)=>a.divineInterventionTimer,true],
    ['Blessing of Resolve','CLR_20','',20,(p)=>p.blessingResolveTimer],
    ['Blessing of Zeal','CLR_22','',8,(p)=>p.blessingZealTimer],
    ['Mark of Weakness','CLR_24','',10,(_p,e)=>e.markWeaknessTimer],
    ["Heaven's Trumpet",'CLR_26','',3,(_p,e)=>e.stunTimer],
    ["Heaven's Trumpet",'CLR_26','',5,(_p,e)=>e.markWeaknessTimer],
    ['Consecrated Ground','CLR_14','',8,(p)=>p.consecratedZone.duration],
    ['Consecrated Ground','CLR_14','consecratedground_lingering',16,(p)=>p.consecratedZone.duration],
    ['Radiant Strike','CLR_12','radiantstrike_chains',2,(_p,e)=>e.rootTimer],
    ['Healing Light','CLR_04','healinglight_renewal',5,(_p,_e,a)=>a.healingLightRenewal.ticks,true,true]
])('paid offline %s/%s composes matching and generic duration', (skill,talent,rune,base,get,friendly=false,ticks=false) => {
    jest.spyOn(Math,'random').mockReturnValue(.99);
    for (const build of ['baseline','skill','generic','combined','unrelated']) {
        const source=new Cleric('duration-caster'),enemy=new Imp('duration-enemy'),ally=new Fighter('duration-ally');
        try {
            for (const actor of [source,enemy,ally]) actor.mesh=new THREE.Group();
            source.stats.mana=1000; source.stats.wisdom=50; source.stats.critChanceBonus=0;
            source.unlockedSkills.push(skill); source.skillRunes={[skill]:rune}; source.talentRanks={};
            let bonus=0;
            if (build==='skill' || build==='combined') {source.talentRanks[talent]=5;bonus+=.1;}
            if (build==='generic' || build==='combined') {Object.assign(source.talentRanks,{CLR_30:5,CLR_33:5,CLR_39:5});bonus+=.45;}
            if (build==='unrelated') source.talentRanks.CLR_08=5;
            enemy.position.set(0,0,2); enemy.stats.hp=enemy.stats.maxHp=10000;
            ally.position.set(0,0,1); ally.stats.maxHp=10000; ally.stats.hp=100;
            const engine={isMultiplayer:false,scene:new THREE.Scene(),
                chunkManager:{getActiveEntities:()=>[enemy,ally]},floatingTextManager:{spawn:jest.fn()},
                spawnTransientEffect:jest.fn(()=>true),isHostileActorTarget:actor=>actor===enemy};
            source.useAbility((friendly?ally:enemy).position.clone(),engine,skill);
            expect(source.stats.mana).toBeLessThan(1000);
            const duration=base*(1+bonus),want=ticks?Math.floor(duration):duration;
            expect(get(source,enemy,ally)).toBeCloseTo(want,8);
            source.talentRanks={};
            expect(get(source,enemy,ally)).toBeCloseTo(want,8);
        } finally {source.dispose();enemy.dispose();ally.dispose();}
    }
});

test('paid Renewal delivers its extended whole-tick budget without re-reading training', () => {
    const source=new Cleric('renewal-duration-source'),ally=new Fighter('renewal-duration-ally');
    try {
        source.mesh=new THREE.Group();ally.mesh=new THREE.Group();ally.position.set(0,0,1);
        source.stats.mana=1000;source.stats.wisdom=50;source.unlockedSkills.push('Healing Light');
        source.skillRunes={'Healing Light':'healinglight_renewal'};
        source.talentRanks={CLR_04:5,CLR_30:5,CLR_33:5,CLR_39:5};
        ally.stats.hp=100;ally.stats.maxHp=10000;ally.stats.hpRegen=0;
        const engine={isMultiplayer:false,chunkManager:{getActiveEntities:()=>[ally]},
            floatingTextManager:{spawn:jest.fn()},spawnTransientEffect:jest.fn(()=>true),isHostileActorTarget:()=>false};
        source.useAbility(ally.position.clone(),engine,'Healing Light');
        expect(source.stats.mana).toBeLessThan(1000);
        expect(ally.healingLightRenewal.ticks).toBe(7);
        const before=ally.stats.hp,amount=ally.healingLightRenewal.amount;
        source.talentRanks={};
        Actor.prototype.update.call(ally,7,null,null,engine.chunkManager);
        expect(ally.stats.hp).toBe(before+7*amount);
        expect(ally.healingLightRenewal).toBeNull();
        Actor.prototype.update.call(ally,1,null,null,engine.chunkManager);
        expect(ally.stats.hp).toBe(before+7*amount);
    } finally {source.dispose();ally.dispose();}
});

test.each([
    [{CLR_02:5},8.8], [{CLR_2:5},8.8], [{CLR_02:5,CLR_2:5},8.8],
    [{CLR_02:99},8.8], [{CLR_02:-1},8], [{CLR_02:Infinity},8],
    [{CLR_02:1.9},8.16], [{CLR_04:5},8]
])('normalizes saved duration ranks %j to %s seconds', (talentRanks,expected) => {
    expect(getClericEffectDuration({meshType:'Cleric',talentRanks},'Spirit Guardians',8)).toBeCloseTo(expected,8);
});

test.each([{isMultiplayer:true},{isRemote:true},{gameEngine:{isMultiplayer:true}},{meshType:'Rogue'}])('does not rescale authoritative/wrong-class duration %j', flags => {
    expect(getClericEffectDuration({meshType:'Cleric',talentRanks:{CLR_02:5},...flags},'Spirit Guardians',8)).toBe(8);
});

test('duration copy preserves saved Cleric investments and matches the existing percentages', () => {
    const talents=CONSTANTS.PASSIVE_TALENTS.Cleric;
    for (const [id,percent] of [['CLR_30','4%'],['CLR_33','3%'],['CLR_39','2%']]) {
        const talent=talents.find(entry=>entry.id===id);
        expect(talent.maxRank).toBe(5);
        expect(talent.desc).toContain(percent);
        expect(talent.desc).toMatch(/duration/);
    }
    expect(talents.find(entry=>entry.id==='CLR_02').desc).not.toMatch(/range/);
});
