import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';
import { resolveRemoteSkillVisual } from '../src/skills/skillVisuals.js';

function engineFor(player, quality = 'high') {
    const engine = {player, effects: [], uiManager: {getGraphicsQuality: () => quality},
        renderSystem: {effectGroup: new THREE.Group(), getEffectQualityScale: () => 1},
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect};
    engine.abilityController = new AbilityController(engine);
    return engine;
}
test.each([0, 1, 5])('rank %s applies to the Cleric cone, Beacon and Mass Revival previews', rank => {
    const source = {talentRanks: {CLR_34: rank}};
    const multiplier = 1 + .03 * rank;
    expect(getAbilityAoeRadius('Cleric', 'Radiant Strike', source)).toBeCloseTo(3 * multiplier);
    expect(getAbilityAoeRadius('Cleric', 'Healing Light', source)).toBeNull();
    source.skillRunes = {'Healing Light': 'healinglight_beacon'};
    expect(getAbilityAoeRadius('Cleric', 'Healing Light', source)).toBeCloseTo(5 * multiplier);
    source.healingLightMassRevival = true;
    expect(getAbilityAoeRadius('Cleric', 'Healing Light', source)).toBeCloseTo(20 * multiplier);
});

test.each(['high', 'low'])('%s remote casts use accepted shapes without private ranks or runes', quality => {
    const player = new Cleric('remote'); player.mesh = new THREE.Group(); player.position.set(60000, 40, 60000);
    for (const [skill, radius, arc] of [['Radiant Strike', 3.45, 2*Math.PI/3], ['Healing Light', 5.75, 2*Math.PI], ['Healing Light', 23, 2*Math.PI]]) {
        const engine = engineFor(player, quality);
        try {
            engine.abilityController.triggerRemoteAbilityVisuals(player, skill, 60008, 60000, {radius, arc, shapeResolved:true});
            const shapes = engine.effects.filter(e => e.abilityShape);
            expect(shapes).toHaveLength(1);
            expect(shapes[0].abilityShape.radius).toBeCloseTo(radius);
            expect(shapes[0].abilityShape.arc).toBeCloseTo(arc);
            const root = shapes[0].meshes[0];
            expect(root.userData.gameplayRadius).toBeCloseTo(radius);
            if (skill === 'Healing Light') expect(root.position.x).toBe(60008);
        } finally { engine.effects.forEach(effect => effect.dispose()); }
    }
});

test('a resolved single-target heal removes a stale predicted Beacon without replaying animation', () => {
    const p = new Cleric('local'); p.mesh = new THREE.Group(); p.skillRunes = {'Healing Light': 'healinglight_beacon'};
    p.playAbilityAnimation = jest.fn();
    const engine = engineFor(p);
    try {
        Actor.prototype.spawnAbilityPresentation.call(p, engine, 'Healing Light', new THREE.Vector3(8, 0, 0));
        const ring = engine.effects.find(e => e.abilityShape);
        expect(ring).toBeDefined();
        engine.abilityController.reconcileLocalAbilityShape({skillName:'Healing Light',targetX:4,targetZ:0,shapeResolved:true});
        expect(ring.isActive).toBe(false);
        expect(engine.effects.filter(e => e.abilityShape)).toHaveLength(0);
        expect(p.playAbilityAnimation).not.toHaveBeenCalled();
        const remote = resolveRemoteSkillVisual(p, 'Healing Light', new THREE.Vector3(4,0,0), {shapeResolved:true});
        expect(remote.layers.some(layer => layer.type === 'ring')).toBe(false);
    } finally { engine.effects.forEach(effect => effect.dispose()); }
});

test.each(['mobile', 'desktop', 'pending'])('%s Radiant Strike intent uses the trained planar body edge', mode => {
    const p = new Cleric('caster'); p.mesh = new THREE.Group(); p.talentRanks = {CLR_34:5};
    p.position.set(60000,40,60000); p.stats.mana = 200;
    p.useSkill = jest.fn(); p.move = jest.fn();
    const target = new Actor('large-target',{}); target.radius = 5;
    target.position.set(60000+3.45+5-.01,0,60000);
    const engine = {player:p,isMultiplayer:true,isMobile:mode==='mobile',network:{send:jest.fn()},
        uiManager:{reportScreen:{style:{display:'none'}}},hoveredEntity:target,
        getMobileCombatTarget:()=>target,showReadabilityFeedback:jest.fn()};
    const controller = new AbilityController(engine);
    if(mode === 'pending') {
        controller.pendingAbilityTarget = target; controller.pendingAbilitySkill = 'Radiant Strike';
        controller.updatePendingTarget();
    } else controller.performAbility(null,'Radiant Strike');
    expect(engine.network.send).toHaveBeenCalledWith('ability',expect.objectContaining({skillName:'Radiant Strike',targetId:target.id}));
    expect(p.useSkill).toHaveBeenCalledTimes(1); expect(p.move).not.toHaveBeenCalled();
    engine.network.send.mockClear(); p.useSkill.mockClear(); target.position.x += .02;
    if(mode === 'pending') {
        controller.pendingAbilityTarget = target; controller.pendingAbilitySkill = 'Radiant Strike';
        controller.updatePendingTarget();
    } else controller.performAbility(null,'Radiant Strike');
    expect(engine.network.send).not.toHaveBeenCalled(); expect(p.useSkill).not.toHaveBeenCalled();
});

test.each(['high','low'])('%s accepted Beacon moves a same-sized prediction to the actual healing target', quality => {
    const p = new Cleric('caster'); p.mesh = new THREE.Group(); p.skillRunes = {'Healing Light':'healinglight_beacon'};
    p.playAbilityAnimation = jest.fn();
    const engine = engineFor(p,quality);
    try {
        Actor.prototype.spawnAbilityPresentation.call(p,engine,'Healing Light',new THREE.Vector3(8,0,0));
        const original = engine.effects.find(e=>e.abilityShape);
        const payload = {sourceId:p.id,skillName:'Healing Light',targetX:7,targetZ:0,radius:5,arc:2*Math.PI,shapeResolved:true};
        GameEngine.prototype.handleServerMessage.call(engine,{type:'ability',payload});
        expect(original.isActive).toBe(false);
        const shapes = engine.effects.filter(e=>e.abilityShape);
        expect(shapes).toHaveLength(1); expect(shapes[0].meshes[0].position.x).toBe(7);
        GameEngine.prototype.handleServerMessage.call(engine,{type:'ability',payload});
        expect(engine.effects.filter(e=>e.abilityShape)).toEqual(shapes);
        expect(p.playAbilityAnimation).not.toHaveBeenCalled();
    } finally { engine.effects.forEach(e=>e.dispose()); }
});
