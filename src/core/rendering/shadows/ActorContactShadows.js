import * as THREE from 'three';

// A small grounding cue for the no-shadow renderer, not directional shadows
// or screen-space AO. One draw, no texture or shadow target, no actor mutation.
export class ActorContactShadows {
    constructor(scene) {
        this.scene = scene;
        this.geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
        this.material = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, polygonOffset: true,
            polygonOffsetFactor: -1, polygonOffsetUnits: -1,
            vertexShader: `attribute float contactOpacity;
                varying vec2 contactUv; varying float contactAlpha;
                void main() {
                    contactUv = uv; contactAlpha = contactOpacity;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.);
                }`,
            fragmentShader: `varying vec2 contactUv; varying float contactAlpha;
                void main() {
                    vec2 p = contactUv * 2. - 1.;
                    float r = dot(p, p);
                    if (r >= 1.) discard;
                    gl_FragColor = vec4(0., 0., 0., .42 * (1. - r) * (1. - r) * contactAlpha);
                }`
        });
        this.point = new THREE.Vector3(); this.scale = new THREE.Vector3();
        this.up = new THREE.Vector3(0, 1, 0); this.normal = new THREE.Vector3();
        this.rotation = new THREE.Quaternion(); this.matrix = new THREE.Matrix4();
        this.capacity = 0;
    }

    reserve(count) {
        if (count <= this.capacity) return;
        this.capacity = Math.max(32, 2 ** Math.ceil(Math.log2(count)));
        if (this.mesh) {
            this.mesh.removeFromParent(); this.mesh.dispose();
            // Dispose while the previous instance attribute is still attached,
            // so a larger crowd cannot orphan its uploaded opacity buffer.
            this.geometry.dispose();
            this.geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
        }
        this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        this.opacity.setUsage(THREE.DynamicDrawUsage);
        this.geometry.setAttribute('contactOpacity', this.opacity);
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
        this.mesh.name = 'Actor ground contacts'; this.mesh.count = 0;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.renderOrder = 1;
        // These decorations must never intercept a ground/actor click.
        this.mesh.raycast = () => {};
        this.scene.add(this.mesh);
    }

    clear() {
        if (this.mesh) { this.mesh.count = 0; this.mesh.visible = false; }
    }

    update(entities, { enabled, isActor, terrainElevation = null } = {}) {
        this.clear();
        if (!enabled) return;
        this.reserve(entities.length);
        if (!this.mesh) return;
        let count = 0;
        for (const actor of entities) {
            if (!isActor(actor) || !actor.mesh?.parent || actor.isActive === false ||
                actor.state === 'DEAD' || actor.state === 'SEATED' || actor.stealthTimer > 0) continue;
            let visible = true;
            for (let node = actor.mesh; node; node = node.parent) if (!node.visible) { visible = false; break; }
            if (!visible) continue;
            actor.mesh.getWorldPosition(this.point);
            actor.mesh.getWorldScale(this.scale);
            const ground = terrainElevation?.sample(this.point.x, this.point.z) ?? actor.position.y;
            const height = Math.max(0, this.point.y - ground);
            if (!Number.isFinite(ground + height + this.point.x + this.point.z) || height >= 8) continue;
            const authoredRadius = actor.mesh.userData.bounds?.radius;
            const radius = THREE.MathUtils.clamp((authoredRadius || actor.radius || 1.25) *
                Math.max(Math.abs(this.scale.x), Math.abs(this.scale.z)) * .9, .35, 6);
            // Approximate the local ground tangent, including negotiated raised
            // terrain. Never put the shadow on the jumping mesh's current Y.
            this.normal.set(0, 1, 0);
            if (terrainElevation) this.normal.set(
                terrainElevation.sample(this.point.x - radius, this.point.z) - terrainElevation.sample(this.point.x + radius, this.point.z),
                radius * 2,
                terrainElevation.sample(this.point.x, this.point.z - radius) - terrainElevation.sample(this.point.x, this.point.z + radius)
            ).normalize();
            // Town and dungeon floor overlays sit at logical ground + .1.
            // Keep the contact above those receivers, not buried underneath.
            this.point.y = ground + .12;
            this.rotation.setFromUnitVectors(this.up, this.normal);
            const spread = radius * (1 + height * .045);
            this.scale.set(spread, 1, spread * .8);
            this.matrix.compose(this.point, this.rotation, this.scale);
            this.mesh.setMatrixAt(count, this.matrix);
            this.opacity.setX(count++, (1 - height / 8) ** 2);
        }
        this.mesh.count = count; this.mesh.visible = count > 0;
        this.mesh.instanceMatrix.needsUpdate = true; this.opacity.needsUpdate = true;
        if (count) {
            this.mesh.computeBoundingBox();
            this.mesh.boundingSphere ??= new THREE.Sphere();
            this.mesh.boundingBox.getBoundingSphere(this.mesh.boundingSphere);
        }
    }

    dispose() {
        this.mesh?.removeFromParent(); this.mesh?.dispose();
        this.geometry.dispose(); this.material.dispose();
        this.mesh = null;
    }
}
