import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

const impact = (family, motif, artStyle, palette, relic, signature, gameplayRadius = null) => Object.freeze({
    family,
    motif,
    artStyle,
    palette: Object.freeze(palette),
    relic,
    signature,
    gameplayRadius
});

export const PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS = Object.freeze({
    Fireball: impact('wizard', 'cinder-star-rupture', 'caged cinder-star rupture and furnace wake',
        { dark: 0x2b0c08, base: 0x8b2515, accent: 0xff5a1f, pale: 0xffd06a }, 'crystal', 1, 10),
    ArcaneMissile: impact('wizard', 'violet-reliquary-puncture', 'violet reliquary puncture with broken orbitals',
        { dark: 0x190c2a, base: 0x542384, accent: 0xa44dff, pale: 0xefcaff }, 'crystal', 2),
    DragonfireLance: impact('wizard', 'wyrm-spear-breach', 'barbed dragonfire breach and incandescent fangs',
        { dark: 0x2b0c08, base: 0x7a2418, accent: 0xff4b1f, pale: 0xffc45c }, 'fang', 3),
    Dagger: impact('rogue', 'misericorde-strike', 'blacksteel misericorde strike with pale edge sparks',
        { dark: 0x111419, base: 0x59616b, accent: 0xaeb9c7, pale: 0xf4f7fb }, 'blade', 4),
    FlameTornado: impact('wizard', 'cinder-helix-scour', 'cinder helix scour with climbing ember teeth',
        { dark: 0x27100b, base: 0x7e2b1c, accent: 0xff5421, pale: 0xffd36b }, 'fang', 5),
    Meteor: impact('wizard', 'extinction-stone-fall', 'crowned extinction-stone impact and caldera fracture',
        { dark: 0x170d0d, base: 0x5f1d16, accent: 0xff3918, pale: 0xffb94c }, 'stone', 6, 26.4),
    PhantomArrow: impact('rogue', 'void-feather-unmaking', 'void-feather execution impact and eclipse splinters',
        { dark: 0x120a1c, base: 0x42205f, accent: 0x9842df, pale: 0xe5c1ff }, 'feather', 7),
    Tripwire: impact('rogue', 'tension-latch-snap', 'blacksteel tension-latch snap and severed silver wire',
        { dark: 0x12151a, base: 0x58616c, accent: 0xb4c0ce, pale: 0xffffff }, 'bar', 8),
    ExplosiveTrap: impact('rogue', 'cinder-tooth-detonation', 'cinder-tooth mine detonation and shrapnel seal',
        { dark: 0x27100c, base: 0x70251b, accent: 0xff4420, pale: 0xffc35c }, 'fang', 9, 6),
    SnareTrap: impact('rogue', 'venom-jaw-closure', 'viridian iron jaw closure and binding thorn flash',
        { dark: 0x0d1b12, base: 0x285b36, accent: 0x4cda70, pale: 0xcaffd6 }, 'fang', 10)
});

function geometry(key, factory) {
    if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, factory());
    return GEOMETRIES.get(key);
}

function material(key, color, opacity = 0.9, blending = THREE.AdditiveBlending) {
    if (!MATERIALS.has(key)) {
        MATERIALS.set(key, new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending
        }));
    }
    return MATERIALS.get(key);
}

function materials(type, palette) {
    return {
        dark: material(`${type}:impact:dark`, palette.dark, 0.7, THREE.NormalBlending),
        base: material(`${type}:impact:base`, palette.base, 0.78),
        accent: material(`${type}:impact:accent`, palette.accent, 0.9),
        pale: material(`${type}:impact:pale`, palette.pale, 0.96),
        field: material(`${type}:impact:field`, palette.accent, 0.14)
    };
}

function addPart(parent, type, name, geo, mat, options = {}) {
    const part = new THREE.Mesh(geo, mat);
    part.name = `${type}:Impact:${name}`;
    part.position.fromArray(options.position || [0, 0, 0]);
    part.rotation.fromArray(options.rotation || [0, 0, 0]);
    part.scale.fromArray(options.scale || [1, 1, 1]);
    part.castShadow = false;
    part.receiveShadow = false;
    Object.assign(part.userData, {
        proceduralProjectileImpactPart: true,
        motion: options.motion || null,
        phase: options.phase || 0,
        highQualityOnly: Boolean(options.highQualityOnly),
        gameplayBoundary: Boolean(options.gameplayBoundary),
        gameplayRadius: options.gameplayRadius ?? null,
        normalizedGameplayRadius: options.normalizedGameplayRadius ?? null,
        basePosition: part.position.toArray(),
        baseScale: part.scale.toArray(),
        directionSign: options.directionSign || 1
    });
    parent.add(part);
    return part;
}

