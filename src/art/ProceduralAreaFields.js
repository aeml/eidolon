import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_AREA_FIELD_DEFINITIONS = Object.freeze({
    BurningGround: Object.freeze({
        family: 'wizard',
        artStyle: 'cinder-script burn scar',
        baseRadius: 3.5
    }),
    InfernoCataclysm: Object.freeze({
        family: 'wizard',
        artStyle: 'infernal cataclysm seal',
        baseRadius: 12
    }),
    GravityWell: Object.freeze({
        family: 'wizard',
        artStyle: 'void astrolabe prison',
        baseRadius: 8
    }),
    SmokeBomb: Object.freeze({
        family: 'rogue',
        artStyle: 'blackglass concealment shroud',
        baseRadius: 5
    })
});

function geometry(key, create) {
    if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, create());
    return GEOMETRIES.get(key);
}

function material(key, color, options = {}) {
    if (!MATERIALS.has(key)) {
        const MaterialClass = options.basic ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
        const parameters = {
            color,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            depthWrite: options.depthWrite ?? true,
            side: options.side ?? THREE.FrontSide,
            blending: options.blending ?? THREE.NormalBlending
        };
        if (!options.basic) {
            parameters.roughness = options.roughness ?? 0.72;
            parameters.metalness = options.metalness ?? 0.18;
            parameters.emissive = options.emissive ?? 0;
            parameters.emissiveIntensity = options.emissiveIntensity ?? 0;
            parameters.flatShading = true;
        }
        MATERIALS.set(key, new MaterialClass(parameters));
    }
    return MATERIALS.get(key);
}

function mesh(parent, name, geometryValue, materialValue, options = {}) {
    const result = new THREE.Mesh(geometryValue, materialValue);
    result.name = name;
    result.position.set(...(options.position || [0, 0, 0]));
    result.rotation.set(...(options.rotation || [0, 0, 0]));
    result.scale.set(...(options.scale || [1, 1, 1]));
    result.castShadow = options.castShadow ?? false;
    result.receiveShadow = options.receiveShadow ?? false;
    parent.add(result);
    return result;
}

function pivot(parent, name, position = [0, 0, 0]) {
    const result = new THREE.Group();
    result.name = name;
    result.position.set(...position);
    parent.add(result);
    return result;
}

function createMaterials(type, palette) {
    return {
        dark: material(`${type}:dark`, palette.dark, { roughness: 0.92, metalness: 0.22 }),
        plate: material(`${type}:plate`, palette.plate, { roughness: 0.42, metalness: 0.66 }),
        glow: material(`${type}:glow`, palette.glow, {
            roughness: 0.18,
            emissive: palette.glow,
            emissiveIntensity: 2.1
        }),
        pale: material(`${type}:pale`, palette.pale, {
            roughness: 0.12,
            emissive: palette.pale,
            emissiveIntensity: 2.7
        }),
        field: material(`${type}:field`, palette.glow, {
            basic: true,
            transparent: true,
            opacity: palette.fieldOpacity ?? 0.12,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        }),
        mist: material(`${type}:mist`, palette.plate, {
            basic: true,
            transparent: true,
            opacity: 0.24,
            depthWrite: false
        }),
        boundary: material(`${type}:boundary`, palette.pale, {
            basic: true,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        })
    };
}

function addGroundMesh(parent, type, name, geometryValue, materialValue, options = {}) {
    return mesh(parent, name, geometryValue, materialValue, {
        ...options,
        rotation: [
            -Math.PI / 2,
            options.rotation?.[1] || 0,
            options.rotation?.[2] || 0
        ]
    });
}

function addRing(parent, type, name, innerRadius, outerRadius, materialValue, y = 0.05, segments = 48) {
    return addGroundMesh(
        parent,
        type,
        name,
        geometry(`${type}:${name}:${innerRadius}:${outerRadius}:${segments}`, () =>
            new THREE.RingGeometry(innerRadius, outerRadius, segments)
        ),
        materialValue,
        { position: [0, y, 0] }
    );
}

function addExactBoundary(root, type, materials) {
    const field = addGroundMesh(
        root,
        type,
        `${type}:ExactField`,
        geometry(`${type}:exact-field`, () => new THREE.CircleGeometry(1, 64)),
        materials.field,
        { position: [0, 0.025, 0] }
    );
    const boundary = addRing(root, type, `${type}:GameplayBoundary`, 0.965, 1, materials.boundary, 0.055, 64);
    [field, boundary].forEach((part) => {
        part.userData.gameplayBoundary = true;
        part.userData.normalizedGameplayRadius = 1;
    });
}

