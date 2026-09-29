import * as THREE from 'three';

// RingGeometry UVs remain planar even when GroundedRingVisual bends vertices
// over terrain. Keep the full gameplay perimeter, but feather its inner edge
// and give it broad pools of light instead of a uniformly glowing wire.
export function createPersistentAuraMaterial(color, { opacity = .48, innerRatio = .988 } = {}) {
    const inner = { value: innerRatio };
    const material = new THREE.MeshBasicMaterial({
        color, opacity, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.NormalBlending
    });
    material.defines = { USE_UV: '' };
    material.userData.auraInnerRatio = inner;
    material.onBeforeCompile = shader => {
        shader.uniforms.auraInnerRatio = inner;
        shader.fragmentShader = `uniform float auraInnerRatio;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            vec2 auraPoint = vUv * 2.0 - 1.0;
            float auraRadius = length(auraPoint);
            float auraWidth = max(1.0 - auraInnerRatio, .0001);
            float auraFeather = smoothstep(auraInnerRatio, auraInnerRatio + auraWidth * .75, auraRadius);
            vec2 auraDirection = auraPoint / max(auraRadius, .0001);
            float auraLobes = pow(abs(auraDirection.x * auraDirection.y * 2.0), 4.0);
            diffuseColor.a *= auraFeather * mix(.45, 1.0, auraLobes);
            #include <opaque_fragment>
        `);
    };
    material.customProgramCacheKey = () => 'persistent-aura-v1';
    return material;
}