function relicGeometry(relic) {
    if (relic === 'blade') return geometry('impact:relic:blade', () => new THREE.ConeGeometry(0.09, 0.72, 4));
    if (relic === 'fang') return geometry('impact:relic:fang', () => new THREE.ConeGeometry(0.11, 0.58, 5));
    if (relic === 'feather') return geometry('impact:relic:feather', () => new THREE.ConeGeometry(0.08, 0.7, 4));
    if (relic === 'bar') return geometry('impact:relic:bar', () => new THREE.BoxGeometry(0.08, 0.62, 0.09));
    if (relic === 'stone') return geometry('impact:relic:stone', () => new THREE.DodecahedronGeometry(0.18, 0));
    return geometry('impact:relic:crystal', () => new THREE.OctahedronGeometry(0.16, 0));
}

function addExactAoeBoundary(root, type, radius, mats) {
    const field = addPart(root, type, 'ExactField',
        geometry(`impact:field:unit:64`, () => new THREE.CircleGeometry(1, 64)), mats.field, {
            position: [0, 0.035, 0], rotation: [-Math.PI / 2, 0, 0], scale: [radius, radius, radius],
            gameplayBoundary: true, gameplayRadius: radius, normalizedGameplayRadius: 1
        });
    const boundary = addPart(root, type, 'ExactBoundary',
        geometry(`impact:boundary:unit:64`, () => new THREE.RingGeometry(0.965, 1, 64)), mats.pale, {
            position: [0, 0.065, 0], rotation: [-Math.PI / 2, 0, 0], scale: [radius, radius, radius],
            gameplayBoundary: true, gameplayRadius: radius, normalizedGameplayRadius: 1
        });
    field.userData.motion = 'boundary-fade';
    boundary.userData.motion = 'boundary-fade';
}

function buildImpact(root, type, definition, mats, radius, quality) {
    const isAoe = Number.isFinite(radius) && radius > 0;
    const visualScale = isAoe ? Math.max(1, Math.min(4.2, radius * 0.2)) : 1;
    if (isAoe) addExactAoeBoundary(root, type, radius, mats);

    const sealRadius = isAoe ? Math.min(radius * 0.48, 5.8) : 1.05;
    for (let index = 0; index < 3; index += 1) {
        addPart(root, type, `BrokenSeal${index + 1}`,
            geometry(`impact:ring:${index}`, () => new THREE.RingGeometry(0.9 - index * 0.12, 1, 32)),
            index === 1 ? mats.pale : mats.accent, {
                position: [0, 0.08 + index * 0.025, 0],
                rotation: [-Math.PI / 2, 0, definition.signature * 0.17 + index * 0.48],
                scale: [sealRadius * (0.48 + index * 0.25), sealRadius * (0.48 + index * 0.25), 1],
                motion: index % 2 ? 'counter-spin-expand' : 'spin-expand', phase: index
            });
    }

    const coreHeight = type === 'Meteor' ? 3.4 : type === 'FlameTornado' ? 2.7 : 1.4;
    addPart(root, type, 'ImpactHeart',
        geometry('impact:heart', () => new THREE.OctahedronGeometry(0.42, 0)), mats.pale, {
            position: [0, Math.max(0.35, coreHeight * 0.28), 0],
            scale: [visualScale, visualScale * 1.25, visualScale], motion: 'heart-collapse'
        });
    addPart(root, type, 'RuptureCrown',
        geometry('impact:crown', () => new THREE.ConeGeometry(0.46, 1.8, 7, 1, true)), mats.accent, {
            position: [0, coreHeight * 0.5, 0], scale: [visualScale, coreHeight, visualScale], motion: 'crown-rise'
        });

    const shardCount = quality === 'low' ? 8 : 16;
    const shard = relicGeometry(definition.relic);
    for (let index = 0; index < shardCount; index += 1) {
        const angle = (index / shardCount) * Math.PI * 2 + definition.signature * 0.13;
        const reach = (isAoe ? Math.min(radius * 0.72, 8.5) : 1.5) * (0.72 + (index % 4) * 0.09);
        addPart(root, type, `RelicShard${index + 1}`, shard,
            index % 4 === 0 ? mats.pale : (index % 2 ? mats.base : mats.accent), {
                position: [Math.cos(angle) * reach * 0.12, 0.22 + (index % 3) * 0.12, Math.sin(angle) * reach * 0.12],
                rotation: [Math.PI / 2, -angle, index % 2 ? 0.36 : -0.36],
                scale: [visualScale, visualScale, visualScale], motion: 'shard-flight', phase: angle,
                directionSign: index % 2 ? -1 : 1, highQualityOnly: index >= 8
            });
        const part = root.getObjectByName(`${type}:Impact:RelicShard${index + 1}`);
        part.userData.flightReach = reach;
    }

    if (definition.relic === 'bar' || type === 'SnareTrap') {
        for (let index = 0; index < 4; index += 1) {
            const angle = index * Math.PI / 2;
            addPart(root, type, `BindingLine${index + 1}`,
                geometry('impact:binding-line', () => new THREE.BoxGeometry(0.06, 0.06, 2.3)), mats.pale, {
                    position: [0, 0.16 + index * 0.02, 0], rotation: [0, angle, 0],
                    scale: [1, 1, isAoe ? Math.min(3.5, radius * 0.35) : 1], motion: 'line-snap', phase: index
                });
        }
    }

    return isAoe ? (type === 'Meteor' ? 1.15 : 0.92) : 0.68;
}

