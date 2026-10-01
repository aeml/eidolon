import * as THREE from 'three';
import { prefersReducedMotion } from '../core/MotionPreference.js';
import { createCrossedGlowGeometry, createSanctuaryMaterial } from '../art/SanctuaryMaterials.js';

const vertex = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export class LevelUpEffect {
    constructor(scene, position, options = {}) {
        this.scene = scene; this.position = position.clone(); this.owner = options.owner;
        this.isActive = true; this.time = 0; this.duration = 3;
        this.reducedMotion = options.reducedMotion ?? prefersReducedMotion();
        this.group = new THREE.Group(); this.group.name = 'LevelUpResonance';
        this.group.position.copy(this.position); scene.add(this.group);
        this.meshes = [];
        this.seal = this.add(new THREE.Mesh(new THREE.RingGeometry(.78, 1, 64),
            createSanctuaryMaterial(0xffd990, { opacity: 0, motif: 'seal' })));
        this.seal.rotation.x = -Math.PI / 2; this.seal.position.y = .18;
        this.ring = this.add(new THREE.Mesh(new THREE.RingGeometry(.78, 1, 64),
            createSanctuaryMaterial(0xffe4af, { opacity: 0, motif: 'seal' })));
        this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .19;
        this.pillar = this.add(new THREE.Mesh(createCrossedGlowGeometry(2), new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } }, vertexShader: vertex,
            fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uOpacity;
                void main() {
                    float core = pow(max(0.0, 1.0 - abs(vUv.x - .5) * 2.0), 8.0);
                    float thread = exp(-pow((vUv.x - .5 - sin(vUv.y * 13.0 - uTime * 3.0) * .08) * 28.0, 2.0));
                    float ends = smoothstep(0.0, .12, vUv.y) * (1.0 - smoothstep(.5, 1.0, vUv.y));
                    gl_FragColor = vec4(mix(vec3(1.0, .65, .25), vec3(1.0, .94, .75), core),
                        (core * .22 + thread * .12) * ends * uOpacity);
                    #include <colorspace_fragment>
                }`, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false
        })));
        this.pillar.material.forceSinglePass = true;
        this.pillar.position.y = 3.25; this.pillar.scale.set(1.6, 3.25, 1.6);
        const count = options.quality === 'low' ? 48 : 96;
        const geo = new THREE.BufferGeometry(), phases = [], seeds = [], colors = [], color = new THREE.Color();
        const elements = [0x93d58b, 0xc8efff, 0xff985c, 0x72caff];
        for (let i = 0; i < count; i++) {
            phases.push((i * .61803398875) % 1); seeds.push((i * .38196601125) % 1);
            color.setHex(i % 4 ? 0xffda86 : elements[Math.floor(i / 4) % 4]); colors.push(color.r, color.g, color.b);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
        geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
        geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 5);
        this.particles = this.add(new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uMotion: { value: this.reducedMotion ? 0 : 1 }, uViewportHeight: { value: 1 } },
            vertexShader: `attribute float aPhase; attribute float aSeed; attribute vec3 color;
                uniform float uTime; uniform float uOpacity; uniform float uMotion; uniform float uViewportHeight;
                varying vec3 vColor; varying float vAlpha;
                void main() {
                    float age = max(0.0, uTime - aPhase * .7), life = clamp(age / 2.3, 0.0, 1.0);
                    float angle = aSeed * 6.2831853 + age * .8 * uMotion;
                    float radius = .65 + life * (1.0 + aPhase) * uMotion;
                    vec3 p = vec3(cos(angle) * radius, .2 + life * mix(1.5, 4.8, uMotion), sin(angle) * radius);
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    gl_Position = projectionMatrix * mv;
                    // Orthographic gameplay cameras do not shrink light with camera distance.
                    // Drawing-buffer height also keeps sparks consistent through zoom, DPI and resize.
                    float perspectiveDivisor = projectionMatrix[3][3] == 0.0 ? max(.01, -mv.z) : 1.0;
                    float worldSize = (.14 + aSeed * .12) * (.7 + sin(life * 3.14159265) * .5);
                    gl_PointSize = clamp(worldSize * .5 * uViewportHeight * projectionMatrix[1][1] / perspectiveDivisor, 1.0, 24.0);
                    vColor = color; vAlpha = sin(life * 3.14159265) * uOpacity;
                }`,
            fragmentShader: `varying vec3 vColor; varying float vAlpha; void main() {
                vec2 p = gl_PointCoord * 2.0 - 1.0; float r = length(p);
                float core = exp(-dot(p, p) * 55.0), halo = exp(-dot(p, p) * 5.0) * .22;
                float rays = pow(max(0.0, 1.0 - abs(p.x) * 3.0), 8.0) * exp(-p.y * p.y * 7.0)
                           + pow(max(0.0, 1.0 - abs(p.y) * 3.0), 8.0) * exp(-p.x * p.x * 7.0);
                gl_FragColor = vec4(mix(vColor, vec3(1.0, .96, .8), core * .65),
                    min(1.0, core + halo + rays * .42) * (1.0 - smoothstep(.75, 1.0, r)) * vAlpha);
                #include <colorspace_fragment>
            }`, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        })));
        const drawingBufferSize = new THREE.Vector2();
        this.particles.onBeforeRender = renderer => {
            renderer.getDrawingBufferSize(drawingBufferSize);
            this.particles.material.uniforms.uViewportHeight.value = drawingBufferSize.y;
        };
        this.update(0);
    }

    add(part) { part.castShadow = false; part.receiveShadow = false; this.group.add(part); this.meshes.push(part); return part; }

    update(dt) {
        if (!this.isActive) return;
        this.time += Number.isFinite(dt) ? Math.max(0, dt) : 0;
        if (this.time >= this.duration) { this.dispose(); return; }
        const position = this.owner?.mesh?.position || this.owner?.position;
        if (position) this.group.position.copy(position);
        const fadeIn = Math.min(1, this.time / .18), fadeOut = Math.min(1, (this.duration - this.time) / .9);
        const opacity = fadeIn * fadeOut;
        this.seal.scale.setScalar(1.75 + (this.reducedMotion ? 0 : Math.sin(this.time * 2) * .06));
        this.seal.material.opacity = opacity * .9;
        this.seal.rotation.z = this.reducedMotion ? 0 : this.time * .2;
        const burst = Math.min(1, this.time / .9);
        this.ring.scale.setScalar(this.reducedMotion ? 2 : 1.5 + burst * 2.2);
        this.ring.material.opacity = this.reducedMotion ? opacity * .3 : Math.max(0, 1 - burst) * fadeIn * .65;
        this.pillar.material.uniforms.uTime.value = this.reducedMotion ? 0 : this.time;
        this.pillar.material.uniforms.uOpacity.value = opacity;
        this.particles.material.uniforms.uTime.value = this.time;
        this.particles.material.uniforms.uOpacity.value = opacity;
    }

    dispose() {
        if (!this.isActive) return;
        this.isActive = false; this.group.removeFromParent();
        for (const part of this.meshes) { part.geometry.dispose(); part.material.dispose(); }
        this.group.clear(); this.meshes = [];
    }
}
