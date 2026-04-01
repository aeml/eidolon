import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from './SkeletonUtils.js';
import { MeshCatalog } from './MeshCatalog.js';
import { CONSTANTS } from '../core/Constants.js';
import { resolveAssetPath } from '../assets/assetManifest.js';

export class MeshFactory {
    static loader = new GLTFLoader();
    static cache = {};
    static pool = {};
    static inflight = {};

    static getPreloadModelPaths() {
        return MeshCatalog.getPreloadModelPaths();
    }

    static isBackgroundPreloadPath(path) {
        return MeshCatalog.isBackgroundPreloadPath(path);
    }

    static getStartupPreloadModelPaths() {
        return MeshCatalog.getStartupPreloadModelPaths();
    }

    static getBackgroundPreloadModelPaths() {
        return MeshCatalog.getBackgroundPreloadModelPaths();
    }

    static async loadModelWithTimeout(path, timeoutMs = 30000) {
        if (!timeoutMs || timeoutMs <= 0) {
            return this.loadModel(path);
        }
        let timeoutId = null;
        try {
            return await Promise.race([
                this.loadModel(path),
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        delete this.inflight[path];
                        reject(new Error(`Timed out after ${timeoutMs}ms: ${path}`));
                    }, timeoutMs);
                })
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    static async preloadModels(paths, { concurrency = 2, onProgress, timeoutMs = 0, failFast = false } = {}) {
        const unique = Array.from(new Set(paths)).filter(Boolean);
        const total = unique.length;
        let completed = 0;
        const failures = [];

        const report = () => {
            if (!onProgress) return;
            const pct = total === 0 ? 100 : Math.round((completed / total) * 100);
            onProgress(pct, `Loading models (${completed}/${total})`);
        };

        report();

        let index = 0;
        const workers = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
            while (true) {
                const current = index++;
                if (current >= total) return;
                const path = unique[current];
                try {
                    await this.loadModelWithTimeout(path, timeoutMs);
                } catch (e) {
                    console.warn(`MeshFactory: Failed to preload model ${path}`, e);
                    failures.push({ path, error: e });
                    if (failFast && this.isFatalPreloadError(e)) {
                        throw e;
                    }
                } finally {
                    completed++;
                    if (onProgress) {
                        onProgress(
                            total === 0 ? 100 : Math.round((completed / total) * 100),
                            `Loading models (${completed}/${total})`,
                            { currentPath: path, completed, total }
                        );
                    }
                    // Yield to keep UI responsive.
                    await new Promise(r => setTimeout(r, 8));
                }
            }
        });

        await Promise.all(workers);

        if (failures.length > 0 && failFast) {
            const first = failures.find(f => this.isFatalPreloadError(f.error));
            if (!first) {
                return;
            }
            throw new Error(`Model preload failed for ${first.path}: ${first.error?.message || first.error}`);
        }
    }

    static isFatalPreloadError(error) {
        const msg = String(error?.message || error || '').toLowerCase();

        // Fatal: true fetch/path/time failures that indicate asset is unavailable.
        if (msg.includes('404') || msg.includes('timed out') || msg.includes('failed to fetch')) {
            return true;
        }

        // Non-fatal: texture decode errors from embedded GLB blobs.
        // We still keep preloading moving and allow runtime fallback materials.
        if (msg.includes("couldn't load texture blob") || msg.includes('could not load texture blob')) {
            return false;
        }

        // Default to non-fatal to avoid hard lock on renderer-specific decode edge cases.
        return false;
    }

    static shouldRetryLoadError(error) {
        const msg = String(error?.message || error || '').toLowerCase();

        if (msg.includes('404') || msg.includes('not found')) return false;

        if (
            msg.includes('failed to fetch') ||
            msg.includes('networkerror') ||
            msg.includes("couldn't load texture blob") ||
            msg.includes('could not load texture blob') ||
            msg.includes('decode') ||
            msg.includes('aborted')
        ) {
            return true;
        }

        return true;
    }

    static async sleep(ms) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    static async preloadAllModels(options = {}) {
        const phase = options.phase || 'all';
        if (phase === 'startup') {
            return this.preloadModels(this.getStartupPreloadModelPaths(), options);
        }
        if (phase === 'background') {
            return this.preloadModels(this.getBackgroundPreloadModelPaths(), options);
        }
        return this.preloadModels(this.getPreloadModelPaths(), options);
    }

    // Cache for primitive geometries to avoid recreation and leaks
    static geometryCache = {
        fighter: new THREE.BoxGeometry(1, 1, 1),
        rogue: new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8),
        wizard: new THREE.ConeGeometry(0.5, 1.5, 8),
        cleric: new THREE.SphereGeometry(0.6, 16, 16),
        default: new THREE.BoxGeometry(0.5, 0.5, 0.5),
        fence: new THREE.BoxGeometry(4.5, 8, 1.5),
        questNPC: new THREE.BoxGeometry(1, 2, 1),
        stash: new THREE.BoxGeometry(1.5, 1.5, 1.5),
        seraph: new THREE.CylinderGeometry(0.5, 0.5, 2, 8)
    };

    /**
     * Helper to load skeleton model with a color tint for placeholder enemies.
     * This allows us to use the skeleton model/animations for all enemies until
     * we have unique models for each enemy type.
     * @param {number} color - Hex color to tint the skeleton
     * @param {number} scale - Scale multiplier (default 2.5)
     * @param {number} emissive - Emissive color (default 0x000000)
     * @param {number} emissiveIntensity - Emissive intensity (default 0)
     * @returns {Promise<THREE.Object3D>} The tinted skeleton mesh
     */
    static async loadSkeletonWithTint(color, scale = 2.5, emissive = 0x000000, emissiveIntensity = 0) {
        try {
            const idleGltf = await this.loadModel('./assets/enemies/undead/skeleton/idle.glb');
            const mesh = SkeletonUtils.clone(idleGltf.scene);
            
            mesh.userData.animations = [];
            const addAnim = (clip, name) => {
                if (clip) {
                    const newClip = clip.clone();
                    newClip.name = name;
                    newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                    mesh.userData.animations.push(newClip);
                }
            };

            if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

            try {
                const walkGltf = await this.loadModel('./assets/enemies/undead/skeleton/walk.glb');
                if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
            } catch (e) {}

            try {
                const runGltf = await this.loadModel('./assets/enemies/undead/skeleton/run.glb');
                if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
            } catch (e) {}

            try {
                const attackGltf = await this.loadModel('./assets/enemies/undead/skeleton/attack.glb');
                if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
            } catch (e) {}

            try {
                const deathGltf = await this.loadModel('./assets/enemies/undead/skeleton/death.glb');
                if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
            } catch (e) {}

            mesh.scale.set(scale, scale, scale);
            
            // Apply color tint to all mesh materials
            mesh.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    // Clone material to avoid affecting other skeletons
                    if (c.material) {
                        c.material = c.material.clone();
                        c.material.color.setHex(color);
                        if (emissive !== 0x000000) {
                            c.material.emissive = new THREE.Color(emissive);
                            c.material.emissiveIntensity = emissiveIntensity;
                        }
                    }
                }
            });

            // Hitbox scaled to match
            const hitSize = scale * 0.8;
            const hitGeo = new THREE.BoxGeometry(hitSize, hitSize * 1.25, hitSize);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.y = hitSize * 0.5;
            mesh.add(hitMesh);
            
            return mesh;
        } catch (e) {
            console.error("Failed to load skeleton with tint:", e);
            // Fallback to colored box
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshStandardMaterial({ color: color });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 1;
            return mesh;
        }
    }

    /**
     * Helper to load quest_man model for NPC placeholders.
     * Uses the same model/animations as QuestNPC.
     * @param {string} name - NPC name for debugging
     * @returns {Promise<THREE.Object3D>} The NPC mesh
     */
    static async loadQuestManModel(name = 'NPC') {
        try {
            const gltf = await this.loadModel('./assets/npc/quest_man/idle.glb');
            const mesh = SkeletonUtils.clone(gltf.scene);
            
            mesh.userData.animations = [];
            if (gltf.animations.length > 0) {
                const clip = gltf.animations[0].clone();
                clip.name = 'Idle';
                mesh.userData.animations.push(clip);
            }

            mesh.scale.set(2.0, 2.0, 2.0);
            
            mesh.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            const hitGeo = new THREE.BoxGeometry(1.5, 3.5, 1.5);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.y = 1.75;
            mesh.add(hitMesh);

            return mesh;
        } catch (err) {
            console.error(`Failed to load ${name} model:`, err);
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x0000FF });
            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
        }
    }

    // ====================================================================
    // Procedural enemy mesh specs
    // ====================================================================
    // Each spec defines a distinct silhouette built from primitive Three.js
    // geometries so Fire/Air/Water enemies are visually distinguishable
    // at a glance, rather than all appearing as tinted skeletons.
    //
    // Shape legend:
    //   'humanoid'  – capsule body + sphere head
    //   'golem'     – wide box torso + sphere joints
    //   'wraith'    – inverted cone (robed ghost)
    //   'beast'     – low wide box body + cone head (quadruped)
    //   'elemental' – stacked spheres with glow
    //   'titan'     – very large humanoid with wide shoulders
    //   'bird'      – cone body + wing planes
    //   'serpent'   – chain of spheres (sinuous)
    // ====================================================================
    static PROCEDURAL_ENEMY_SPECS = {
        // ---- Fire realm overworld ----
        SandstormDjinn:    { shape: 'wraith',    scale: 2.5, color: 0xD2B48C, emissive: 0x332200, emissiveI: 0.15 },
        MagmaGolem:        { shape: 'golem',     scale: 3.0, color: 0xFF4500, emissive: 0xFF2200, emissiveI: 0.4 },
        ScorchedWraith:    { shape: 'wraith',    scale: 2.5, color: 0xFF6600, emissive: 0xFF4400, emissiveI: 0.5 },
        InfernalBehemoth:  { shape: 'titan',     scale: 4.0, color: 0x8B0000, emissive: 0xFF0000, emissiveI: 0.3 },
        PhoenixSentinel:   { shape: 'bird',      scale: 3.0, color: 0xFFD700, emissive: 0xFF8C00, emissiveI: 0.6 },

        // ---- Air realm overworld ----
        StormHarpy:        { shape: 'bird',      scale: 2.5, color: 0x87CEEB, emissive: 0x000000, emissiveI: 0 },
        CloudElemental:    { shape: 'elemental', scale: 2.8, color: 0xE0E0E0, emissive: 0xCCCCCC, emissiveI: 0.2 },
        ThunderRoc:        { shape: 'bird',      scale: 3.0, color: 0x4169E1, emissive: 0xFFFF00, emissiveI: 0.3 },
        TempestGiant:      { shape: 'titan',     scale: 4.5, color: 0x483D8B, emissive: 0x00BFFF, emissiveI: 0.2 },
        CycloneAvatar:     { shape: 'elemental', scale: 3.5, color: 0x00CED1, emissive: 0x00FFFF, emissiveI: 0.4 },

        // ---- Fire dungeon bosses ----
        Cindermaw:         { shape: 'beast',     scale: 4.0, color: 0xFF4500, emissive: 0xFF2200, emissiveI: 0.6 },
        ScorchedTwins:     { shape: 'humanoid',  scale: 3.5, color: 0xFF6347, emissive: 0xFF4500, emissiveI: 0.5 },
        ForgemasterPyrax:  { shape: 'golem',     scale: 4.5, color: 0xB22222, emissive: 0xFF4500, emissiveI: 0.4 },
        ObsidianGuardian:  { shape: 'titan',     scale: 5.0, color: 0x1C1C1C, emissive: 0xFF0000, emissiveI: 0.2 },
        LordInfernax:      { shape: 'titan',     scale: 6.0, color: 0x8B0000, emissive: 0xFF4500, emissiveI: 0.7 },

        // ---- Air dungeon bosses ----
        Windshear:         { shape: 'elemental', scale: 4.0, color: 0x87CEEB, emissive: 0x00BFFF, emissiveI: 0.4 },
        Stormcallers:      { shape: 'humanoid',  scale: 3.5, color: 0x9370DB, emissive: 0xFFFF00, emissiveI: 0.3 },
        RocMatriarch:      { shape: 'bird',      scale: 4.5, color: 0x4682B4, emissive: 0x00CED1, emissiveI: 0.3 },
        ThunderlordKaelix: { shape: 'titan',     scale: 5.5, color: 0x483D8B, emissive: 0xFFFF00, emissiveI: 0.5 },
        Zephyrion:         { shape: 'elemental', scale: 6.5, color: 0x00CED1, emissive: 0x00FFFF, emissiveI: 0.6 },

        // ---- Water dungeon bosses ----
        TiderendLeviathan: { shape: 'serpent',   scale: 4.0, color: 0x0AA0B8, emissive: 0x3DE7FF, emissiveI: 0.4 },
        DrownedChoir:      { shape: 'wraith',    scale: 3.6, color: 0x1E6F9F, emissive: 0x6FD8FF, emissiveI: 0.3 },
        AbyssalGoliath:    { shape: 'golem',     scale: 4.6, color: 0x0D3D5C, emissive: 0x2BB4CC, emissiveI: 0.2 },
        MaelstromWarden:   { shape: 'titan',     scale: 5.2, color: 0x0A3A6B, emissive: 0x4DD2FF, emissiveI: 0.4 },
        Thalorath:         { shape: 'titan',     scale: 6.2, color: 0x003B6F, emissive: 0x4EF2FF, emissiveI: 0.5 },
    };

    // ---- Procedural enemy caches ----
    // Geometry templates: keyed by shape name -> array of { geo, pos, rot } descriptors
    static _proceduralShapeCache = {};
    // Material cache: keyed by enemy type name -> MeshStandardMaterial
    static _proceduralMatCache = {};
    // Transparent material variants: keyed by enemy type name + suffix -> MeshStandardMaterial
    static _proceduralMatTransCache = {};
    // Hitbox geometry cache: keyed by scale -> BoxGeometry
    static _proceduralHitboxCache = {};
    // Invisible hitbox material (shared singleton)
    static _hitboxMat = null;

    /**
     * Get or create the cached material for a procedural enemy type.
     * @param {string} type - Enemy type name
     * @param {Object} spec - Spec with color, emissive, emissiveI
     * @returns {THREE.MeshStandardMaterial}
     */
    static _getProceduralMat(type, { color, emissive, emissiveI }) {
        if (!this._proceduralMatCache[type]) {
            this._proceduralMatCache[type] = new THREE.MeshStandardMaterial({
                color,
                emissive: new THREE.Color(emissive),
                emissiveIntensity: emissiveI,
                roughness: 0.6,
                metalness: 0.2,
            });
        }
        return this._proceduralMatCache[type];
    }

    /**
     * Get or create a transparent variant of the cached material.
     * @param {string} key - Cache key (e.g. "type:head", "type:ring")
     * @param {Object} spec - Spec with color, emissive, emissiveI
     * @param {number} opacity - Opacity value
     * @returns {THREE.MeshStandardMaterial}
     */
    static _getProceduralTransMat(key, { color, emissive, emissiveI }, opacity) {
        if (!this._proceduralMatTransCache[key]) {
            this._proceduralMatTransCache[key] = new THREE.MeshStandardMaterial({
                color,
                emissive: new THREE.Color(emissive),
                emissiveIntensity: emissiveI,
                roughness: 0.6,
                metalness: 0.2,
                transparent: true,
                opacity,
            });
        }
        return this._proceduralMatTransCache[key];
    }

    /**
     * Build (or retrieve from cache) the geometry descriptors for a given shape.
     * Each descriptor is { geo: BufferGeometry, pos: [x,y,z], rot: [x,y,z], transparent: bool, opacity: number }.
     * Geometries are created once and reused across all instances of the same shape.
     * @param {string} shape - Shape name
     * @returns {Array<Object>} Array of mesh descriptors
     */
    static _getShapeDescriptors(shape) {
        if (this._proceduralShapeCache[shape]) return this._proceduralShapeCache[shape];

        const descs = [];
        const add = (geo, pos, rot = [0, 0, 0], opts = {}) => {
            descs.push({ geo, pos, rot, transparent: opts.transparent || false, opacity: opts.opacity || 1.0 });
        };

        switch (shape) {
            case 'humanoid': {
                add(new THREE.CylinderGeometry(0.35, 0.3, 1.4, 8), [0, 0.7, 0]);
                add(new THREE.SphereGeometry(0.25, 8, 8), [0, 1.55, 0]);
                const armGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.8, 6);
                add(armGeo, [-0.45, 0.9, 0], [0, 0, 0.3]);
                add(armGeo, [0.45, 0.9, 0], [0, 0, -0.3]);
                break;
            }
            case 'golem': {
                add(new THREE.BoxGeometry(0.9, 0.8, 0.6), [0, 1.0, 0]);
                add(new THREE.BoxGeometry(0.4, 0.35, 0.35), [0, 1.55, 0]);
                const jointGeo = new THREE.SphereGeometry(0.18, 6, 6);
                const armGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.7, 6);
                const legGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.6, 6);
                [-0.55, 0.55].forEach(x => {
                    add(jointGeo, [x, 1.2, 0]);
                    add(armGeo, [x, 0.7, 0]);
                });
                [-0.25, 0.25].forEach(x => {
                    add(legGeo, [x, 0.3, 0]);
                });
                break;
            }
            case 'wraith': {
                add(new THREE.ConeGeometry(0.6, 1.6, 8), [0, 0.8, 0], [Math.PI, 0, 0]);
                add(new THREE.SphereGeometry(0.2, 8, 8), [0, 1.7, 0], [0, 0, 0], { transparent: true, opacity: 0.7 });
                const tendrilGeo = new THREE.ConeGeometry(0.05, 0.5, 4);
                for (let i = 0; i < 3; i++) {
                    add(tendrilGeo, [Math.cos(i * 2.1) * 0.3, 0.1, Math.sin(i * 2.1) * 0.3]);
                }
                break;
            }
            case 'beast': {
                add(new THREE.BoxGeometry(0.7, 0.5, 1.2), [0, 0.5, 0]);
                add(new THREE.ConeGeometry(0.25, 0.5, 6), [0, 0.6, 0.7], [-Math.PI / 2, 0, 0]);
                const legGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6);
                [[-0.3, 0.4], [0.3, 0.4], [-0.3, -0.4], [0.3, -0.4]].forEach(([x, z]) => {
                    add(legGeo, [x, 0.15, z]);
                });
                add(new THREE.CylinderGeometry(0.05, 0.02, 0.6, 4), [0, 0.4, -0.8], [0.5, 0, 0]);
                break;
            }
            case 'elemental': {
                const sizes = [0.35, 0.28, 0.2, 0.14];
                let y = 0;
                sizes.forEach(r => {
                    y += r;
                    add(new THREE.SphereGeometry(r, 10, 10), [0, y, 0]);
                    y += r * 0.8;
                });
                add(new THREE.TorusGeometry(0.5, 0.04, 8, 16), [0, 0.6, 0], [Math.PI / 3, 0, 0], { transparent: true, opacity: 0.5 });
                break;
            }
            case 'titan': {
                add(new THREE.BoxGeometry(0.8, 1.2, 0.5), [0, 1.0, 0]);
                add(new THREE.BoxGeometry(1.2, 0.2, 0.5), [0, 1.55, 0]);
                add(new THREE.SphereGeometry(0.22, 8, 8), [0, 1.85, 0]);
                const armGeo = new THREE.CylinderGeometry(0.14, 0.12, 1.0, 6);
                const fistGeo = new THREE.SphereGeometry(0.15, 6, 6);
                [-0.65, 0.65].forEach(x => {
                    add(armGeo, [x, 0.8, 0]);
                    add(fistGeo, [x, 0.25, 0]);
                });
                const legGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.8, 6);
                [-0.25, 0.25].forEach(x => {
                    add(legGeo, [x, 0.25, 0]);
                });
                break;
            }
            case 'bird': {
                add(new THREE.ConeGeometry(0.3, 1.0, 8), [0, 0.8, 0]);
                add(new THREE.SphereGeometry(0.18, 8, 8), [0, 1.4, 0]);
                add(new THREE.ConeGeometry(0.06, 0.2, 4), [0, 1.4, 0.22], [-Math.PI / 2, 0, 0]);
                const wingGeo = new THREE.PlaneGeometry(0.8, 0.4);
                [-1, 1].forEach(side => {
                    add(wingGeo, [side * 0.6, 1.0, 0], [0, side * 0.2, side * 0.3]);
                });
                add(new THREE.PlaneGeometry(0.3, 0.4), [0, 0.5, -0.3], [0.5, 0, 0]);
                break;
            }
            case 'serpent': {
                const segCount = 8;
                for (let i = 0; i < segCount; i++) {
                    const t = i / (segCount - 1);
                    const r = 0.2 * (1 - t * 0.5);
                    add(new THREE.SphereGeometry(r, 8, 8), [
                        Math.sin(i * 0.6) * 0.3,
                        0.3 + i * 0.18,
                        Math.cos(i * 0.6) * 0.15
                    ]);
                }
                add(new THREE.SphereGeometry(0.22, 8, 8), [
                    Math.sin((segCount - 1) * 0.6) * 0.3,
                    0.3 + segCount * 0.18,
                    0
                ]);
                break;
            }
            // No default — unknown shapes handled in createProceduralEnemy
        }

        this._proceduralShapeCache[shape] = descs;
        return descs;
    }

    /**
     * Build a procedural enemy mesh from a spec.
     * Uses cached geometries (shared per shape) and cached materials (shared per type)
     * to avoid redundant GPU allocations. Each instance gets its own Group with shared
     * geometry/material references — no cloning needed since they're read-only.
     * Falls back to loadSkeletonWithTint if anything goes wrong.
     * @param {string} type - Enemy type name
     * @param {Object} spec - Entry from PROCEDURAL_ENEMY_SPECS
     * @returns {THREE.Object3D}
     */
    static createProceduralEnemy(type, spec) {
        const { shape, scale: s, color, emissive, emissiveI } = spec;

        const group = new THREE.Group();

        // Try cached shape path
        const descs = this._getShapeDescriptors(shape);
        if (descs.length > 0) {
            const baseMat = this._getProceduralMat(type, spec);
            descs.forEach((d, i) => {
                let material = baseMat;
                if (d.transparent) {
                    material = this._getProceduralTransMat(`${type}:${i}`, spec, d.opacity);
                }
                const mesh = new THREE.Mesh(d.geo, material);
                mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
                mesh.rotation.set(d.rot[0], d.rot[1], d.rot[2]);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                group.add(mesh);
            });
        } else {
            // Unknown shape — create a visible placeholder so it's debuggable
            console.warn(`MeshFactory.createProceduralEnemy: unknown shape "${shape}" for type "${type}"`);
            const placeholder = new THREE.Mesh(
                new THREE.BoxGeometry(0.6, 1.2, 0.6),
                new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true })
            );
            placeholder.position.y = 0.6;
            placeholder.castShadow = true;
            placeholder.receiveShadow = true;
            group.add(placeholder);
        }

        // Scale the whole group
        group.scale.set(s, s, s);

        // Hitbox — cached per scale value
        if (!this._proceduralHitboxCache[s]) {
            const hitSize = s * 0.8;
            this._proceduralHitboxCache[s] = new THREE.BoxGeometry(hitSize, hitSize * 1.25, hitSize);
        }
        if (!this._hitboxMat) {
            this._hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
        }
        const hitSize = s * 0.8;
        const hitMesh = new THREE.Mesh(this._proceduralHitboxCache[s], this._hitboxMat);
        hitMesh.position.y = hitSize * 0.5;
        group.add(hitMesh);

        return group;
    }

    static getPooledMesh(type) {
        if (this.pool[type] && this.pool[type].length > 0) {
            const mesh = this.pool[type].pop();
            mesh.visible = true;
            return mesh;
        }
        return null;
    }

    static releaseMesh(type, mesh) {
        if (!mesh) return;
        if (!this.pool[type]) this.pool[type] = [];
        
        mesh.visible = false;
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        if (mesh.parent) mesh.parent.remove(mesh);
        
        if (this.pool[type].length < 50) {
            this.pool[type].push(mesh);
        } else {
            // Pool is full, dispose of the mesh resources.
            // Procedural enemies now use shared/cached geometries and materials —
            // do NOT dispose them (they are singletons). Only dispose non-cached
            // GLTF materials whose geometry is also shared.
            const isProceduralType = !!this.PROCEDURAL_ENEMY_SPECS[type];
            if (!isProceduralType) {
                mesh.traverse((child) => {
                    if (child.isMesh) {
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                        // GLTF geometries are shared via loadModel cache — don't dispose
                    }
                });
            }
            // For procedural types: geometry + material are cached singletons, nothing to dispose
        }
    }

    static async loadModel(path) {
        if (this.cache[path]) return this.cache[path];
        if (this.inflight[path]) return this.inflight[path];

        const versionedPath = resolveAssetPath(path);
        const maxRetries = 2;
        const promise = (async () => {
            let attempt = 0;
            while (attempt <= maxRetries) {
                try {
                    const gltf = await new Promise((resolve, reject) => {
                        // Use a dedicated loader per request to avoid any shared internal state issues
                        // when we preload concurrently.
                        const loader = new GLTFLoader();
                        loader.load(versionedPath, resolve, undefined, reject);
                    });
                    this.cache[path] = gltf;
                    return gltf;
                } catch (err) {
                    const canRetry = attempt < maxRetries && this.shouldRetryLoadError(err);
                    if (!canRetry) {
                        throw err;
                    }

                    const delayMs = 120 * Math.pow(2, attempt);
                    console.warn(`MeshFactory: retrying model load (${attempt + 1}/${maxRetries}) for ${path}`, err);
                    await this.sleep(delayMs);
                    attempt += 1;
                }
            }

            throw new Error(`Failed to load model after retries: ${path}`);
        })();

        this.inflight[path] = promise.finally(() => {
            delete this.inflight[path];
        });
        return this.inflight[path];
    }

    static async createMeshForType(type) {
        const pooled = this.getPooledMesh(type);
        if (pooled) return pooled;

        let geometry, material, mesh;
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;

        if (type === 'Fighter') {
            try {
                const idleGltf = await this.loadModel('./assets/archetypes/Fighter/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);

                mesh.userData.animations = [];

                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                } else {
                    console.warn("MeshFactory: No animations found in idle.glb");
                }

                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Fighter/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Fighter/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Fighter/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;

                    }
                });
                
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                if (size.length() === 0) {
                    console.error("MeshFactory: Mesh has ZERO size! It might be empty or scale 0.");
                }

                mesh.position.sub(center);
                mesh.position.y += size.y / 2;

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
                const geometry = new THREE.BoxGeometry(1, 1, 1);
                const material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.FIGHTER.COLOR });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.5;
                return mesh;
            }
        }

        if (type === 'Wizard') {
            try {
                const idleGltf = await this.loadModel('./assets/archetypes/Wizard/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];

                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Wizard/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Wizard/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Wizard/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;

                    }
                });
                
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
                const geometry = new THREE.ConeGeometry(0.5, 1.5, 8);
                const material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.WIZARD.COLOR });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.75;
                return mesh;
            }
        }

        if (type === 'Rogue') {
            try {
                const idleGltf = await this.loadModel('./assets/archetypes/Rogue/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];

                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Rogue/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Rogue/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Rogue/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;

                    }
                });
                
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
                const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
                const material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.ROGUE.COLOR });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.75;
                return mesh;
            }
        }

        if (type === 'Cleric') {
            try {
                const idleGltf = await this.loadModel('./assets/archetypes/Cleric/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];

                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Cleric/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Cleric/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Cleric/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;

                    }
                });
                
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                const hitGeo = new THREE.BoxGeometry(1.5, 2.0, 1.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 0.9;
                mesh.add(hitMesh);

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
                const geometry = new THREE.SphereGeometry(0.6, 16, 16);
                const material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.CLERIC.COLOR });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.6;
                return mesh;
            }
        }

        if (type === 'Skeleton') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/undead/skeleton/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/undead/skeleton/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/undead/skeleton/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/undead/skeleton/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/undead/skeleton/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;

                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.0, 2.5, 2.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.0;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load Skeleton:", e);
                // Return a visible fallback instead of falling through to the default tiny box
                return await this.loadSkeletonWithTint(0xcccccc, 2.5, 0x444444, 0.3);
            }
        }

        if (type === 'DemonOrc') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/demons/demon_orc/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/demons/demon_orc/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/demons/demon_orc/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/demons/demon_orc/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/demons/demon_orc/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.0, 3.0, 3.0);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;

                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.0;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load DemonOrc:", e);
                const geometry = new THREE.BoxGeometry(1.5, 2, 1.5);
                const material = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1;
                return mesh;
            }
        } else if (type === 'Imp') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/demons/imp/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/demons/imp/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/demons/imp/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/demons/imp/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/demons/imp/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(1.8, 1.8, 1.8);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;

                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 0.75;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load Imp:", e);
                const geometry = new THREE.BoxGeometry(0.8, 1, 0.8);
                const material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.5;
                return mesh;
            }
        } else if (type === 'DwarfSalesman') {
            try {
                const gltf = await this.loadModel('./assets/npc/dwarf_salesman/idle.glb');
                mesh = SkeletonUtils.clone(gltf.scene);
                
                mesh.userData.animations = [];
                if (gltf.animations.length > 0) {
                    const clip = gltf.animations[0].clone();
                    clip.name = 'Idle';
                    mesh.userData.animations.push(clip);
                }

                mesh.scale.set(2.0, 2.0, 2.0);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.5, 3.5, 2.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.5;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load DwarfSalesman:", err);
                geometry = new THREE.BoxGeometry(1, 1.5, 1);
                material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        } else if (type === 'Construct') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/undead/construct/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/undead/construct/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/undead/construct/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/undead/construct/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/undead/construct/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0x555555 });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;

                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.5;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load Construct:", e);
                const geometry = new THREE.BoxGeometry(1.5, 2.5, 1.5);
                const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.25;
                return mesh;
            }
        } else if (type === 'InfernoTitan') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(4.0, 4.0, 4.0);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.0;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load InfernoTitan:", e);
                const geometry = new THREE.BoxGeometry(2.0, 3.5, 2.0);
                const material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.75;
                return mesh;
            }
        } else if (type === 'RootboundWarden') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}
                try {
                    const runGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}
                try {
                    const attackGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}
                try {
                    const deathGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(5.0, 5.0, 5.0);
                mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                return mesh;
            } catch (e) {
                console.error("Failed to load RootboundWarden:", e);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshStandardMaterial({ color: 0x006400 }));
                return mesh;
            }
        } else if (type === 'BriarMatron') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}
                try {
                    const runGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}
                try {
                    const attackGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}
                try {
                    const deathGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.0, 2.0, 2.0);
                mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                return mesh;
            } catch (e) {
                console.error("Failed to load BriarMatron:", e);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.5), new THREE.MeshStandardMaterial({ color: 0x8B0000 }));
                return mesh;
            }
        } else if (type === 'RustboundColossus') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}
                try {
                    const runGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}
                try {
                    const attackGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}
                try {
                    const deathGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.5, 3.5, 3.5);
                mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                return mesh;
            } catch (e) {
                console.error("Failed to load RustboundColossus:", e);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 3), new THREE.MeshStandardMaterial({ color: 0xA0522D }));
                return mesh;
            }
        } else if (type === 'HollowSentinel') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}
                try {
                    const runGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}
                try {
                    const attackGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}
                try {
                    const deathGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.0, 3.0, 3.0);
                mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                return mesh;
            } catch (e) {
                console.error("Failed to load HollowSentinel:", e);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4.5, 2.5), new THREE.MeshStandardMaterial({ color: 0x708090 }));
                return mesh;
            }
        } else if (type === 'Siren') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/snow/siren/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/snow/siren/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/snow/siren/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/snow/siren/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/snow/siren/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0x00ffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(1.5, 2.5, 1.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.25;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load Siren:", e);
                const geometry = new THREE.BoxGeometry(1.0, 2.0, 1.0);
                const material = new THREE.MeshStandardMaterial({ color: 0x00ffff });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.0;
                return mesh;
            }
        } else if (type === 'AquaGolem') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.5;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load AquaGolem:", e);
                const geometry = new THREE.BoxGeometry(2.0, 3.0, 2.0);
                const material = new THREE.MeshStandardMaterial({ color: 0x0088ff });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.5;
                return mesh;
            }
        } else if (type === 'MountainTroll') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.0, 3.0, 3.0); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(3.0, 3.5, 3.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.75;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load MountainTroll:", e);
                const geometry = new THREE.BoxGeometry(2.5, 3.5, 2.5);
                const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.75;
                return mesh;
            }
        } else if (type === 'FrostGuardian') {
            try {
                // Reuse Construct model but with Ice styling
                const idleGltf = await this.loadModel('./assets/enemies/undead/construct/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/undead/construct/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/undead/construct/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/undead/construct/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/undead/construct/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.0, 3.0, 3.0); // Slightly larger than Construct
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        // Force Ice Material
                        c.material = new THREE.MeshStandardMaterial({ 
                            color: 0x00FFFF, // Cyan/Ice
                            metalness: 0.8,
                            roughness: 0.2
                        });
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(3.0, 3.5, 3.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.75;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load FrostGuardian:", e);
                const geometry = new THREE.BoxGeometry(2.0, 3.0, 2.0);
                const material = new THREE.MeshStandardMaterial({ color: 0x00FFFF });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.5;
                return mesh;
            }
        } else if (type === 'AvengingSeraph') {
            try {
                // Try loading from folder structure first
                const idleGltf = await this.loadModel('./assets/summons/avenging_seraph/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/summons/avenging_seraph/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/summons/avenging_seraph/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/summons/avenging_seraph/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/summons/avenging_seraph/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // Make it glow a bit
                        if (c.material) {
                            c.material.emissive = new THREE.Color(0xffd700);
                            c.material.emissiveIntensity = 0.2;
                        }
                    }
                });

                return mesh;
            } catch (e) {
                console.warn("Failed to load AvengingSeraph from folder, trying single file...", e);
                try {
                    // Try single file
                    const gltf = await this.loadModel('./assets/summons/avenging_seraph.glb');
                    mesh = SkeletonUtils.clone(gltf.scene);
                    mesh.scale.set(2.5, 2.5, 2.5);
                    return mesh;
                } catch (e2) {
                    console.error("Failed to load AvengingSeraph (all attempts):", e2);
                    // Fallback to simple geometry
                    const geometry = this.geometryCache.seraph;
                    const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
                    mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = 1.0;
                    return mesh;
                }
            }
        } else if (type === 'Fence') {
            const geometry = this.geometryCache.fence;
            const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown
            mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.position.y = 4.0;
            return mesh;
        } else if (type === 'QuestNPC') {
            try {
                const gltf = await this.loadModel('./assets/npc/quest_man/idle.glb');
                mesh = SkeletonUtils.clone(gltf.scene);
                
                mesh.userData.animations = [];
                if (gltf.animations.length > 0) {
                    const clip = gltf.animations[0].clone();
                    clip.name = 'Idle';
                    mesh.userData.animations.push(clip);
                }

                mesh.scale.set(2.0, 2.0, 2.0);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(1.5, 3.5, 1.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.75;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load QuestNPC:", err);
                geometry = this.geometryCache.questNPC;
                material = new THREE.MeshStandardMaterial({ color: 0x0000FF });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        } else if (type === 'DungeonNPC') {
            // DungeonNPC uses the same quest_man model as QuestNPC
            return await this.loadQuestManModel('DungeonNPC');
        } else if (type === 'RespecNPC') {
            // RespecNPC uses the same quest_man model as QuestNPC
            return await this.loadQuestManModel('RespecNPC');
        } else if (type === 'TradingHouse') {
            try {
                const gltf = await this.loadModel('./assets/buildings/trading_house.glb');
                const model = SkeletonUtils.clone(gltf.scene);
                
                // Scale 7.8x (matching WorldGenerator)
                model.scale.set(7.8, 7.8, 7.8);
                
                model.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                // Calculate bounding box to center and ground the mesh
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                model.position.sub(center); // Center at 0,0,0
                model.position.y += size.y / 2; // Move up so bottom is at 0
                model.position.y -= 0.5; // Slight sink to blend with ground

                // Wrapper Group to persist offset
                mesh = new THREE.Group();
                mesh.add(model);

                // Hitbox (Invisible, for clicking)
                // Make it roughly the size of the building
                const hitGeo = new THREE.BoxGeometry(12, 12, 12);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 6.0;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load TradingHouse:", err);
                geometry = new THREE.BoxGeometry(10, 10, 10);
                material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        } else if (type === 'Stash') {
            try {
                const gltf = await this.loadModel('./assets/objects/chests/stash_base.glb');
                const model = SkeletonUtils.clone(gltf.scene);
                
                model.scale.set(2.0, 2.0, 2.0);
                
                model.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                // Calculate bounding box to center and ground the mesh
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                model.position.sub(center); // Center at 0,0,0
                model.position.y += size.y / 2 + 0.2; // Move up so bottom is at 0

                // Wrapper Group to persist offset
                mesh = new THREE.Group();
                mesh.add(model);

                const hitGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.0;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load Stash:", err);
                geometry = this.geometryCache.stash;
                material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        } else if (type === 'Forge') {
            try {
                const gltf = await this.loadModel('./assets/buildings/blacksmith_forge.glb');
                const model = SkeletonUtils.clone(gltf.scene);
                
                model.scale.set(4.0, 4.0, 4.0);
                
                model.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                // Calculate bounding box to center and ground the mesh
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                model.position.sub(center); // Center at 0,0,0
                model.position.y += size.y / 2; // Move up so bottom is at 0

                // Wrapper Group to persist offset
                mesh = new THREE.Group();
                mesh.add(model);

                // Hitbox
                const hitGeo = new THREE.BoxGeometry(4.0, 4.0, 4.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 2.0;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load Forge:", err);
                geometry = new THREE.BoxGeometry(2, 2, 2);
                material = new THREE.MeshStandardMaterial({ color: 0x555555 });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        }
        // ========================================================================
        // PROCEDURAL ENEMIES (Fire / Air / Water realms + dungeon bosses)
        // Each type uses a distinct procedural silhouette from PROCEDURAL_ENEMY_SPECS.
        // Falls back to tinted skeleton if procedural build fails.
        // TODO: Replace with proper GLB models when assets are available.
        // ========================================================================
        else if (this.PROCEDURAL_ENEMY_SPECS[type]) {
            try {
                return this.createProceduralEnemy(type, this.PROCEDURAL_ENEMY_SPECS[type]);
            } catch (e) {
                console.warn(`MeshFactory: Procedural mesh failed for ${type}, falling back to skeleton.`, e);
                const spec = this.PROCEDURAL_ENEMY_SPECS[type];
                // TODO: Replace this skeleton fallback with a proper GLB model for ${type}
                return await this.loadSkeletonWithTint(spec.color, spec.scale, spec.emissive, spec.emissiveI);
            }
        }

        switch (type) {
            case 'Fighter':
                geometry = this.geometryCache.fighter;
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.FIGHTER.COLOR });
                break;
            case 'Rogue':
                geometry = this.geometryCache.rogue;
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.ROGUE.COLOR });
                break;
            case 'Wizard':
                geometry = this.geometryCache.wizard;
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.WIZARD.COLOR });
                break;
            case 'Cleric':
                geometry = this.geometryCache.cleric;
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.CLERIC.COLOR });
                break;
            default:
                geometry = this.geometryCache.default;
                material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        }

        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.y = 0.5; 
        return mesh;
    }
}
