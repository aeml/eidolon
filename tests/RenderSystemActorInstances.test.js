import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';

function fixture() {
    const render = new RenderSystem(false);
    render.setActorInstancesEnabled(true);
    const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
    const roots = [0, 1].map(index => {
        const root = new THREE.Group(); root.userData.proceduralHumanoid = true;
        root.position.x = index * 2; root.add(new THREE.Mesh(geometry, material));
        render.entityGroup.add(root); return root;
    });
    const begin = () => { render.scene.updateMatrixWorld(true); render.actorInstances.beginFrame(); };
    return { render, geometry, material, roots, begin };
}

test('candidate is disabled by default and cannot be reactivated after retirement', () => {
    const render = new RenderSystem(false);
    expect(render.actorInstances).toBeNull(); render.dispose();
    render.setActorInstancesEnabled(true); expect(render.actorInstances).toBeNull();
});

test('actual entity-group streaming registers, retires and re-registers models', () => {
    const f = fixture();
    try {
        expect(f.render.actorInstances.roots.size).toBe(2); f.begin();
        expect(f.render.actorInstances.batches.size).toBe(1); f.render.actorInstances.endFrame();
        f.roots[1].removeFromParent(); expect(f.render.actorInstances.roots.size).toBe(1); f.begin();
        expect(f.render.actorInstances.batches.size).toBe(0); f.render.actorInstances.endFrame();
        f.render.add(f.roots[1]); f.begin(); expect(f.render.actorInstances.batches.size).toBe(1);
    } finally { f.render.dispose(); }
});

test.each(['direct', 'composer'])('%s failure restores original visibility before returning control', path => {
    const f = fixture();
    try {
        f.render.usePostProcessing = path === 'composer';
        const submission = path === 'composer' ? f.render.composer : f.render.renderer;
        jest.spyOn(submission, 'render').mockImplementationOnce(() => { f.begin(); throw Error('mid-frame failure'); });
        expect(() => f.render.render()).toThrow('mid-frame failure');
        f.roots.forEach(root => expect(root.children[0].visible).toBe(true));
        expect(f.render.actorInstances.group.visible).toBe(false);
        expect(f.render.renderer.info.autoReset).toBe(true);
    } finally { f.render.dispose(); }
});

test('scene reset releases owned buffers immediately without disposing borrowed surfaces', () => {
    const f = fixture();
    try {
        f.begin();
        const batch = [...f.render.actorInstances.batches.values()][0];
        const release = jest.spyOn(batch, 'dispose'), geometry = jest.spyOn(f.geometry, 'dispose');
        const material = jest.spyOn(f.material, 'dispose');
        f.render.clearInstanceScene(); f.render.clearInstanceScene();
        expect(release).toHaveBeenCalledTimes(1); expect(geometry).not.toHaveBeenCalled(); expect(material).not.toHaveBeenCalled();
        expect(f.render.actorInstances.batches.size).toBe(0); expect(f.render.actorInstances.roots.size).toBe(0);
        f.roots.forEach(root => expect(root.children[0].visible).toBe(true));
        f.roots.forEach(root => f.render.add(root)); f.begin(); expect(f.render.actorInstances.batches.size).toBe(1);
    } finally { f.render.dispose(); }
});

test('disabling removes only owned hooks and streaming listeners', () => {
    const f = fixture();
    try {
        const helper = f.render.actorInstances, before = helper.before, after = helper.after;
        f.begin(); f.render.setActorInstancesEnabled(false); f.render.setActorInstancesEnabled(false);
        expect(f.render.actorInstances).toBeNull(); expect(helper.roots.size).toBe(0); expect(helper.batches.size).toBe(0);
        expect(helper.group.parent).toBeNull(); expect(f.render.scene.onBeforeRender).toBe(before);
        expect(f.render.scene.onAfterRender).toBe(after);
        f.roots[1].removeFromParent(); f.render.add(f.roots[1]); expect(helper.roots.size).toBe(0);
        f.roots.forEach(root => expect(root.children[0].visible).toBe(true));
    } finally { f.render.dispose(); }
});