function updateImpact(root, elapsed, duration, dt) {
    const t = Math.min(1, elapsed / duration);
    const fade = Math.max(0, 1 - t);
    root.traverse((part) => {
        if (!part.isMesh) return;
        const data = part.userData;
        if (data.gameplayBoundary) {
            part.scale.fromArray(data.baseScale);
            part.visible = t < 0.82;
            return;
        }
        const base = data.baseScale || [1, 1, 1];
        const position = data.basePosition || [0, 0, 0];
        if (data.motion === 'spin-expand' || data.motion === 'counter-spin-expand') {
            part.rotation.z += dt * (data.motion === 'spin-expand' ? 2.6 : -2.1);
            const expansion = 0.55 + t * 1.35;
            part.scale.set(base[0] * expansion, base[1] * expansion, base[2]);
        } else if (data.motion === 'heart-collapse') {
            const pulse = Math.max(0, Math.sin(t * Math.PI));
            part.scale.set(base[0] * pulse, base[1] * pulse, base[2] * pulse);
            part.rotation.y += dt * 4.5;
        } else if (data.motion === 'crown-rise') {
            part.position.y = position[1] + t * 1.8;
            part.scale.set(base[0] * (1 + t * 0.8), base[1] * (0.35 + fade * 0.65), base[2] * (1 + t * 0.8));
        } else if (data.motion === 'shard-flight') {
            const reach = Number(data.flightReach || 1.5);
            const angle = Number(data.phase || 0);
            const travel = Math.sin(Math.min(1, t * 1.25) * Math.PI / 2) * reach;
            part.position.set(Math.cos(angle) * travel, position[1] + Math.sin(t * Math.PI) * reach * 0.22, Math.sin(angle) * travel);
            part.rotation.y += dt * 4 * data.directionSign;
            part.rotation.z += dt * 3.2;
            const close = t > 0.72 ? (1 - t) / 0.28 : 1;
            part.scale.set(base[0] * close, base[1] * close, base[2] * close);
        } else if (data.motion === 'line-snap') {
            const close = Math.max(0, 1 - t * 1.25);
            part.scale.set(base[0], base[1], base[2] * close);
            part.rotation.y += dt * (data.phase % 2 ? -1.8 : 1.8);
        }
    });
}

class ProceduralProjectileImpactEffect {
    constructor(scene, root, duration) {
        this.scene = scene;
        this.root = root;
        this.meshes = [root];
        this.duration = duration;
        this.elapsed = 0;
        this.isActive = true;
        this.disposed = false;
    }

    update(dt) {
        if (!this.isActive) return;
        const step = Math.max(0, Number(dt) || 0);
        this.elapsed += step;
        updateImpact(this.root, this.elapsed, this.duration, step);
        if (this.elapsed >= this.duration) this.dispose();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.isActive = false;
        this.root.parent?.remove(this.root);
        this.root.clear();
        this.meshes.length = 0;
    }
}

export function createProceduralProjectileImpactEffect(scene, position, options = {}) {
    if (!scene || !position) return null;
    const type = options.projectileType;
    const definition = PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS[type];
    if (!definition) throw new Error(`Unknown procedural projectile impact: ${type}`);
    const quality = options.quality === 'low' ? 'low' : 'high';
    const suppliedRadius = options.radius == null ? NaN : Number(options.radius);
    const gameplayRadius = Number.isFinite(suppliedRadius) && suppliedRadius >= 0
        ? suppliedRadius
        : definition.gameplayRadius;
    const root = new THREE.Group();
    root.name = `ProceduralProjectileImpact:${type}`;
    root.position.copy(position);
    root.position.y = Math.max(0.04, Number(position.y) || 0.04);
    const direction = options.direction?.isVector3
        ? options.direction.clone().setY(0).normalize()
        : new THREE.Vector3(0, 0, 1);
    if (direction.lengthSq() === 0) direction.set(0, 0, 1);
    root.rotation.y = Math.atan2(direction.x, direction.z);
    Object.assign(root.userData, {
        proceduralProjectileImpact: true,
        projectileType: type,
        impactFamily: definition.family,
        motif: definition.motif,
        artStyle: definition.artStyle,
        quality,
        gameplayRadius: gameplayRadius ?? null,
        terminal: Boolean(options.terminal),
        targetId: options.targetId || '',
        sharedGeometry: true,
        sharedMaterials: true
    });
    const duration = buildImpact(root, type, definition, materials(type, definition.palette), gameplayRadius, quality);
    root.traverse((part) => {
        if (part.userData?.highQualityOnly) part.visible = quality !== 'low';
    });
    scene.add(root);
    return new ProceduralProjectileImpactEffect(scene, root, duration);
}

export function getProceduralProjectileImpactCacheMetrics() {
    return { geometries: GEOMETRIES.size, materials: MATERIALS.size };
}
