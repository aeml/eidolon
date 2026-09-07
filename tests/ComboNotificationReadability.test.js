import {jest} from '@jest/globals';
import * as THREE from 'three';
import {GameEngine} from '../src/core/GameEngine.js';

test.each([true,false])('local combo keeps its notification without duplicate phone floating text: mobile=%s',isMobile=>{
    const engine=Object.create(GameEngine.prototype);
    engine.isMobile=isMobile;engine.player={id:'caster',position:new THREE.Vector3()};
    engine.floatingTextManager={spawn:jest.fn()};engine.uiManager={showComboNotification:jest.fn()};
    engine.handleServerMessage({type:'combo',payload:{playerId:'caster',comboId:'mass_revival',comboName:'Mass Revival'}});
    expect(engine.uiManager.showComboNotification).toHaveBeenCalledWith('Mass Revival','mass_revival');
    expect(engine.floatingTextManager.spawn).toHaveBeenCalledTimes(isMobile?0:1);
    if(!isMobile)expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('COMBO: Mass Revival!',engine.player.position,'#ffd700');
});

test.each([true,false])('another player’s combo does not show a local notification: mobile=%s',isMobile=>{
    const engine=Object.create(GameEngine.prototype);
    engine.isMobile=isMobile;engine.player={id:'caster',position:new THREE.Vector3()};
    engine.floatingTextManager={spawn:jest.fn()};engine.uiManager={showComboNotification:jest.fn()};
    engine.handleServerMessage({type:'combo',payload:{playerId:'someone-else',comboId:'mass_revival',comboName:'Mass Revival'}});
    expect(engine.uiManager.showComboNotification).not.toHaveBeenCalled();
    expect(engine.floatingTextManager.spawn).not.toHaveBeenCalled();
});
