import {jest} from '@jest/globals';
import * as THREE from 'three';
import {Cleric} from '../src/entities/Cleric.js';
import {Wizard} from '../src/entities/Wizard.js';
import {Actor} from '../src/entities/Actor.js';

function fixture(){
    const p=new Cleric('caster');p.mesh=new THREE.Group();
    p.position.set(60000,40,60000);p.stats.wisdom=10;p.stats.damage=50;
    p.stats.hp=100;p.stats.maxHp=500;p.stats.mana=1000;p.stats.maxMana=1000;
    p.unlockedSkills.push('Healing Light','Radiant Strike','Divine Intervention','Purifying Wave');
    const entities=[];
    const engine={chunkManager:{getActiveEntities:()=>entities},spawnTransientEffect:jest.fn(()=>true),
        floatingTextManager:{spawn:jest.fn()},isHostileActorTarget:e=>Boolean(e.hostile)};
    const add=(id,x,z=0,hostile=false)=>{
        const e=new Wizard(id);e.position.set(p.position.x+x,0,p.position.z+z);e.radius=5;
        e.stats.hp=100;e.stats.maxHp=500;e.stats.hpRegen=0;e.hostile=hostile;
        e.takeDamage=jest.fn(amount=>{e.stats.hp-=amount;});entities.push(e);return e;
    };
    return {p,engine,add,entities};
}

test.each([0,1,5])('offline trained Radiant Strike hits the planar padded cone, rank %s',rank=>{
    const {p,engine,add}=fixture();p.talentRanks={CLR_34:rank};
    const radius=3*(1+.03*rank);
    const inside=add('inside',radius+5-.01,0,true),outside=add('outside',radius+5+.01,0,true);
    const side=add('side',0,2,true),ally=add('ally',1),dead=add('dead',1,0,true),inactive=add('inactive',1,0,true);
    dead.state='DEAD';inactive.isActive=false;
    p.useAbility(new THREE.Vector3(p.position.x+1,0,p.position.z),engine,'Radiant Strike');
    expect(inside.takeDamage).toHaveBeenCalledWith(70,p);
    for(const e of [outside,side,ally,dead,inactive])expect(e.takeDamage).not.toHaveBeenCalled();
    expect(p.stats.mana).toBe(980);expect(p.cooldowns['Radiant Strike']).toBeCloseTo(4*(1-p.stats.cooldownReduction));
    expect(engine.spawnTransientEffect.mock.calls.filter(c=>c[0]==='cone')).toHaveLength(1);
});

test.each([0,1,5])('offline Beacon uses the resolved ally center and trained padded edge, rank %s',rank=>{
    const {p,engine,add}=fixture();p.talentRanks={CLR_34:rank};p.skillRunes={'Healing Light':'healinglight_beacon'};
    const primary=add('primary',8),radius=5*(1+.03*rank);
    const edge=add('edge',8+radius+5-.01),outside=add('outside',8+radius+5+.01),enemy=add('enemy',9,0,true);
    const dead=add('dead',9),inactive=add('inactive',9);dead.state='DEAD';inactive.isActive=false;
    p.useAbility(new THREE.Vector3(primary.position.x+1,0,primary.position.z),engine,'Healing Light');
    expect(primary.stats.hp).toBe(160);expect(edge.stats.hp).toBe(160);
    for(const e of [outside,enemy,dead,inactive])expect(e.stats.hp).toBe(100);
    expect(p.stats.hp).toBe(100);expect(p.stats.mana).toBe(975);expect(p.cooldowns['Healing Light']).toBeCloseTo(8*(1-p.stats.cooldownReduction));
    const ring=engine.spawnTransientEffect.mock.calls.find(c=>c[0]==='ring');
    expect(ring[1].x).toBe(primary.position.x);expect(ring[3].radius).toBeCloseTo(radius);
});

