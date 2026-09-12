import {jest} from '@jest/globals';
import * as THREE from 'three';
import {Fighter} from '../src/entities/Fighter.js';
import {Actor} from '../src/entities/Actor.js';
import {AbilityController} from '../src/core/AbilityController.js';

const owned=[];
function fixture(rank=0) {
    const player=new Fighter('grip-caster'); owned.push(player);
    player.mesh=new THREE.Group(); player.position.set(50000,40,50000);
    player.stats.mana=200;player.unlockedSkills.push('Unbreakable Grip');
    player.talentRanks={FTR_16:rank,FTR_33:5,FTR_38:5};
    const entities=[];
    const engine={player,currentInstanceId:'grip-room',currentInstanceType:'dungeon',
        chunkManager:{getActiveEntities:()=>entities},isHostileActorTarget:t=>t.hostile,
        spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()}};
    const add=(id,distance)=>{const e=new Actor(id,{});owned.push(e);entities.push(e);e.position.set(50000+distance,0,50000);e.radius=.5;e.hostile=true;return e;};
    const cast=aim=>player.useAbility(aim,engine,'Unbreakable Grip');
    return {player,engine,add,cast};
}
afterEach(()=>{owned.splice(0).forEach(a=>a.dispose());jest.restoreAllMocks();});

test.each([0,1,5])('Grip rank%s uses trained planar body range in controller and actual paid cast',rank=>{
    const f=fixture(rank),range=10*(1+.02*rank),target=f.add('edge',range+.499);
    expect(new AbilityController(f.engine).getAbilityCastRange('Unbreakable Grip')).toBeCloseTo(range,8);
    expect(new AbilityController(f.engine).getAbilityTargetDistance(target,'Unbreakable Grip')).toBeCloseTo(range-.001,8);
    f.cast(target.position.clone());
    expect(f.player.stats.mana).toBe(165);expect(target.position.x).toBe(50002);expect(target.rootTimer).toBe(1);
});

test.each(['outside','friendly','dead','zero-hp','inactive','remote','other-instance','wall','malformed','locked'])(
    'Grip refuses %s before charging mana or cooldown',reason=>{
        const f=fixture(5),target=f.add('rejected',reason==='outside'?11.501:5);
        if(reason==='friendly')target.hostile=false;
        if(reason==='dead')target.state='DEAD';
        if(reason==='zero-hp')target.stats.hp=0;
        if(reason==='inactive')target.isActive=false;
        if(reason==='remote')target.isRemote=true;
        if(reason==='other-instance')target.instanceId='elsewhere';
        if(reason==='locked')f.player.unlockedSkills=[];
        if(reason==='wall')f.engine.currentDungeonLayout={walkRects:[{x:50000,z:50000,width:4,height:4},{x:50005,z:50000,width:4,height:4}]};
        const original=target.position.clone();
        f.cast(reason==='malformed'?new THREE.Vector3(NaN,0,50000):target.position.clone());
        expect(f.player.stats.mana).toBe(200);expect(f.player.cooldowns['Unbreakable Grip']||0).toBe(0);
        expect(target.rootTimer).toBe(0);expect(target.position).toEqual(original);expect(f.engine.spawnTransientEffect).not.toHaveBeenCalled();
    });

test('Grip ignores nearby friend and selects an enemy within planar body-padded cursor tolerance',()=>{
    const f=fixture(5),friend=f.add('friend',5),enemy=f.add('enemy',8.4);friend.hostile=false;
    f.cast(new THREE.Vector3(50005,40,50000));
    expect(friend.rootTimer).toBe(0);expect(enemy.rootTimer).toBe(1);expect(enemy.position.x).toBe(50002);
});

test.each(['ccImmune','ironFortressImmovable'])('Grip respects %s without pushing an enemy or adding damage',flag=>{
    const f=fixture(5),target=f.add('immune',5);target[flag]=true;const hp=target.stats.hp;
    f.cast(target.position.clone());expect(f.player.stats.mana).toBe(165);expect(target.position.x).toBe(50005);
    expect(target.rootTimer).toBe(flag==='ccImmune'?0:1);expect(target.stats.hp).toBe(hp);expect(target.stunTimer).toBe(0);
});

test('online Grip never predicts pull or root',()=>{
    const f=fixture(5),target=f.add('server-owned',5);f.engine.isMultiplayer=true;
    f.cast(target.position.clone());expect(target.position.x).toBe(50005);expect(target.rootTimer).toBe(0);
});

test('Grip chooses the closest eligible center rather than a farther large body',()=>{
    const f=fixture(5),near=f.add('near',4),far=f.add('large-far',6);far.radius=3;
    f.cast(new THREE.Vector3(50004.1,40,50000));
    expect(near.rootTimer).toBe(1);expect(far.rootTimer).toBe(0);expect(far.position.x).toBe(50006);
});
