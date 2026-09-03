import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS = Object.freeze({
    Fireball: Object.freeze({ family: 'wizard', role: 'projectile', artStyle: 'caged ember star', gameplayRadius: 2 }),
    ArcaneMissile: Object.freeze({ family: 'wizard', role: 'projectile', artStyle: 'violet reliquary bolt', gameplayRadius: 1.5 }),
    DragonfireLance: Object.freeze({ family: 'wizard', role: 'projectile', artStyle: 'dragonfire war lance', gameplayRadius: 1.5 }),
    Dagger: Object.freeze({ family: 'rogue', role: 'projectile', artStyle: 'blacksteel throwing misericorde', gameplayRadius: 1.5 }),
    FlameTornado: Object.freeze({ family: 'wizard', role: 'projectile', artStyle: 'cinder helix', gameplayRadius: 1.5, upright: true }),
    Meteor: Object.freeze({ family: 'wizard', role: 'projectile', artStyle: 'crowned extinction stone', gameplayRadius: 1.5 }),
    PhantomArrow: Object.freeze({ family: 'rogue', role: 'projectile', artStyle: 'void-feather execution bolt', gameplayRadius: 1.5 }),
    Tripwire: Object.freeze({ family: 'rogue', role: 'trap', artStyle: 'blacksteel tension snare', gameplayRadius: 1.5 }),
    ExplosiveTrap: Object.freeze({ family: 'rogue', role: 'trap', artStyle: 'cinder-tooth mine', gameplayRadius: 1 }),
    SnareTrap: Object.freeze({ family: 'rogue', role: 'trap', artStyle: 'venom jaw snare', gameplayRadius: 1 }),
    ZoneDamage: Object.freeze({ family: 'wizard', role: 'zone', artStyle: 'infernal cataclysm seal', gameplayRadius: 5, scaleEncodesRadius: true }),
    ZoneHoly: Object.freeze({ family: 'cleric', role: 'zone', artStyle: 'consecrated reliquary seal', gameplayRadius: 5, scaleEncodesRadius: true }),
    Zone: Object.freeze({ family: 'cleric', role: 'zone', artStyle: 'legacy sanctified seal', gameplayRadius: 5, scaleEncodesRadius: true })
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
            parameters.roughness = options.roughness ?? 0.62;
            parameters.metalness = options.metalness ?? 0.12;
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

function standardMaterials(type, palette) {
    return {
        dark: material(`${type}:dark`, palette.dark, { roughness: 0.9, metalness: 0.35 }),
        plate: material(`${type}:plate`, palette.plate, { roughness: 0.38, metalness: 0.78 }),
        glow: material(`${type}:glow`, palette.glow, {
            roughness: 0.15,
            emissive: palette.glow,
            emissiveIntensity: 2.2
        }),
        pale: material(`${type}:pale`, palette.pale, {
            roughness: 0.12,
            emissive: palette.pale,
            emissiveIntensity: 2.8
        }),
        field: material(`${type}:field`, palette.glow, {
            basic: true,
            transparent: true,
            opacity: 0.13,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
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

function addGroundRing(parent, type, name, innerRadius, outerRadius, materialValue, y = 0.05, segments = 48) {
    const result = mesh(
        parent,
        name,
        geometry(`${type}:${name}:${innerRadius}:${outerRadius}:${segments}`, () =>
            new THREE.RingGeometry(innerRadius, outerRadius, segments)
        ),
        materialValue,
        { position: [0, y, 0], rotation: [-Math.PI / 2, 0, 0] }
    );
    return result;
}

function addOrbit(root, type, materials, count, radius, longitudinal = false) {
    const orbit = pivot(root, `${type}:Orbit`);
    const shard = geometry(`${type}:orbit-shard`, () => new THREE.OctahedronGeometry(0.09, 0));
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        mesh(orbit, `${type}:OrbitShard${index + 1}`, shard, index % 3 === 0 ? materials.pale : materials.glow, {
            position: longitudinal
                ? [Math.sin(angle) * radius, Math.cos(angle) * radius, (index / Math.max(1, count - 1) - 0.5) * 1.4]
                : [Math.sin(angle) * radius, Math.sin(angle * 2) * radius * 0.25, Math.cos(angle) * radius],
            rotation: [angle, angle * 0.5, -angle]
        });
    }
    return orbit;
}

function createFireball(type, materials) {
    const root = new THREE.Group();
    const spin = pivot(root, `${type}:Spin`);
    mesh(spin, `${type}:FaultCore`, geometry(`${type}:core`, () => new THREE.IcosahedronGeometry(0.42, 1)), materials.glow);
    mesh(spin, `${type}:PaleHeart`, geometry(`${type}:heart`, () => new THREE.OctahedronGeometry(0.24, 0)), materials.pale);
    for (let index = 0; index < 3; index += 1) {
        mesh(spin, `${type}:Cage${index + 1}`, geometry(`${type}:cage:${index}`, () => new THREE.TorusGeometry(0.5 + index * 0.08, 0.035, 5, 18)), index === 1 ? materials.pale : materials.plate, {
            rotation: [index * 0.72, Math.PI / 2 + index * 0.43, index * 0.25]
        });
    }
    const flame = geometry(`${type}:flame`, () => new THREE.ConeGeometry(0.13, 0.72, 5));
    for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        mesh(root, `${type}:Flame${index + 1}`, flame, index % 3 === 0 ? materials.pale : materials.glow, {
            position: [Math.sin(angle) * 0.28, Math.cos(angle) * 0.28, -0.68 - (index % 3) * 0.16],
            rotation: [Math.PI / 2, 0, angle]
        });
    }
    addOrbit(root, type, materials, 7, 0.68, true);
    return root;
}

function createArcaneMissile(type, materials) {
    const root = new THREE.Group();
    const spin = pivot(root, `${type}:Spin`);
    mesh(spin, `${type}:ReliquaryBolt`, geometry(`${type}:bolt`, () => new THREE.OctahedronGeometry(0.42, 0)), materials.glow, {
        scale: [0.65, 0.65, 2.45]
    });
    mesh(spin, `${type}:Needle`, geometry(`${type}:needle`, () => new THREE.ConeGeometry(0.19, 0.92, 5)), materials.pale, {
        position: [0, 0, 0.92], rotation: [Math.PI / 2, 0, 0]
    });
    for (let index = 0; index < 3; index += 1) {
        mesh(spin, `${type}:Seal${index + 1}`, geometry(`${type}:seal:${index}`, () => new THREE.TorusGeometry(0.36 + index * 0.12, 0.03, 5, 16)), index === 2 ? materials.pale : materials.plate, {
            position: [0, 0, -0.35 + index * 0.34], rotation: [0, 0, Math.PI / 2]
        });
    }
    addOrbit(root, type, materials, 6, 0.6, true);
    return root;
}

function createDragonfireLance(type, materials) {
    const root = new THREE.Group();
    const spin = pivot(root, `${type}:Spin`);
    mesh(spin, `${type}:Shaft`, geometry(`${type}:shaft`, () => new THREE.CylinderGeometry(0.08, 0.11, 2.8, 7)), materials.dark, {
        rotation: [Math.PI / 2, 0, 0]
    });
    mesh(spin, `${type}:DragonHead`, geometry(`${type}:head`, () => new THREE.ConeGeometry(0.32, 1.18, 6)), materials.glow, {
        position: [0, 0, 1.84], rotation: [Math.PI / 2, 0, 0]
    });
    const barb = geometry(`${type}:barb`, () => new THREE.ConeGeometry(0.09, 0.7, 4));
    for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        mesh(spin, `${type}:Barb${index + 1}`, barb, index % 2 ? materials.plate : materials.pale, {
            position: [Math.sin(angle) * 0.22, Math.cos(angle) * 0.22, 0.45 + (index % 2) * 0.35],
            rotation: [Math.PI / 2, 0, angle]
        });
    }
    addOrbit(root, type, materials, 8, 0.48, true);
    return root;
}

function createDagger(type, materials, phantom = false) {
    const root = new THREE.Group();
    const spin = pivot(root, `${type}:Spin`);
    mesh(spin, `${type}:Blade`, geometry(`${type}:blade`, () => new THREE.ConeGeometry(phantom ? 0.25 : 0.22, phantom ? 1.55 : 1.25, 4)), phantom ? materials.glow : materials.plate, {
        position: [0, 0, 0.55], rotation: [Math.PI / 2, 0, Math.PI / 4]
    });
    mesh(spin, `${type}:Fuller`, geometry(`${type}:fuller`, () => new THREE.BoxGeometry(0.045, 0.06, phantom ? 1.2 : 0.88)), materials.pale, {
        position: [0, 0, 0.36]
    });
    mesh(spin, `${type}:Guard`, geometry(`${type}:guard`, () => new THREE.BoxGeometry(0.72, 0.1, 0.12)), materials.dark, {
        position: [0, 0, -0.13], rotation: [0, 0, phantom ? 0.38 : 0]
    });
    mesh(spin, `${type}:Pommel`, geometry(`${type}:pommel`, () => new THREE.OctahedronGeometry(0.15, 0)), phantom ? materials.glow : materials.dark, {
        position: [0, 0, -0.55]
    });
    if (phantom) {
        for (let index = 0; index < 6; index += 1) {
            const side = index % 2 === 0 ? -1 : 1;
            mesh(spin, `${type}:VoidFeather${index + 1}`, geometry(`${type}:feather`, () => new THREE.ConeGeometry(0.09, 0.72, 4)), index % 3 === 0 ? materials.pale : materials.glow, {
                position: [side * (0.16 + Math.floor(index / 2) * 0.08), 0, -0.35 - Math.floor(index / 2) * 0.18],
                rotation: [Math.PI / 2, 0, side * 0.62]
            });
        }
        addOrbit(root, type, materials, 5, 0.48, true);
    }
    return root;
}

function createFlameTornado(type, materials) {
    const root = new THREE.Group();
    const spin = pivot(root, `${type}:Spin`, [0, 1.8, 0]);
    mesh(spin, `${type}:HollowCore`, geometry(`${type}:core`, () => new THREE.ConeGeometry(0.46, 3.4, 7, 1, true)), materials.glow, {
        position: [0, 0, 0], rotation: [0, 0, Math.PI]
    });
    for (let index = 0; index < 8; index += 1) {
        const radius = 0.38 + index * 0.13;
        mesh(spin, `${type}:Helix${index + 1}`, geometry(`${type}:helix:${index}`, () => new THREE.TorusGeometry(radius, 0.055, 5, 18)), index % 3 === 0 ? materials.pale : materials.plate, {
            position: [0, -1.34 + index * 0.37, 0], rotation: [Math.PI / 2 + index * 0.09, index * 0.15, index * 0.31]
        });
    }
    const cinder = geometry(`${type}:cinder`, () => new THREE.OctahedronGeometry(0.11, 0));
    for (let index = 0; index < 12; index += 1) {
        const angle = (index / 12) * Math.PI * 2;
        mesh(spin, `${type}:Cinder${index + 1}`, cinder, index % 4 === 0 ? materials.pale : materials.glow, {
            position: [Math.sin(angle) * (0.62 + (index % 3) * 0.18), -1.2 + (index % 6) * 0.46, Math.cos(angle) * (0.62 + (index % 3) * 0.18)]
        });
    }
    return root;
}

function createMeteor(type, materials) {
    const root = new THREE.Group();
    const spin = pivot(root, `${type}:Spin`);
    mesh(spin, `${type}:ExtinctionStone`, geometry(`${type}:stone`, () => new THREE.DodecahedronGeometry(1.24, 1)), materials.dark, {
        scale: [0.88, 1.08, 0.92], rotation: [0.24, 0.4, -0.18]
    });
    mesh(spin, `${type}:FaultHeart`, geometry(`${type}:heart`, () => new THREE.IcosahedronGeometry(0.72, 0)), materials.glow);
    const fault = geometry(`${type}:fault`, () => new THREE.BoxGeometry(0.08, 0.08, 1.45));
    for (let index = 0; index < 9; index += 1) {
        const angle = (index / 9) * Math.PI * 2;
        mesh(spin, `${type}:Fault${index + 1}`, fault, index % 3 === 0 ? materials.pale : materials.glow, {
            position: [Math.sin(angle) * 0.92, Math.sin(angle * 2) * 0.45, Math.cos(angle) * 0.4],
            rotation: [angle * 0.5, angle, angle * 0.3], scale: [1, 1, 0.55]
        });
    }
    const crown = geometry(`${type}:crown`, () => new THREE.ConeGeometry(0.12, 0.72, 5));
    for (let index = 0; index < 7; index += 1) {
        const angle = (index / 7) * Math.PI * 2;
        mesh(spin, `${type}:Crown${index + 1}`, crown, index % 2 ? materials.plate : materials.glow, {
            position: [Math.sin(angle) * 0.72, 0.86, Math.cos(angle) * 0.72], rotation: [Math.sin(angle) * 0.22, 0, -Math.cos(angle) * 0.22]
        });
    }
    return root;
}

function createTrap(type, materials, mode, radius) {
    const root = new THREE.Group();
    const boundary = addGroundRing(root, type, `${type}:GameplayBoundary`, Math.max(0.05, radius - 0.1), radius, materials.boundary, 0.045, 48);
    boundary.userData.gameplayBoundary = true;
    boundary.userData.gameplayRadius = radius;
    const spin = pivot(root, `${type}:Spin`, [0, 0.11, 0]);
    addGroundRing(spin, type, `${type}:InnerSeal`, radius * 0.38, radius * 0.46, materials.glow, 0, 24);

    if (mode === 'wire') {
        const post = geometry(`${type}:post`, () => new THREE.CylinderGeometry(0.06, 0.09, 0.52, 6));
        mesh(spin, `${type}:PostLeft`, post, materials.dark, { position: [-radius * 0.72, 0.22, 0] });
        mesh(spin, `${type}:PostRight`, post, materials.dark, { position: [radius * 0.72, 0.22, 0] });
        for (let index = -1; index <= 1; index += 1) {
            mesh(spin, `${type}:TensionWire${index + 2}`, geometry(`${type}:wire`, () => new THREE.BoxGeometry(radius * 1.44, 0.025, 0.025)), index === 0 ? materials.pale : materials.plate, {
                position: [0, 0.12 + (index + 1) * 0.11, index * 0.08]
            });
        }
        mesh(spin, `${type}:Latch`, geometry(`${type}:latch`, () => new THREE.OctahedronGeometry(0.16, 0)), materials.glow, { position: [0, 0.16, 0] });
    } else if (mode === 'mine') {
        mesh(spin, `${type}:Charge`, geometry(`${type}:charge`, () => new THREE.DodecahedronGeometry(0.34, 0)), materials.dark, { position: [0, 0.18, 0] });
        const tooth = geometry(`${type}:tooth`, () => new THREE.ConeGeometry(0.08, 0.52, 4));
        for (let index = 0; index < 8; index += 1) {
            const angle = (index / 8) * Math.PI * 2;
            mesh(spin, `${type}:Tooth${index + 1}`, tooth, index % 2 ? materials.plate : materials.glow, {
                position: [Math.sin(angle) * 0.48, 0.12, Math.cos(angle) * 0.48],
                rotation: [Math.PI / 2, 0, -angle]
            });
        }
    } else {
        const jaw = geometry(`${type}:jaw`, () => new THREE.BoxGeometry(0.7, 0.12, 0.18));
        mesh(spin, `${type}:JawLeft`, jaw, materials.plate, { position: [-0.34, 0.12, 0], rotation: [0, 0, 0.28] });
        mesh(spin, `${type}:JawRight`, jaw, materials.plate, { position: [0.34, 0.12, 0], rotation: [0, 0, -0.28] });
        const fang = geometry(`${type}:fang`, () => new THREE.ConeGeometry(0.07, 0.38, 4));
        for (let index = 0; index < 6; index += 1) {
            const side = index % 2 ? -1 : 1;
            mesh(spin, `${type}:Fang${index + 1}`, fang, index % 3 === 0 ? materials.pale : materials.glow, {
                position: [side * (0.18 + Math.floor(index / 2) * 0.16), 0.22, 0],
                rotation: [0, 0, side * 0.62]
            });
        }
    }
    return root;
}

function createZone(type, materials, mode, radius) {
    const root = new THREE.Group();
    const field = mesh(
        root,
        `${type}:ExactField`,
        geometry(`${type}:field:${radius}`, () => new THREE.CircleGeometry(radius, 64)),
        materials.field,
        { position: [0, 0.035, 0], rotation: [-Math.PI / 2, 0, 0] }
    );
    field.userData.gameplayRadius = radius;
    field.userData.gameplayBoundary = true;
    const boundary = addGroundRing(root, type, `${type}:GameplayBoundary`, radius * 0.965, radius, materials.boundary, 0.065, 64);
    boundary.userData.gameplayBoundary = true;
    boundary.userData.gameplayRadius = radius;
    const spin = pivot(root, `${type}:Spin`, [0, 0.08, 0]);
    addGroundRing(spin, type, `${type}:InnerSealA`, radius * 0.5, radius * 0.525, materials.glow, 0, 48);
    addGroundRing(spin, type, `${type}:InnerSealB`, radius * 0.7, radius * 0.715, materials.plate, 0.005, 48);

    if (mode === 'fire') {
        const fault = geometry(`${type}:fault`, () => new THREE.PlaneGeometry(radius * 0.055, radius * 0.82));
        for (let index = 0; index < 9; index += 1) {
            const angle = (index / 9) * Math.PI * 2;
            mesh(spin, `${type}:MagmaFault${index + 1}`, fault, index % 3 === 0 ? materials.pale : materials.glow, {
                position: [Math.sin(angle) * radius * 0.28, 0, Math.cos(angle) * radius * 0.28],
                rotation: [-Math.PI / 2, 0, angle + (index % 2 ? 0.16 : -0.12)]
            });
        }
        const ember = geometry(`${type}:ember`, () => new THREE.OctahedronGeometry(0.12, 0));
        for (let index = 0; index < 14; index += 1) {
            const angle = (index / 14) * Math.PI * 2;
            mesh(spin, `${type}:Cinder${index + 1}`, ember, index % 4 === 0 ? materials.pale : materials.glow, {
                position: [Math.sin(angle) * radius * (0.22 + (index % 3) * 0.16), 0.12 + (index % 4) * 0.16, Math.cos(angle) * radius * (0.22 + (index % 3) * 0.16)]
            });
        }
    } else if (mode === 'holy') {
        const ray = geometry(`${type}:ray`, () => new THREE.ConeGeometry(radius * 0.045, radius * 0.88, 3));
        for (let index = 0; index < 12; index += 1) {
            const angle = (index / 12) * Math.PI * 2;
            mesh(spin, `${type}:ReliquaryRay${index + 1}`, ray, index % 3 === 0 ? materials.pale : materials.glow, {
                position: [Math.sin(angle) * radius * 0.42, 0, Math.cos(angle) * radius * 0.42],
                rotation: [-Math.PI / 2, 0, -angle]
            });
        }
        for (let index = 0; index < 8; index += 1) {
            const angle = (index / 8) * Math.PI * 2;
            mesh(spin, `${type}:OathPearl${index + 1}`, geometry(`${type}:pearl`, () => new THREE.OctahedronGeometry(0.16, 0)), index % 2 ? materials.glow : materials.pale, {
                position: [Math.sin(angle) * radius * 0.78, 0.17, Math.cos(angle) * radius * 0.78]
            });
        }
    } else {
        const ward = geometry(`${type}:ward`, () => new THREE.PlaneGeometry(radius * 0.055, radius * 1.42));
        for (let index = 0; index < 6; index += 1) {
            const angle = (index / 6) * Math.PI;
            mesh(spin, `${type}:CrossedWard${index + 1}`, ward, index % 2 ? materials.glow : materials.pale, {
                position: [0, 0, 0], rotation: [-Math.PI / 2, 0, angle]
            });
        }
        for (let index = 0; index < 6; index += 1) {
            const angle = (index / 6) * Math.PI * 2;
            mesh(spin, `${type}:OldOath${index + 1}`, geometry(`${type}:old-oath`, () => new THREE.TetrahedronGeometry(0.2, 0)), index % 2 ? materials.plate : materials.pale, {
                position: [Math.sin(angle) * radius * 0.68, 0.16, Math.cos(angle) * radius * 0.68],
                rotation: [0, angle, angle]
            });
        }
    }
    return root;
}

const PALETTES = Object.freeze({
    Fireball: { dark: 0x1d1518, plate: 0x6f3127, glow: 0xff4a1f, pale: 0xffd064 },
    ArcaneMissile: { dark: 0x17131f, plate: 0x59406e, glow: 0xaa43ff, pale: 0xf0bcff },
    DragonfireLance: { dark: 0x211316, plate: 0x733129, glow: 0xff3b1f, pale: 0xffd26b },
    Dagger: { dark: 0x14161b, plate: 0x89919c, glow: 0x9ba7b8, pale: 0xf0f4f8 },
    FlameTornado: { dark: 0x211417, plate: 0x793323, glow: 0xff4b1f, pale: 0xffd360 },
    Meteor: { dark: 0x171518, plate: 0x4b2924, glow: 0xff3b18, pale: 0xffb94c },
    PhantomArrow: { dark: 0x14121c, plate: 0x4e3d64, glow: 0x9a42df, pale: 0xe2bdff },
    Tripwire: { dark: 0x17191e, plate: 0x737b85, glow: 0xbcc7d4, pale: 0xf4f7fb },
    ExplosiveTrap: { dark: 0x211618, plate: 0x793026, glow: 0xff3d20, pale: 0xffc15a },
    SnareTrap: { dark: 0x141b17, plate: 0x536b59, glow: 0x46d96b, pale: 0xc4ffd2 },
    ZoneDamage: { dark: 0x1f1216, plate: 0x6e271f, glow: 0xff3d1c, pale: 0xffc254 },
    ZoneHoly: { dark: 0x211c15, plate: 0x826d3b, glow: 0xffd447, pale: 0xfff3ad },
    Zone: { dark: 0x1d1b18, plate: 0x746744, glow: 0xd9bb64, pale: 0xffedb0 }
});

export function createProceduralProjectileVisual(type) {
    const definition = PROCEDURAL_PROJECTILE_VISUAL_DEFINITIONS[type];
    if (!definition) throw new Error(`Unknown procedural projectile visual: ${type}`);
    const materials = standardMaterials(type, PALETTES[type]);
    let root;

    if (type === 'Fireball') root = createFireball(type, materials);
    else if (type === 'ArcaneMissile') root = createArcaneMissile(type, materials);
    else if (type === 'DragonfireLance') root = createDragonfireLance(type, materials);
    else if (type === 'Dagger') root = createDagger(type, materials, false);
    else if (type === 'FlameTornado') root = createFlameTornado(type, materials);
    else if (type === 'Meteor') root = createMeteor(type, materials);
    else if (type === 'PhantomArrow') root = createDagger(type, materials, true);
    else if (type === 'Tripwire') root = createTrap(type, materials, 'wire', definition.gameplayRadius);
    else if (type === 'ExplosiveTrap') root = createTrap(type, materials, 'mine', definition.gameplayRadius);
    else if (type === 'SnareTrap') root = createTrap(type, materials, 'snare', definition.gameplayRadius);
    else if (type === 'ZoneDamage') root = createZone(type, materials, 'fire', definition.gameplayRadius);
    else if (type === 'ZoneHoly') root = createZone(type, materials, 'holy', definition.gameplayRadius);
    else root = createZone(type, materials, 'legacy', definition.gameplayRadius);

    root.name = `ProceduralProjectile:${type}`;
    root.userData.proceduralProjectile = true;
    root.userData.projectileType = type;
    root.userData.projectileFamily = definition.family;
    root.userData.projectileRole = definition.role;
    root.userData.artStyle = definition.artStyle;
    root.userData.gameplayRadius = definition.gameplayRadius;
    root.userData.baseGameplayRadius = definition.gameplayRadius;
    root.userData.scaleEncodesRadius = Boolean(definition.scaleEncodesRadius);
    root.userData.upright = Boolean(definition.upright);
    root.userData.sharedResources = true;
    root.userData.baseScale = new THREE.Vector3(1, 1, 1);
    return root;
}

export function updateProceduralProjectileVisual(root, type, elapsed, dt) {
    if (!root?.userData?.proceduralProjectile) return;
    const time = Math.max(0, Number(elapsed) || 0);
    const delta = Math.max(0, Number(dt) || 0);
    const spin = root.getObjectByName(`${type}:Spin`);
    const orbit = root.getObjectByName(`${type}:Orbit`);
    const role = root.userData.projectileRole;

    if (spin) {
        const spinSpeed = role === 'zone' ? 0.18 : role === 'trap' ? 0.42 : type === 'Meteor' ? 0.85 : 3.6;
        spin.rotation.y += delta * spinSpeed;
        if (type !== 'Dagger' && type !== 'PhantomArrow') {
            const pulse = 1 + Math.sin(time * (role === 'zone' ? 2.1 : 6.2)) * (role === 'zone' ? 0.015 : 0.045);
            spin.scale.setScalar(pulse);
        }
    }
    if (orbit) {
        orbit.rotation.z -= delta * 2.8;
        orbit.rotation.y += delta * 1.7;
    }

    // Gameplay-boundary meshes never pulse or grow. Only interior motifs move,
    // so the visible outer edge continues to mean the exact server radius.
    root.traverse((part) => {
        if (!part.userData?.gameplayBoundary) return;
        part.scale.set(1, 1, 1);
    });
}

export function applyProceduralProjectileScale(root, scale) {
    if (!root?.userData?.proceduralProjectile) return;
    const normalizedScale = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
    const baseRadius = Number(root.userData.baseGameplayRadius) || 0;
    const radiusScale = root.userData.scaleEncodesRadius ? normalizedScale : 1;
    root.userData.gameplayRadius = baseRadius * radiusScale;
    root.traverse((part) => {
        if (part.userData?.gameplayBoundary) {
            part.userData.gameplayRadius = baseRadius * radiusScale;
        }
    });
}

export function releaseProceduralProjectileVisual(root) {
    if (!root) return;
    root.parent?.remove(root);
    root.clear();
}

export function getProceduralProjectileCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
