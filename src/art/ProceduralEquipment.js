import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTailoredTorsoGeometry, createOpenHoodGeometry, createPauldronGeometry, createDrapedSkirtGeometry, createWristCuffGeometry, createFittedBootGeometry, fittedBootFrontDepth, createClothMantleGeometry, createLegSectionGeometry } from './ProceduralGarmentGeometry.js';
import { socketGemAppearanceName } from './SocketGemAppearance.js';
import { COSMETIC_CATALOGUE } from '../data/cosmetics.generated.js';
import { getEquipmentSurfaceMaps } from './EquipmentSurfaceMaps.js';
import { batchRigidEquipmentPivots, clearRigidEquipmentPivots } from './RigidEquipmentPivots.js';

const GEOMETRIES = new Map();
const MATERIALS = new Map();
const BATCH_GEOMETRIES = new Map();

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

// Cosmetic render descriptors are NOT entries in the equippable item manifest.
const RENDER_VISUAL_DESCRIPTORS = Object.freeze({
    ...EQUIPMENT_VISUAL_DESCRIPTORS,
    ...Object.fromEntries(COSMETIC_CATALOGUE.map(look => [look.name, Object.freeze({
        ...EQUIPMENT_VISUAL_DESCRIPTORS[look.base], primary: look.primary, secondary: look.secondary
    })]))
});

const EQUIPMENT_BASE_NAMES_BY_LENGTH = Object.freeze(
    Object.keys(RENDER_VISUAL_DESCRIPTORS).sort((a, b) => b.length - a.length)
);

function geometry(key, create) {
    if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, create());
    return GEOMETRIES.get(key);
}

function beveledPanel(points, depth, bevel = 0.02) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: true, bevelSegments: 1,
        bevelSize: bevel, bevelThickness: bevel, curveSegments: 1
    });
    result.translate(0, 0, -depth / 2);
    return result;
}

const SHIELD_OUTLINE = [[0, 0.78], [0.58, 0.46], [0.47, -0.36], [0, -0.84], [-0.47, -0.36], [-0.58, 0.46]];

