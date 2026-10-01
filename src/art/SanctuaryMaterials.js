import * as THREE from 'three';

// Analytic light, not external textures. Three crossed planes make tiny soft
// stars readable from the isometric camera without per-actor billboarding.
export function createCrossedGlowGeometry(planes = 3) {
    const plane = new THREE.PlaneGeometry(2, 2), source = plane.toNonIndexed();
    plane.dispose();
    const positions = [], uvs = [], vertex = new THREE.Vector3();
    const rotations = [new THREE.Matrix4(), new THREE.Matrix4().makeRotationY(Math.PI / 2), new THREE.Matrix4().makeRotationX(Math.PI / 2)];
    for (const rotation of rotations.slice(0, planes)) for (let i = 0; i < source.attributes.position.count; i++) {
        vertex.fromBufferAttribute(source.attributes.position, i).applyMatrix4(rotation);
        positions.push(vertex.x, vertex.y, vertex.z);
        uvs.push(source.attributes.uv.getX(i), source.attributes.uv.getY(i));
    }
    source.dispose();
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    result.computeBoundingSphere();
    return result;
}

export function createSanctuaryMaterial(color, { opacity = .86, motif = 'star' } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color, opacity, transparent: true,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    mat.forceSinglePass = true;
    mat.userData.sanctuaryMotif = motif;
    mat.onBeforeCompile = shader => {
        shader.vertexShader = `varying vec2 vSanctuaryUv;\n${shader.vertexShader}`.replace('#include <uv_vertex>', '#include <uv_vertex>\nvSanctuaryUv = uv;');
        shader.fragmentShader = `varying vec2 vSanctuaryUv;\n${shader.fragmentShader}`;
        const star = `
            vec2 p = vSanctuaryUv * 2.0 - 1.0;
            float r = length(p);
            float core = exp(-dot(p, p) * 65.0);
            float halo = exp(-dot(p, p) * 6.0) * .2;
            float rays = pow(max(0.0, 1.0 - abs(p.x) * 3.0), 8.0) * exp(-p.y * p.y * 7.0)
                       + pow(max(0.0, 1.0 - abs(p.y) * 3.0), 8.0) * exp(-p.x * p.x * 7.0);
            diffuseColor.a *= min(1.0, core + halo + rays * .42) * (1.0 - smoothstep(.75, 1.0, r));
            outgoingLight = mix(outgoingLight, vec3(1.0, .97, .84), core * .65);
        `;
        const seal = `
            vec2 p = vSanctuaryUv * 2.0 - 1.0;
            float r = length(p);
            float a = atan(p.y, p.x);
            float feather = smoothstep(.78, .82, r) * (1.0 - smoothstep(.97, 1.0, r));
            float thread = exp(-pow((r - .91 - sin(a * 12.0) * .025) / .009, 2.0));
            float rim = exp(-pow((r - .955) / .012, 2.0));
            float petals = pow(max(0.0, cos(a * 4.0)), 16.0) * exp(-pow((r - .85) / .04, 2.0));
            diffuseColor.a *= feather * (.07 + thread * .7 + rim * .28 + petals * .65);
            vec3 earth = vec3(.55, .84, .48), air = vec3(.75, .91, 1.0);
            vec3 fire = vec3(1.0, .5, .22), water = vec3(.35, .71, 1.0);
            vec3 echo = earth * pow(max(0.0, cos(a)), 16.0)
                      + air * pow(max(0.0, sin(a)), 16.0)
                      + fire * pow(max(0.0, -cos(a)), 16.0)
                      + water * pow(max(0.0, -sin(a)), 16.0);
            outgoingLight = mix(outgoingLight, echo, petals * .45);
        `;
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `${motif === 'star' ? star : seal}\n#include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => `sanctuary-light-v1:${motif}`;
    return mat;
}
