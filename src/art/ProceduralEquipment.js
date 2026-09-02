import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const EQUIPMENT_RENDER_SLOTS = Object.freeze([
    'head',
    'shoulders',
    'chest',
    'gloves',
    'belt',
    'legs',
    'feet',
    'neck',
    'ring1',
    'ring2',
    'trinket1',
    'trinket2',
    'mainHand',
    'offHand'
]);

const RARITY_COLORS = Object.freeze({
    Common: 0xb9b7ad,
    Uncommon: 0x55b96a,
    Rare: 0x4f86d9,
    Legendary: 0xe39a38,
    Eidolic: 0x9f66dc
});

const GEM_COLORS = Object.freeze({
    Ruby: 0xc42e36,
    Sapphire: 0x315fc5,
    Emerald: 0x2fa968,
    Topaz: 0xe0af35,
    Diamond: 0xdce9ee,
    Onyx: 0x211d29,
    Opal: 0x8dcfe4
});

const SET_COLORS = Object.freeze({
    warlord_fury: 0xc44a32,
    bulwark_ages: 0x6e91a0,
    shadow_embrace: 0x705179,
    venom_lord: 0x55a85b,
    inferno_heart: 0xe06a32,
    temporal_weave: 0x617ed3,
    divine_light: 0xe6c66a,
    crusader_zeal: 0xd7e2d2
});

const UNIQUE_EFFECT_COLORS = Object.freeze({
    vampiric: 0xa32d3d,
    efficient: 0x4a88b7,
    lucky: 0xd6ad42,
    explosive: 0xdb5b2b,
    swift: 0x4ec6a2,
    thorns: 0x6da253,
    berserker: 0xd14232,
    guardian: 0x648da8,
    executioner: 0x8d557e,
    regenerative: 0x4ea86f
});

function descriptor(slot, family, variant, primary, secondary, material = 'metal') {
    return Object.freeze({ slot, family, variant, primary, secondary, material });
}

/**
 * Every generated equippable base item has an intentional code-native visual.
 * Affixed drops resolve back to these names, then rarity/tier/potency/socket
 * details layer identity onto the family silhouette.
 */
export const EQUIPMENT_VISUAL_DESCRIPTORS = Object.freeze({
    'Iron Sword': descriptor('mainHand', 'blade', 'longsword', 0x879098, 0x4a2b1e),
    'Steel Dagger': descriptor('mainHand', 'blade', 'dagger', 0xaeb8bd, 0x39211c),
    'Wooden Staff': descriptor('mainHand', 'focusWeapon', 'staff', 0x553621, 0x7891a9, 'wood'),
    'Cleric Mace': descriptor('mainHand', 'focusWeapon', 'mace', 0x787d80, 0xb4863d),
    'Wooden Shield': descriptor('offHand', 'offhand', 'shield', 0x5a3a24, 0x858078, 'wood'),
    'Spell Tome': descriptor('offHand', 'offhand', 'tome', 0x442235, 0xc49b52, 'cloth'),
    'Leather Cap': descriptor('head', 'headwear', 'cap', 0x4c3023, 0x8b6544, 'leather'),
    'Iron Helm': descriptor('head', 'headwear', 'helm', 0x4c545d, 0x9ca2a0),
    'Silk Hood': descriptor('head', 'headwear', 'hood', 0x392644, 0x765066, 'cloth'),
    'Leather Tunic': descriptor('chest', 'bodyArmor', 'tunic', 0x4a2c20, 0x76513a, 'leather'),
    'Plate Mail': descriptor('chest', 'bodyArmor', 'plate', 0x49515a, 0x969c98),
    'Robes': descriptor('chest', 'bodyArmor', 'robes', 0x30243f, 0x6d4866, 'cloth'),
    'Leather Pants': descriptor('legs', 'legArmor', 'leather', 0x442a21, 0x76513a, 'leather'),
    'Plate Greaves': descriptor('legs', 'legArmor', 'plate', 0x4d555e, 0x9ba19e),
    'Silk Skirt': descriptor('legs', 'legArmor', 'skirt', 0x362341, 0x76506b, 'cloth'),
    'Leather Boots': descriptor('feet', 'footwear', 'leather', 0x40271e, 0x76513a, 'leather'),
    'Iron Boots': descriptor('feet', 'footwear', 'plate', 0x4b535b, 0x929997),
    'Sandals': descriptor('feet', 'footwear', 'sandals', 0x72513a, 0xb78e5e, 'leather'),
    'Leather Gloves': descriptor('gloves', 'handwear', 'leather', 0x44291f, 0x79533a, 'leather'),
    'Iron Gauntlets': descriptor('gloves', 'handwear', 'plate', 0x4d555e, 0x9ca29f),
    'Silk Gloves': descriptor('gloves', 'handwear', 'silk', 0x392543, 0x7b536e, 'cloth'),
    'Reinforced Spaulders': descriptor('shoulders', 'shoulderArmor', 'reinforced', 0x544238, 0x838783, 'leather'),
    'Steel Pauldrons': descriptor('shoulders', 'shoulderArmor', 'plate', 0x505861, 0xa2a8a5),
    'Velvet Mantle': descriptor('shoulders', 'shoulderArmor', 'mantle', 0x4b2139, 0x89516e, 'cloth'),
    'Studded Belt': descriptor('belt', 'waist', 'studded', 0x43271d, 0xa8844b, 'leather'),
    'Plated Girdle': descriptor('belt', 'waist', 'plate', 0x4e555d, 0xa0a49e),
    'Silk Sash': descriptor('belt', 'waist', 'sash', 0x52233e, 0xb06d83, 'cloth'),
    'Gold Ring': descriptor('ring', 'ring', 'gold', 0xb99342, 0xf0ce73),
    'Silver Ring': descriptor('ring', 'ring', 'silver', 0xa5adb0, 0xe0e4dc),
    'Ruby Ring': descriptor('ring', 'ring', 'ruby', 0xb89548, 0xc62e39),
    'Pendant': descriptor('neck', 'neckwear', 'pendant', 0x9a7841, 0xd2b86b),
    'Choker': descriptor('neck', 'neckwear', 'choker', 0x33242d, 0x9b5570, 'cloth'),
    'Necklace': descriptor('neck', 'neckwear', 'necklace', 0xa1a8aa, 0x66a9cf),
    'Amulet of Power': descriptor('trinket', 'trinket', 'amulet', 0x8b6838, 0xb83338),
    'Talisman of Speed': descriptor('trinket', 'trinket', 'talisman', 0x65706b, 0x52bf92),
    'Orb of Mana': descriptor('trinket', 'trinket', 'orb', 0x3b4b76, 0x668fe2)
});