test.each([false,true])('offline hostile cone respects cover; friendly Beacon still crosses it: doorway=%s',doorway=>{
    for(const skill of ['Radiant Strike','Healing Light']){
        const {p,engine,add}=fixture();p.position.set(50009,40,50000);
        const target=add('across-wall',2,0,skill==='Radiant Strike');
        engine.currentInstanceId='dungeon_cleric';engine.currentDungeonLayout={walkRects:[
            {x:50000,z:50000,width:20,height:20},{x:50020.5,z:50000,width:20,height:20},
            ...(doorway?[{x:50010,z:50000,width:5,height:6}]:[])]};
        p.skillRunes={'Healing Light':'healinglight_beacon'};
        p.useAbility(skill==='Healing Light'?p.position.clone():target.position,engine,skill);
        if(skill==='Radiant Strike')expect(target.takeDamage).toHaveBeenCalledTimes(doorway?1:0);
        else expect(target.stats.hp).toBe(160);
    }
});

test.each(['combo','expired','intervening','failed'])('offline normal Mass Revival sequence: %s',mode=>{
    jest.spyOn(Date,'now').mockReturnValue(10000);
    const {p,engine,add}=fixture();p.talentRanks={CLR_34:5};
    const edge=add('edge',23+5-.01),outside=add('outside',23+5+.01);
    try{
        p.useAbility(p.position.clone(),engine,'Divine Intervention');
        if(mode==='expired')Date.now.mockReturnValue(14000);
        if(mode==='intervening')p.useAbility(p.position.clone(),engine,'Purifying Wave');
        if(mode==='failed'){
            p.stats.mana=0;p.useAbility(p.position.clone(),engine,'Purifying Wave');p.stats.mana=500;
        }
        engine.spawnTransientEffect.mockClear();p.useAbility(p.position.clone(),engine,'Healing Light');
        const active=mode==='combo'||mode==='failed';
        expect(edge.stats.hp).toBe(active?160:100);expect(outside.stats.hp).toBe(100);
        const rings=engine.spawnTransientEffect.mock.calls.filter(c=>c[0]==='ring');
        expect(rings).toHaveLength(active?1:0);
        if(active){expect(rings[0][1].x).toBe(p.position.x);expect(rings[0][3].radius).toBe(23);}
    }finally{jest.restoreAllMocks();}
});

test('offline direct healing uses actual healing bonuses, poison and missing-health clamp',()=>{
    const {p,engine,add}=fixture();p.talentRanks={CLR_03:5,CLR_29:5};p.stats.healingDoneBonus=.1;
    const target=add('primary',8);target.poisonTimer=5;
    p.useAbility(target.position,engine,'Healing Light');
    // floor(60*1.1)=66; floor(66*1.35)=89; poison halves and floors to 44.
    expect(target.stats.hp).toBe(144);expect(p.stats.hp).toBe(100);
    p.cooldowns['Healing Light']=0;target.stats.hp=499;
    p.useAbility(target.position,engine,'Healing Light');expect(target.stats.hp).toBe(500);
    expect(engine.floatingTextManager.spawn).toHaveBeenLastCalledWith('+1',target.position,'#00ff00');
});

test.each(['enemy','dead','inactive','too-far','wall'])('offline direct heal falls back to self for %s target',kind=>{
    const {p,engine,add}=fixture();const target=add('invalid',kind==='too-far'?30:8,0,kind==='enemy');
    if(kind==='dead')target.state='DEAD';if(kind==='inactive')target.isActive=false;
    if(kind==='wall'){
        engine.currentInstanceId='dungeon_heal';engine.currentDungeonLayout={walkRects:[
            {x:60000,z:60000,width:4,height:4},{x:60008,z:60000,width:4,height:4}]};
    }
    p.useAbility(target.position,engine,'Healing Light');
    expect(target.stats.hp).toBe(100);expect(p.stats.hp).toBe(160);
    const pillar=engine.spawnTransientEffect.mock.calls.find(c=>c[0]==='pillar');expect(pillar[1].x).toBe(p.position.x);
});

test('offline Renewal ticks five times on the recipient, even when stunned, without repeating talent bonuses',()=>{
    const {p,engine,add}=fixture();p.skillRunes={'Healing Light':'healinglight_renewal'};
    const target=add('renewal',8);p.useAbility(target.position,engine,'Healing Light');
    expect(target.stats.hp).toBe(160);target.stunTimer=10;
    for(let i=0;i<6;i++)Actor.prototype.update.call(target,1,null,null,[]);
    expect(target.stats.hp).toBe(170);
});

