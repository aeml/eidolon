import * as THREE from 'three';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { PORTAL_CRYSTALS } from '../core/ResonancePortalState.js';

// Four facets borrow the distant sanctums' light; these are not replacement
// crystals or a new repair objective. The walkable plaza has no solid floor box.
export function createResonancePortalModel() {
    const mesh = new THREE.Group();
    mesh.name = 'FourfoldResonancePlaza';
    mesh.userData.bounds = { height: 8 };
    const geometries = new Set(), materials = new Set();
    const material = options => { const value = new THREE.MeshStandardMaterial(options); materials.add(value); return value; };
    const stone = material({ color: 0x585461, roughness: .92 });
    applyWorldSurfaceDetail(stone, 'stone');
    const metal = material({ color: 0x9b8254, roughness: .46, metalness: .72 });
    const add = (geometry, surface, x, y, z) => {
        geometries.add(geometry);
        const part = new THREE.Mesh(geometry, surface);
        part.position.set(x, y, z); part.castShadow = true; part.receiveShadow = true;
        mesh.add(part); return part;
    };
    const paving = add(new THREE.CylinderGeometry(8, 8, .12, 48), stone, 0, .05, 0);
    paving.castShadow = false;
    for (const radius of [6.7, 7.7]) {
        const inlay = add(new THREE.TorusGeometry(radius, .055, 5, 64), metal, 0, .13, 0);
        inlay.rotation.x = Math.PI / 2;
    }
    const ring = add(new THREE.TorusGeometry(3.5, .38, 8, 40), stone, 0, 4.2, 0);
    ring.name = 'CovenantArch';
    add(new THREE.TorusGeometry(3.5, .075, 5, 64), metal, 0, 4.2, .38);
    const walls = [];
    for (const x of [-3.5, 3.5]) {
        add(new THREE.BoxGeometry(.95, 3.5, 1.25), stone, x, 1.85, 0);
        walls.push({ x, z: 0, width: .95, depth: 1.25, height: 3.7 });
    }
    const crystals = PORTAL_CRYSTALS.map((crystal, index) => {
        const x = index % 2 ? 5.4 : -5.4, z = index < 2 ? -3.6 : 3.6;
        add(new THREE.CylinderGeometry(.7, 1, 1.25, 8), stone, x, .75, z);
        add(new THREE.CylinderGeometry(.82, .82, .14, 8), metal, x, 1.43, z);
        const surface = material({ color: crystal.color, emissive: crystal.color, emissiveIntensity: .04, roughness: .25, metalness: .24 });
        const shard = add(new THREE.OctahedronGeometry(.85), surface, x, 2.5, z);
        shard.scale.set(.72, 1.8, .72); shard.rotation.y = index * .6;
        shard.name = crystal.name;
        walls.push({ x, z, width: 2, depth: 2, height: 3.9 });
        const ray = add(new THREE.CylinderGeometry(.035, .035, 1, 5), surface, 0, 0, 0);
        const start = new THREE.Vector3(x, 2.5, z), end = new THREE.Vector3(0, 4.2, 0);
        const delta = end.clone().sub(start);
        ray.position.copy(start).add(end).multiplyScalar(.5);
        ray.scale.y = delta.length(); ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
        ray.castShadow = false; ray.visible = false;
        return { shard, surface, ray };
    });
    const veil = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, strength: { value: .08 } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 p; void main(){ p=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `varying vec2 p; uniform float time; uniform float strength;
            void main(){ float r=length(p); if(r>1.0) discard;
            float wave=sin(r*30.0-atan(p.y,p.x)*3.0-time*1.4)*.5+.5;
            float edge=smoothstep(.55,1.0,r); vec3 c=mix(vec3(.035,.025,.09),vec3(.5,.62,.94),edge*.8+wave*.16);
            gl_FragColor=vec4(c, strength*(.8+edge*.2)); }`
    });
    materials.add(veil);
    const surface = add(new THREE.CircleGeometry(3.1, 48), veil, 0, 4.2, 0);
    surface.castShadow = false;
    let elapsed = 0;
    return {
        mesh, walls, crystals,
        update(dt, state, reducedMotion = false) {
            if (!reducedMotion && Number.isFinite(dt)) elapsed += Math.min(.1, Math.max(0, dt));
            veil.uniforms.time.value = reducedMotion ? 0 : elapsed;
            veil.uniforms.strength.value = state.eligible ? .95 : state.stage === 'ready' ? .32 : .08;
            mesh.userData.portalStage = state.stage;
            crystals.forEach((crystal, index) => {
                const restored = state.restored[index] || state.legacy;
                crystal.surface.emissiveIntensity = restored ? .65 + (reducedMotion ? 0 : Math.sin(elapsed * 1.5 + index) * .12) : .04;
                crystal.ray.visible = restored;
            });
        },
        dispose() { geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); }
    };
}