const EQUIPMENT_BASE_NAMES_BY_LENGTH = Object.freeze(
    Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).sort((a, b) => b.length - a.length)
);

function geometry(key, create) {
    if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, create());
    return GEOMETRIES.get(key);
}

function material(key, color, options = {}) {
    const cacheKey = `${key}:${color.toString(16)}:${options.emissive || 0}:${options.emissiveIntensity || 0}`;
    if (!MATERIALS.has(cacheKey)) {
        MATERIALS.set(cacheKey, new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.62,
            metalness: options.metalness ?? 0.15,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            flatShading: true,
            side: options.side ?? THREE.FrontSide
        }));
    }
    return MATERIALS.get(cacheKey);
}

function getRarityName(item) {
    if (typeof item?.rarity === 'string') return item.rarity;
    return item?.rarity?.name || 'Common';
}

function addMesh(parent, name, geometryValue, materialValue, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1]
} = {}) {
    const mesh = new THREE.Mesh(geometryValue, materialValue);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

function createMaterials(item, visual) {
    const rarityName = getRarityName(item);
    const rarityColor = RARITY_COLORS[rarityName] || RARITY_COLORS.Common;
    const materialDefaults = visual.material === 'metal'
        ? { metalness: 0.72, roughness: 0.38 }
        : visual.material === 'cloth'
            ? { metalness: 0.02, roughness: 0.9, side: THREE.DoubleSide }
            : visual.material === 'leather'
                ? { metalness: 0.03, roughness: 0.84 }
                : { metalness: 0.01, roughness: 0.88 };
    const potency = Math.max(0, Number(item?.potency) || 0);
    return {
        primary: material(`${visual.variant}-primary`, visual.primary, materialDefaults),
        secondary: material(`${visual.variant}-secondary`, visual.secondary, {
            ...materialDefaults,
            metalness: Math.max(materialDefaults.metalness, 0.25)
        }),
        accent: material(`${visual.variant}-${rarityName}-accent`, rarityColor, {
            metalness: 0.5,
            roughness: 0.3,
            emissive: rarityColor,
            emissiveIntensity: rarityName === 'Common' ? 0.03 : 0.2 + Math.min(0.5, potency * 0.035)
        }),
        dark: material('equipment-dark', 0x17171c, { metalness: 0.2, roughness: 0.78 })
    };
}

function baseItemName(item) {
    if (!item) return null;
    if (item.baseName && EQUIPMENT_VISUAL_DESCRIPTORS[item.baseName]) return item.baseName;
    const fullName = String(item.name || '');
    return EQUIPMENT_BASE_NAMES_BY_LENGTH.find((name) => fullName.includes(name)) || null;
}

export function resolveEquipmentVisualDescriptor(item) {
    const name = baseItemName(item);
    if (!name) return null;
    return Object.freeze({ baseName: name, ...EQUIPMENT_VISUAL_DESCRIPTORS[name] });
}

function buildBlade(group, visual, mats) {
    const dagger = visual.variant === 'dagger';
    const bladeLength = dagger ? 0.82 : 1.58;
    addMesh(group, 'Gear_Grip', geometry('gear-grip', () => new THREE.CylinderGeometry(0.06, 0.065, 0.42, 8)), mats.dark, {
        position: [0, -0.12, 0]
    });
    addMesh(group, 'Gear_Pommel', geometry('gear-pommel', () => new THREE.OctahedronGeometry(0.1, 0)), mats.accent, {
        position: [0, -0.38, 0]
    });
    addMesh(group, 'Gear_Guard', geometry('gear-guard', () => new THREE.BoxGeometry(0.56, 0.085, 0.1)), mats.secondary, {
        position: [0, 0.1, 0], scale: dagger ? [0.7, 1, 1] : [1, 1, 1]
    });
    addMesh(group, 'Gear_Blade', geometry(`gear-blade-${dagger ? 'short' : 'long'}`, () =>
        new THREE.CylinderGeometry(dagger ? 0.08 : 0.115, dagger ? 0.13 : 0.17, bladeLength, 4)
    ), mats.primary, {
        position: [0, 0.13 + bladeLength / 2, 0], rotation: [0, Math.PI / 4, 0], scale: [0.68, 1, 0.3]
    });
    addMesh(group, 'Gear_BladeRune', geometry(`gear-rune-${dagger ? 'short' : 'long'}`, () =>
        new THREE.BoxGeometry(0.028, bladeLength * 0.7, 0.026)
    ), mats.accent, { position: [0, 0.16 + bladeLength / 2, 0.07] });
}

function buildFocusWeapon(group, visual, mats) {
    const mace = visual.variant === 'mace';
    const shaftLength = mace ? 1.05 : 2.15;
    addMesh(group, 'Gear_Shaft', geometry(`gear-shaft-${mace ? 'mace' : 'staff'}`, () =>
        new THREE.CylinderGeometry(mace ? 0.065 : 0.055, mace ? 0.075 : 0.065, shaftLength, 8)
    ), mace ? mats.secondary : mats.primary, { position: [0, shaftLength / 2 - 0.28, 0] });
    if (mace) {
        addMesh(group, 'Gear_MaceHead', geometry('gear-mace-head', () => new THREE.DodecahedronGeometry(0.27, 0)), mats.primary, {
            position: [0, 0.96, 0], scale: [0.85, 1.2, 0.85]
        });
        for (let index = 0; index < 4; index++) {
            addMesh(group, `Gear_MaceFlange${index}`, geometry('gear-mace-flange', () => new THREE.ConeGeometry(0.1, 0.32, 4)), mats.accent, {
                position: [Math.cos(index * Math.PI / 2) * 0.22, 0.98, Math.sin(index * Math.PI / 2) * 0.22],
                rotation: [Math.PI / 2, 0, -index * Math.PI / 2]
            });
        }
    } else {
        addMesh(group, 'Gear_StaffCrown', geometry('gear-staff-crown', () => new THREE.TorusGeometry(0.27, 0.055, 5, 10)), mats.secondary, {
            position: [0, 1.82, 0], rotation: [Math.PI / 2, 0, 0]
        });
        addMesh(group, 'Gear_StaffFocus', geometry('gear-staff-focus', () => new THREE.OctahedronGeometry(0.16, 0)), mats.accent, {
            position: [0, 1.82, 0]
        });
    }
}

function buildOffhand(group, visual, mats) {
    if (visual.variant === 'tome') {
        addMesh(group, 'Gear_TomePages', geometry('gear-tome-pages', () => new THREE.BoxGeometry(0.52, 0.68, 0.18)), mats.secondary, {
            position: [0.08, 0.28, 0.16], rotation: [0.08, -0.3, 0.06]
        });
        addMesh(group, 'Gear_TomeCover', geometry('gear-tome-cover', () => new THREE.BoxGeometry(0.58, 0.75, 0.08)), mats.primary, {
            position: [0.08, 0.28, 0.28], rotation: [0.08, -0.3, 0.06]
        });
        addMesh(group, 'Gear_TomeSigil', geometry('gear-tome-sigil', () => new THREE.TorusGeometry(0.13, 0.025, 4, 8)), mats.accent, {
            position: [0, 0.3, 0.34], rotation: [Math.PI / 2, -0.3, 0]
        });
        return;
    }
    const shield = new THREE.Group();
    shield.name = 'Gear_Shield';
    shield.position.set(0.05, 0.02, 0.22);
    group.add(shield);
    addMesh(shield, 'Gear_ShieldFace', geometry('gear-shield-face', () => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.78);
        shape.lineTo(0.58, 0.46);
        shape.lineTo(0.47, -0.36);
        shape.lineTo(0, -0.84);
        shape.lineTo(-0.47, -0.36);
        shape.lineTo(-0.58, 0.46);
        shape.closePath();
        const result = new THREE.ExtrudeGeometry(shape, {
            depth: 0.1,
            bevelEnabled: true,
            bevelSegments: 1,
            bevelSize: 0.025,
            bevelThickness: 0.025,
            curveSegments: 1
        });
        result.center();
        return result;
    }), mats.primary);
    addMesh(shield, 'Gear_ShieldRim', geometry('gear-shield-rim', () => new THREE.TorusGeometry(0.46, 0.05, 4, 8)), mats.secondary, {
        position: [0, 0.08, 0.13], rotation: [Math.PI / 2, 0, 0], scale: [0.9, 1.25, 1]
    });
    addMesh(shield, 'Gear_ShieldBoss', geometry('gear-shield-boss', () => new THREE.OctahedronGeometry(0.17, 0)), mats.accent, {
        position: [0, 0.08, 0.18], scale: [1, 1, 0.5]
    });
}

