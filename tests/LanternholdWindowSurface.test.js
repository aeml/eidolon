import * as THREE from 'three';
import { applyLanternholdWindowSurface } from '../src/art/LanternholdWindowSurface.js';
import { createLanternholdNeighborhood } from '../src/art/LanternholdNeighborhood.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test('households keep independent glass controls and the original opaque pane geometry route', () => {
    const roots = ['high', 'low'].map(quality => createLanternholdNeighborhood(0, 200, { quality, perInstanceFrustum: true }));
    try {
        const panes = roots.map(root => root.getObjectByName('residential-shacks:window'));
        expect(roots.every(root => root.children.length === 6 && root.userData.walkFootprints.length === 15)).toBe(true);
        for (const pane of panes) {
            expect(pane.isBatchedMesh).toBe(true);expect(pane.castShadow).toBe(false);
            expect(pane.material.transparent).toBe(false);expect(pane.material.opacity).toBe(1);
            expect(pane.material.map).toBeNull();expect(pane.material.normalMap).toBeNull();expect(pane.material.emissiveMap).toBeNull();
        }
        const controls = panes.map(pane => pane.material.userData.lanternholdWindowSurface.amount);
        controls[0].value = 0;expect(controls[1].value).toBe(1);
    } finally { for (const root of roots) RenderSystem.prototype.disposeObjectResources.call({}, root); }
});

test('glazing refuses to replace another shader owner and retains an existing installed hook', () => {
    const material = new THREE.MeshStandardMaterial(), foreign = () => {};
    material.onBeforeCompile = foreign;
    expect(() => applyLanternholdWindowSurface(material)).toThrow('cannot replace');expect(material.onBeforeCompile).toBe(foreign);
    material.onBeforeCompile = THREE.Material.prototype.onBeforeCompile;applyLanternholdWindowSurface(material);
    const installed = material.onBeforeCompile, amount = material.userData.lanternholdWindowSurface.amount;
    expect(applyLanternholdWindowSurface(material)).toBe(material);expect(material.onBeforeCompile).toBe(installed);
    expect(material.userData.lanternholdWindowSurface.amount).toBe(amount);material.dispose();
});
