import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshCatalog } from './MeshCatalog.js';
import { resolveAssetPath } from '../assets/assetManifest.js';
import {
    createProceduralFighter,
    createProceduralRogue,
    createProceduralWizard,
    createProceduralCleric
} from '../art/ProceduralHumanoid.js';
import {
    createProceduralDwarfSalesman,
    createProceduralQuestNPC,
    createProceduralDungeonNPC,
    createProceduralRespecNPC
} from '../art/ProceduralTownActors.js';
import { createProceduralAvengingSeraph } from '../art/ProceduralSummons.js';
import {
    createProceduralConstruct,
    createProceduralDemonOrc,
    createProceduralImp,
    createProceduralInfernoTitan,
    createProceduralSkeleton
} from '../art/ProceduralLegacyEnemies.js';
import {
    createProceduralAquaGolem,
    createProceduralFrostGuardian,
    createProceduralMountainTroll,
    createProceduralSiren
} from '../art/ProceduralMoonfrostEnemies.js';
import {
    createProceduralBriarMatron,
    createProceduralHollowSentinel,
    createProceduralRootboundWarden,
    createProceduralRustboundColossus
} from '../art/ProceduralThorncryptBosses.js';
import {
    createProceduralCindermaw,
    createProceduralForgemasterPyrax,
    createProceduralLordInfernax,
    createProceduralObsidianGuardian,
    createProceduralScorchedTwins
} from '../art/ProceduralMoltenBosses.js';
import {
    createProceduralRocMatriarch,
    createProceduralStormcallers,
    createProceduralThunderlordKaelix,
    createProceduralWindshear,
    createProceduralZephyrion
} from '../art/ProceduralTempestBosses.js';
import {
    createProceduralAbyssalGoliath,
    createProceduralDrownedChoir,
    createProceduralMaelstromWarden,
    createProceduralThalorath,
    createProceduralTiderendLeviathan
} from '../art/ProceduralAbyssalBosses.js';
import {
    PROCEDURAL_OVERWORLD_ENEMY_DEFINITIONS,
    createProceduralOverworldEnemy
} from '../art/ProceduralOverworldEnemies.js';
import { createProceduralLanternholdStructure } from '../art/ProceduralLanternholdArchitecture.js';

