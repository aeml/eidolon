import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { CONSTANTS } from './Constants.js';
import { createProceduralReflectionEnvironment } from '../art/ProceduralReflectionEnvironment.js';
import {
    DUNGEON_THEME_KEYS,
    createRegionLightingPresets,
    createRegionParticleConfigs
} from '../art/darkFantasyTheme.js';
import {
    PROCEDURAL_TERRAIN_DEFINITIONS,
    createProceduralTerrainMaterial,
    createProceduralTerrainTexture
} from '../art/ProceduralRealmTerrain.js';

const DUNGEON_THEME_KEY_SET = new Set(DUNGEON_THEME_KEYS);

export class RenderSystem {
    constructor(isMobile = false) {
        this.scene = new THREE.Scene();
        // Background/ground/water assets are loaded via `preloadEnvironment()`.
        // Keep a non-black fallback so the scene isn't empty if loading fails.
        this.scene.background = new THREE.Color(0x9eb4c9);
        
        // Optimization: Mobile Settings
        this.isMobile = isMobile;

        // Camera Setup (Isometric Orthographic)
        const aspect = window.innerWidth / window.innerHeight;
        this.currentZoom = CONSTANTS.CAMERA.ZOOM;
        const d = this.currentZoom;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 2000); // Increased Far Plane
        
        // Isometric rotation
        this.cameraOffset = new THREE.Vector3(100, 100, 100);
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.updateCamera();
        
