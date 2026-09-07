import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Actor } from '../src/entities/Actor.js';
import { AttachedStatusEffect } from '../src/entities/AttachedStatusEffect.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';

test.each([0,1,5])('Guardian Embrace rank %s snapshots a body-aware aura and heals at its real tick', rank => {
    const p = new Cleric('guardian');
    p.unlockedSkills.push('Guardian Embrace');
    p.talentRanks = { CLR_34: rank };
    p.position.set(60000,40,60000);
    p.stats.hp = 100;
    p.stats.maxHp = 500;
    p.stats.wisdom = 10;
    const ally = new Wizard('ally');
    ally.radius = 5;
    ally.stats.hp = 100;
    ally.stats.maxHp = 500;
    const radius=10*(1+.03*rank);
    ally.position.set(p.position.x+radius+ally.radius-.01,0,p.position.z);
    const engine={ chunkManager:{getActiveEntities:()=>[ally]}, spawnTransientEffect:jest.fn(()=>true), floatingTextManager:{spawn:jest.fn()},isHostileActorTarget:()=>false };
    p.useAbility(p.position.clone(),engine,'Guardian Embrace');
    expect(getAbilityAoeRadius('Cleric','Guardian Embrace',p)).toBeCloseTo(radius,8);
    expect(p.guardianEmbraceRadius).toBeCloseTo(radius,8);
    expect(p.guardianEmbraceTimer).toBe(10);
    expect(p.cooldowns['Guardian Embrace']).toBeCloseTo(30*(1-p.stats.cooldownReduction),8);
    p.talentRanks={};
    p.update(0,null,p,engine.chunkManager,engine.floatingTextManager);
    expect(ally.stats.hp).toBe(140);
    expect(p.stats.hp).toBe(140);
    ally.position.x+=.02;
    p.update(1,null,p,engine.chunkManager,engine.floatingTextManager);
    expect(ally.stats.hp).toBe(140);
    p.guardianEmbraceTimer=.1;
    p.update(.1,null,p,engine.chunkManager,engine.floatingTextManager);
    expect(p.guardianEmbraceActive).toBe(false);
});

test.each(['high','low'])('%s attached aura preserves body-sized art and exact persistent radius', quality => {
    const owner={id:'guardian',position:new THREE.Vector3(3,40,4),guardianEmbraceRadius:11.5};
    const scene=new THREE.Scene();
    const effect=new AttachedStatusEffect(scene,owner,'guardian_embrace',{quality});
    try {
        const boundary=effect.group.children.find(child=>child.userData.gameplayBoundary);
        expect(boundary).toBeDefined();
        expect(boundary.scale.x).toBe(11.5);
        expect(effect.group.children.find(child=>child.name.endsWith(':OuterSeal')).scale.x).toBe(2);
        owner.position.x=8;
        effect.update(.5);
        expect(effect.group.position.x).toBe(8);
        expect(boundary.scale.x).toBe(11.5);
        owner.guardianEmbraceRadius=10;
        effect.update(0);
        expect(boundary.scale.x).toBe(10);
    } finally { effect.dispose(); }
    expect(scene.children).toHaveLength(0);
});

test.each(['isMultiplayer','isRemote'])('online Guardian Embrace never applies client healing: %s', flag => {
    const p=new Cleric('online-guardian');
    p[flag]=true;
    p.guardianEmbraceActive=true;
    p.guardianEmbraceTimer=10;
    p.embraceTickTimer=1;
    const ally=new Wizard('online-ally');
    ally.stats.hp=100;
    const engine={chunkManager:{getActiveEntities:()=>[ally]},floatingTextManager:{spawn:jest.fn()}};
    p.gameEngine=engine;
    p.update(0,null,p,engine.chunkManager,engine.floatingTextManager);
    expect(ally.stats.hp).toBe(100);
});

test('new observer receives an active aura radius and clears it on inactive state',()=>{
    const p=new Cleric('observer');
    p.mesh=new THREE.Group();
    const engine={renderSystem:{effectGroup:new THREE.Group()},showRemoteSupportStateReadability:jest.fn()};
    p.gameEngine=engine;
    GameEngine.prototype.syncRemoteSupportEffects.call(engine,p,{guardianEmbraceActive:true,guardianEmbraceDuration:6,guardianEmbraceRadius:11.5});
    expect(p.guardianEmbraceRadius).toBe(11.5);
    expect(p.attachedStatusEffects.get('guardian_embrace')?.group.userData.gameplayRadius).toBe(11.5);
    const group=p.attachedStatusEffects.get('guardian_embrace').group;
    GameEngine.prototype.syncRemoteSupportEffects.call(engine,p,{guardianEmbraceRadius:10});
    expect(p.attachedStatusEffects.get('guardian_embrace').group).toBe(group);
    expect(group.userData.gameplayRadius).toBe(10);
    expect(p.guardianEmbraceTimer).toBe(6);
    GameEngine.prototype.syncRemoteSupportEffects.call(engine,p,{guardianEmbraceActive:false,guardianEmbraceDuration:0,guardianEmbraceRadius:0});
    expect(p.attachedStatusEffects.has('guardian_embrace')).toBe(false);
    expect(p.guardianEmbraceRadius).toBe(0);
});

test('offline Guardian Embrace does not heal enemy actors',()=>{
    const p=new Cleric('healer');
    p.unlockedSkills.push('Guardian Embrace');
    const enemy=new Actor('enemy',{}); enemy.stats.hp=100; enemy.stats.maxHp=500;
    const engine={chunkManager:{getActiveEntities:()=>[enemy]},spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()},isHostileActorTarget:e=>e===enemy};
    p.useAbility(p.position.clone(),engine,'Guardian Embrace');
    p.update(1,null,p,engine.chunkManager,engine.floatingTextManager);
    expect(enemy.stats.hp).toBe(100);
});

test.each([
    {poison:false,start:100,want:157},
    {poison:true,start:100,want:128},
    {poison:false,start:490,want:500}
])('offline healing composes equipment/mastery, poison and missing health: %j',({poison,start,want})=>{
    const p=new Cleric('healer');
    p.unlockedSkills.push('Guardian Embrace');
    p.stats.wisdom=10; p.stats.healingDoneBonus=.2; p.talentRanks={CLR_05:5};
    const ally=new Wizard('ally');
    ally.stats.hp=start; ally.stats.maxHp=500; ally.poisonTimer=poison?5:0;
    const engine={chunkManager:{getActiveEntities:()=>[ally]},spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()},isHostileActorTarget:()=>false};
    p.useAbility(p.position.clone(),engine,'Guardian Embrace');
    p.update(0,null,p,engine.chunkManager,engine.floatingTextManager);
    expect(ally.stats.hp).toBe(want);
    expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith(`+${want-start}`,ally.position,'#00ff00');
});
