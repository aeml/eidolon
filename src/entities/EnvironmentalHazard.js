import * as THREE from 'three';
import { Entity } from './Entity.js';
import { disposeSceneMesh } from './EffectSceneFallback.js';
import { getHazardTheme } from '../art/darkFantasyTheme.js';

/**
 * EnvironmentalHazard - Visual effects for world hazards
 * 
 * Hazard Types:
 * - lava_pool: Bubbling lava with rising embers (Fire Realm - West, X: -3000 to -1000)
 * - sandstorm: Swirling sand/dust particles (Earth Realm - Center, X: -1000 to 1000)
 * - lightning_zone: Crackling lightning strikes (Water Realm - North, Z: -600 to -2200)
 * - wind_gust: Pushing wind with visible streaks (Air Realm - East, X: 1000 to 3000)
 * - poison_cloud: Green toxic mist (future use)
 * - ice_patch: Slippery frozen ground (future use)
 * 
 * Server sends hazard positions and types, client renders visuals.
 * Damage is server-authoritative (% max health per second).
 */
export class EnvironmentalHazard extends Entity {
    constructor(id, hazardType, position, config = {}) {
        super(id);
        this.type = 'EnvironmentalHazard';
        this.hazardType = hazardType;
        this.position.set(position.x, position.y || 0, position.z);
        
        const requestedRadius = Number(config.radius);
        this.radius = Number.isFinite(requestedRadius) && requestedRadius > 0 ? requestedRadius : 5.0;
        // Gameplay footprints are server-authoritative. Ambient vertical motion
        // may add atmosphere, but no ground visual may imply a larger boundary.
        this.visualRadius = this.radius;
        this.theme = getHazardTheme(hazardType);
        this.intensity = config.intensity || 1.0;
        this.duration = config.duration || -1; // -1 = permanent
        this.elapsedTime = 0;
        
        this.meshes = [];
        this.particles = null;
        this.time = 0;
        
        this.createVisual();
        this.createGameplayBoundary();
    }

