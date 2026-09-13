import * as THREE from 'three';
import { PublicEventController } from '../src/core/PublicEventController.js';
import { SocialPresenceController } from '../src/core/SocialPresenceController.js';

const event = { id: 'ember-1', site: { x: -1250, z: 200, title: 'Ashes Without a Hearth', realm: 'fire',
    objective: 'Stand on the rim.', lore: '<b>The old road remembers.</b>', level: 72 },
    phase: 'defending', runeX: -1250, runeZ: 200, radius: 22, innerRadius: 12,
    wave: 2, charge: 11, chargeNeeded: 20, remaining: 4, participants: 2, endsAt: new Date(Date.now() + 60000).toISOString() };

test('authoritative event renders exact rings and optional nearby objective without quest entries', () => {
    const engine = { player: { position: new THREE.Vector3(-1250, 0, 200) }, renderSystem: { scene: new THREE.Scene() } };
    const controller = new PublicEventController(engine);
    const router = new SocialPresenceController({ uiManager: { publicEvents: controller } });
    expect(router.handleMessage({ type: 'public_event', payload: event })).toBe(true);
    expect(controller.root.hidden).toBe(false); expect(controller.root.open).toBe(false);
    expect(controller.summary.textContent).toContain('Wave 2/3');
    expect(controller.lore.querySelector('b')).toBeNull();
    expect(controller.marker.position.x).toBe(-1250);
    expect(controller.ring.scale.x).toBe(22); expect(controller.inner.scale.x).toBe(12);
    expect(controller.progress.value).toBe(11);
    controller.root.open = true; controller.updateState({ ...event, charge: 12 });
    expect(controller.root.open).toBe(true);
    engine.currentInstanceId = 'dungeon'; controller.update(.016);
    expect(controller.root.hidden).toBe(true); expect(controller.marker.visible).toBe(false);
    engine.currentInstanceId = ''; engine.player.position.x = 0; controller.update(.016);
    expect(controller.root.hidden).toBe(true);
    controller.dispose(); expect(engine.renderSystem.scene.children).toHaveLength(0);
});

test('completion has no claim button; expired and cleared snapshots hide both UI and rune', () => {
    const engine = { player: { position: new THREE.Vector3(-1250, 0, 200) }, renderSystem: { scene: new THREE.Scene() } };
    const controller = new PublicEventController(engine);
    controller.updateState({ ...event, phase: 'complete', calmedUntil: new Date(Date.now() + 300000).toISOString() });
    expect(controller.status.textContent).toContain('no reward to claim');
    expect(controller.progress.hidden).toBe(true);
    expect(controller.root.querySelector('button')).toBeNull();
    controller.updateState({ ...event, phase: 'expired' });
    expect(controller.root.hidden).toBe(true); expect(controller.marker.visible).toBe(false);
    controller.updateState(null); expect(controller.data).toBeNull();
    controller.dispose();
});
