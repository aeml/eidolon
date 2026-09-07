import fs from 'node:fs';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Actor } from '../src/entities/Actor.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { GameEngine } from '../src/core/GameEngine.js';

const cases=JSON.parse(fs.readFileSync('server/internal/game/testdata/cleric_immediate_area.json','utf8'));
describe.each(cases)('$skill rank $rank',tc=>{
    test.each([false,true])('actual offline body-padded effect: outside=%s',outside=>{
        const p=new Cleric('caster');p.unlockedSkills.push(tc.skill);p.talentRanks={CLR_34:tc.rank};p.stats.wisdom=10;
        p.stats.mana=200;p.stats.maxMana=200;
        p.position.set(60000,40,60000);
        const trumpet=tc.skill==="Heaven's Trumpet";
        const target=trumpet?new Actor('target',{}):new Wizard('target'); target.radius=5;
        target.position.set(p.position.x+tc.radius+5+(outside?.01:-.01),0,p.position.z); target.takeDamage=jest.fn();
        const engine={chunkManager:{getActiveEntities:()=>[target]},spawnTransientEffect:jest.fn(()=>true),
            floatingTextManager:{spawn:jest.fn()},isHostileActorTarget:e=>trumpet&&e===target};
        const mana=p.stats.mana;
        p.useAbility(p.position.clone().addScalar(100),engine,tc.skill);
        expect(p.stats.mana).toBe(mana-tc.cost);
        expect(p.cooldowns[tc.skill]).toBeCloseTo(tc.cooldown*(1-p.stats.cooldownReduction),8);
        if(trumpet) {
            expect(target.takeDamage).toHaveBeenCalledTimes(outside?0:1);
            if(!outside) expect(target.takeDamage).toHaveBeenCalledWith(30,p);
            expect(target.stunTimer).toBe(outside?0:3);expect(target.markWeaknessTimer).toBe(outside?0:5);
        } else {
            const key=tc.skill==='Blessing of Resolve'?'blessingResolveTimer':'blessingZealTimer';
            const duration=tc.skill==='Blessing of Resolve'?20:8;
            expect(target[key]).toBe(outside?0:duration);expect(p[key]).toBe(duration);
        }
        const rings=engine.spawnTransientEffect.mock.calls.filter(c=>c[0]==='ring');
        expect(rings).toHaveLength(1);expect(rings[0][3].radius).toBeCloseTo(tc.radius,8);
    });
    test.each(['high','low'])('%s local and rank-private remote mesh boundaries',quality=>{
        for(const remote of [false,true]) {
            const p={id:'caster',meshType:'Cleric',position:new THREE.Vector3(60000,40,60000),mesh:new THREE.Group(),...(remote?{}:{talentRanks:{CLR_34:tc.rank}})};
            const engine={effects:[],uiManager:{getGraphicsQuality:()=>quality},
                renderSystem:{effectGroup:new THREE.Group(),getEffectQualityScale:()=>1},spawnTransientEffect:GameEngine.prototype.spawnTransientEffect};
            try {
                if(remote) new AbilityController(engine).triggerRemoteAbilityVisuals(p,tc.skill,p.position.x+3,p.position.z,{radius:tc.radius,arc:2*Math.PI});
                else Actor.prototype.spawnAbilityPresentation.call(p,engine,tc.skill,new THREE.Vector3(60100,0,60100));
                const shapes=engine.effects.filter(e=>e.abilityShape); expect(shapes).toHaveLength(1);
                const root=shapes[0].meshes[0],boundary=root.children.find(c=>c.userData.normalizedGameplayRadius===1);
                expect(root.position.x).toBe(p.position.x+(remote?3:0));
                expect(boundary.scale.x).toBeCloseTo(tc.radius,8);expect(shapes[0].abilityShape.arc).toBeCloseTo(2*Math.PI,8);
            } finally {engine.effects.forEach(e=>e.dispose());}
        }
    });
});

test.each([false,true])('Trumpet respects walls and CC immunity: doorway=%s',doorway=>{
    const p=new Cleric('trumpet');p.unlockedSkills.push("Heaven's Trumpet");p.position.set(50009,40,50000);
    p.stats.mana=200;p.stats.maxMana=200;
    const target=new Actor('immune',{});target.position.set(50011,0,50000);target.ccImmune=true;target.takeDamage=jest.fn();
    const rects=[{x:50000,z:50000,width:20,height:20},{x:50020.5,z:50000,width:20,height:20}];
    if(doorway) rects.push({x:50010,z:50000,width:5,height:6});
    const engine={currentInstanceId:'dungeon_trumpet',currentDungeonLayout:{walkRects:rects},chunkManager:{getActiveEntities:()=>[target]},
        spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()},isHostileActorTarget:()=>true};
    p.useAbility(p.position.clone(),engine,"Heaven's Trumpet");
    expect(target.takeDamage).toHaveBeenCalledTimes(doorway?1:0);expect(target.stunTimer).toBe(0);
    expect(target.markWeaknessTimer).toBe(doorway?5:0);
});

test.each(['Blessing of Resolve','Blessing of Zeal',"Heaven's Trumpet"])('%s excludes dead/inactive and respects PvP allegiance',skill=>{
    const p=new Cleric('caster');p.unlockedSkills.push(skill);
    p.stats.mana=200;p.stats.maxMana=200;
    const targets=['ally','opponent','dead','inactive'].map(id=>{
        const e=new Wizard(id);e.takeDamage=jest.fn();if(id==='dead')e.state='DEAD';if(id==='inactive')e.isActive=false;return e;
    });
    const engine={chunkManager:{getActiveEntities:()=>targets},spawnTransientEffect:jest.fn(()=>true),floatingTextManager:{spawn:jest.fn()},isHostileActorTarget:e=>e.id==='opponent'};
    p.useAbility(p.position.clone(),engine,skill);
    for(const e of targets) {
        if(skill==="Heaven's Trumpet") expect(e.takeDamage).toHaveBeenCalledTimes(e.id==='opponent'?1:0);
        else expect((e.blessingResolveTimer>0||e.blessingZealTimer>0)).toBe(e.id==='ally');
    }
});
