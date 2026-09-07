import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Actor } from '../src/entities/Actor.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Projectile } from '../src/entities/Projectile.js';
import { eidolon } from '../src/proto/state_pb.js';

describe.each([0,1,5])('Consecrated Ground rank %s', rank => {
    test.each(['','consecratedground_expanded','consecratedground_lingering'])('actual offline ticks and persistent boundary: %s', rune => {
        const p=new Cleric('holy'); p.unlockedSkills.push('Consecrated Ground');
        p.talentRanks={CLR_34:rank}; p.skillRunes={'Consecrated Ground':rune};
        p.position.set(60000,40,60000); p.stats.wisdom=10; p.stats.hp=100; p.stats.maxHp=500;
        const radius=(rune==='consecratedground_expanded'?7.5:5)*(1+.03*rank);
        const ally=new Wizard('ally'); ally.stats.hp=100; ally.stats.maxHp=500; ally.radius=5;
        ally.position.set(p.position.x+radius+5-.01,0,p.position.z);
        const enemy=new Actor('enemy',{}); enemy.position.copy(ally.position); enemy.radius=5; enemy.takeDamage=jest.fn();
        const engine={effectScene:new THREE.Scene(),chunkManager:{getActiveEntities:()=>[ally,enemy]},
            floatingTextManager:{spawn:jest.fn()},spawnTransientEffect:jest.fn(()=>true),isHostileActorTarget:e=>e===enemy};
        try {
            p.useAbility(p.position.clone().addScalar(100),engine,'Consecrated Ground');
            expect(getAbilityAoeRadius('Cleric','Consecrated Ground',p)).toBeCloseTo(radius,8);
            expect(p.consecratedZone.radius).toBeCloseTo(radius,8);
            expect(p.consecratedZone.duration).toBe(rune==='consecratedground_lingering'?16:8);
            expect(p.consecratedZone.visual.parent).toBe(engine.effectScene);
            expect(p.consecratedZone.visual.userData.gameplayRadius).toBeCloseTo(radius,8);
            p.talentRanks={};
            p.update(0,null,p,engine.chunkManager,engine.floatingTextManager);
            expect(ally.stats.hp).toBe(120); expect(p.stats.hp).toBe(120);
            expect(enemy.takeDamage).toHaveBeenCalledTimes(1);
            expect(enemy.takeDamage).toHaveBeenCalledWith(30,p);
            const origin=p.consecratedZone.position.clone(); p.position.x-=40;
            ally.position.x+=.02; enemy.position.x+=.02;
            p.update(1,null,p,engine.chunkManager,engine.floatingTextManager);
            expect(ally.stats.hp).toBe(120); expect(enemy.takeDamage).toHaveBeenCalledTimes(1);
            expect(p.consecratedZone.position).toEqual(origin);
            expect(p.consecratedZone.visual.position.x).toBe(origin.x);
            p.consecratedZone.duration=.1;
            p.update(.1,null,p,engine.chunkManager,engine.floatingTextManager);
            expect(p.consecratedZone).toBeNull(); expect(engine.effectScene.children).toHaveLength(0);
        } finally { p.cancelAbilities(); }
    });
});

test('offline holy ground cancels its persistent scene resources',()=>{
    const p=new Cleric('holy'); p.unlockedSkills.push('Consecrated Ground');
    const engine={effectScene:new THREE.Scene(),spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()}};
    p.useAbility(p.position.clone(),engine,'Consecrated Ground');
    expect(engine.effectScene.children).toHaveLength(1);
    p.cancelAbilities();
    expect(p.consecratedZone).toBeNull(); expect(engine.effectScene.children).toHaveLength(0);
});

test.each([false,true])('holy ground damages only through connected dungeon floor: doorway=%s',doorway=>{
    const p=new Cleric('holy-wall'); p.unlockedSkills.push('Consecrated Ground'); p.position.set(50009,40,50000);
    const enemy=new Actor('enemy',{}); enemy.position.set(50011,0,50000); enemy.takeDamage=jest.fn();
    const ally=new Wizard('ally'); ally.position.copy(enemy.position); ally.stats.hp=10; ally.stats.maxHp=500;
    const rects=[{x:50000,z:50000,width:20,height:20},{x:50020.5,z:50000,width:20,height:20}];
    if(doorway) rects.push({x:50010,z:50000,width:5,height:6});
    const engine={currentInstanceId:'dungeon_holy',currentDungeonLayout:{walkRects:rects},effectScene:new THREE.Scene(),
        chunkManager:{getActiveEntities:()=>[enemy,ally]},isHostileActorTarget:e=>e===enemy,
        spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()}};
    try {
        p.useAbility(p.position.clone(),engine,'Consecrated Ground');
        p.update(0,null,p,engine.chunkManager,engine.floatingTextManager);
        expect(enemy.takeDamage).toHaveBeenCalledTimes(doorway?1:0);
        expect(ally.stats.hp).toBeGreaterThan(10); // Existing support-through-wall contract.
    } finally { p.cancelAbilities(); }
});

test('holy-zone scale reaches a rank-private observer through the actual wire/sync consumer',()=>{
    const owner=new Cleric('private-owner');
    const zone=new Projectile('holy-snapshot',owner,'ZoneHoly',new THREE.Vector3(3,.1,4),new THREE.Vector3(4,.1,4));
    const wire=eidolon.state.Entity.decode(eidolon.state.Entity.encode({id:zone.id,type:'Projectile',subType:'ZoneHoly',
        x:3,y:.1,z:4,scale:1.725,state:'MOVING'}).finish());
    const engine={player:owner,clearAuthoritativeJumpState:jest.fn(),showRemoteStateReadability:jest.fn(),
        syncRemoteSupportEffects:jest.fn(),syncPlayerStatusClears:jest.fn(),syncPlayerStatusDetails:jest.fn(),
        chunkManager:{updateEntityChunk:jest.fn(),getChunkKey:()=> 'test',chunks:new Map()}};
    try {
        GameEngine.prototype.syncRemoteEntity.call(engine,zone,wire);
        expect(zone.mesh.userData.gameplayRadius).toBeCloseTo(8.625,5);
        zone.mesh.updateMatrixWorld(true);
        zone.mesh.traverse(part=>{
            if(!part.userData.gameplayBoundary) return;
            part.geometry.computeBoundingSphere();
            expect(part.geometry.boundingSphere.radius*part.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(8.625,5);
        });
    } finally { zone.dispose(); }
});