function material(key, color, options = {}) {
    const cacheKey = [key, color.toString(16), options.emissive || 0, options.emissiveIntensity || 0,
        options.roughness ?? 0.62, options.metalness ?? 0.15, options.side ?? THREE.FrontSide,
        options.flatShading ?? true, options.surface || ''].join(':');
    if (!MATERIALS.has(cacheKey)) {
        const result = new THREE.MeshStandardMaterial({
            ...(options.surface ? getEquipmentSurfaceMaps(options.surface) : {}),
            color,
            roughness: options.roughness ?? 0.62,
            metalness: options.metalness ?? 0.15,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            flatShading: options.flatShading ?? true,
            side: options.side ?? THREE.FrontSide
        });
        // These constructor-owned surfaces differ only by diffuse color when
        // this key matches. Never infer compatibility for arbitrary materials.
        result.userData.equipmentSurfaceKey = [options.emissive || 0, options.emissiveIntensity || 0,
            options.roughness ?? 0.62, options.metalness ?? 0.15, options.side ?? THREE.FrontSide,
            options.flatShading ?? true, options.surface || ''].join(':');
        MATERIALS.set(cacheKey, result);
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
    // Fitted shells and woven cloth use their authored normals. Weapons and
    // ornaments retain hard facets; this distinction is part of the cache key.
    const surface = { ...materialDefaults, surface: visual.material,
        flatShading: !(['bodyArmor', 'headwear', 'legArmor', 'handwear', 'footwear', 'shoulderArmor'].includes(visual.family)) };
    return {
        primary: material(`${visual.variant}-primary`, visual.primary, surface),
        secondary: material(`${visual.variant}-secondary`, visual.secondary, {
            ...surface,
            metalness: visual.material === 'cloth' ? materialDefaults.metalness : Math.max(materialDefaults.metalness, 0.25)
        }),
        accent: material(`${visual.variant}-${rarityName}-accent`, rarityColor, {
            metalness: 0.5,
            roughness: 0.3,
            emissive: rarityColor,
            emissiveIntensity: rarityName === 'Common' ? 0 : 0.06 + Math.min(0.1, potency * 0.012)
        }),
        dark: material('equipment-dark', 0x17171c, { metalness: 0.2, roughness: 0.78 })
    };
}

function baseItemName(item) {
    if (!item) return null;
    if (item.baseName && RENDER_VISUAL_DESCRIPTORS[item.baseName]) return item.baseName;
    const fullName = String(item.name || '');
    return EQUIPMENT_BASE_NAMES_BY_LENGTH.find((name) => fullName.includes(name)) || null;
}

export function resolveEquipmentVisualDescriptor(item) {
    const name = baseItemName(item);
    if (!name) return null;
    return Object.freeze({ baseName: name, ...RENDER_VISUAL_DESCRIPTORS[name] });
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
    const bladeWidth = dagger ? 0.085 : 0.12;
    addMesh(group, 'Gear_Blade', geometry(`gear-blade-${dagger ? 'short' : 'long'}`, () =>
        beveledPanel([[-bladeWidth, 0], [bladeWidth, 0], [bladeWidth * 0.72, bladeLength * 0.76],
            [0, bladeLength], [-bladeWidth * 0.72, bladeLength * 0.76]], 0.035, 0.018)
    ), mats.primary, {
        position: [0, 0.13, 0]
    });
    addMesh(group, 'Gear_BladeRune', geometry(`gear-rune-${dagger ? 'short' : 'long'}`, () =>
        new THREE.BoxGeometry(0.018, bladeLength * 0.52, 0.008)
    ), mats.accent, { position: [0, 0.16 + bladeLength * 0.34, 0.039] });
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
    addMesh(shield, 'Gear_ShieldFace', geometry('gear-shield-face', () =>
        beveledPanel(SHIELD_OUTLINE, 0.1, 0.025)
    ), mats.primary);
    addMesh(shield, 'Gear_ShieldRim', geometry('gear-shield-rim', () => {
        const shape = new THREE.Shape(SHIELD_OUTLINE.map(([x, y]) => new THREE.Vector2(x, y)));
        const hole = new THREE.Path(SHIELD_OUTLINE.map(([x, y]) => new THREE.Vector2(x * 0.88, y * 0.88)));
        shape.closePath();
        hole.closePath();
        shape.holes.push(hole);
        const result = new THREE.ExtrudeGeometry(shape, {
            depth: 0.035, bevelEnabled: true, bevelSegments: 1,
            bevelSize: 0.01, bevelThickness: 0.01, curveSegments: 1
        });
        return result;
    }), mats.secondary, { position: [0, 0, 0.065] });
    addMesh(shield, 'Gear_ShieldSpine', geometry('gear-shield-spine', () =>
        beveledPanel([[0, 0.61], [0.055, 0.2], [0, -0.62], [-0.055, 0.2]], 0.025, 0.008)
    ), mats.secondary, { position: [0, 0, 0.084] });
    addMesh(shield, 'Gear_ShieldGrip', geometry('gear-shield-grip', () => new THREE.TorusGeometry(0.18, 0.035, 5, 8, Math.PI)), mats.dark, {
        position: [0, 0.08, -0.09], rotation: [Math.PI / 2, 0, 0]
    });
    addMesh(shield, 'Gear_ShieldBoss', geometry('gear-shield-boss', () => new THREE.OctahedronGeometry(0.17, 0)), mats.accent, {
        position: [0, 0.08, 0.18], scale: [1, 1, 0.5]
    });
}

function buildHeadwear(group, visual, mats) {
    if (visual.variant === 'cap') {
        addMesh(group, 'Gear_CapCrown', geometry('gear-cap-crown', () => new THREE.SphereGeometry(0.39, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), mats.primary, {
            position: [0, 0.34, 0], scale: [1, 0.78, 1]
        });
        addMesh(group, 'Gear_CapBand', geometry('gear-cap-band', () => new THREE.TorusGeometry(0.34, 0.055, 5, 8)), mats.secondary, {
            position: [0, 0.3, 0], rotation: [Math.PI / 2, 0, 0]
        });
    } else if (visual.variant === 'hood') {
        addMesh(group, 'Gear_Hood', geometry('gear-hood', createOpenHoodGeometry), mats.primary);
        addMesh(group, 'Gear_HoodEdge', geometry('gear-hood-edge', () => new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
                [-0.28, -0.12, 0.32], [-0.29, 0.25, 0.33], [-0.22, 0.52, 0.25],
                [0, 0.7, 0], [0.22, 0.52, 0.25], [0.29, 0.25, 0.33], [0.28, -0.12, 0.32]
            ].map((point) => new THREE.Vector3(...point))), 16, 0.022, 4, false
        )), mats.secondary);
    } else {
        addMesh(group, 'Gear_Helm', geometry('gear-helm', () => new THREE.CylinderGeometry(0.4, 0.36, 0.56, 10, 1, true, 0.72, Math.PI * 2 - 1.44)), mats.primary, {
            position: [0, 0.16, 0]
        });
        addMesh(group, 'Gear_HelmCrown', geometry('gear-helm-crown', () => new THREE.SphereGeometry(0.405, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2)), mats.primary, {
            position: [0, 0.43, 0], scale: [1, 0.48, 1]
        });
        addMesh(group, 'Gear_HelmBrow', geometry('gear-helm-brow', () => new THREE.BoxGeometry(0.7, 0.11, 0.12)), mats.secondary, {
            position: [0, 0.39, 0.32]
        });
        addMesh(group, 'Gear_HelmNasal', geometry('gear-helm-nasal', () => beveledPanel(
            [[-0.042, 0.16], [0.042, 0.16], [0.027, -0.16], [0, -0.19], [-0.027, -0.16]], 0.035, 0.008
        )), mats.secondary, {
            position: [0, 0.18, 0.4]
        });
    }
}

