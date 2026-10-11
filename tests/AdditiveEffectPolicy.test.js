import * as THREE from 'three';
import { additiveEffectCorpus } from './additiveEffectCorpus.js';

test.each(['cast', 'status', 'feedback'])('%s preserves ordinary alpha passes and submits filled additive double-sided materials once at both qualities', kind => {
    let additive = 0, ordinary = 0, wireframe = 0;
    for (const quality of ['high', 'low']) {
        const scene = new THREE.Scene(), cases = additiveEffectCorpus(scene, quality);
        for (const entry of cases.filter(entry => entry.kind === kind)) {
            entry.root.traverse(mesh => {
                if (!mesh.isMesh) return;
                for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                    if (material.blending === THREE.AdditiveBlending && !material.wireframe) {
                        additive++;
                        expect(material.forceSinglePass).toBe(true);
                        expect(material.transparent).toBe(true); expect(material.depthWrite).toBe(false);
                        expect(material.side).toBe(THREE.DoubleSide); expect(material.isMeshBasicMaterial).toBe(true);
                    } else {
                        if (material.wireframe) wireframe++; else ordinary++;
                        expect(material.forceSinglePass).toBe(false);
                    }
                }
            });
        }
        for (const entry of cases) entry.dispose();
        expect(scene.children).toHaveLength(0);
    }
    expect(additive).toBeGreaterThan(0);
    // Current contact cues use additive roles only; cast/status factories also
    // exercise the unchanged ordinary-alpha branch.
    if (kind !== 'feedback') {
        expect(ordinary).toBeGreaterThan(0);
        expect(wireframe).toBeGreaterThan(0);
    }
});
