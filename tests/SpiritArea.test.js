import { jest } from '@jest/globals';
import * as THREE from 'three';
import { SpiritGuardiansEffect } from '../src/entities/SpiritGuardiansEffect.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';

describe.each([false,true])('Spirit boosted=%s',boosted=>{
    test.each(['','spirits_expanded','spirits_vengeful'])('offline trained cast/tick and snapshot: %s',rune=>{
        const p=new Cleric('spirits');const skill=boosted?'Spirit Guardians Boost':'Spirit Guardians';
        p.unlockedSkills.push(skill);p.talentRanks={CLR_34:5};p.skillRunes={'Spirit Guardians':rune};
        p.stats.wisdom=10;p.position.set(60000,40,60000);
        const radius=(boosted?20:16)*(rune==='spirits_expanded'?1.5:1)*1.15;
        const enemy=new Actor('enemy',{});enemy.radius=5;enemy.position.set(p.position.x+radius+5-.01,0,p.position.z);enemy.takeDamage=jest.fn();
        const engine={effectScene:new THREE.Scene(),spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()},chunkManager:{getActiveEntities:()=>[enemy]}};
        try {
            p.useAbility(p.position.clone(),engine,skill);
            expect(p.spiritRadius).toBeCloseTo(radius,8);expect(p.spiritRune).toBe(rune);
            expect(p.spiritEffect.effectRadius).toBeCloseTo(radius,8);
            p.skillRunes={};p.talentRanks={};
            p.update(0,null,p,engine.chunkManager,engine.floatingTextManager);
            const damage=Math.floor((boosted?35:20)*(rune==='spirits_vengeful'?1.5:1));
            expect(enemy.takeDamage).toHaveBeenCalledWith(damage,p);
            enemy.position.x+=.02;p.update(.5,null,p,engine.chunkManager,engine.floatingTextManager);
            expect(enemy.takeDamage).toHaveBeenCalledTimes(1);expect(enemy.slowTimer).toBe(0);
            p.spiritDuration=.1;p.update(.1,null,p,engine.chunkManager,engine.floatingTextManager);
            expect(p.spiritRadius).toBe(0);expect(p.spiritRune).toBe('');expect(engine.effectScene.children).toHaveLength(0);
        } finally {p.cancelAbilities();}
    });
});

test.each(['high','low'])('%s exact aura changes radius without resizing/recreating cherubs',quality=>{
    const source={id:'spirits',position:new THREE.Vector3(),spiritRadius:27.6};
    const effect=new SpiritGuardiansEffect(new THREE.Scene(),source,{runeId:'spirits_expanded',quality});
    try {
        const cherubs=[...effect.guardians];effect.update(.37);
        expect(effect.pulseRing.geometry.parameters.outerRadius).toBe(27.6);
        expect(effect.pulseRing.scale.toArray()).toEqual([1,1,1]);
        const scale=cherubs[0].scale.x,oldGeometry=effect.pulseRing.geometry;
        const disposal=jest.spyOn(oldGeometry,'dispose');source.spiritRadius=30;
        effect.setVariant();effect.update(0);
        expect(effect.guardians).toEqual(cherubs);expect(cherubs[0].scale.x).toBe(scale);
        expect(effect.effectRadius).toBe(30);expect(effect.orbitRadius).toBe(22.5);
        expect(effect.pulseRing.geometry.parameters.outerRadius).toBe(30);expect(disposal).toHaveBeenCalledTimes(1);
    } finally {effect.dispose();}
});

test('late observer applies private-rank-independent active radius/rune and radius-only deltas',()=>{
    const p=new Cleric('observer');const engine={effectScene:new THREE.Scene(),showRemoteSupportStateReadability:jest.fn()};p.gameEngine=engine;
    GameEngine.prototype.syncRemoteSupportEffects.call(engine,p,{spiritsActive:true,spiritsBoosted:true,spiritDuration:6,spiritRadius:34.5,spiritRune:'spirits_expanded'});
    expect(p.spiritEffect.effectRadius).toBe(34.5);expect(p.spiritEffect.runeId).toBe('spirits_expanded');
    const group=p.spiritEffect.group,cherubs=[...p.spiritEffect.guardians];
    GameEngine.prototype.syncRemoteSupportEffects.call(engine,p,{spiritRadius:30});
    expect(p.spiritEffect.group).toBe(group);expect(p.spiritEffect.guardians).toEqual(cherubs);
    expect(p.spiritDuration).toBe(6);expect(p.spiritEffect.effectRadius).toBe(30);
    GameEngine.prototype.syncRemoteSupportEffects.call(engine,p,{spiritsActive:false,spiritRadius:0,spiritRune:''});
    expect(p.spiritRadius).toBe(0);expect(p.spiritRune).toBe('');expect(p.spiritEffect).toBeNull();
});

test.each([false,true])('offline spirits retain wall damage protection: doorway=%s',doorway=>{
    const p=new Cleric('spirits');p.position.set(50009,40,50000);p.talentRanks={CLR_34:5};
    const target=new Actor('enemy',{});target.position.set(50011,0,50000);target.takeDamage=jest.fn();
    const rects=[{x:50000,z:50000,width:20,height:20},{x:50020.5,z:50000,width:20,height:20}];
    if(doorway)rects.push({x:50010,z:50000,width:5,height:6});
    const engine={currentInstanceId:'dungeon_spirits',currentDungeonLayout:{walkRects:rects},effectScene:new THREE.Scene(),
        chunkManager:{getActiveEntities:()=>[target]},spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()}};
    try{p.useAbility(p.position.clone(),engine,'Spirit Guardians');p.update(0,null,p,engine.chunkManager,engine.floatingTextManager);
        expect(target.takeDamage).toHaveBeenCalledTimes(doorway?1:0);
    }finally{p.cancelAbilities();}
});