        // Renderer
        // Optimization: Disable antialias on mobile for performance
        // Firefox Optimization: alpha: false (we have a background), stencil: false (unused)
        const isFirefox = /firefox/i.test(navigator.userAgent);
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: !this.isMobile && !isFirefox, // Disable AA on Firefox for performance
            powerPreference: "high-performance",
            alpha: false,
            stencil: false
        });
        
        // Optimization: Cap pixel ratio to save fill rate on high DPI screens
        // Firefox: Cap at 1.0 to ensure smooth framerate
        const maxPixelRatio = isFirefox ? 1.0 : (this.isMobile ? 1.0 : 1.5);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.toneMappingExposure = 1.45;
        this.reflectionEnvironment = createProceduralReflectionEnvironment();
        this.scene.environment = this.reflectionEnvironment;
        this.scene.environmentIntensity = 0.65;
        // Mobile preset: shadows are a major GPU cost; disable entirely on mobile.
        this.renderer.shadowMap.enabled = !this.isMobile;
        this.renderer.shadowMap.autoUpdate = true;
        this.renderer.shadowMap.needsUpdate = true;
        // Optimization: Prefer filtered soft shadows for readable shape fidelity.
        // Firefox keeps PCF shadows here too because the visual quality loss from BasicShadowMap was too severe.
        this.renderer.shadowMap.type = this.isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        
        this.perfOverlay = null;
        this.composer = null;
        this.renderPass = null;
        this.bloomPass = null;
        this.fxaaPass = null;
        this.outputPass = null;
        this.usePostProcessing = false;
        this.postProcessingInitFailed = false;
        this.graphicsQuality = 'high';
        this.bloomQualityScale = 1.0;
        this.effectQualityScale = 1.0;
        this.brightnessLevel = 50;
        const legacyMinBrightnessScale = 1.18 / 1.45;
        this.minBrightnessScale = 0.6;
        this.midBrightnessScale = legacyMinBrightnessScale + 0.5 * (1 - legacyMinBrightnessScale);
        this.brightnessScale = 1.0;
        this.currentRealm = null;
        this.environmentThemeOverride = null;
        this.targetLighting = null;
        this.environmentGroup = new THREE.Group();
        this.environmentGroup.name = 'EnvironmentGroup';
        this.staticEnvironmentGroup = new THREE.Group();
        this.staticEnvironmentGroup.name = 'StaticEnvironmentGroup';
        this.instanceEnvironmentGroup = new THREE.Group();
        this.instanceEnvironmentGroup.name = 'InstanceEnvironmentGroup';
        this.entityGroup = new THREE.Group();
        this.entityGroup.name = 'EntityGroup';
        this.effectGroup = new THREE.Group();
        this.effectGroup.name = 'EffectGroup';
        this.environmentGroup.add(this.staticEnvironmentGroup);
        this.environmentGroup.add(this.instanceEnvironmentGroup);
        this.scene.add(this.environmentGroup);
        this.scene.add(this.entityGroup);
        this.scene.add(this.effectGroup);
        this.shadowFollowOffset = new THREE.Vector3(360, 500, 220);
        this.shadowTarget = new THREE.Vector3();
        this.shadowCoverageRadius = 280;
        this.shadowTexelSnap = true;
        this.cameraShakeEnabled = false;
        this.cameraPunch = null;
        this.currentLighting = {
            ambientIntensity: 2.25,
            keyIntensity: 2.25,
            keyColor: new THREE.Color(0xffffff),
            fillColor: new THREE.Color(0xd9e6ff),
            fillIntensity: 0.36,
            fogColor: new THREE.Color(0xb4bccb),
            fogNear: 1200,
            fogFar: 4200
        };

        this.realmLightingPresets = createRegionLightingPresets();
        this.perfStats = {
            lastTime: performance.now(),
            lastUpdate: performance.now(),
            fps: 0,
            frameTime: 0,
            frames: 0
        };

        // Ensure canvas is behind UI but visible
        this.renderer.domElement.style.position = 'absolute';

        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '1'; // Behind UI (which is 10)
        
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        this.setupLights();
        this.applyLightingPreset('earth', true);
        this.setupPostProcessing();
        this.setGraphicsQuality('high');
        this.setBrightnessLevel(50);

        // Water/Ground are created via `preloadEnvironment()` so the loading screen
        // can reliably wait for textures before gameplay begins.

        // Handle Resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    async preloadEnvironment(onProgress) {
        const report = (p, text) => {
            if (onProgress) onProgress(p, text);
        };
        const quality = this.graphicsQuality === 'low' ? 'low' : 'high';
        report(0, 'Forging the Eidolic night...');
        if (!this.backgroundTexture) {
            this.backgroundTexture = createProceduralTerrainTexture('sky', { quality });
            this.scene.background = this.backgroundTexture;
        }

        report(25, 'Stirring the blackwater...');
        if (!this.waterTexture) {
            this.waterTexture = createProceduralTerrainTexture('ocean', { quality });
            this.setupTexture(this.waterTexture, 180, 180);
        }
        if (!this.waterPlane) {
            const geo = new THREE.PlaneGeometry(10000, 10000);
            const mat = this.createWaterMaterial(this.waterTexture);
            this.waterPlane = new THREE.Mesh(geo, mat);
            this.waterPlane.name = 'ProceduralEidolicBlackwater';
            this.waterPlane.userData.proceduralTerrain = true;
            this.waterPlane.userData.terrainKey = 'ocean';
            this.waterPlane.userData.motif = PROCEDURAL_TERRAIN_DEFINITIONS.ocean.motif;
            this.waterPlane.rotation.x = -Math.PI / 2;
            this.waterPlane.position.y = -5;
            this.waterPlane.renderOrder = -1;
        }
        if (!this.waterPlane.parent) this.staticEnvironmentGroup.add(this.waterPlane);

        report(50, 'Carving the five realms...');
        const fenceInset = 0.75; // Match fence thickness so water shows beyond bounds
        const realmWidth = 2000 - fenceInset * 2;
        const realmDepth = 1600 - fenceInset * 2;
        this.terrainTextures ||= {};
        const createRealmGround = (property, key, x, y, z, width = realmWidth, depth = realmDepth) => {
            if (!this.terrainTextures[key]) {
                this.terrainTextures[key] = createProceduralTerrainTexture(key, { quality });
                this.setupTexture(this.terrainTextures[key], ...PROCEDURAL_TERRAIN_DEFINITIONS[key].surface.repeat);
            }
            if (!this[property]) {
                const material = createProceduralTerrainMaterial(key, {
                    quality,
                    texture: this.terrainTextures[key]
                });
                const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
                ground.name = `ProceduralRealmTerrain:${key}`;
                ground.userData.proceduralTerrain = true;
                ground.userData.terrainKey = key;
                ground.userData.terrainId = PROCEDURAL_TERRAIN_DEFINITIONS[key].id;
                ground.userData.motif = PROCEDURAL_TERRAIN_DEFINITIONS[key].motif;
                ground.rotation.x = -Math.PI / 2;
                ground.position.set(x, y, z);
                ground.receiveShadow = true;
                this[property] = ground;
            }
            if (!this[property].parent) this.staticEnvironmentGroup.add(this[property]);
        };

        createRealmGround('groundEarth', 'earth', 0, 0, 200);
        createRealmGround('groundSnow', 'water', 0, 0, -1400);
        createRealmGround('groundFire', 'fire', -2000, 0, 200);
        createRealmGround('groundAir', 'air', 2000, 0, 200);
        createRealmGround('groundTown', 'town', 0, 0.025, 200, 198.5, 198.5);

        report(100, 'Five codeborn realms ready');
        if (!this._pMesh) this.initRealmParticles();
    }

    /* ----------------------------------------------------------------
       Realm Ambient Particles
       ----------------------------------------------------------------
       Lightweight camera-relative particle system that gives each realm
       a distinct atmospheric feel:
         earth — gentle floating dust motes
         town  — warm firefly-like motes
         water — falling snowflakes
         fire  — rising embers
         air   — fast horizontal wind wisps
       ---------------------------------------------------------------- */

    static REALM_PARTICLE_CONFIGS = createRegionParticleConfigs();

    initRealmParticles() {
        const count = this.isMobile ? 50 : 140;
        this._pCount = count;

        const positions = new Float32Array(count * 3);
        const alphas = new Float32Array(count);

        // Initialize all below ground (invisible)
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 1] = -200;
            alphas[i] = 0;
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(0xc8b89a) },
                uSize: { value: 3.0 }
            },
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;
                uniform float uSize;
                void main() {
                    vAlpha = alpha;
                    gl_PointSize = uSize;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    float d = length(gl_PointCoord - vec2(0.5));
                    if (d > 0.5) discard;
                    float soft = 1.0 - smoothstep(0.25, 0.5, d);
                    gl_FragColor = vec4(uColor, vAlpha * soft);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this._pMesh = new THREE.Points(geom, mat);
        this._pMesh.frustumCulled = false;
        this.staticEnvironmentGroup.add(this._pMesh);

        // Internal per-particle state (plain arrays, not GPU attributes)
        this._pVel = new Float32Array(count * 3);
        this._pLife = new Float32Array(count);     // remaining life
        this._pMaxLife = new Float32Array(count);  // total life (for fade calc)
        this._pRealm = null;                       // currently-configured realm
        this._pTargetColor = new THREE.Color(0xc8b89a);
    }

    /** Spawn / reset a single particle at `index` using `cfg` around `center`. */
    _spawnParticle(index, cfg, center) {
        const pos = this._pMesh.geometry.attributes.position.array;
        const i3 = index * 3;

        const rand = (min, max) => min + Math.random() * (max - min);

        pos[i3]     = center.x + rand(-cfg.spread[0], cfg.spread[0]);
        pos[i3 + 1] = rand(cfg.spawnY[0], cfg.spawnY[1]);
        pos[i3 + 2] = center.z + rand(-cfg.spread[2], cfg.spread[2]);

        this._pVel[i3]     = rand(cfg.velXZ[0], cfg.velXZ[1]);
        this._pVel[i3 + 1] = rand(cfg.velY[0], cfg.velY[1]);
        this._pVel[i3 + 2] = rand(cfg.velXZ[0], cfg.velXZ[1]);

        const life = rand(cfg.life[0], cfg.life[1]);
        this._pLife[index] = life;
        this._pMaxLife[index] = life;
    }

    /**
     * Called every frame from `updateEnvironmentLighting`.
     * Moves particles, recycles dead ones, and transitions color/size on realm change.
     */
    updateRealmParticles(dt, cameraTarget) {
        if (!this._pMesh) return;
        if (this.graphicsQuality === 'low') {
            this._pMesh.visible = false;
            return;
        }
        this._pMesh.visible = true;

        const realm = this.currentRealm || 'earth';
        // Town shares earth particles when no town config (but we do have one)
        const cfg = RenderSystem.REALM_PARTICLE_CONFIGS[realm]
            || RenderSystem.REALM_PARTICLE_CONFIGS.earth;

        // On realm change, update target color/size (particles respawn gradually)
        if (realm !== this._pRealm) {
            this._pRealm = realm;
            this._pTargetColor.set(cfg.color);
        }

        // Lerp material color/size toward target
        const mat = this._pMesh.material;
        mat.uniforms.uColor.value.lerp(this._pTargetColor, Math.min(1, dt * 2.0));
        mat.uniforms.uSize.value = THREE.MathUtils.lerp(
            mat.uniforms.uSize.value, cfg.size, Math.min(1, dt * 2.0)
        );

        const pos = this._pMesh.geometry.attributes.position.array;
        const alphas = this._pMesh.geometry.attributes.alpha.array;
        const count = this._pCount;
        const center = cameraTarget || this.cameraTarget;

        for (let i = 0; i < count; i++) {
            this._pLife[i] -= dt;
            if (this._pLife[i] <= 0) {
                // Respawn
                this._spawnParticle(i, cfg, center);
                alphas[i] = 0; // fade in from zero
            } else {
                // Move
                const i3 = i * 3;
                pos[i3]     += this._pVel[i3] * dt;
                pos[i3 + 1] += this._pVel[i3 + 1] * dt;
                pos[i3 + 2] += this._pVel[i3 + 2] * dt;

                // Fade: ramp up in first 20% of life, ramp down in last 30%
                const t = this._pLife[i] / this._pMaxLife[i]; // 1→0
                const fadeIn = Math.min(1, (1 - t) / 0.2);    // 0→1 in first 20%
                const fadeOut = Math.min(1, t / 0.3);          // 1→0 in last 30%
                alphas[i] = fadeIn * fadeOut * 0.6;             // cap at 0.6 opacity
            }
        }

        this._pMesh.geometry.attributes.position.needsUpdate = true;
        this._pMesh.geometry.attributes.alpha.needsUpdate = true;
    }

    setupLights() {
        if (this.ambientLight?.parent?.remove) {
            this.ambientLight.parent.remove(this.ambientLight);
        }
        if (this.keyLight?.parent?.remove) {
            this.keyLight.parent.remove(this.keyLight);
        }
        if (this.keyLight?.target?.parent?.remove) {
            this.keyLight.target.parent.remove(this.keyLight.target);
        }
        if (this.fillLight?.parent?.remove) {
            this.fillLight.parent.remove(this.fillLight);
        }
        if (this.fillLight?.target?.parent?.remove) {
            this.fillLight.target.parent.remove(this.fillLight.target);
        }

        const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = this.renderer.shadowMap.enabled;
        
        // Optimization: Reduce Shadow Map Size on Mobile
        // Keep high quality sharper now that the shadow frustum follows the player.
        const shadowSize = this.getShadowMapSize();
        dirLight.shadow.mapSize.width = shadowSize;
        dirLight.shadow.mapSize.height = shadowSize;
        dirLight.shadow.autoUpdate = true;
        dirLight.shadow.radius = this.graphicsQuality === 'high' ? 4.5 : 3.0;
        dirLight.shadow.bias = -0.00014;
        dirLight.shadow.normalBias = 0.05;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 1400;
        this.configureShadowFrustum(dirLight, this.shadowCoverageRadius);
        dirLight.target.position.copy(this.shadowTarget);
        this.scene.add(dirLight.target);
        this.scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x99b7ff, 0.35);
        fillLight.position.set(-14, 12, -8);
        fillLight.castShadow = false;
        this.scene.add(fillLight);

        this.ambientLight = ambientLight;
        this.keyLight = dirLight;
        this.fillLight = fillLight;
    }

    setupPostProcessing() {
        const params = new URLSearchParams(window.location.search);
        const forcePost = params.get('post') === '1';
        const disablePost = params.get('post') === '0';
        if (disablePost || this.graphicsQuality === 'low' || (this.isMobile && !forcePost)) {
            this.usePostProcessing = false;
            return;
        }

        try {
            this.composer = new EffectComposer(this.renderer);
            this.renderPass = new RenderPass(this.scene, this.camera);
            this.composer.addPass(this.renderPass);

            this.bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.24,
                0.3,
                0.82
            );
            this.composer.addPass(this.bloomPass);

            this.fxaaPass = new ShaderPass(FXAAShader);
            this.updateFxaaResolution();
            this.composer.addPass(this.fxaaPass);

            this.outputPass = new OutputPass();
            this.composer.addPass(this.outputPass);

            this.usePostProcessing = true;
            this.postProcessingInitFailed = false;
            this.applyPostProcessingPreset(this.targetLighting || this.realmLightingPresets.earth);
        } catch (error) {
            console.warn('RenderSystem: Post-processing disabled due to setup failure.', error);
            this.usePostProcessing = false;
            this.postProcessingInitFailed = true;
            this.composer = null;
            this.renderPass = null;
            this.bloomPass = null;
            this.fxaaPass = null;
            this.outputPass = null;
        }
    }

    updateFxaaResolution() {
        if (!this.fxaaPass) return;
        const pixelRatio = this.renderer.getPixelRatio();
        this.fxaaPass.material.uniforms.resolution.value.set(
            1 / (window.innerWidth * pixelRatio),
            1 / (window.innerHeight * pixelRatio)
        );
    }

    getRealmForPosition(position) {
        if (this.environmentThemeOverride) return this.environmentThemeOverride;
        if (!position) return 'earth';
        if (position.z < -600) return 'water';
        if (position.x < -1000) return 'fire';
        if (position.x > 1000) return 'air';
        // Town is a ~120-radius area centered at (0, 200) within Earth
        const dx = position.x;
        const dz = position.z - 200;
        if (dx * dx + dz * dz < 120 * 120) return 'town';
        return 'earth';
    }

    setEnvironmentContext(context = null, position = null, immediate = true) {
        const dungeonTheme = DUNGEON_THEME_KEY_SET.has(context) ? context : null;
        this.environmentThemeOverride = dungeonTheme;
        const realm = this.getRealmForPosition(position || this.cameraTarget);
        this.currentRealm = realm;
        this.applyLightingPreset(realm, immediate);

        // Recycle the atmosphere immediately so a dungeon transition cannot
        // carry overworld snow, embers, or wind across the loading boundary.
        if (this._pLife) this._pLife.fill(0);
        this._pRealm = null;
        return realm;
    }

    applyLightingPreset(realm, immediate = false) {
        const preset = this.realmLightingPresets[realm] || this.realmLightingPresets.earth;
        this.targetLighting = {
            ambientIntensity: preset.ambientIntensity,
            keyIntensity: preset.keyIntensity,
            keyColor: new THREE.Color(preset.keyColor),
            fillColor: new THREE.Color(preset.fillColor),
            fillIntensity: preset.fillIntensity,
            fogColor: new THREE.Color(preset.fogColor),
            fogNear: preset.fogNear,
            fogFar: preset.fogFar,
            exposure: preset.exposure,
            bloomStrength: preset.bloomStrength,
            bloomRadius: preset.bloomRadius,
            bloomThreshold: preset.bloomThreshold
        };

        if (immediate) {
            this.currentLighting.ambientIntensity = this.targetLighting.ambientIntensity;
            this.currentLighting.keyIntensity = this.targetLighting.keyIntensity;
            this.currentLighting.keyColor.copy(this.targetLighting.keyColor);
            this.currentLighting.fillColor.copy(this.targetLighting.fillColor);
            this.currentLighting.fillIntensity = this.targetLighting.fillIntensity;
            this.currentLighting.fogColor.copy(this.targetLighting.fogColor);
            this.currentLighting.fogNear = this.targetLighting.fogNear;
            this.currentLighting.fogFar = this.targetLighting.fogFar;
            this.renderer.toneMappingExposure = this.targetLighting.exposure * this.brightnessScale;
            this.applyLightingState();
            this.applyPostProcessingPreset(this.targetLighting);
        }
    }

    applyPostProcessingPreset(preset) {
        if (!this.bloomPass) return;
        this.bloomPass.strength = preset.bloomStrength * this.bloomQualityScale;
        this.bloomPass.radius = preset.bloomRadius;
        this.bloomPass.threshold = preset.bloomThreshold;
    }

    getShadowMapSize() {
        if (this.isMobile || this.graphicsQuality === 'low') return 512;
        if (this.graphicsQuality === 'medium') return 2048;
        return 4096;
    }

    configureShadowFrustum(light, radius = this.shadowCoverageRadius) {
        if (!light?.shadow?.camera) return;
        const coverage = Math.max(180, Number(radius) || this.shadowCoverageRadius || 220);
        light.shadow.camera.left = -coverage;
        light.shadow.camera.right = coverage;
        light.shadow.camera.top = coverage;
        light.shadow.camera.bottom = -coverage;
        light.shadow.camera.updateProjectionMatrix();
        light.shadow.needsUpdate = true;
    }

    getShadowWorldTexelSize() {
        const mapSize = this.keyLight?.shadow?.mapSize?.width || this.getShadowMapSize();
        const coverage = Math.max(180, Number(this.shadowCoverageRadius) || 220);
        return (coverage * 2) / Math.max(1, mapSize);
    }

    getShadowSnappedTarget(position) {
        if (!this.shadowTexelSnap || !position) {
            return new THREE.Vector3(position?.x || 0, 0, position?.z || 0);
        }

        const texelSize = this.getShadowWorldTexelSize();
        return new THREE.Vector3(
            Math.round(position.x / texelSize) * texelSize,
            0,
            Math.round(position.z / texelSize) * texelSize
        );
    }

    updateShadowFocus(position = null) {
        if (!this.keyLight || !position) return;
        const snappedTarget = this.getShadowSnappedTarget(position);
        this.shadowTarget.copy(snappedTarget);
        this.keyLight.target.position.copy(this.shadowTarget);
        this.keyLight.position.copy(this.shadowTarget).add(this.shadowFollowOffset);
        this.keyLight.target.updateMatrixWorld?.();
        this.keyLight.shadow.camera.updateProjectionMatrix();
        this.keyLight.shadow.needsUpdate = true;
    }

    getBrightnessScale(level = 100) {
        const clamped = Math.max(0, Math.min(100, Number(level) || 0));
        if (clamped <= 50) {
            const t = clamped / 50;
            return this.minBrightnessScale + t * (this.midBrightnessScale - this.minBrightnessScale);
        }
        const t = (clamped - 50) / 50;
        return this.midBrightnessScale + t * (1 - this.midBrightnessScale);
    }

    setBrightnessLevel(level = 100) {
        const clamped = Math.max(0, Math.min(100, Number(level) || 0));
        this.brightnessLevel = clamped;
        this.brightnessScale = this.getBrightnessScale(clamped);
        if (this.targetLighting) {
            this.renderer.toneMappingExposure = this.targetLighting.exposure * this.brightnessScale;
        }
    }

    setGraphicsQuality(quality = 'high') {
        const normalized = (quality === 'low' || quality === 'medium' || quality === 'high') ? quality : 'high';
        const previousQuality = this.graphicsQuality;
        this.graphicsQuality = normalized;
        this.bloomQualityScale = normalized === 'high' ? 1.0 : (normalized === 'medium' ? 0.66 : 0.0);
        this.effectQualityScale = normalized === 'high' ? 1.0 : (normalized === 'medium' ? 0.78 : 0.52);

        const isFirefox = /firefox/i.test(navigator.userAgent);
        const allowShadows = normalized !== 'low' && !this.isMobile;
        this.renderer.shadowMap.enabled = allowShadows;
        this.renderer.shadowMap.autoUpdate = true;
        this.renderer.shadowMap.needsUpdate = true;
        this.renderer.shadowMap.type = allowShadows
            ? THREE.PCFSoftShadowMap
            : THREE.BasicShadowMap;

        if (this.keyLight) {
            this.keyLight.castShadow = allowShadows;
            const shadowSize = this.getShadowMapSize();
            this.keyLight.shadow.mapSize.width = shadowSize;
            this.keyLight.shadow.mapSize.height = shadowSize;
            this.keyLight.shadow.autoUpdate = true;
            this.keyLight.shadow.radius = normalized === 'high' ? 4.5 : 3.0;
            this.keyLight.shadow.bias = normalized === 'high' ? -0.00014 : -0.00012;
            this.keyLight.shadow.normalBias = normalized === 'high' ? 0.05 : 0.045;
            this.configureShadowFrustum(this.keyLight, this.shadowCoverageRadius);
            this.keyLight.shadow.needsUpdate = true;
        }

        if (normalized === 'low') {
            this.usePostProcessing = false;
        } else {
            if (!this.composer) {
                this.setupPostProcessing();
            }
            this.usePostProcessing = !!this.composer;
        }

        if (this.targetLighting) {
            this.applyPostProcessingPreset(this.targetLighting);
        }

        const reloadRequired = normalized !== 'low' && !this.composer && this.postProcessingInitFailed;
        return {
            changed: previousQuality !== normalized,
            reloadRequired
        };
    }

    getEffectQualityScale() {
        return this.effectQualityScale;
    }

    applyLightingState() {
        if (!this.ambientLight || !this.keyLight || !this.fillLight) return;
        this.ambientLight.intensity = this.currentLighting.ambientIntensity;
        this.keyLight.intensity = this.currentLighting.keyIntensity;
        this.keyLight.color.copy(this.currentLighting.keyColor);
        this.fillLight.intensity = this.currentLighting.fillIntensity;
        this.fillLight.color.copy(this.currentLighting.fillColor);
        // Keep reflected light in step with regional ambience, including fades
        // into darker interiors, without rebuilding the shared radiance map.
        this.scene.environmentIntensity = 0.65 * THREE.MathUtils.clamp(this.currentLighting.ambientIntensity / 1.9, 0.45, 1.1);
        if (!this.scene.fog) {
            this.scene.fog = new THREE.Fog(
                this.currentLighting.fogColor.clone(),
                this.currentLighting.fogNear,
                this.currentLighting.fogFar
            );
        } else {
            this.scene.fog.color.copy(this.currentLighting.fogColor);
            this.scene.fog.near = this.currentLighting.fogNear;
            this.scene.fog.far = this.currentLighting.fogFar;
        }
    }

    updateEnvironmentLighting(position, dt = 1 / 60) {
        const realm = this.getRealmForPosition(position);
        if (realm !== this.currentRealm || !this.targetLighting) {
            this.currentRealm = realm;
            this.applyLightingPreset(realm, false);
        }
        if (!this.targetLighting) return;

        const blend = Math.min(1, dt * 2.8);
        this.currentLighting.ambientIntensity = THREE.MathUtils.lerp(this.currentLighting.ambientIntensity, this.targetLighting.ambientIntensity, blend);
        this.currentLighting.keyIntensity = THREE.MathUtils.lerp(this.currentLighting.keyIntensity, this.targetLighting.keyIntensity, blend);
        this.currentLighting.fillIntensity = THREE.MathUtils.lerp(this.currentLighting.fillIntensity, this.targetLighting.fillIntensity, blend);
        this.currentLighting.fogNear = THREE.MathUtils.lerp(this.currentLighting.fogNear, this.targetLighting.fogNear, blend);
        this.currentLighting.fogFar = THREE.MathUtils.lerp(this.currentLighting.fogFar, this.targetLighting.fogFar, blend);
        this.currentLighting.keyColor.lerp(this.targetLighting.keyColor, blend);
        this.currentLighting.fillColor.lerp(this.targetLighting.fillColor, blend);
        this.currentLighting.fogColor.lerp(this.targetLighting.fogColor, blend);
        const targetExposure = this.targetLighting.exposure * this.brightnessScale;
        this.renderer.toneMappingExposure = THREE.MathUtils.lerp(this.renderer.toneMappingExposure, targetExposure, blend);

        this.applyLightingState();

        if (this.bloomPass) {
            const targetStrength = this.targetLighting.bloomStrength * this.bloomQualityScale;
            this.bloomPass.strength = THREE.MathUtils.lerp(this.bloomPass.strength, targetStrength, blend);
            this.bloomPass.radius = THREE.MathUtils.lerp(this.bloomPass.radius, this.targetLighting.bloomRadius, blend);
            this.bloomPass.threshold = THREE.MathUtils.lerp(this.bloomPass.threshold, this.targetLighting.bloomThreshold, blend);
        }

        this.updateShadowFocus(position);

        // Update ambient particles (follows camera, realm-dependent)
        this.updateRealmParticles(dt, position ? { x: position.x, z: position.z } : null);
    }

    // setupWater/setupGround were replaced by `preloadEnvironment()`.

    setupTexture(texture, repeatX = 80, repeatY = 80) {
        if (!texture) return;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = this.isMobile ? 1 : Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4);
        texture.repeat.set(repeatX, repeatY);
        texture.colorSpace = THREE.SRGBColorSpace;
    }

    createWaterMaterial(texture) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('waterShader') === '0') {
            return new THREE.MeshBasicMaterial({
                map: texture,
                color: 0x88ccff,
                transparent: false,
                depthWrite: false
            });
        }

        return new THREE.ShaderMaterial({
            uniforms: {
                uMap: { value: texture },
                uTime: { value: 0 },
                uFlowSpeed: { value: 0.03 },
                uDistortion: { value: 0.025 },
                uColorNear: { value: new THREE.Color(0x4d8bb0) },
                uColorFar: { value: new THREE.Color(0x8ed0f0) },
                uOpacity: { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vWorldPos;
                varying vec3 vNormalW;

                void main() {
                    vUv = uv;
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPos.xyz;
                    vNormalW = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: `
                uniform sampler2D uMap;
                uniform float uTime;
                uniform float uFlowSpeed;
                uniform float uDistortion;
                uniform vec3 uColorNear;
                uniform vec3 uColorFar;
                uniform float uOpacity;

                varying vec2 vUv;
                varying vec3 vWorldPos;
                varying vec3 vNormalW;

                void main() {
                    vec2 flowA = vec2(uTime * uFlowSpeed, uTime * uFlowSpeed * 0.65);
                    vec2 flowB = vec2(-uTime * uFlowSpeed * 0.42, uTime * uFlowSpeed * 0.31);
                    vec2 sampleUvA = vUv * 6.0 + flowA;
                    vec2 sampleUvB = vUv * 9.5 + flowB;

                    float waveA = texture2D(uMap, sampleUvA).r;
                    float waveB = texture2D(uMap, sampleUvB).g;
                    float waves = (waveA * 0.6 + waveB * 0.4);

                    vec2 distortUv = vUv * 4.0 + vec2(waveB, waveA) * uDistortion;
                    vec3 baseTex = texture2D(uMap, distortUv).rgb;

                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float fresnel = pow(1.0 - max(dot(normalize(vNormalW), viewDir), 0.0), 2.0);

                    vec3 waterColor = mix(uColorNear, uColorFar, fresnel);
                    waterColor = mix(waterColor, baseTex, 0.35);
                    waterColor += vec3(0.08, 0.14, 0.18) * waves;

                    float alpha = min(1.0, uOpacity + fresnel * 0.08);
                    gl_FragColor = vec4(waterColor, alpha);
                }
            `,
            transparent: false,
            depthWrite: false
        });
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const d = this.currentZoom;
        
        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
        this.updateFxaaResolution();
    }

    setZoom(zoomLevel) {
        this.currentZoom = Math.max(CONSTANTS.CAMERA.MIN_ZOOM, Math.min(CONSTANTS.CAMERA.MAX_ZOOM, zoomLevel));
        this.onWindowResize();
    }

    updateCamera() {
        this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);

        if (this.cameraPunch) {
            const elapsed = (performance.now() - this.cameraPunch.startTime) / (this.cameraPunch.duration * 1000);
            if (elapsed >= 1) {
                this.cameraPunch = null;
            } else {
                const damping = 1 - elapsed;
                const oscillation = Math.sin(elapsed * Math.PI * 6);
                this.camera.position.y += oscillation * this.cameraPunch.vertical * this.cameraPunch.intensity * damping;
                this.camera.position.x += Math.cos(elapsed * Math.PI * 4) * this.cameraPunch.horizontal * this.cameraPunch.intensity * damping;
            }
        }

        this.camera.lookAt(this.cameraTarget);
    }

    panCamera(deltaX, deltaZ) {
        this.cameraTarget.x += deltaX;
        this.cameraTarget.z += deltaZ;
        this.updateCamera();
    }

    setCameraTarget(target) {
        this.cameraTarget.copy(target);
        this.updateCamera();
    }

    setCameraShakeEnabled(enabled) {
        this.cameraShakeEnabled = Boolean(enabled);
        if (!this.cameraShakeEnabled) {
            this.cameraPunch = null;
            this.updateCamera();
        }
    }

    applyCameraPunch({ intensity = 0.8, duration = 0.16, vertical = 1.0, horizontal = 0.45 } = {}) {
        if (!this.cameraShakeEnabled) {
            this.cameraPunch = null;
            return;
        }

        const scaledIntensity = Math.max(0, intensity) * 0.35;
        const scaledDuration = Math.max(0.05, duration * 0.56);
        const scaledVertical = vertical * 0.55;
        const scaledHorizontal = horizontal * 0.3;

        this.cameraPunch = {
            startTime: performance.now(),
            duration: scaledDuration,
            intensity: scaledIntensity,
            vertical: scaledVertical,
            horizontal: scaledHorizontal
        };
        this.updateCamera();
    }

    add(mesh) {
        if (mesh) {
            this.entityGroup.add(mesh);
        } else {
            console.warn("RenderSystem: Attempted to add null/undefined mesh to scene.");
        }
    }

    remove(mesh) {
        if (mesh?.parent?.remove) {
            mesh.parent.remove(mesh);
        } else {
            this.scene.remove(mesh);
        }
    }

    addToEnvironment(mesh) {
        if (mesh) {
            this.instanceEnvironmentGroup.add(mesh);
        }
    }

    addToEffects(mesh) {
        if (mesh) {
            this.effectGroup.add(mesh);
        }
    }

    clearInstanceScene() {
        this.clearGroupChildren(this.instanceEnvironmentGroup, { dispose: true });
        this.clearGroupChildren(this.entityGroup);
        this.clearGroupChildren(this.effectGroup);
    }

    clearGroupChildren(group, options = {}) {
        if (!group) return;
        if (options.dispose) {
            // Traverse the whole ownership group once so resources shared by
            // sibling room, corridor, and dressing roots are deduplicated.
            this.disposeObjectResources(group);
        }
        while (group.children.length > 0) {
            const child = group.children[0];
            group.remove(child);
        }
    }

    disposeObjectResources(object) {
        if (!object) return;
        const disposedGeometries = new Set();
        const disposedMaterials = new Set();
        const disposedTextures = new Set();
        const disposeMaterial = (material) => {
            if (!material || disposedMaterials.has(material)) return;
            disposedMaterials.add(material);
            for (const value of Object.values(material)) {
                if (value?.isTexture && !disposedTextures.has(value)) {
                    disposedTextures.add(value);
                    value.dispose?.();
                }
            }
            material.dispose?.();
        };
        object.traverse?.((child) => {
            if (child.geometry?.dispose && !disposedGeometries.has(child.geometry)) {
                disposedGeometries.add(child.geometry);
                child.geometry.dispose();
            }
            if (Array.isArray(child.material)) {
                child.material.forEach(disposeMaterial);
            } else {
                disposeMaterial(child.material);
            }
        });
    }

    render() {
        if (this.waterTexture) {
            const time = performance.now() * 0.0001;
            if (this.waterPlane && this.waterPlane.material && this.waterPlane.material.uniforms && this.waterPlane.material.uniforms.uTime) {
                this.waterPlane.material.uniforms.uTime.value = time;
            } else {
                this.waterTexture.offset.x = time;
                this.waterTexture.offset.y = time;
            }
        }
        // Count the complete frame (shadow maps, world and post-processing),
        // not just the composer's final fullscreen triangle. Restore the
        // renderer's policy for callers that use it outside this frame.
        const info = this.renderer.info;
        const autoReset = info.autoReset;
        info.autoReset = false;
        info.reset();
        try {
            if (this.usePostProcessing && this.composer) {
                this.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }
        } finally {
            info.autoReset = autoReset;
        }
        this.updatePerfOverlay();
    }

    enablePerfOverlay(element) {
        if (!element) return;
        this.perfOverlay = element;
        this.perfOverlay.style.display = 'block';
        this.updatePerfOverlay(true);
    }

    updatePerfOverlay(force = false) {
        if (!this.perfOverlay) return;

        const now = performance.now();
        const stats = this.perfStats;
        stats.frames += 1;
        stats.frameTime = now - stats.lastTime;
        stats.lastTime = now;

        const interval = force ? 0 : 250;
        if (now - stats.lastUpdate < interval) {
            return;
        }

        stats.fps = Math.round(1000 / Math.max(stats.frameTime, 0.001));
        stats.lastUpdate = now;

        const info = this.renderer.info;
        const mem = info.memory || {};
        const render = info.render || {};

        const memoryLine = (performance && performance.memory)
            ? `heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB`
            : 'heap n/a';

        this.perfOverlay.textContent =
            `fps ${stats.fps}\n` +
            `frame ${stats.frameTime.toFixed(1)} ms\n` +
            `calls ${render.calls ?? 0}\n` +
            `tris ${render.triangles ?? 0}\n` +
            `geo ${mem.geometries ?? 0} tex ${mem.textures ?? 0}\n` +
            memoryLine;
    }


    dispose() {
        if (this._pMesh) {
            this._pMesh.geometry.dispose();
            this._pMesh.material.dispose();
            if (this._pMesh.parent?.remove) {
                this._pMesh.parent.remove(this._pMesh);
            } else {
                this.scene.remove(this._pMesh);
            }
            this._pMesh = null;
        }

        // Dispose generated textures (material.dispose() does NOT release these).
        const ownedTextures = new Set([
            this.waterTexture,
            this.backgroundTexture,
            this.reflectionEnvironment,
            ...Object.values(this.terrainTextures || {})
        ].filter(Boolean));
        ownedTextures.forEach((texture) => texture.dispose());
        this.waterTexture = null;
        this.backgroundTexture = null;
        this.reflectionEnvironment = null;
        this.scene.environment = null;
        this.terrainTextures = {};
        if (this.scene.background?.isTexture) this.scene.background = new THREE.Color(0x080b11);

        // Traverse scene BEFORE renderer.dispose() so GPU resources are freed while context exists
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        if (this.composer) {
            this.composer.dispose();
        }
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        if (this.perfOverlay) {
            this.perfOverlay.style.display = 'none';
        }
    }

}
