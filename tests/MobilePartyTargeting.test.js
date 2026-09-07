import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AbilityController } from '../src/core/AbilityController.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Skeleton } from '../src/entities/Skeleton.js';
jest.unstable_mockModule('../src/proto/state_pb.js',()=>({default:{eidolon:{state:{}}},eidolon:{state:{}}}));
const {GameEngine}=await import('../src/core/GameEngine.js');
let engine,player,ally,enemy;
beforeEach(()=>{
    player=new Cleric('self');ally=new Fighter('ally');enemy=new Skeleton('enemy');
    player.position.set(0,0,0);ally.position.set(2,0,0);enemy.position.set(0,0,2);
    player.stats.mana=1000;player.abilityCooldown=0;player.useSkill=jest.fn();player.useAbility=jest.fn();
    engine=Object.create(GameEngine.prototype);
    Object.assign(engine,{player,isMobile:true,isMultiplayer:true,currentInstanceId:'town',
        uiManager:{social:{phoneParty:{selectedId:'ally'},partyData:{partyId:'group',members:[{id:'self'},{id:'ally'}]}},reportScreen:{style:{display:'none'}}},
        chunkManager:{getActiveEntities:()=>[player,ally,enemy]},inputManager:{keys:{}},network:{send:jest.fn()},
        refreshCombatIntentState:jest.fn(),showReadabilityFeedback:jest.fn()});
    engine.abilityController=new AbilityController(engine);engine.setMobileCombatTarget(enemy);
});
test.each(['Healing Light','Divine Intervention'])('%s addresses the chosen ally while preserving the selected enemy',skill=>{
    engine.abilityController.performAbility(null,skill);
    expect(engine.network.send).toHaveBeenCalledWith('ability',expect.objectContaining({targetId:'ally',targetX:2,targetZ:0,skillName:skill}));
    expect(engine.getMobileCombatTarget()).toBe(enemy);
});
test('damage skills still address the enemy, not the healing selection',()=>{
    engine.abilityController.performAbility(null,'Radiant Strike');
    expect(engine.network.send).toHaveBeenCalledWith('ability',expect.objectContaining({targetId:'enemy'}));
});
test('no selected ally means an explicit self-targeted heal',()=>{
    engine.uiManager.social.phoneParty.selectedId=null;engine.abilityController.performAbility(null,'Healing Light');
    expect(engine.network.send).toHaveBeenCalledWith('ability',expect.objectContaining({targetId:'self'}));
});
test.each(['dead','departed','missing','hostile'])('an unavailable %s ally does not silently turn the heal into a self cast',condition=>{
    if(condition==='dead')ally.stats.hp=0;
    if(condition==='departed')engine.uiManager.social.partyData.members=[];
    if(condition==='missing')engine.chunkManager.getActiveEntities=()=>[player,enemy];
    if(condition==='hostile')engine.isHostileActorTarget=e=>e===ally||e===enemy;
    engine.abilityController.performAbility(null,'Healing Light');
    expect(engine.network.send).not.toHaveBeenCalled();expect(player.useSkill).not.toHaveBeenCalled();
    expect(engine.showReadabilityFeedback).toHaveBeenCalledWith('mobile-ally-unavailable',expect.any(Object),700);
});
test('an out-of-range ally requires movement without auto-chasing or spending mana',()=>{
    ally.position.copy(new THREE.Vector3(100,0,0));engine.abilityController.performAbility(null,'Healing Light');
    expect(engine.network.send).not.toHaveBeenCalled();expect(player.useSkill).not.toHaveBeenCalled();
    expect(engine.pendingInteraction).toBeNull();
});