function buildHeadwear(group, visual, mats) {
    if (visual.variant === 'cap') {
        addMesh(group, 'Gear_CapCrown', geometry('gear-cap-crown', () => new THREE.SphereGeometry(0.39, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), mats.primary, {
            position: [0, 0.26, 0], scale: [1, 0.78, 1]
        });
        addMesh(group, 'Gear_CapBand', geometry('gear-cap-band', () => new THREE.TorusGeometry(0.34, 0.055, 5, 8)), mats.secondary, {
            position: [0, 0.22, 0], rotation: [Math.PI / 2, 0, 0]
        });
    } else if (visual.variant === 'hood') {
        addMesh(group, 'Gear_Hood', geometry('gear-hood', () => new THREE.ConeGeometry(0.48, 0.78, 8, 1, true)), mats.primary, {
            position: [0, 0.27, -0.02], rotation: [0, 0, Math.PI]
        });
        addMesh(group, 'Gear_HoodEdge', geometry('gear-hood-edge', () => new THREE.TorusGeometry(0.3, 0.045, 5, 8)), mats.accent, {
            position: [0, 0.16, 0.22], rotation: [Math.PI / 2, 0, 0], scale: [1, 1.18, 1]
        });
    } else {
        addMesh(group, 'Gear_Helm', geometry('gear-helm', () => new THREE.CylinderGeometry(0.4, 0.36, 0.68, 8)), mats.primary, {
            position: [0, 0.17, 0]
        });
        addMesh(group, 'Gear_HelmBrow', geometry('gear-helm-brow', () => new THREE.BoxGeometry(0.7, 0.11, 0.12)), mats.secondary, {
            position: [0, 0.24, 0.32]
        });
        addMesh(group, 'Gear_HelmNasal', geometry('gear-helm-nasal', () => new THREE.BoxGeometry(0.08, 0.38, 0.08)), mats.accent, {
            position: [0, 0.06, 0.38]
        });
    }
}

function buildBodyArmor(group, visual, mats) {
    const cloth = visual.variant === 'robes';
    const tunic = visual.variant === 'tunic';
    addMesh(group, 'Gear_Torso', geometry(`gear-torso-${visual.variant}`, () =>
        new THREE.CylinderGeometry(cloth ? 0.67 : 0.63, cloth ? 0.58 : 0.52, cloth ? 1.28 : 1.1, 8)
    ), mats.primary, { position: [0, 0.47, 0], scale: [1.16, 1, cloth ? 0.76 : 0.72] });
    if (tunic) {
        addMesh(group, 'Gear_TunicLacing', geometry('gear-tunic-lacing', () => new THREE.BoxGeometry(0.1, 0.72, 0.04)), mats.accent, {
            position: [0, 0.48, 0.49]
        });
    } else if (cloth) {
        addMesh(group, 'Gear_RobeStole', geometry('gear-robe-stole', () => new THREE.BoxGeometry(0.28, 1.14, 0.055)), mats.secondary, {
            position: [0, 0.36, 0.5]
        });
    } else {
        addMesh(group, 'Gear_PlateKeel', geometry('gear-plate-keel', () => new THREE.ConeGeometry(0.3, 0.85, 4)), mats.secondary, {
            position: [0, 0.46, 0.48], rotation: [0, 0, Math.PI], scale: [0.68, 1, 0.32]
        });
    }
    addMesh(group, 'Gear_ChestSigil', geometry('gear-chest-sigil', () => new THREE.OctahedronGeometry(0.12, 0)), mats.accent, {
        position: [0, 0.58, 0.59], scale: [0.7, 1.2, 0.35]
    });
}

function buildLegArmor(group, visual, mats) {
    const skirt = visual.variant === 'skirt';
    addMesh(group, 'Gear_ThighArmor', geometry(`gear-leg-${visual.variant}`, () =>
        skirt
            ? new THREE.ConeGeometry(0.32, 0.92, 7, 1, true)
            : new THREE.CylinderGeometry(visual.variant === 'plate' ? 0.285 : 0.265, 0.21, 0.9, 8)
    ), mats.primary, {
        position: [0, -0.43, 0], rotation: skirt ? [0, 0, Math.PI] : [0, 0, 0], scale: skirt ? [1, 1, 0.72] : [1, 1, 1]
    });
    addMesh(group, 'Gear_KneeMark', geometry('gear-knee-mark', () => new THREE.OctahedronGeometry(0.11, 0)), mats.accent, {
        position: [0, -0.77, 0.2], scale: [1, 0.75, 0.45]
    });
}

function buildFootwear(group, visual, mats) {
    if (visual.variant === 'sandals') {
        addMesh(group, 'Gear_SandalSole', geometry('gear-sandal-sole', () => new THREE.BoxGeometry(0.39, 0.09, 0.66)), mats.secondary, {
            position: [0, 0.02, 0.14]
        });
        addMesh(group, 'Gear_SandalStrap', geometry('gear-sandal-strap', () => new THREE.TorusGeometry(0.18, 0.035, 4, 8, Math.PI)), mats.primary, {
            position: [0, 0.1, 0.18], rotation: [Math.PI / 2, 0, 0]
        });
    } else {
        addMesh(group, 'Gear_Boot', geometry(`gear-boot-${visual.variant}`, () => new THREE.BoxGeometry(0.4, 0.28, 0.66)), mats.primary, {
            position: [0, 0.12, 0.14]
        });
        addMesh(group, 'Gear_BootCap', geometry('gear-boot-cap', () => new THREE.DodecahedronGeometry(0.2, 0)), mats.secondary, {
            position: [0, 0.13, 0.38], scale: [1, 0.62, 1.1]
        });
    }
    addMesh(group, 'Gear_FootMark', geometry('gear-foot-mark', () => new THREE.BoxGeometry(0.16, 0.05, 0.05)), mats.accent, {
        position: [0, 0.24, 0.39]
    });
}

function buildHandwear(group, visual, mats) {
    const plate = visual.variant === 'plate';
    addMesh(group, 'Gear_Glove', geometry(`gear-glove-${visual.variant}`, () => new THREE.DodecahedronGeometry(plate ? 0.23 : 0.205, 0)), mats.primary, {
        scale: plate ? [0.86, 1.14, 0.96] : [0.8, 1.05, 0.9]
    });
    if (plate) {
        addMesh(group, 'Gear_GlovePlate', geometry('gear-glove-plate', () => new THREE.BoxGeometry(0.28, 0.16, 0.08)), mats.secondary, {
            position: [0, 0.03, 0.17], rotation: [-0.18, 0, 0]
        });
    }
    addMesh(group, 'Gear_GloveMark', geometry('gear-glove-mark', () => new THREE.OctahedronGeometry(0.06, 0)), mats.accent, {
        position: [0, 0.05, 0.2], scale: [1, 0.7, 0.35]
    });
}

function buildShoulderArmor(group, visual, mats, side) {
    const mantle = visual.variant === 'mantle';
    const plate = visual.variant === 'plate';
    addMesh(group, 'Gear_Shoulder', geometry(`gear-shoulder-${visual.variant}`, () =>
        mantle
            ? new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
            : new THREE.DodecahedronGeometry(plate ? 0.55 : 0.49, 0)
    ), mats.primary, {
        position: [side * 0.05, -0.06, 0],
        rotation: [0, 0, side * 0.16],
        scale: mantle ? [1.15, 0.45, 0.92] : [1.12, plate ? 0.62 : 0.54, 0.88]
    });
    addMesh(group, 'Gear_ShoulderRidge', geometry(`gear-shoulder-ridge-${mantle ? 'cloth' : 'solid'}`, () =>
        mantle ? new THREE.BoxGeometry(0.12, 0.58, 0.36) : new THREE.ConeGeometry(0.13, 0.42, 4)
    ), mantle ? mats.secondary : mats.accent, {
        position: [side * 0.31, mantle ? -0.23 : 0.14, 0],
        rotation: [0, 0, -side * (mantle ? 0.16 : 0.45)]
    });
}

function buildWaist(group, visual, mats) {
    addMesh(group, 'Gear_Belt', geometry(`gear-belt-${visual.variant}`, () =>
        new THREE.CylinderGeometry(visual.variant === 'sash' ? 0.57 : 0.55, 0.55, visual.variant === 'sash' ? 0.25 : 0.17, 8)
    ), mats.primary);
    addMesh(group, 'Gear_Buckle', geometry(`gear-buckle-${visual.variant}`, () =>
        visual.variant === 'plate' ? new THREE.DodecahedronGeometry(0.15, 0) : new THREE.BoxGeometry(0.22, 0.22, 0.08)
    ), mats.secondary, { position: [0, 0, 0.53], rotation: [0, 0, Math.PI / 4] });
    if (visual.variant === 'studded') {
        [-0.33, 0.33].forEach((x, index) => addMesh(group, `Gear_BeltStud${index}`, geometry('gear-belt-stud', () => new THREE.OctahedronGeometry(0.055, 0)), mats.accent, {
            position: [x, 0, 0.42]
        }));
    } else {
        addMesh(group, 'Gear_BeltMark', geometry('gear-belt-mark', () => new THREE.OctahedronGeometry(0.07, 0)), mats.accent, {
            position: [0, 0, 0.61], scale: [0.8, 1.2, 0.45]
        });
    }
}

function buildRing(group, visual, mats) {
    addMesh(group, 'Gear_RingBand', geometry('gear-ring-band', () => new THREE.TorusGeometry(0.075, 0.018, 5, 8)), mats.primary, {
        rotation: [Math.PI / 2, 0, 0]
    });
    if (visual.variant === 'ruby') {
        addMesh(group, 'Gear_RingStone', geometry('gear-ring-stone', () => new THREE.OctahedronGeometry(0.055, 0)), mats.secondary, {
            position: [0, 0.07, 0]
        });
    } else {
        addMesh(group, 'Gear_RingSeal', geometry('gear-ring-seal', () => new THREE.DodecahedronGeometry(0.045, 0)), mats.accent, {
            position: [0, 0.07, 0], scale: [1, 0.65, 1]
        });
    }
}

function buildNeckwear(group, visual, mats) {
    if (visual.variant === 'choker') {
        addMesh(group, 'Gear_Choker', geometry('gear-choker', () => new THREE.TorusGeometry(0.33, 0.055, 5, 10)), mats.primary, {
            rotation: [Math.PI / 2, 0, 0], scale: [1, 0.78, 1]
        });
        addMesh(group, 'Gear_ChokerSeal', geometry('gear-choker-seal', () => new THREE.OctahedronGeometry(0.08, 0)), mats.accent, {
            position: [0, -0.08, 0.31]
        });
        return;
    }
    addMesh(group, 'Gear_NeckChain', geometry('gear-neck-chain', () => new THREE.TorusGeometry(0.31, 0.025, 5, 10, Math.PI * 1.35)), mats.primary, {
        position: [0, -0.05, 0.08], rotation: [Math.PI / 2, 0, -0.55]
    });
    addMesh(group, 'Gear_NeckFocus', geometry(`gear-neck-${visual.variant}`, () =>
        visual.variant === 'pendant' ? new THREE.OctahedronGeometry(0.13, 0) : new THREE.TorusGeometry(0.12, 0.035, 5, 8)
    ), visual.variant === 'pendant' ? mats.secondary : mats.accent, {
        position: [0, -0.28, 0.34], rotation: [Math.PI / 2, 0, 0], scale: [0.82, 1.15, 0.55]
    });
}

function buildTrinket(group, visual, mats) {
    if (visual.variant === 'orb') {
        addMesh(group, 'Gear_OrbCage', geometry('gear-orb-cage', () => new THREE.TorusGeometry(0.14, 0.025, 5, 8)), mats.primary, {
            rotation: [Math.PI / 2, 0, 0]
        });
        addMesh(group, 'Gear_Orb', geometry('gear-orb', () => new THREE.OctahedronGeometry(0.105, 1)), mats.accent);
        return;
    }
    addMesh(group, 'Gear_TrinketCord', geometry('gear-trinket-cord', () => new THREE.CylinderGeometry(0.018, 0.018, 0.28, 5)), mats.dark, {
        position: [0, -0.13, 0]
    });
    addMesh(group, 'Gear_TrinketFocus', geometry(`gear-trinket-${visual.variant}`, () =>
        visual.variant === 'amulet' ? new THREE.OctahedronGeometry(0.13, 0) : new THREE.TorusGeometry(0.12, 0.035, 4, 8)
    ), mats.accent, { position: [0, -0.32, 0], scale: [0.82, 1.12, 0.5] });
    addMesh(group, 'Gear_TrinketFrame', geometry('gear-trinket-frame', () => new THREE.TorusGeometry(0.16, 0.025, 5, 8)), mats.secondary, {
        position: [0, -0.32, -0.01], rotation: [Math.PI / 2, 0, 0]
    });
}

const BUILDERS = Object.freeze({
    blade: buildBlade,
    focusWeapon: buildFocusWeapon,
    offhand: buildOffhand,
    headwear: buildHeadwear,
    bodyArmor: buildBodyArmor,
    legArmor: buildLegArmor,
    footwear: buildFootwear,
    handwear: buildHandwear,
    shoulderArmor: buildShoulderArmor,
    waist: buildWaist,
    ring: buildRing,
    neckwear: buildNeckwear,
    trinket: buildTrinket
});

function socketDecorationPosition(slot) {
    if (slot === 'mainHand') return [0.1, 0.3, 0.08];
    if (slot === 'offHand') return [-0.2, 0.08, 0.4];
    if (slot === 'head') return [0.27, 0.37, 0.27];
    if (slot === 'chest') return [0.31, 0.55, 0.55];
    if (slot === 'shoulders') return [0, -0.04, 0.46];
    if (slot === 'legs') return [0, -0.64, 0.25];
    if (slot === 'feet') return [0.12, 0.23, 0.38];
    if (slot === 'gloves') return [0.1, 0.08, 0.2];
    return [0.1, 0.08, 0.18];
}

function addSocketDetails(group, item, visual, mats) {
    const gems = Array.isArray(item?.gems) ? item.gems : [];
    const socketCount = Math.max(gems.length, Math.max(0, Number(item?.sockets) || 0));
    if (socketCount <= 0) return;
    const origin = socketDecorationPosition(visual.slot);
    const shown = Math.min(3, socketCount);
    for (let index = 0; index < shown; index++) {
        const gem = gems[index];
        const gemType = gem?.type || gem?.gemType;
        const gemColor = GEM_COLORS[gemType] || 0x26262d;
        const gemMaterial = gem
            ? material(`socket-${gemType || 'unknown'}`, gemColor, {
                metalness: 0.18,
                roughness: 0.2,
                emissive: gemColor,
                emissiveIntensity: 0.65
            })
            : mats.dark;
        addMesh(group, `Gear_Socket${index + 1}`, geometry('gear-socket', () => new THREE.OctahedronGeometry(0.047, 0)), gemMaterial, {
            position: [origin[0] + (index - (shown - 1) / 2) * 0.11, origin[1], origin[2]],
            scale: [1, 1, 0.55]
        });
    }
}

function addIdentityDetails(group, item, visual) {
    const setId = String(item?.setId || '');
    const uniqueEffect = String(item?.uniqueEffect || '');
    if (!setId && !uniqueEffect) return;

    const origin = socketDecorationPosition(visual.slot);
    if (setId) {
        const setColor = SET_COLORS[setId] || 0x9e7cc2;
        const setMaterial = material(`equipment-set-${setId}`, setColor, {
            metalness: 0.35,
            roughness: 0.28,
            emissive: setColor,
            emissiveIntensity: 0.42
        });
        addMesh(group, 'Gear_SetRune', geometry('gear-set-rune', () => new THREE.TorusGeometry(0.085, 0.018, 4, 8)), setMaterial, {
            position: [origin[0] - (uniqueEffect ? 0.13 : 0), origin[1] + 0.13, origin[2] + 0.012],
            rotation: [Math.PI / 2, 0, Math.PI / 4],
            scale: [1, 1.25, 1]
        });
    }
    if (uniqueEffect) {
        const effectColor = UNIQUE_EFFECT_COLORS[uniqueEffect] || 0xb68bd0;
        const effectMaterial = material(`equipment-unique-${uniqueEffect}`, effectColor, {
            metalness: 0.22,
            roughness: 0.24,
            emissive: effectColor,
            emissiveIntensity: 0.62
        });
        addMesh(group, 'Gear_UniqueRune', geometry('gear-unique-rune', () => new THREE.OctahedronGeometry(0.075, 0)), effectMaterial, {
            position: [origin[0] + (setId ? 0.13 : 0), origin[1] + 0.13, origin[2] + 0.018],
            rotation: [0, 0, Math.PI / 4],
            scale: [0.85, 1.2, 0.48]
        });
    }
}

function createEquipmentVisual(slot, item, anchor, fitScale = 1) {
    const visual = resolveEquipmentVisualDescriptor(item);
    if (!visual) return null;
    const group = new THREE.Group();
    group.name = `EquippedVisual_${slot}`;
    group.userData.equipmentVisual = true;
    group.userData.slot = slot;
    group.userData.itemId = item.id || '';
    group.userData.baseName = visual.baseName;
    group.userData.family = visual.family;
    group.userData.rarity = getRarityName(item);
    group.userData.tier = Math.max(0, Math.min(4, Math.floor((Math.max(1, Number(item.level) || 1) - 1) / 25)));
    group.userData.potency = Math.max(0, Number(item.potency) || 0);
    group.userData.sockets = Math.max(0, Number(item.sockets) || 0);
    group.userData.setId = item.setId || '';
    group.userData.uniqueEffect = item.uniqueEffect || '';
    group.userData.statScaleVersion = Math.max(0, Number(item.statScaleVersion) || 0);
    group.userData.fitScale = Math.max(0.5, Math.min(1.25, Number(fitScale) || 1));
    const mats = createMaterials(item, visual);
    const side = anchor.name.includes('Left') ? 1 : -1;
    BUILDERS[visual.family](group, visual, mats, side);
    addSocketDetails(group, item, visual, mats);
    addIdentityDetails(group, item, visual);
    const tierScale = (1 + group.userData.tier * 0.025) * group.userData.fitScale;
    group.scale.setScalar(tierScale);
    return group;
}

export function equipmentVisualSignature(equipment = {}) {
    return EQUIPMENT_RENDER_SLOTS.map((slot) => {
        const item = equipment?.[slot];
        if (!item?.id && !item?.name) return `${slot}:empty`;
        const rarity = getRarityName(item);
        const gems = Array.isArray(item.gems)
            ? item.gems.map((gem) => `${gem?.type || ''}/${gem?.quality || ''}`).join(',')
            : '';
        return [slot, item.id || '', item.baseName || '', item.name || '', rarity,
            item.level || 0, item.potency || 0, item.sockets || 0, gems,
            item.setId || '', item.uniqueEffect || '', item.statScaleVersion || 0].join(':');
    }).join('|');
}

function forEachEquipmentAnchor(root, callback) {
    Object.entries(root?.userData?.equipmentAnchors || {}).forEach(([slot, anchorNames]) => {
        anchorNames.forEach((anchorName) => {
            const anchor = root.getObjectByName(anchorName);
            if (anchor) callback(anchor, slot);
        });
    });
}

export function clearProceduralEquipment(root) {
    if (!root?.userData?.proceduralHumanoid) return false;
    forEachEquipmentAnchor(root, (anchor) => {
        [...anchor.children].forEach((child) => {
            if (child.userData?.equipmentVisual) anchor.remove(child);
            else if (!child.userData?.equipmentAnchor) child.visible = true;
        });
    });
    root.userData.equipmentVisualSignature = '';
    root.userData.equipmentVisualItemCount = 0;
    root.userData.equipmentVisualPartCount = 0;
    return true;
}

export function applyProceduralEquipment(root, equipment = {}, { force = false } = {}) {
    if (!root?.userData?.proceduralHumanoid || !root.userData.equipmentAnchors) {
        return Object.freeze({ supported: false, changed: false, items: 0, parts: 0, missing: [] });
    }
    const signature = equipmentVisualSignature(equipment);
    if (!force && root.userData.equipmentVisualSignature === signature) {
        return Object.freeze({
            supported: true,
            changed: false,
            items: root.userData.equipmentVisualItemCount || 0,
            parts: root.userData.equipmentVisualPartCount || 0,
            missing: []
        });
    }

    clearProceduralEquipment(root);
    const missing = [];
    let items = 0;
    let parts = 0;
    for (const slot of EQUIPMENT_RENDER_SLOTS) {
        const item = equipment?.[slot];
        if (!item?.id && !item?.name) continue;
        if (!resolveEquipmentVisualDescriptor(item)) {
            missing.push(item.name || item.id || slot);
            continue;
        }
        const anchorNames = root.userData.equipmentAnchors[slot] || [];
        let rendered = false;
        anchorNames.forEach((anchorName) => {
            const anchor = root.getObjectByName(anchorName);
            if (!anchor) return;
            [...anchor.children].forEach((child) => {
                if (!child.userData?.equipmentAnchor && !child.userData?.equipmentVisual &&
                    !child.userData?.equipmentBodyBase) child.visible = false;
            });
            const visual = createEquipmentVisual(
                slot,
                item,
                anchor,
                root.userData.equipmentScaleBySlot?.[slot] ?? 1
            );
            if (!visual) return;
            anchor.add(visual);
            visual.traverse((child) => {
                if (child.isMesh) parts++;
            });
            rendered = true;
        });
        if (rendered) items++;
    }

    root.userData.equipmentVisualSignature = signature;
    root.userData.equipmentVisualItemCount = items;
    root.userData.equipmentVisualPartCount = parts;
    return Object.freeze({ supported: true, changed: true, items, parts, missing });
}

export function getProceduralEquipmentCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