    createLavaMaterial(isInner = false) {
        const baseColor = isInner ? new THREE.Color(0xffaa00) : new THREE.Color(0xff4500);
        const hotColor = isInner ? new THREE.Color(0xffdd55) : new THREE.Color(0xff7a2f);
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uBaseColor: { value: baseColor },
                uHotColor: { value: hotColor },
                uOpacity: { value: isInner ? 0.95 : 0.88 },
                uPulse: { value: isInner ? 1.3 : 1.0 },
                uInnerBoost: { value: isInner ? 1.0 : 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uBaseColor;
                uniform vec3 uHotColor;
                uniform float uOpacity;
                uniform float uPulse;
                uniform float uInnerBoost;
                varying vec2 vUv;

                float hash(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return -1.0 + 2.0 * fract(sin(p.x + p.y) * 43758.5453123);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y) * 0.5 + 0.5;
                }

                void main() {
                    vec2 p = (vUv - 0.5) * 3.0;
                    float radius = length(p);
                    float edgeMask = smoothstep(1.0, 0.76, radius);

                    float n1 = noise(p * 2.5 + vec2(uTime * 0.9, -uTime * 0.6));
                    float n2 = noise(p * 5.0 + vec2(-uTime * 1.4, uTime * 1.0));
                    float lava = n1 * 0.65 + n2 * 0.35;

                    float pulse = 0.8 + sin(uTime * 4.5) * 0.15 * uPulse;
                    float heatBand = smoothstep(0.55, 0.95, lava + uInnerBoost * 0.1);

                    vec3 color = mix(uBaseColor, uHotColor, heatBand);
                    color += vec3(0.16, 0.08, 0.0) * (lava * pulse);

                    gl_FragColor = vec4(color, edgeMask * uOpacity * pulse);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: isInner ? THREE.AdditiveBlending : THREE.NormalBlending
        });
    }

    createLightningRingMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 0.55 },
                uColor: { value: new THREE.Color(0x00bfff) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uOpacity;
                uniform vec3 uColor;
                varying vec2 vUv;

                void main() {
                    vec2 p = vUv - 0.5;
                    float a = atan(p.y, p.x);
                    float radial = length(p);
                    float arc = sin(a * 22.0 + uTime * 12.0) * 0.5 + 0.5;
                    float flicker = sin(uTime * 26.0 + a * 15.0) * 0.5 + 0.5;
                    float ring = smoothstep(0.53, 0.47, abs(radial - 0.5));
                    float energy = ring * (0.55 + arc * 0.45) * (0.75 + flicker * 0.25);
                    vec3 color = uColor + vec3(0.35, 0.35, 0.35) * (arc * flicker * ring);
                    gl_FragColor = vec4(color, energy * uOpacity);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
    }

    /**
     * Shared dark-fantasy warning field. The geometry's outer radius is exactly
     * the damage radius supplied by the server, and remains visible on low
     * quality because it communicates gameplay rather than decoration.
     */
    createGameplayBoundary() {
        const geometry = new THREE.CircleGeometry(this.radius, 64);
        geometry.computeBoundingSphere();
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uBoundaryColor: { value: new THREE.Color(this.theme.boundary) },
                uSecondaryColor: { value: new THREE.Color(this.theme.secondary) },
                uFillColor: { value: new THREE.Color(this.theme.fill) },
                uGlyphCount: { value: this.theme.glyphCount },
                uPulseRate: { value: this.theme.pulseRate }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uBoundaryColor;
                uniform vec3 uSecondaryColor;
                uniform vec3 uFillColor;
                uniform float uGlyphCount;
                uniform float uPulseRate;
                varying vec2 vUv;

                void main() {
                    vec2 p = (vUv - 0.5) * 2.0;
                    float radial = length(p);
                    if (radial > 1.0) discard;

                    float angle = atan(p.y, p.x);
                    float pulse = 0.5 + 0.5 * sin(uTime * uPulseRate * 6.2831853);
                    float outer = smoothstep(0.89, 0.95, radial) * (1.0 - smoothstep(0.975, 1.0, radial));
                    float inner = smoothstep(0.72, 0.77, radial) * (1.0 - smoothstep(0.82, 0.86, radial));
                    float glyphWave = sin(angle * uGlyphCount - uTime * uPulseRate * 1.8);
                    float glyphs = smoothstep(0.62, 0.88, glyphWave) * inner;
                    float radialVein = smoothstep(0.78, 0.98, sin(radial * 62.0 - uTime * 2.0) * 0.5 + 0.5);
                    float fill = (1.0 - smoothstep(0.0, 0.92, radial)) * (0.045 + radialVein * 0.025);

                    vec3 color = uFillColor * fill;
                    color += uBoundaryColor * outer * (0.66 + pulse * 0.34);
                    color += uSecondaryColor * glyphs * (0.52 + pulse * 0.38);
                    float alpha = fill + outer * (0.58 + pulse * 0.25) + glyphs * 0.46;
                    gl_FragColor = vec4(color, min(alpha, 0.9));
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.boundaryMesh = new THREE.Mesh(geometry, material);
        this.boundaryMesh.name = `HazardBoundary:${this.hazardType}`;
        this.boundaryMesh.rotation.x = -Math.PI / 2;
        this.boundaryMesh.position.copy(this.position);
        this.boundaryMesh.position.y = this.position.y + 0.16;
        this.boundaryMesh.renderOrder = 4;
        this.boundaryMesh.userData.hazardBoundary = true;
        this.boundaryMesh.userData.gameplayRadius = this.radius;
        this.boundaryMesh.userData.themeName = this.theme.name;
        this.meshes.push(this.boundaryMesh);
    }
    
    createVisual() {
        switch (this.hazardType) {
            case 'lava_pool':
                this.createLavaPool();
                break;
            case 'sandstorm':
                this.createSandstorm();
                break;
            case 'lightning_zone':
                this.createLightningZone();
                break;
            case 'wind_gust':
                this.createWindGust();
                break;
            case 'poison_cloud':
                this.createPoisonCloud();
                break;
            default:
                this.createGenericHazard();
        }
    }
    
    // ========================================================================
    // LAVA POOL - Bubbling molten rock with rising embers
    // ========================================================================
    createLavaPool() {
        // Base lava pool (glowing ground circle)
        const poolGeo = new THREE.CircleGeometry(this.visualRadius, 32);
        const poolMat = this.createLavaMaterial(false);
        this.groundMesh = new THREE.Mesh(poolGeo, poolMat);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.copy(this.position);
        this.groundMesh.position.y = 0.05;
        this.meshes.push(this.groundMesh);
        
        // Inner glow (brighter center)
        const innerGeo = new THREE.CircleGeometry(this.visualRadius * 0.62, 32);
        const innerMat = this.createLavaMaterial(true);
        this.innerGlow = new THREE.Mesh(innerGeo, innerMat);
        this.innerGlow.rotation.x = -Math.PI / 2;
        this.innerGlow.position.copy(this.position);
        this.innerGlow.position.y = 0.1;
        this.meshes.push(this.innerGlow);
        
        // Rising ember particles
        const particleCount = 45;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);
        const offsets = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.visualRadius * 0.8;
            positions[i * 3] = this.position.x + Math.cos(angle) * dist;
            positions[i * 3 + 1] = this.position.y + Math.random() * 2;
            positions[i * 3 + 2] = this.position.z + Math.sin(angle) * dist;
            speeds[i] = 1.0 + Math.random() * 2.0;
            offsets[i] = Math.random() * Math.PI * 2;
        }
        
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0xFFDD00,
            size: 0.45,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(particleGeo, particleMat);
        this.particles.userData = { speeds, offsets, baseY: this.position.y };
        this.meshes.push(this.particles);
        
        // Bubbling spheres (simulated bubbles)
        this.bubbles = [];
        for (let i = 0; i < 5; i++) {
            const bubbleGeo = new THREE.SphereGeometry(0.28 + Math.random() * 0.35, 8, 8);
            const bubbleMat = new THREE.MeshBasicMaterial({
                color: 0xFF6600,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.visualRadius * 0.7;
            bubble.position.set(
                this.position.x + Math.cos(angle) * dist,
                this.position.y + 0.1,
                this.position.z + Math.sin(angle) * dist
            );
            bubble.userData = {
                baseY: this.position.y + 0.1,
                speed: 0.5 + Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2
            };
            this.bubbles.push(bubble);
            this.meshes.push(bubble);
        }
    }
    
    // ========================================================================
    // SANDSTORM - Swirling dust and debris
    // ========================================================================
    createSandstorm() {
        // Dust particle cloud
        const particleCount = 140;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);
        const offsets = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.visualRadius;
            positions[i * 3] = this.position.x + Math.cos(angle) * dist;
            positions[i * 3 + 1] = this.position.y + Math.random() * 5;
            positions[i * 3 + 2] = this.position.z + Math.sin(angle) * dist;
            speeds[i] = 2.0 + Math.random() * 3.0;
            offsets[i] = angle;
        }
        
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0xD2B48C, // Tan/sand color
            size: 0.55,
            transparent: true,
            opacity: 0.7,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(particleGeo, particleMat);
        this.particles.userData = { speeds, offsets, baseY: this.position.y };
        this.meshes.push(this.particles);
        
        // Swirling cone (wind visual)
        const coneGeo = new THREE.CylinderGeometry(this.visualRadius * 0.35, this.visualRadius, 6, 18, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
            color: 0xC4A574,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false,
            wireframe: true
        });
        this.cone = new THREE.Mesh(coneGeo, coneMat);
        this.cone.position.copy(this.position);
        this.cone.position.y = 2.5;
        this.meshes.push(this.cone);
    }
    
    // ========================================================================
    // LIGHTNING ZONE - Crackling electrical area with periodic strikes
    // ========================================================================
    createLightningZone() {
        // Ground warning circle
        const ringGeo = new THREE.RingGeometry(this.visualRadius * 0.78, this.visualRadius, 40);
        const ringMat = this.createLightningRingMaterial();
        this.groundMesh = new THREE.Mesh(ringGeo, ringMat);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.copy(this.position);
        this.groundMesh.position.y = 0.05;
        this.meshes.push(this.groundMesh);
        
        // Electric spark particles
        const particleCount = 60;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);
        const offsets = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.visualRadius;
            positions[i * 3] = this.position.x + Math.cos(angle) * dist;
            positions[i * 3 + 1] = this.position.y + Math.random() * 3;
            positions[i * 3 + 2] = this.position.z + Math.sin(angle) * dist;
            speeds[i] = 5.0 + Math.random() * 5.0;
            offsets[i] = Math.random() * Math.PI * 2;
        }
        
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0xFFFF00,
            size: 0.38,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(particleGeo, particleMat);
        this.particles.userData = { speeds, offsets, baseY: this.position.y };
        this.meshes.push(this.particles);
        
        // Lightning bolt (line geometry, toggled on/off)
        this.createLightningBolt();
        this.lightningTimer = 0;
        this.lightningVisible = false;
    }
    
    createLightningBolt() {
        const points = [];
        const startY = 15;
        const segments = 8;
        let x = this.position.x;
        let z = this.position.z;
        
        for (let i = 0; i <= segments; i++) {
            const y = startY - (startY / segments) * i;
            points.push(new THREE.Vector3(x, y, z));
            // Add jagged offset for next point
            x += (Math.random() - 0.5) * 2;
            z += (Math.random() - 0.5) * 2;
        }
        // End at ground
        points[points.length - 1].set(this.position.x, 0, this.position.z);
        
        const boltGeo = new THREE.BufferGeometry().setFromPoints(points);
        const boltMat = new THREE.LineBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0,
            linewidth: 2
        });
        this.lightningBolt = new THREE.Line(boltGeo, boltMat);
        this.meshes.push(this.lightningBolt);
        
        // Glow around bolt
        const glowMat = new THREE.LineBasicMaterial({
            color: 0x00BFFF,
            transparent: true,
            opacity: 0,
            linewidth: 4
        });
        this.lightningGlow = new THREE.Line(boltGeo.clone(), glowMat);
        this.meshes.push(this.lightningGlow);
    }
    
    // ========================================================================
    // WIND GUST - Directional pushing wind
    // ========================================================================
    createWindGust() {
        // Wind streak particles (moving in a direction)
        const particleCount = 90;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);
        const offsets = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = this.position.x + (Math.random() - 0.5) * this.visualRadius * 2;
            positions[i * 3 + 1] = this.position.y + Math.random() * 3;
            positions[i * 3 + 2] = this.position.z + (Math.random() - 0.5) * this.visualRadius * 2;
            speeds[i] = 8.0 + Math.random() * 4.0;
            offsets[i] = Math.random();
        }
        
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0xDDF4FF,
            size: 0.24,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(particleGeo, particleMat);
        this.particles.userData = { speeds, offsets, baseY: this.position.y };
        this.meshes.push(this.particles);
        
        // Wind direction indicator (arrow-like streaks)
        const arrowGeo = new THREE.ConeGeometry(0.45, 2.6, 8);
        const arrowMat = new THREE.MeshBasicMaterial({
            color: 0xAADDFF,
            transparent: true,
            opacity: 0.4,
            depthWrite: false
        });
        
        for (let i = 0; i < 3; i++) {
            const arrow = new THREE.Mesh(arrowGeo, arrowMat.clone());
            arrow.rotation.x = Math.PI / 2; // Point forward
            arrow.position.set(
                this.position.x + (i - 1) * 2.6,
                this.position.y + 1.4,
                this.position.z
            );
            arrow.userData = { phase: i * 0.3 };
            this.meshes.push(arrow);
        }
    }
    
    // ========================================================================
    // POISON CLOUD - Toxic green mist
    // ========================================================================
    createPoisonCloud() {
        // Ground mist circle
        const mistGeo = new THREE.CircleGeometry(this.visualRadius, 32);
        const mistMat = new THREE.MeshBasicMaterial({
            color: 0x44FF44,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.groundMesh = new THREE.Mesh(mistGeo, mistMat);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.copy(this.position);
        this.groundMesh.position.y = 0.1;
        this.meshes.push(this.groundMesh);
        
        // Rising poison particles
        const particleCount = 70;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);
        const offsets = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.visualRadius;
            positions[i * 3] = this.position.x + Math.cos(angle) * dist;
            positions[i * 3 + 1] = this.position.y + Math.random() * 2;
            positions[i * 3 + 2] = this.position.z + Math.sin(angle) * dist;
            speeds[i] = 0.5 + Math.random() * 1.0;
            offsets[i] = Math.random() * Math.PI * 2;
        }
        
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0x88FF88,
            size: 0.65,
            transparent: true,
            opacity: 0.7,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(particleGeo, particleMat);
        this.particles.userData = { speeds, offsets, baseY: this.position.y };
        this.meshes.push(this.particles);
    }
    
    // ========================================================================
    // GENERIC HAZARD - Fallback red warning zone
    // ========================================================================
    createGenericHazard() {
        const ringGeo = new THREE.RingGeometry(this.visualRadius * 0.78, this.visualRadius, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.groundMesh = new THREE.Mesh(ringGeo, ringMat);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.copy(this.position);
        this.groundMesh.position.y = 0.05;
        this.meshes.push(this.groundMesh);
    }
    
    // ========================================================================
    // UPDATE - Called every frame
    // ========================================================================
    update(dt) {
        this.time += dt;
        this.elapsedTime += dt;

        if (this.boundaryMesh?.material?.uniforms?.uTime) {
            this.boundaryMesh.material.uniforms.uTime.value = this.time;
        }
        
        if (this.duration > 0 && this.elapsedTime >= this.duration) {
            this.isActive = false;
            return;
        }
        
        switch (this.hazardType) {
            case 'lava_pool':
                this.updateLavaPool(dt);
                break;
            case 'sandstorm':
                this.updateSandstorm(dt);
                break;
            case 'lightning_zone':
                this.updateLightningZone(dt);
                break;
            case 'wind_gust':
                this.updateWindGust(dt);
                break;
            case 'poison_cloud':
                this.updatePoisonCloud(dt);
                break;
            default:
                this.updateGenericHazard(dt);
        }
    }
    
    updateLavaPool(dt) {
        if (this.groundMesh && this.groundMesh.material.uniforms && this.groundMesh.material.uniforms.uTime) {
            this.groundMesh.material.uniforms.uTime.value = this.time;
            this.groundMesh.material.uniforms.uPulse.value = 0.9 + Math.sin(this.time * 3) * 0.2;
        }
        if (this.innerGlow && this.innerGlow.material.uniforms && this.innerGlow.material.uniforms.uTime) {
            this.innerGlow.material.uniforms.uTime.value = this.time * 1.25;
            this.innerGlow.material.uniforms.uPulse.value = 1.1 + Math.sin(this.time * 4 + 1) * 0.25;
        }

        // Pulse ground glow
        if (this.groundMesh) {
            if (this.groundMesh.material.opacity !== undefined) {
                this.groundMesh.material.opacity = 0.7 + Math.sin(this.time * 3) * 0.15;
            }
        }
        if (this.innerGlow) {
            if (this.innerGlow.material.opacity !== undefined) {
                this.innerGlow.material.opacity = 0.8 + Math.sin(this.time * 4 + 1) * 0.15;
            }
            this.innerGlow.scale.setScalar(1 + Math.sin(this.time * 2) * 0.1);
        }
        
        // Animate ember particles (rise and reset)
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            const speeds = this.particles.userData.speeds;
            const offsets = this.particles.userData.offsets;
            const baseY = this.particles.userData.baseY;
            
            for (let i = 0; i < speeds.length; i++) {
                positions[i * 3 + 1] += speeds[i] * dt;
                
                // Slight horizontal drift
                const angle = this.time * 0.5 + offsets[i];
                positions[i * 3] += Math.cos(angle) * dt * 0.3;
                positions[i * 3 + 2] += Math.sin(angle) * dt * 0.3;
                
                // Reset if too high
                if (positions[i * 3 + 1] > baseY + 5) {
                    const resetAngle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * this.visualRadius * 0.8;
                    positions[i * 3] = this.position.x + Math.cos(resetAngle) * dist;
                    positions[i * 3 + 1] = baseY;
                    positions[i * 3 + 2] = this.position.z + Math.sin(resetAngle) * dist;
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }
        
        // Animate bubbles
        if (this.bubbles) {
            for (const bubble of this.bubbles) {
                const data = bubble.userData;
                const bobHeight = Math.sin(this.time * data.speed + data.phase) * 0.3;
                bubble.position.y = data.baseY + bobHeight;
                bubble.scale.setScalar(1 + Math.sin(this.time * data.speed * 2 + data.phase) * 0.2);
            }
        }
    }
    
    updateSandstorm(dt) {
        // Spin cone
        if (this.cone) {
            this.cone.rotation.y += dt * 3;
            this.cone.material.opacity = 0.25 + Math.sin(this.time * 2) * 0.1;
        }
        
        // Spiral particles
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            const speeds = this.particles.userData.speeds;
            const offsets = this.particles.userData.offsets;
            const baseY = this.particles.userData.baseY;
            
            for (let i = 0; i < speeds.length; i++) {
                // Rise up
                positions[i * 3 + 1] += speeds[i] * dt * 0.5;
                
                // Spiral motion
                const angle = this.time * speeds[i] * 0.5 + offsets[i];
                const height = positions[i * 3 + 1] - baseY;
                const radius = this.visualRadius * (1 - height / 6); // Narrow as it goes up
                
                positions[i * 3] = this.position.x + Math.cos(angle) * radius;
                positions[i * 3 + 2] = this.position.z + Math.sin(angle) * radius;
                
                // Reset if too high
                if (positions[i * 3 + 1] > baseY + 6) {
                    positions[i * 3 + 1] = baseY;
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
            this.particles.material.opacity = 0.6 + Math.sin(this.time * 3) * 0.2;
        }
    }
    
    updateLightningZone(dt) {
        if (this.groundMesh && this.groundMesh.material.uniforms && this.groundMesh.material.uniforms.uTime) {
            this.groundMesh.material.uniforms.uTime.value = this.time;
            this.groundMesh.material.uniforms.uOpacity.value = 0.32 + Math.sin(this.time * 5) * 0.18;
        }

        // Pulse warning ring
        if (this.groundMesh) {
            if (this.groundMesh.material.opacity !== undefined) {
                this.groundMesh.material.opacity = 0.3 + Math.sin(this.time * 5) * 0.2;
            }
        }
        
        // Erratic spark particles
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            const speeds = this.particles.userData.speeds;
            const offsets = this.particles.userData.offsets;
            const baseY = this.particles.userData.baseY;
            
            for (let i = 0; i < speeds.length; i++) {
                // Random jitter
                positions[i * 3] += (Math.random() - 0.5) * speeds[i] * dt;
                positions[i * 3 + 1] += (Math.random() - 0.5) * speeds[i] * dt;
                positions[i * 3 + 2] += (Math.random() - 0.5) * speeds[i] * dt;
                
                // Keep within bounds
                const dx = positions[i * 3] - this.position.x;
                const dz = positions[i * 3 + 2] - this.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist > this.visualRadius) {
                    const angle = Math.atan2(dz, dx);
                    positions[i * 3] = this.position.x + Math.cos(angle) * this.visualRadius * 0.9;
                    positions[i * 3 + 2] = this.position.z + Math.sin(angle) * this.visualRadius * 0.9;
                }
                if (positions[i * 3 + 1] < baseY) positions[i * 3 + 1] = baseY;
                if (positions[i * 3 + 1] > baseY + 4) positions[i * 3 + 1] = baseY + 4;
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }
        
        // Lightning strike effect (periodic)
        this.lightningTimer += dt;
        if (this.lightningTimer > 2.0 + Math.random() * 2.0) {
            this.triggerLightningStrike();
            this.lightningTimer = 0;
        }
        
        // Fade lightning bolt
        if (this.lightningBolt && this.lightningVisible) {
            this.lightningBolt.material.opacity -= dt * 5;
            this.lightningGlow.material.opacity -= dt * 3;
            if (this.lightningBolt.material.opacity <= 0) {
                this.lightningVisible = false;
                this.lightningBolt.material.opacity = 0;
                this.lightningGlow.material.opacity = 0;
            }
        }
    }
    
    triggerLightningStrike() {
        // Regenerate bolt path
        if (this.lightningBolt) {
            const points = [];
            const startY = 15;
            const segments = 8;
            let x = this.position.x + (Math.random() - 0.5) * this.visualRadius;
            let z = this.position.z + (Math.random() - 0.5) * this.visualRadius;
            const endX = x;
            const endZ = z;
            
            for (let i = 0; i <= segments; i++) {
                const y = startY - (startY / segments) * i;
                points.push(new THREE.Vector3(x, y, z));
                x += (Math.random() - 0.5) * 3;
                z += (Math.random() - 0.5) * 3;
            }
            points[points.length - 1].set(endX, 0, endZ);
            
            this.lightningBolt.geometry.setFromPoints(points);
            this.lightningBolt.material.opacity = 1;
            this.lightningGlow.geometry.setFromPoints(points);
            this.lightningGlow.material.opacity = 0.8;
            this.lightningVisible = true;
        }
    }
    
    updateWindGust(dt) {
        // Move particles in wind direction (positive X direction)
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            const speeds = this.particles.userData.speeds;
            
            for (let i = 0; i < speeds.length; i++) {
                positions[i * 3] += speeds[i] * dt; // Move in X direction
                
                // Slight vertical wobble
                positions[i * 3 + 1] += Math.sin(this.time * 5 + i) * dt;
                
                // Reset if out of bounds
                if (positions[i * 3] > this.position.x + this.visualRadius) {
                    positions[i * 3] = this.position.x - this.visualRadius;
                    positions[i * 3 + 1] = this.position.y + Math.random() * 3;
                    positions[i * 3 + 2] = this.position.z + (Math.random() - 0.5) * this.visualRadius * 2;
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
            this.particles.material.opacity = 0.5 + Math.sin(this.time * 4) * 0.2;
        }
        
        // Animate arrow indicators
        for (const mesh of this.meshes) {
            if (mesh.userData && mesh.userData.phase !== undefined) {
                mesh.position.x = this.position.x + Math.sin(this.time * 3 + mesh.userData.phase) * 2;
                mesh.material.opacity = 0.3 + Math.sin(this.time * 5 + mesh.userData.phase) * 0.2;
            }
        }
    }
    
    updatePoisonCloud(dt) {
        // Pulse ground
        if (this.groundMesh) {
            this.groundMesh.material.opacity = 0.45 + Math.sin(this.time * 2) * 0.12;
        }
        
        // Float particles upward slowly
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            const speeds = this.particles.userData.speeds;
            const offsets = this.particles.userData.offsets;
            const baseY = this.particles.userData.baseY;
            
            for (let i = 0; i < speeds.length; i++) {
                positions[i * 3 + 1] += speeds[i] * dt;
                
                // Gentle sway
                const angle = this.time + offsets[i];
                positions[i * 3] += Math.cos(angle) * dt * 0.2;
                positions[i * 3 + 2] += Math.sin(angle) * dt * 0.2;
                
                // Reset
                if (positions[i * 3 + 1] > baseY + 3) {
                    const resetAngle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * this.visualRadius;
                    positions[i * 3] = this.position.x + Math.cos(resetAngle) * dist;
                    positions[i * 3 + 1] = baseY;
                    positions[i * 3 + 2] = this.position.z + Math.sin(resetAngle) * dist;
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    updateGenericHazard(dt) {
        if (this.groundMesh) {
            this.groundMesh.material.opacity = 0.4 + Math.sin(this.time * 4) * 0.2;
            this.groundMesh.rotation.z += dt;
        }
    }
    
    // ========================================================================
    // MESH MANAGEMENT
    // ========================================================================
    addToScene(scene) {
        for (const mesh of this.meshes) {
            scene.add(mesh);
        }
    }
    
    removeFromScene(scene) {
        for (const mesh of this.meshes) {
            if (mesh.parent?.remove) {
                mesh.parent.remove(mesh);
            } else if (scene?.remove) {
                scene.remove(mesh);
            }
        }
    }
    
    dispose() {
        for (const mesh of this.meshes) {
            disposeSceneMesh(mesh);
        }
        this.meshes = [];
        this.isActive = false;
    }
}