function createFireField(type, materials, inferno, quality) {
    const root = new THREE.Group();
    addExactBoundary(root, type, materials);
    const spin = pivot(root, `${type}:Spin`, [0, 0.07, 0]);
    addRing(spin, type, `${type}:InnerBrand`, inferno ? 0.47 : 0.38, inferno ? 0.5 : 0.42, materials.glow, 0, 48);
    addRing(spin, type, `${type}:OuterBrand`, 0.69, 0.71, materials.plate, 0.004, 48);

    const faultCount = quality === 'low' ? 6 : (inferno ? 12 : 9);
    const fault = geometry(`${type}:fault`, () => new THREE.PlaneGeometry(inferno ? 0.038 : 0.05, inferno ? 0.82 : 0.7));
    for (let index = 0; index < faultCount; index += 1) {
        const angle = (index / faultCount) * Math.PI * 2;
        addGroundMesh(spin, type, `${type}:Fault${index + 1}`, fault, index % 3 === 0 ? materials.pale : materials.glow, {
            position: [Math.sin(angle) * (inferno ? 0.28 : 0.25), 0.01, Math.cos(angle) * (inferno ? 0.28 : 0.25)],
            rotation: [0, 0, angle + (index % 2 ? 0.16 : -0.12)]
        });
    }

    const cinderCount = quality === 'low' ? 8 : (inferno ? 16 : 12);
    const cinder = geometry(`${type}:cinder`, () => new THREE.OctahedronGeometry(inferno ? 0.012 : 0.018, 0));
    for (let index = 0; index < cinderCount; index += 1) {
        const angle = (index / cinderCount) * Math.PI * 2;
        const radius = 0.22 + (index % 4) * 0.16;
        const part = mesh(spin, `${type}:Cinder${index + 1}`, cinder, index % 4 === 0 ? materials.pale : materials.glow, {
            position: [Math.sin(angle) * radius, 0.025 + (index % 3) * 0.02, Math.cos(angle) * radius]
        });
        part.userData.baseY = part.position.y;
        part.userData.phase = angle;
        part.userData.areaFieldParticle = true;
    }

    const crownCount = quality === 'low' ? 5 : 9;
    const crown = geometry(`${type}:crown`, () => new THREE.ConeGeometry(0.025, inferno ? 0.13 : 0.18, 5));
    for (let index = 0; index < crownCount; index += 1) {
        const angle = (index / crownCount) * Math.PI * 2;
        mesh(spin, `${type}:Crown${index + 1}`, crown, index % 2 ? materials.plate : materials.glow, {
            position: [Math.sin(angle) * 0.79, inferno ? 0.055 : 0.075, Math.cos(angle) * 0.79],
            rotation: [Math.sin(angle) * 0.28, 0, -Math.cos(angle) * 0.28]
        });
    }
    return root;
}

function createGravityField(type, materials, quality) {
    const root = new THREE.Group();
    addExactBoundary(root, type, materials);
    const spin = pivot(root, `${type}:Spin`, [0, 0.065, 0]);
    [0.24, 0.43, 0.65].forEach((radius, index) => {
        addRing(spin, type, `${type}:Orbit${index + 1}`, radius, radius + 0.018, index === 1 ? materials.pale : materials.glow, index * 0.004, 56);
    });
    mesh(spin, `${type}:EventHorizon`, geometry(`${type}:event-horizon`, () => new THREE.IcosahedronGeometry(0.105, 1)), materials.dark, {
        position: [0, 0.12, 0]
    });
    mesh(spin, `${type}:Singularity`, geometry(`${type}:singularity`, () => new THREE.OctahedronGeometry(0.055, 0)), materials.pale, {
        position: [0, 0.12, 0]
    });

    const toothCount = quality === 'low' ? 8 : 16;
    const tooth = geometry(`${type}:tooth`, () => new THREE.ConeGeometry(0.022, 0.22, 4));
    for (let index = 0; index < toothCount; index += 1) {
        const angle = (index / toothCount) * Math.PI * 2;
        addGroundMesh(spin, type, `${type}:InwardTooth${index + 1}`, tooth, index % 4 === 0 ? materials.pale : materials.plate, {
            position: [Math.sin(angle) * 0.81, 0.012, Math.cos(angle) * 0.81],
            rotation: [0, 0, -angle]
        });
    }

    const shardCount = quality === 'low' ? 6 : 12;
    const orbit = pivot(spin, `${type}:CounterOrbit`, [0, 0.1, 0]);
    const shard = geometry(`${type}:shard`, () => new THREE.TetrahedronGeometry(0.025, 0));
    for (let index = 0; index < shardCount; index += 1) {
        const angle = (index / shardCount) * Math.PI * 2;
        mesh(orbit, `${type}:CapturedShard${index + 1}`, shard, index % 3 === 0 ? materials.pale : materials.glow, {
            position: [Math.sin(angle) * (0.31 + (index % 3) * 0.14), 0.025 + (index % 2) * 0.025, Math.cos(angle) * (0.31 + (index % 3) * 0.14)],
            rotation: [angle, angle * 0.5, -angle]
        });
    }
    return root;
}

