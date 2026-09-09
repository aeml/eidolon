import * as THREE from 'three';
import { GameEngine } from '../src/core/GameEngine.js';
import { Fighter } from '../src/entities/Fighter.js';
import { syncWellRested, wellRestedBuff } from '../src/core/WellRested.js';
import { PhoneStatusUI } from '../src/ui/PhoneStatusUI.js';

test('authoritative rest fields preserve partial updates and accept explicit expiry/departure', () => {
    const actor = {};
    syncWellRested(actor, { wellRestedSeconds: 123.456, safeZoneId: 'future-sanctuary' });
    syncWellRested(actor, {});
    expect(actor).toEqual({ wellRestedSeconds: 123.456, safeZoneId: 'future-sanctuary' });
    syncWellRested(actor, { wellRestedSeconds: 0, safeZoneId: '' });
    expect(actor).toEqual({ wellRestedSeconds: 0, safeZoneId: '' });
    for (const invalid of [NaN, Infinity, -10]) {
        syncWellRested(actor, { wellRestedSeconds: invalid });
        expect(actor.wellRestedSeconds).toBe(0);
    }
    syncWellRested(actor, { wellRestedSeconds: 99999 });
    expect(actor.wellRestedSeconds).toBe(7200);
});

test.each([[0, 'lanternhold'], [100, 'lanternhold'], [100, ''], [7200, 'lanternhold']])(
    'multiplayer render ticks cannot earn/spend rest or heal without server snapshots (%s, %s)', (bank, zone) => {
        const actor = new Fighter('rest-authority');
        actor.isMultiplayer = true;
        actor.stats.hp = 17;
        actor.stats.mana = 0;
        syncWellRested(actor, { wellRestedSeconds: bank, safeZoneId: zone });
        for (let tick = 0; tick < 60; tick++) actor.update(1, null, null, null);
        expect(actor.wellRestedSeconds).toBe(bank);
        expect(actor.stats.hp).toBe(17);
        expect(actor.stats.mana).toBe(0);
        syncWellRested(actor, { wellRestedSeconds: 2.5, safeZoneId: '' });
        expect(actor.wellRestedSeconds).toBe(2.5);
        actor.dispose();
    }
);

test('tracked buff states explain bank, cap, paused death and kill-only bonus without a wall-clock expiry', () => {
    const engine = Object.create(GameEngine.prototype);
    engine.player = { wellRestedSeconds: 123.4, safeZoneId: 'lanternhold' };
    let buff = engine.getActiveBuffs().find(entry => entry.id === 'well_rested');
    expect(buff.timeLabel).toBe('2m 04s / 2h · Resting · +1s each second');
    expect(buff.detail).toContain('+25% enemy-kill XP only');
    expect(buff.expiresAt).toBeUndefined();
    engine.player.safeZoneId = '';
    buff = engine.getActiveBuffs().find(entry => entry.id === 'well_rested');
    expect(buff.timeLabel).toContain('Counts down outside sanctuary');
    expect(wellRestedBuff({ wellRestedSeconds: 7200, safeZoneId: 'future' }).timeLabel).toBe('2h 00m / 2h · Fully rested');
    expect(wellRestedBuff({ wellRestedSeconds: 123, safeZoneId: 'future', state: 'DEAD' }).timeLabel).toContain('Paused in sanctuary');
    engine.player.wellRestedSeconds = 0;
    expect(engine.getActiveBuffs().some(entry => entry.id === 'well_rested')).toBe(false);
});

test.each(['high', 'low'])('replicated aura lifecycle remains transparent and never modifies the actor or hitbox (%s)', quality => {
    const scene = new THREE.Group();
    const actor = new Fighter('rested');
    actor.mesh = new THREE.Group();
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false }));
    actor.mesh.add(hitbox);
    actor.gameEngine = { renderSystem: { effectGroup: scene, graphicsQuality: quality } };
    const engine = Object.create(GameEngine.prototype);
    for (let cycle = 0; cycle < 10; cycle++) {
        engine.syncRemoteSupportEffects(actor, { wellRestedSeconds: 100, safeZoneId: 'lanternhold' });
        expect(scene.children).toHaveLength(1);
        const effect = actor.attachedStatusEffects.get('well_rested');
        actor.mesh.position.set(20, 2, 150);
        effect.update(1);
        expect(effect.group.position.toArray()).toEqual([20, 2, 150]);
        effect.group.traverse(part => {
            if (!part.isMesh) return;
            expect(part.geometry.type).not.toBe('BoxGeometry');
            expect(part.material.transparent).toBe(true);
            expect(part.material.depthWrite).toBe(false);
        });
        actor.stealthTimer = 3;
        actor.syncAttachedStatusEffects(0);
        expect(actor.attachedStatusEffects.has('well_rested')).toBe(false);
        actor.stealthTimer = 0;
        actor.state = 'DEAD';
        actor.syncAttachedStatusEffects(0);
        expect(scene.children).toHaveLength(0);
        actor.state = 'IDLE';
        actor.syncAttachedStatusEffects(0);
        expect(actor.attachedStatusEffects.has('well_rested')).toBe(true);
        engine.syncRemoteSupportEffects(actor, { wellRestedSeconds: 0, safeZoneId: '' });
        expect(scene.children).toHaveLength(0);
        expect(hitbox.material.opacity).toBe(0);
        expect(hitbox.material.colorWrite).toBe(false);
    }
    engine.syncRemoteSupportEffects(actor, { wellRestedSeconds: 100 });
    actor.dispose();
    expect(scene.children).toHaveLength(0);
});

test('phone rows show readable bank and sanctuary state without replacing the row on departure', () => {
    document.body.innerHTML = '<div id="ui"></div><div id="hud"></div>';
    const ui = new PhoneStatusUI(document.getElementById('ui'), document.getElementById('hud'));
    const actor = { wellRestedSeconds: 3661, safeZoneId: 'lanternhold' };
    const buff = () => ({ ...wellRestedBuff(actor), remainingSeconds: actor.wellRestedSeconds });
    ui.update([buff()], true, 'hero');
    const row = ui.rows.get('well_rested').root;
    expect(row.textContent).toContain('1h 01m / 2h');
    expect(row.textContent).toContain('Resting');
    actor.safeZoneId = '';
    ui.update([buff()], true, 'hero');
    expect(ui.rows.get('well_rested').root).toBe(row);
    expect(row.textContent).toContain('Counts down outside sanctuary');
    ui.dispose();
});