// New dungeon and raid enemies deliberately recompose existing production
// rigs. Keep that relationship in the factory as well as GameEngine so direct
// consumers (previews, QA galleries, and pooled respawns) resolve the same
// visible mesh instead of falling through to an unknown-type error.
export const PROCEDURAL_MESH_ALIASES = Object.freeze({
    DissonantShade: 'ScorchedWraith',
    MemoryReaver: 'Construct',
    DissonantHerald: 'Stormcallers',
    NullArchitect: 'ObsidianGuardian',
    EidolonDevourer: 'HollowSentinel',
    UmbraPrime: 'HollowSentinel',
    GravenColossus: 'HollowSentinel',
    TideboundTyrant: 'Thalorath',
    AshenImperator: 'LordInfernax',
    TempestSovereign: 'Zephyrion'
});

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

    static getStartupPreloadModelPaths(playerType = '') {
        return MeshCatalog.getStartupPreloadModelPaths(playerType);
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

        return { completed, total, failures };
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
            return this.preloadModels(this.getStartupPreloadModelPaths(options.playerType), options);
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
        stash: new THREE.BoxGeometry(1.5, 1.5, 1.5),
        seraph: new THREE.CylinderGeometry(0.5, 0.5, 2, 8)
    };

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
    static PROCEDURAL_ENEMY_SPECS = MeshCatalog.getProceduralEnemySpecs();

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
                mesh.name = `ProceduralPart${i}`;
                mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
                mesh.rotation.set(d.rot[0], d.rot[1], d.rot[2]);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                group.add(mesh);
            });
        } else {
            throw new Error(`Unknown procedural shape "${shape}" for actor "${type}"`);
        }

        group.userData.proceduralShape = shape;
        group.userData.animations = this.createProceduralAnimationClips(group.children);

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

    static createProceduralAnimationClips(parts) {
        const animatedParts = [...parts].filter((part) => part?.isMesh && /^ProceduralPart\d+$/.test(part.name));
        if (animatedParts.length === 0) return [];

        const idleTracks = [];
        const walkTracks = [];
        const runTracks = [];
        const attackTracks = [];
        const deathTracks = [];

        animatedParts.forEach((part, index) => {
            const path = part.name;
            const baseY = part.position.y;
            const baseRotX = part.rotation.x;
            const baseRotZ = part.rotation.z;
            const phase = index % 2 === 0 ? 1 : -1;
            const movementAmount = index === 0 ? 0.08 : 0.16;

            idleTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.position[y]`,
                [0, 0.75, 1.5],
                [baseY, baseY + 0.035 + (index % 3) * 0.006, baseY]
            ));

            walkTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.rotation[x]`,
                [0, 0.4, 0.8],
                [baseRotX - movementAmount * phase, baseRotX + movementAmount * phase, baseRotX - movementAmount * phase]
            ));
            walkTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.position[y]`,
                [0, 0.2, 0.4, 0.6, 0.8],
                [baseY, baseY + 0.035, baseY, baseY + 0.035, baseY]
            ));

            runTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.rotation[x]`,
                [0, 0.24, 0.48],
                [baseRotX - movementAmount * 1.45 * phase, baseRotX + movementAmount * 1.45 * phase, baseRotX - movementAmount * 1.45 * phase]
            ));
            runTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.position[y]`,
                [0, 0.12, 0.24, 0.36, 0.48],
                [baseY, baseY + 0.06, baseY, baseY + 0.06, baseY]
            ));

            attackTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.rotation[x]`,
                [0, 0.18, 0.38, 0.62],
                [baseRotX, baseRotX - (0.18 + index * 0.015), baseRotX + (0.34 + index * 0.02), baseRotX]
            ));
            attackTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.rotation[z]`,
                [0, 0.18, 0.38, 0.62],
                [baseRotZ, baseRotZ - 0.08 * phase, baseRotZ + 0.12 * phase, baseRotZ]
            ));

            deathTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.position[y]`,
                [0, 0.32, 0.85],
                [baseY, baseY, Math.max(0.04, baseY * 0.22)]
            ));
            deathTracks.push(new THREE.NumberKeyframeTrack(
                `${path}.rotation[z]`,
                [0, 0.32, 0.85],
                [baseRotZ, baseRotZ + 0.12 * phase, baseRotZ + (Math.PI / 2) * phase]
            ));
        });

        return [
            new THREE.AnimationClip('Idle', 1.5, idleTracks),
            new THREE.AnimationClip('Walk', 0.8, walkTracks),
            new THREE.AnimationClip('Run', 0.48, runTracks),
            new THREE.AnimationClip('Attack', 0.62, attackTracks),
            new THREE.AnimationClip('Death', 0.85, deathTracks)
        ];
    }

    static createAnimatedPlayerFallback(type, geometry, color, centerY) {
        const group = new THREE.Group();
        const part = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color })
        );
        part.name = 'ProceduralPart0';
        part.position.y = centerY;
        part.castShadow = true;
        part.receiveShadow = true;
        group.add(part);
        group.userData.assetFallback = true;
        group.userData.fallbackType = type;
        group.userData.animations = this.createProceduralAnimationClips(group.children);
        return group;
    }

    static getPooledMesh(type) {
        if (this.pool[type] && this.pool[type].length > 0) {
            const mesh = this.pool[type].pop();
            mesh.userData.resetPose?.();
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
            const isProceduralType = Boolean(mesh.userData?.sharedGeometry) ||
                !!this.PROCEDURAL_ENEMY_SPECS[type];
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

    static configureShadowCastingForMaterial(material, { isFoliage = false, stableFrontShadows = false } = {}) {
        if (!material) return material;

        if (material.map && (material.transparent || isFoliage)) {
            material.transparent = false;
            material.alphaTest = Math.max(material.alphaTest || 0, 0.5);
            material.depthWrite = true;
            material.side = material.side ?? THREE.DoubleSide;
            material.shadowSide = THREE.DoubleSide;
            material.forceSinglePass = true;
            material.alphaToCoverage = false;
        }

        if (stableFrontShadows) {
            material.shadowSide = THREE.FrontSide;
            material.polygonOffset = true;
            material.polygonOffsetFactor = 1;
            material.polygonOffsetUnits = 1;
        }

        material.needsUpdate = true;
        return material;
    }

    static configureShadowCastingForObject(object, options = {}) {
        if (!object) return object;
        object.castShadow = true;
        object.receiveShadow = true;

        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material = object.material.map(material => this.configureShadowCastingForMaterial(material, options));
            } else {
                object.material = this.configureShadowCastingForMaterial(object.material, options);
            }
        }

        return object;
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

        const aliasedType = PROCEDURAL_MESH_ALIASES[type];
        if (aliasedType) {
            const aliasedMesh = await this.createMeshForType(aliasedType);
            aliasedMesh.userData.proceduralAlias = type;
            aliasedMesh.userData.proceduralSourceType = aliasedType;
            return aliasedMesh;
        }

        let mesh;
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;

        if (type === 'Fighter') {
            return createProceduralFighter();
        }

        if (type === 'Rogue') {
            return createProceduralRogue();
        }

        if (type === 'Wizard') {
            return createProceduralWizard();
        }

        if (type === 'Cleric') {
            return createProceduralCleric();
        }

        if (type === 'DwarfSalesman') {
            return createProceduralDwarfSalesman();
        }

        if (type === 'QuestNPC') {
            return createProceduralQuestNPC();
        }

        if (type === 'DungeonNPC') {
            return createProceduralDungeonNPC();
        }

        if (type === 'RespecNPC') {
            return createProceduralRespecNPC();
        }

        if (type === 'Skeleton') {
            return createProceduralSkeleton();
        }

        if (type === 'DemonOrc') {
            return createProceduralDemonOrc();
        } else if (type === 'Imp') {
            return createProceduralImp();
        } else if (type === 'Construct') {
            return createProceduralConstruct();
        } else if (type === 'InfernoTitan') {
            return createProceduralInfernoTitan();
        } else if (type === 'RootboundWarden') {
            return createProceduralRootboundWarden();
        } else if (type === 'BriarMatron') {
            return createProceduralBriarMatron();
        } else if (type === 'RustboundColossus') {
            return createProceduralRustboundColossus();
        } else if (type === 'HollowSentinel') {
            return createProceduralHollowSentinel();
        } else if (type === 'Cindermaw') {
            return createProceduralCindermaw();
        } else if (type === 'ScorchedTwins') {
            return createProceduralScorchedTwins();
        } else if (type === 'ForgemasterPyrax') {
            return createProceduralForgemasterPyrax();
        } else if (type === 'ObsidianGuardian') {
            return createProceduralObsidianGuardian();
        } else if (type === 'LordInfernax') {
            return createProceduralLordInfernax();
        } else if (type === 'Windshear') {
            return createProceduralWindshear();
        } else if (type === 'Stormcallers') {
            return createProceduralStormcallers();
        } else if (type === 'RocMatriarch') {
            return createProceduralRocMatriarch();
        } else if (type === 'ThunderlordKaelix') {
            return createProceduralThunderlordKaelix();
        } else if (type === 'Zephyrion') {
            return createProceduralZephyrion();
        } else if (type === 'TiderendLeviathan') {
            return createProceduralTiderendLeviathan();
        } else if (type === 'DrownedChoir') {
            return createProceduralDrownedChoir();
        } else if (type === 'AbyssalGoliath') {
            return createProceduralAbyssalGoliath();
        } else if (type === 'MaelstromWarden') {
            return createProceduralMaelstromWarden();
        } else if (type === 'Thalorath') {
            return createProceduralThalorath();
        } else if (PROCEDURAL_OVERWORLD_ENEMY_DEFINITIONS[type]) {
            return createProceduralOverworldEnemy(type);
        } else if (type === 'Siren') {
            return createProceduralSiren();
        } else if (type === 'AquaGolem') {
            return createProceduralAquaGolem();
        } else if (type === 'MountainTroll') {
            return createProceduralMountainTroll();
        } else if (type === 'FrostGuardian') {
            return createProceduralFrostGuardian();
        } else if (type === 'AvengingSeraph') {
            return createProceduralAvengingSeraph();
        } else if (type === 'Fence') {
            const geometry = this.geometryCache.fence;
            const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown
            mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.position.y = 4.0;
            return mesh;
        } else if (type === 'TradingHouse') {
            return createProceduralLanternholdStructure('trading_house', { optimized: true });
        } else if (type === 'Stash') {
            return createProceduralLanternholdStructure('stash', { optimized: true });
        } else if (type === 'Forge') {
            return createProceduralLanternholdStructure('forge', { optimized: true });
        }
        // Historical compatibility construction. The production registry is
        // intentionally empty and guarded by coverage now that every actor has
        // a named rig. If it ever returns, construction fails closed rather than
        // hiding an incomplete visual behind a generic actor.
        else if (this.PROCEDURAL_ENEMY_SPECS[type]) {
            return this.createProceduralEnemy(type, this.PROCEDURAL_ENEMY_SPECS[type]);
        }
        throw new Error(`Unknown procedural mesh type: ${type}`);
    }
}