test('offline Divine rune cleanses one debuff, in server priority order',()=>{
    const {p,engine,add}=fixture();p.skillRunes={'Healing Light':'healinglight_divine'};
    const target=add('cleanse',8);target.stunTimer=5;target.rootTimer=5;target.poisonTimer=5;
    p.useAbility(target.position,engine,'Healing Light');
    expect(target.stunTimer).toBe(0);expect(target.rootTimer).toBe(5);expect(target.poisonTimer).toBe(5);
});

test.each(['Radiant Strike','Healing Light'])('online %s never mutates local target health or applies offline mechanics',skill=>{
    const {p,engine,add}=fixture();engine.isMultiplayer=true;
    const target=add('target',1,0,skill==='Radiant Strike');
    p.useAbility(target.position,engine,skill);
    expect(target.stats.hp).toBe(100);expect(target.takeDamage).not.toHaveBeenCalled();expect(p.stats.hp).toBe(100);
});

test.each(['radiantstrike_smite','radiantstrike_chains','radiantstrike_purge'])('offline Radiant Strike retains mastery and rune %s',rune=>{
    const {p,engine,add}=fixture();p.talentRanks={CLR_11:5,CLR_12:5};p.skillRunes={'Radiant Strike':rune};
    const target=add('rune-target',2,0,true);target.blessingZealTimer=5;target.blessingZealFactor=.35;target.shieldHP=200;
    const immune=add('immune',2,1,true);immune.ccImmune=true;
    p.useAbility(target.position,engine,'Radiant Strike');
    expect(target.takeDamage).toHaveBeenCalledWith(rune==='radiantstrike_smite'?126:84,p);
    expect(p.cooldowns['Radiant Strike']).toBeCloseTo(4*(1-p.stats.cooldownReduction)*.85);
    // Five CLR_12 Technique ranks extend the two-second rune root by10%.
    expect(target.rootTimer).toBe(rune==='radiantstrike_chains'?2.2:0);expect(immune.rootTimer).toBe(0);
    expect(target.blessingZealTimer).toBe(rune==='radiantstrike_purge'?0:5);
    expect(target.shieldHP).toBe(200); // Purge removes only the first buff.
});

test('offline Radiant Strike set healing uses actual post-shield damage, not the nominal hit',()=>{
    const {p,engine,add}=fixture();p.activeSetBonuses={crusader:{specials:{radiantStrikeLifesteal:100}}};
    const target=add('shielded',2,0,true);target.shieldHP=50;
    target.takeDamage=jest.fn((amount,source)=>Actor.prototype.takeDamage.call(target,amount,source));
    p.useAbility(target.position,engine,'Radiant Strike');
    expect(target.stats.hp).toBe(80);expect(p.stats.hp).toBe(120);
});

test.each(['dead','replica','multiplayer','inactive'])('Renewal never heals a %s recipient',state=>{
    const {p,engine,add}=fixture();p.skillRunes={'Healing Light':'healinglight_renewal'};
    const target=add('renewal',8);p.useAbility(target.position,engine,'Healing Light');
    if(state==='dead')target.state='DEAD';if(state==='replica')target.isRemote=true;
    if(state==='multiplayer')target.isMultiplayer=true;if(state==='inactive')target.isActive=false;
    Actor.prototype.update.call(target,1,null,null,[]);
    expect(target.stats.hp).toBe(160);expect(target.healingLightRenewal).toBeNull();
});

test.each(['healinglight_renewal','healinglight_divine'])('Mass Revival does not inherit %s single-target side effects',rune=>{
    const {p,engine,add}=fixture();p.skillRunes={'Healing Light':rune};const ally=add('ally',10);ally.rootTimer=5;
    p.useAbility(p.position.clone(),engine,'Divine Intervention');p.useAbility(ally.position,engine,'Healing Light');
    expect(ally.stats.hp).toBe(160);expect(ally.rootTimer).toBe(5);expect(ally.healingLightRenewal).toBeUndefined();
    expect(p.healingLightMassRevival).toBe(false);
});

test('cancelling abilities clears offline combo eligibility',()=>{
    const {p,engine,add}=fixture();const ally=add('ally',22);
    p.useAbility(p.position.clone(),engine,'Divine Intervention');p.cancelAbilities();
    p.useAbility(p.position.clone(),engine,'Healing Light');expect(ally.stats.hp).toBe(100);
});