function buildBodyArmor(group, visual, mats) {
    const cloth = visual.variant === 'robes';
    const tunic = visual.variant === 'tunic';
    addMesh(group, 'Gear_Torso', geometry(`gear-torso-${visual.variant}`, () =>
        createTailoredTorsoGeometry(cloth ? 0.58 : 0.52, cloth ? 0.67 : 0.63, cloth ? 1.28 : 1.1)
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
    const thighArmor = addMesh(group, 'Gear_ThighArmor', geometry(`gear-leg-${visual.variant}`, () =>
        skirt
            ? createDrapedSkirtGeometry()
            : createLegSectionGeometry('thigh')
    ), mats.primary, {
        position: skirt ? [0, 0, 0.24] : [0, 0, 0],
        scale: !skirt && visual.variant === 'plate' ? [1.07, 1, 1.07] : [1, 1, 1]
    });
    if (skirt) {
        addMesh(group, 'Gear_SkirtBack', thighArmor.geometry, mats.primary, {
            position: [0, 0, -0.2], rotation: [0, Math.PI, 0], scale: [1, 0.9, 1]
        });
        addMesh(group, 'Gear_SkirtBorder', geometry('gear-skirt-border', () => createDrapedSkirtGeometry(true)),
            mats.secondary, { position: [0, 0, 0.24] });
    }
    addMesh(group, 'Gear_KneeMark', geometry('gear-knee-mark', () => new THREE.OctahedronGeometry(0.11, 0)), mats.accent, {
        position: fitArmorOrnament(group, visual, skirt ? [0.16, -0.72, 0.29] : [0, -0.77, 0.2]), scale: [1, 0.75, 0.45]
    });
}

function buildShinArmor(group, visual, mats) {
    addMesh(group, 'Gear_ShinArmor', geometry('gear-fitted-shin', () => createLegSectionGeometry('shin')),
        visual.variant === 'skirt' ? mats.dark : mats.primary);
    if (visual.variant !== 'skirt') {
        addMesh(group, 'Gear_Greave', geometry('gear-fitted-greave', () => createLegSectionGeometry('greave')), mats.secondary);
    }
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
        addMesh(group, 'Gear_Boot', geometry('gear-fitted-boot', () => createFittedBootGeometry()), mats.primary);
        addMesh(group, 'Gear_BootSole', geometry('gear-fitted-sole', () => createFittedBootGeometry('sole')), mats.dark);
        addMesh(group, 'Gear_BootCap', geometry('gear-fitted-toe', () => createFittedBootGeometry('toe')), mats.secondary);
    }
    addMesh(group, 'Gear_FootMark', geometry('gear-foot-mark', () => new THREE.BoxGeometry(0.16, 0.05, 0.05)), mats.accent, {
        position: visual.variant === 'sandals' ? [0, .12, .38] : [0, .17, .414]
    });
}

function buildHandwear(group, visual, mats) {
    const plate = visual.variant === 'plate';
    addMesh(group, 'Gear_Glove', geometry('gear-wrist-cuff', () => createWristCuffGeometry()), mats.primary, {
        scale: plate ? [1, 1, 1] : [.94, 1, .94]
    });
    addMesh(group, 'Gear_GloveRim', geometry('gear-wrist-rim', () => createWristCuffGeometry(true)), mats.secondary, {
        scale: plate ? [1, 1, 1] : [.94, 1, .94]
    });
    addMesh(group, 'Gear_GloveMark', geometry('gear-glove-mark', () => new THREE.OctahedronGeometry(0.06, 0)), mats.accent, {
        position: [0, .045, plate ? .157 : .148], scale: [.7, .55, .25]
    });
}

function buildShoulderArmor(group, visual, mats, side) {
    const mantle = visual.variant === 'mantle';
    const plate = visual.variant === 'plate';
    if (!mantle) {
        // Keep the cap close to the upper-arm pivot and let the overlapping
        // lower plate cover its join. Smaller leather uses the same tailored
        // construction; neither replaces the shoulder with a solid boulder.
        const scale = plate ? 1 : .91;
        const transform = { position: [side * .035, 0, 0], scale: [scale, scale, scale] };
        addMesh(group, 'Gear_Shoulder', geometry('gear-shoulder-shell', () => createPauldronGeometry()), mats.primary, transform);
        addMesh(group, 'Gear_ShoulderLame', geometry('gear-shoulder-lame', () => createPauldronGeometry('lame')), mats.primary, transform);
        addMesh(group, 'Gear_ShoulderRidge', geometry('gear-shoulder-rim', () => createPauldronGeometry('rim')), mats.secondary, transform);
        return;
    }
    const transform = { position: [side * .035, 0, 0] };
    addMesh(group, 'Gear_Shoulder', geometry('gear-draped-mantle', () => createClothMantleGeometry()), mats.primary, transform);
    addMesh(group, 'Gear_ShoulderRidge', geometry('gear-mantle-hem', () => createClothMantleGeometry(true)), mats.secondary, transform);
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
    addMesh(group, 'Gear_RingSetting', geometry('gear-ring-setting', () => new THREE.BoxGeometry(.14, .025, .065)), mats.primary, {
        position: [0, .023, 0]
    });
    if (visual.variant === 'ruby') {
        addMesh(group, 'Gear_RingStone', geometry('gear-ring-stone', () => new THREE.OctahedronGeometry(0.055, 0)), mats.secondary, {
            position: [0, 0.07, 0]
        });
    } else {
        addMesh(group, 'Gear_RingSeal', geometry('gear-ring-seal', () => new THREE.DodecahedronGeometry(0.045, 0)), mats.accent, {
            position: [0, 0.06, 0], scale: [1, 0.65, 1]
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
    addMesh(group, 'Gear_NeckChain', geometry('gear-neck-chain', () => new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
            [0, -.09, .60], [-.2, -.045, .50], [-.28, .01, .25],
            [-.2, .04, -.08], [0, .045, -.2], [.2, .04, -.08],
            [.28, .01, .25], [.2, -.045, .50]
        ].map(point => new THREE.Vector3(...point)), true, 'centripetal'), 40, .018, 6, true
    )), mats.primary);
    addMesh(group, 'Gear_NeckFocus', geometry(`gear-neck-${visual.variant}`, () =>
        visual.variant === 'pendant' ? new THREE.OctahedronGeometry(0.13, 0) : new THREE.TorusGeometry(0.12, 0.035, 5, 8)
    ), visual.variant === 'pendant' ? mats.secondary : mats.accent, {
        position: [0, -.17, .605], scale: [.62, .85, .55]
    });
    if (visual.variant === 'necklace') {
        addMesh(group, 'Gear_NeckSetting', geometry('gear-neck-setting', () => new THREE.CylinderGeometry(.1, .1, .02, 16)), mats.dark, {
            position: [0, -.17, .60], rotation: [Math.PI / 2, 0, 0], scale: [.62, .55, .85]
        });
    }
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
        position: [0, -0.32, -0.01]
    });
    addMesh(group, 'Gear_TrinketSetting', geometry('gear-trinket-setting', () => new THREE.CylinderGeometry(.14, .14, .025, 16)), mats.dark, {
        position: [0, -.32, -.025], rotation: [Math.PI / 2, 0, 0]
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

function socketDecorationPosition(slot, visual) {
    if (slot === 'mainHand') return [0.1, 0.3, 0.08];
    if (slot === 'offHand') return [-0.2, 0.08, 0.4];
    if (slot === 'head') return [0.27, 0.37, 0.27];
    if (slot === 'chest') return [0.31, 0.55, 0.55];
    if (slot === 'shoulders') return visual?.variant === 'mantle'
        ? [0, -0.04, 0.46] : [0, -0.04, visual?.variant === 'reinforced' ? .338 : .371];
    if (slot === 'legs') return [0, -0.64, 0.25];
    if (slot === 'feet') return visual?.variant === 'sandals' ? [0, .12, .385] : [0, .115, .49];
    if (slot === 'gloves') return [0, .13, visual?.variant === 'plate' ? .176 : .166];
    return [0.1, 0.08, 0.18];
}

// Jewelry and headwear need settings at their own scale, not the armor default.
// Origins remain item-local; surface fitting happens before cached batching.
function fittedDecorationLayout(visual) {
    if (visual.family === 'blade') return { scale: .65, spacing: .085, vertical: true,
        origin: [0, .4, .08], identity: [0, .66, .08], surfaces: ['Gear_Blade', 'Gear_BladeRune'] };
    if (visual.family === 'focusWeapon') return { scale: .6, spacing: .08, vertical: true,
        origin: [0, .45, .08], identity: [0, .7, .08], surfaces: ['Gear_Shaft', 'Gear_MaceHead'] };
    if (visual.family === 'offhand') return { scale: .75, spacing: .07,
        origin: visual.variant === 'tome' ? [.08, .12, .4] : [-.2, .08, .4],
        identity: visual.variant === 'tome' ? [.08, .45, .4] : [-.2, .25, .4],
        surfaces: ['Gear_TomeCover', 'Gear_ShieldFace', 'Gear_ShieldRim', 'Gear_ShieldSpine'] };
    if (visual.family === 'handwear') return { scale: .65, spacing: .065,
        origin: [0, .13, .18], identity: [0, .04, .18], surfaces: ['Gear_Glove', 'Gear_GloveRim'] };
    if (visual.family === 'headwear') return {
        scale: .65, spacing: .055, vertical: visual.variant === 'hood',
        origin: visual.variant === 'hood' ? [.30, .22, .3] : [0, visual.variant === 'cap' ? .40 : .48, .3],
        identity: visual.variant === 'hood' ? [.30, .40, .3] : [0, visual.variant === 'cap' ? .50 : .58, .3],
        surfaces: ['Gear_CapCrown', 'Gear_CapBand', 'Gear_Hood', 'Gear_Helm', 'Gear_HelmCrown', 'Gear_HelmBrow']
    };
    if (visual.family === 'ring') return { scale: .28, spacing: .035, origin: [0, .06, 0], identity: [0, .025, .035], top: true,
        surfaces: ['Gear_RingSetting', 'Gear_RingSeal', 'Gear_RingStone'] };
    if (visual.family === 'waist') return { scale: .6, spacing: .09, origin: [0, 0, .55], identity: [0, .05, .55],
        surfaces: ['Gear_Belt', 'Gear_Buckle', 'Gear_BeltMark'] };
    if (visual.family === 'trinket') return { scale: .5, spacing: .045,
        origin: [0, visual.variant === 'orb' ? 0 : -.29, .1], identity: [0, visual.variant === 'orb' ? .035 : -.37, .1],
        surfaces: ['Gear_Orb', 'Gear_TrinketFocus', 'Gear_TrinketSetting'] };
    if (visual.family === 'neckwear') return { scale: .28, spacing: .022,
        origin: [0, visual.variant === 'choker' ? -.08 : -.17, .6],
        identity: [0, visual.variant === 'choker' ? -.045 : -.135, .6],
        surfaces: ['Gear_ChokerSeal', 'Gear_NeckFocus', 'Gear_NeckSetting'] };
    return null;
}

function fitAccessoryDecoration(group, layout, position, top = false) {
    const supports = layout.surfaces.map(name => group.getObjectByName(name)).filter(Boolean);
    // Shield surfaces are nested under a translated mount; update ancestors too.
    supports.forEach(part => part.updateWorldMatrix(true, false));
    const ray = new THREE.Raycaster(top ? new THREE.Vector3(position[0], 2, position[2]) : new THREE.Vector3(position[0], position[1], 2),
        top ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObjects(supports)[0];
    if (hit) position[top ? 1 : 2] = hit.point[top ? 'y' : 'z'] + .004 * layout.scale;
    return position;
}

function addSocketDetails(group, item, visual, mats) {
    const gems = Array.isArray(item?.gems) ? item.gems : [];
    const socketCount = Math.max(gems.length, Math.max(0, Number(item?.sockets) || 0));
    if (socketCount <= 0) return;
    // Blade sockets are inlaid along the blade, not offset beside its narrow
    // edge. Matching reverse fittings represent the same embedded stones and
    // keep a naturally pitched weapon readable from either face.
    const blade = visual.family === 'blade';
    const layout = fittedDecorationLayout(visual), size = layout?.scale ?? 1;
    const origin = layout?.origin ?? (blade ? [0, 0.4, 0.08] : socketDecorationPosition(visual.slot, visual));
    const shown = Math.min(3, socketCount);
    for (let index = 0; index < shown; index++) {
        const gem = gems[index];
        const gemType = socketGemAppearanceName(gem);
        const gemColor = GEM_COLORS[gemType] || 0x26262d;
        const gemMaterial = gem
            ? material(`socket-${gemType || 'unknown'}`, gemColor, {
                metalness: 0.18,
                roughness: 0.2,
                emissive: gemColor,
                emissiveIntensity: 0.12
            })
            : mats.dark;
        const offset = (index - (shown - 1) / 2) * (layout?.spacing ?? .085);
        const vertical = blade || layout?.vertical;
        const position = [origin[0] + (vertical ? 0 : offset), origin[1] + (vertical ? offset : 0), origin[2]];
        if (visual.family === 'handwear') {
            // Seat all three sockets on the curved cuff, not floating beyond
            // the narrow wrist's sides. Geometry remains shared and immutable.
            const radius = visual.variant === 'plate' ? .192 : .1805;
            position[2] = Math.sqrt(radius * radius - position[0] * position[0]) * .9 + .003;
        }
        if (visual.family === 'footwear') {
            fitFootOrnament(visual, position);
        }
        fitArmorOrnament(group, visual, position);
        if (layout) fitAccessoryDecoration(group, layout, position, layout.top);
        addMesh(group, `Gear_SocketMount${index + 1}`, geometry('gear-socket-mount', () => new THREE.OctahedronGeometry(0.048, 0)), mats.dark, {
            position, scale: [size, size, .4 * size], rotation: [layout?.top ? -Math.PI / 2 : 0, 0, 0]
        });
        addMesh(group, `Gear_Socket${index + 1}`, geometry('gear-socket', () => new THREE.OctahedronGeometry(0.033, 0)), gemMaterial, {
            position: [position[0], position[1] + (layout?.top ? .018 * size : 0), position[2] + (layout?.top ? 0 : .018 * size)],
            scale: [size, size, .55 * size], rotation: [layout?.top ? -Math.PI / 2 : 0, 0, 0]
        });
        if (blade) {
            // The extruded blade spans z=0..0.035 before its bevel. Mirror
            // around its mid-plane; do not draw through the blade or body.
            addMesh(group, `Gear_SocketMountBack${index + 1}`, geometry('gear-socket-mount', () => new THREE.OctahedronGeometry(0.048, 0)), mats.dark, {
                position: [position[0], position[1], 0.035 - position[2]], scale: [size, size, .4 * size]
            });
            addMesh(group, `Gear_SocketBack${index + 1}`, geometry('gear-socket', () => new THREE.OctahedronGeometry(0.033, 0)), gemMaterial, {
                position: [position[0], position[1], 0.035 - position[2] - .018 * size], scale: [size, size, .55 * size]
            });
        }
    }
}

function fitFootOrnament(visual, position) {
    if (visual.family !== 'footwear') return position;
    if (visual.variant === 'sandals') {
        position[1] = .12;
        position[2] = .18 + Math.sqrt(.18 ** 2 - position[0] ** 2) + .025;
    } else position[2] = fittedBootFrontDepth(position[0], position[1]) + .009;
    return position;
}

// Fit once when constructing an item, never during animation. Sample the
// actual shell so folds, handedness and curved metal stay consistent.
function fitArmorOrnament(group, visual, position) {
    const surface = visual.family === 'shoulderArmor' ? 'Gear_Shoulder'
        : visual.family === 'legArmor' ? 'Gear_ThighArmor'
            : visual.family === 'bodyArmor' ? 'Gear_Torso' : null;
    if (!surface) return position;
    const shell = group.getObjectByName(surface);
    shell.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(position[0], position[1], 2), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(shell)[0];
    if (hit) position[2] = hit.point.z + .009;
    return position;
}

function addIdentityDetails(group, item, visual) {
    const setId = String(item?.setId || '');
    const uniqueEffect = String(item?.uniqueEffect || '');
    if (!setId && !uniqueEffect) return;

    const layout = fittedDecorationLayout(visual), size = layout?.scale ?? 1;
    const origin = layout?.identity ?? socketDecorationPosition(visual.slot, visual);
    const positionFor = (sign, paired, depth) => {
        const separation = sign * (paired ? .08 * size : 0);
        const position = [origin[0] + (layout?.vertical ? 0 : separation),
            origin[1] + (layout?.vertical ? separation : layout ? 0 : .1), origin[2] + depth];
        return layout ? fitAccessoryDecoration(group, layout, position)
            : fitArmorOrnament(group, visual, fitFootOrnament(visual, position));
    };
    if (setId) {
        const setColor = SET_COLORS[setId] || 0x9e7cc2;
        const setMaterial = material(`equipment-set-${setId}`, setColor, {
            metalness: 0.35,
            roughness: 0.28,
            emissive: setColor,
            emissiveIntensity: 0.08
        });
        addMesh(group, 'Gear_SetRune', geometry('gear-set-rune', () => new THREE.TorusGeometry(0.058, 0.009, 3, 4)), setMaterial, {
            position: positionFor(-1, uniqueEffect, .012),
            rotation: [0, 0, 0],
            scale: [size, 1.25 * size, size]
        });
    }
    if (uniqueEffect) {
        const effectColor = UNIQUE_EFFECT_COLORS[uniqueEffect] || 0xb68bd0;
        const effectMaterial = material(`equipment-unique-${uniqueEffect}`, effectColor, {
            metalness: 0.22,
            roughness: 0.24,
            emissive: effectColor,
            emissiveIntensity: 0.12
        });
        addMesh(group, 'Gear_UniqueRune', geometry('gear-unique-rune', () => new THREE.OctahedronGeometry(0.044, 0)), effectMaterial, {
            position: positionFor(1, setId, .018),
            rotation: [0, 0, Math.PI / 4],
            scale: [.85 * size, 1.2 * size, .48 * size]
        });
    }
}

/**
 * Builds one exact equipment form without attaching it to a character. Geometry
 * and materials are immutable shared resources; transforms and userData belong
 * to the returned group, so callers may safely pose it for characters or loot.
 */
export function createProceduralEquipmentVisual(item, {
    slot = null,
    side = -1,
    fitScale = 1,
    fitLength = fitScale,
    name = null,
    batch = false,
    segment = 'main'
} = {}) {
    const visual = resolveEquipmentVisualDescriptor(item);
    if (!visual) return null;
    const resolvedSlot = slot || visual.slot;
    const group = new THREE.Group();
    group.name = name || `EquippedVisual_${resolvedSlot}`;
    group.userData.equipmentVisual = true;
    group.userData.slot = resolvedSlot;
    group.userData.segment = segment;
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
    group.userData.fitLength = Math.max(0.5, Math.min(1.25, Number(fitLength) || 1));
    const mats = createMaterials(item, visual);
    if (visual.family === 'legArmor' && segment === 'shin') {
        buildShinArmor(group, visual, mats);
    } else {
        BUILDERS[visual.family](group, visual, mats, side >= 0 ? 1 : -1);
        addSocketDetails(group, item, visual, mats);
        addIdentityDetails(group, item, visual);
    }
    if (batch) batchRigidEquipmentParts(group);
    const tierScale = (1 + group.userData.tier * 0.025) * group.userData.fitScale;
    group.scale.setScalar(tierScale);
    group.scale.y = (1 + group.userData.tier * 0.025) * group.userData.fitLength;
    return group;
}

// Equipment parts are rigid within their skeletal anchor. Combine only opaque
// sibling meshes with identical surface/shadow state; the actor's bones and
// the item root still own animation and class-specific fit. Keep named sources
// hidden for inspection, bounds and asset tooling, never as extra draw calls.
function batchRigidEquipmentParts(group) {
    const buckets = new Map();
    for (const part of group.children) {
        if (!part.isMesh || !part.visible || Array.isArray(part.material) || part.material.transparent) continue;
        part.updateMatrix();
        const key = [part.material.userData.equipmentSurfaceKey || part.material.uuid,
            part.material.shadowSide, part.castShadow, part.receiveShadow, part.renderOrder, part.layers.mask].join(':');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(part);
    }
    for (const [surfaceKey, parts] of buckets) {
        if (parts.length < 2) continue;
        const colored = parts.some(part => part.material !== parts[0].material);
        const key = parts.map(part => [part.geometry.uuid, part.matrix.elements.join(','),
            colored ? part.material.color.toArray().join(',') : ''].join(':')).join('|');
        let merged = BATCH_GEOMETRIES.get(key);
        if (!merged) {
            const baked = parts.map(part => {
                const geometry = (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(part.matrix);
                if (colored) {
                    const colors = new Float32Array(geometry.attributes.position.count * 3);
                    for (let i = 0; i < colors.length; i += 3) part.material.color.toArray(colors, i);
                    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                }
                return geometry;
            });
            merged = mergeGeometries(baked, false);
            baked.forEach((entry) => entry.dispose());
            if (!merged) throw new Error(`Unable to batch equipment ${group.userData.baseName}`);
            merged.computeBoundingBox();
            merged.computeBoundingSphere();
            BATCH_GEOMETRIES.set(key, merged);
        }
        let batchMaterial = parts[0].material;
        if (colored) {
            const materialKey = `equipment-color-batch:${surfaceKey}`;
            if (!MATERIALS.has(materialKey)) {
                const material = batchMaterial.clone();
                material.color.setRGB(1, 1, 1); material.vertexColors = true;
                MATERIALS.set(materialKey, material);
            }
            batchMaterial = MATERIALS.get(materialKey);
        }
        const combined = new THREE.Mesh(merged, batchMaterial);
        combined.name = `Gear_Batch_${parts[0].name}`;
        combined.castShadow = parts[0].castShadow;
        combined.receiveShadow = parts[0].receiveShadow;
        combined.renderOrder = parts[0].renderOrder;
        combined.layers.mask = parts[0].layers.mask;
        combined.userData.equipmentBatchSources = parts.map((part) => part.name);
        combined.matrixAutoUpdate = false;
        group.add(combined);
        parts.forEach((part) => {
            part.visible = false;
            part.matrixAutoUpdate = false;
            part.userData.equipmentBatchSource = true;
        });
    }
    // Unmerged opaque leaves are rigid too. Cache their local transform once;
    // the item root and animated equipment mount remain fully dynamic.
    for (const part of group.children) {
        if (!part.isMesh || part.isSkinnedMesh || part.children.length || Array.isArray(part.material) || part.material.transparent) continue;
        part.updateMatrix();
        part.matrixAutoUpdate = false;
    }
}

export function equipmentVisualSignature(equipment = {}) {
    return EQUIPMENT_RENDER_SLOTS.map((slot) => {
        const item = equipment?.[slot];
        if (!item?.id && !item?.name) return `${slot}:empty`;
        const rarity = getRarityName(item);
        const gems = Array.isArray(item.gems)
            ? item.gems.map((gem) => `${socketGemAppearanceName(gem) || ''}/${gem?.quality || ''}`).join(',')
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
    root.userData.equipmentVisualRevision = (root.userData.equipmentVisualRevision || 0) + 1;
    clearRigidEquipmentPivots(root);
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
            const visual = createProceduralEquipmentVisual(item, {
                slot,
                side: anchor.name.includes('Left') ? 1 : -1,
                fitScale: root.userData.equipmentScaleBySlot?.[slot] ?? 1,
                fitLength: root.userData.equipmentLengthBySlot?.[slot],
                segment: anchor.userData.equipmentSegment || 'main',
                batch: true
            });
            if (!visual) return;
            anchor.add(visual);
            visual.traverse((child) => {
                if (child.isMesh && !child.userData.equipmentBatchSource) parts++;
            });
            rendered = true;
        });
        if (rendered) items++;
    }

    batchRigidEquipmentPivots(root);
    root.userData.equipmentVisualSignature = signature;
    root.userData.equipmentVisualItemCount = items;
    root.userData.equipmentVisualPartCount = parts;
    return Object.freeze({ supported: true, changed: true, items, parts, missing });
}

export function getProceduralEquipmentCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size + BATCH_GEOMETRIES.size, materials: MATERIALS.size });
}