function createSmokeField(type, materials, quality) {
    const root = new THREE.Group();
    addExactBoundary(root, type, materials);
    const spin = pivot(root, `${type}:Spin`, [0, 0.06, 0]);
    addRing(spin, type, `${type}:BlackglassSeal`, 0.36, 0.4, materials.plate, 0, 40);
    addRing(spin, type, `${type}:ShroudSeal`, 0.67, 0.69, materials.dark, 0.004, 48);

    const vaneCount = quality === 'low' ? 6 : 10;
    const vane = geometry(`${type}:vane`, () => new THREE.ConeGeometry(0.035, 0.36, 5));
    for (let index = 0; index < vaneCount; index += 1) {
        const angle = (index / vaneCount) * Math.PI * 2;
        addGroundMesh(spin, type, `${type}:ShroudVane${index + 1}`, vane, index % 3 === 0 ? materials.pale : materials.plate, {
            position: [Math.sin(angle) * 0.54, 0.012, Math.cos(angle) * 0.54],
            rotation: [0, 0, -angle + 0.35]
        });
    }

    const wispCount = quality === 'low' ? 7 : 14;
    const wisp = geometry(`${type}:wisp`, () => new THREE.DodecahedronGeometry(0.06, 0));
    for (let index = 0; index < wispCount; index += 1) {
        const angle = (index / wispCount) * Math.PI * 2;
        const radius = 0.2 + (index % 4) * 0.17;
        const part = mesh(spin, `${type}:Wisp${index + 1}`, wisp, index % 4 === 0 ? materials.glow : materials.mist, {
            position: [Math.sin(angle) * radius, 0.05 + (index % 3) * 0.055, Math.cos(angle) * radius],
            scale: [1.4, 0.8 + (index % 2) * 0.35, 1.4]
        });
        part.userData.baseY = part.position.y;
        part.userData.phase = angle;
        part.userData.areaFieldParticle = true;
    }
    return root;
}

const PALETTES = Object.freeze({
    BurningGround: { dark: 0x1d1515, plate: 0x673027, glow: 0xff4a1e, pale: 0xffc45a, fieldOpacity: 0.13 },
    InfernoCataclysm: { dark: 0x1f1115, plate: 0x76251d, glow: 0xff3517, pale: 0xffba47, fieldOpacity: 0.16 },
    GravityWell: { dark: 0x0c0913, plate: 0x49305f, glow: 0x7e35c9, pale: 0xe0a9ff, fieldOpacity: 0.12 },
    SmokeBomb: { dark: 0x15151a, plate: 0x4e515c, glow: 0x777b89, pale: 0xd0d3dc, fieldOpacity: 0.09 }
});

export function createProceduralAreaField(type, radius, options = {}) {
    const definition = PROCEDURAL_AREA_FIELD_DEFINITIONS[type];
    if (!definition) throw new Error(`Unknown procedural area field: ${type}`);
    const gameplayRadius = Number.isFinite(Number(radius)) && Number(radius) > 0
        ? Number(radius)
        : definition.baseRadius;
    const quality = options.quality === 'low' ? 'low' : 'high';
    const materials = createMaterials(type, PALETTES[type]);
    let root;
    if (type === 'BurningGround') root = createFireField(type, materials, false, quality);
    else if (type === 'InfernoCataclysm') root = createFireField(type, materials, true, quality);
    else if (type === 'GravityWell') root = createGravityField(type, materials, quality);
    else root = createSmokeField(type, materials, quality);

    root.name = `ProceduralAreaField:${type}`;
    root.scale.setScalar(gameplayRadius);
    root.userData.baseScale = root.scale.clone();
    root.userData.proceduralAreaField = true;
    root.userData.areaFieldType = type;
    root.userData.areaFieldFamily = definition.family;
    root.userData.artStyle = definition.artStyle;
    root.userData.gameplayRadius = gameplayRadius;
    root.userData.sharedResources = true;
    root.traverse((part) => {
        if (part.userData?.gameplayBoundary) part.userData.gameplayRadius = gameplayRadius;
    });
    return root;
}

export function updateProceduralAreaField(root, elapsed, dt) {
    if (!root?.userData?.proceduralAreaField) return;
    const type = root.userData.areaFieldType;
    const time = Math.max(0, Number(elapsed) || 0);
    const delta = Math.max(0, Number(dt) || 0);
    const spin = root.getObjectByName(`${type}:Spin`);
    const counterOrbit = root.getObjectByName(`${type}:CounterOrbit`);
    if (spin) {
        const speed = type === 'GravityWell' ? 0.48 : type === 'SmokeBomb' ? 0.18 : 0.12;
        spin.rotation.y += delta * speed;
    }
    if (counterOrbit) counterOrbit.rotation.y -= delta * 1.1;
    root.traverse((part) => {
        if (part.userData?.gameplayBoundary) {
            part.scale.set(1, 1, 1);
            return;
        }
        if (!part.userData?.areaFieldParticle) return;
        const phase = Number(part.userData.phase) || 0;
        part.position.y = (Number(part.userData.baseY) || 0) + Math.sin(time * 2.4 + phase) * 0.012;
    });
}

export function releaseProceduralAreaField(root) {
    if (!root) return;
    root.parent?.remove(root);
    root.clear();
}

export function getProceduralAreaFieldCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
