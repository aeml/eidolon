import * as THREE from 'three';
import { EnemyHealthBars } from '../src/ui/EnemyHealthBars.js';

function fixture(mobile = false) {
    document.body.innerHTML = '<div id="ui-layer"></div>';
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, .1, 100);
    camera.position.set(0, 6, 18); camera.lookAt(0, 2, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const bars = new Map(), manager = new EnemyHealthBars(document.getElementById('ui-layer'), bars, mobile);
    const enemy = (id, hp = 100) => {
        const mesh = new THREE.Group(); mesh.userData.bounds = { height: 2.5 };
        return { id, mesh, name: 'Skeleton', isActive: true, state: 'IDLE', position: new THREE.Vector3(), stats: { hp, maxHp: 100 } };
    };
    return { camera, bars, manager, enemy };
}

test('damaged and selected enemies stay visible without hover, full-health idle enemies do not', () => {
    const { manager, enemy, camera, bars } = fixture();
    const hurt = enemy('hurt', 60), idle = enemy('idle'), selected = enemy('selected');
    manager.reconcile([hurt, idle, selected], null, false, selected, 0);
    manager.updatePositions(camera, 0);
    expect([...bars.keys()]).toEqual(['selected', 'hurt']);
    expect(bars.get('selected').classList.contains('floating-bar--selected')).toBe(true);
    expect(bars.get('hurt').getAttribute('aria-valuenow')).toBe('60');
    manager.reconcile([hurt, idle, selected], null, true, null, 10);
    manager.updatePositions(camera, 10); expect(bars.size).toBe(3);
    hurt.stats.hp = 100;
    manager.reconcile([hurt, idle, selected], null, false, null, 20);
    manager.updatePositions(camera, 20); expect(bars.size).toBe(0);
});

test('projection follows interpolated meshes and camera without another health reconciliation', () => {
    const { manager, enemy, camera, bars } = fixture(); const actor = enemy('enemy', 60);
    manager.reconcile([actor], null, false, null, 0); manager.updatePositions(camera, 0);
    const bar = bars.get(actor.id), before = bar.style.transform;
    actor.mesh.position.x = 3; manager.updatePositions(camera, 16);
    expect(bar.style.transform).not.toBe(before);
    expect(actor.position.toArray()).toEqual([0, 0, 0]);
    const moved = bar.style.transform;
    camera.position.x = 2; camera.lookAt(0, 2, 0); manager.updatePositions(camera, 32);
    expect(bar.style.transform).not.toBe(moved);
    actor.mesh.position.x = 1000; manager.updatePositions(camera, 48); expect(bars.size).toBe(0);
    actor.mesh.position.x = 0; manager.updatePositions(camera, 64);
    expect(bars.get(actor.id)).toBe(bar);
    actor.mesh.userData.bounds.height = 5; actor.mesh.scale.y = 1.2;
    manager.updatePositions(camera, 80);
    expect(bar.style.transform).not.toBe(moved);
});

test('damage trail reports the old amount briefly, resolves, and snaps on healing or reduced motion', () => {
    const { manager, enemy, camera, bars } = fixture(); const actor = enemy('enemy');
    manager.reconcile([actor], actor, false, null, 0); manager.updatePositions(camera, 0);
    actor.stats.hp = 40; manager.reconcile([actor], actor, false, null, 100); manager.updatePositions(camera, 100);
    const bar = bars.get(actor.id);
    expect(bar._fill.style.transform).toBe('scaleX(0.4)');
    expect(bar._trail.style.transform).toBe('scaleX(1)');
    manager.updatePositions(camera, 560); expect(bar._trail.style.transform).toBe('scaleX(0.4)');
    actor.stats.hp = 60; manager.reconcile([actor], actor, false, null, 600); manager.updatePositions(camera, 600);
    expect(bar._trail.style.transform).toBe('scaleX(0.6)');
    actor.stats.hp = 30; manager.reconcile([actor], actor, false, null, 700);
    manager.reducedMotion = { matches: true }; manager.updatePositions(camera, 700);
    expect(bar._trail.style.transform).toBe('scaleX(0.3)');
});

test.each([false, true])('crowds are bounded, target prioritized and pooled styles reset (mobile=%s)', mobile => {
    const { manager, enemy, camera, bars } = fixture(mobile);
    const actors = Array.from({ length: 35 }, (_, i) => enemy(`enemy-${i}`, 50));
    manager.reconcile(actors, null, false, actors[34], 0); manager.updatePositions(camera, 0);
    expect(bars.size).toBe(mobile ? 12 : 24); expect(bars.has('enemy-34')).toBe(true);
    manager.reconcile([], null, false, null, 10); manager.updatePositions(camera, 10);
    const next = enemy('new-enemy', 85);
    manager.reconcile([next], null, false, null, 20); manager.updatePositions(camera, 20);
    const bar = bars.get(next.id);
    expect(bar.classList.contains('floating-bar--selected')).toBe(false);
    expect(bar._trail.style.transform).toBe('scaleX(0.85)');
    expect(bar.dataset.entityId).toBe(next.id);
    manager.clear();
    expect(document.querySelectorAll('.floating-bar')).toHaveLength(0);
    expect(manager.records.size).toBe(0); expect(manager.pool).toHaveLength(0);
});

test('invalid values, dead/hidden actors and behind-camera meshes cannot leave ghost bars', () => {
    const { manager, enemy, camera, bars } = fixture(); const actor = enemy('enemy', 50);
    manager.reconcile([actor], actor, true, actor, 0); manager.updatePositions(camera, 0);
    actor.state = 'DEAD'; manager.updatePositions(camera, 10); expect(bars.size).toBe(0);
    actor.state = 'IDLE'; actor.mesh.visible = false; manager.updatePositions(camera, 20); expect(bars.size).toBe(0);
    actor.mesh.visible = true; actor.mesh.position.z = 40; manager.updatePositions(camera, 30); expect(bars.size).toBe(0);
    for (const [hp, max] of [[NaN, 100], [100, 0], [100, Infinity], [-1, 100]]) {
        actor.stats = { hp, maxHp: max }; manager.reconcile([actor], actor, true, actor, 40);
        expect(manager.records.size).toBe(0);
    }
});
