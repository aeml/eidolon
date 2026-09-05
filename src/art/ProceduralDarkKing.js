import * as THREE from 'three';
import { createProceduralHollowSentinel } from './ProceduralThorncryptBosses.js';

const GEOMETRIES = new Map();
const MATERIALS = new Map();
const geometry = (key, create) => {
    if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, create());
    return GEOMETRIES.get(key);
};
function material(key, color, metalness = 0.65, roughness = 0.48, emissive = 0) {
    if (!MATERIALS.has(key)) MATERIALS.set(key, new THREE.MeshStandardMaterial({
        color, metalness, roughness, emissive,
        emissiveIntensity: emissive ? 0.35 : 0,
        flatShading: true, side: THREE.DoubleSide
    }));
    return MATERIALS.get(key);
}
function part(parent, name, geo, mat, position, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `DarkKing_${name}`;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}
function bladeGeometry(points, depth) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, steps: 1 });
    result.translate(0, 0, -depth / 2);
    return result;
}

/** A distinct sovereign on the proven Sentinel animation skeleton. */
export function createProceduralDarkKing() {
    const root = createProceduralHollowSentinel();
    const iron = material('iron', 0x333944);
    const silver = material('silver', 0x858692, 0.8, 0.35);
    const gold = material('gold', 0x9a8057, 0.75, 0.44);
    const cloth = material('cloth', 0x35253b, 0, 0.96);
    const voidLight = material('void', 0x9978b5, 0.3, 0.4, 0x6b3989);
    const remove = [];
    root.traverse((object) => {
        if (!object.isMesh) return;
        if (/_(CrownSpike|EmptyRib|VigilTatter|WitchShard|VigilPole|VigilBlade|VigilEye|SigilThorn|CryptSigil)/.test(object.name)) {
            remove.push(object);
            return;
        }
        // Assign cached, king-owned materials; never mutate the shared
        // Thorncrypt materials used by other bosses in the same scene.
        object.material = /Eye|LastWitchlight/.test(object.name) ? voidLight
            : /BreastReliquary|Shoulder/.test(object.name) ? gold
                : /HollowChest/.test(object.name) ? cloth : iron;
    });
    remove.forEach((object) => object.removeFromParent());
    const body = root.getObjectByName('Rig_HollowSentinelBody');
    const head = root.getObjectByName('Rig_HollowSentinelHead');
    const weapon = root.getObjectByName('Rig_HollowSentinelWeapon');
    for (const side of ['Left', 'Right']) {
        part(root.getObjectByName(`Rig_HollowSentinelArm${side}`), `Gauntlet${side}`,
            geometry('gauntlet', () => new THREE.DodecahedronGeometry(0.24)), iron, [0, -1.54, 0.05], [0.9, 1.15, 0.95]);
    }

    part(head, 'CrownBand', geometry('band', () => new THREE.CylinderGeometry(0.56, 0.5, 0.22, 9, 1, true)), gold, [0, 0.34, 0]);
    const crownBlade = geometry('crown-blade', () => bladeGeometry([[-0.16, 0], [0.16, 0], [0.09, 0.62], [0, 1.05], [-0.09, 0.5]], 0.08));
    for (let index = 0; index < 7; index++) {
        const angle = index * Math.PI * 2 / 7;
        const blade = part(head, `BrokenCrown${index}`, crownBlade, index % 2 ? iron : gold,
            [Math.sin(angle) * 0.53, 0.43, Math.cos(angle) * 0.53],
            [1, index === 2 ? 0.5 : index === 5 ? 0.7 : 1, 1]);
        blade.rotation.y = angle;
        blade.rotation.x = -0.18;
    }
    part(head, 'Visor', geometry('visor', () => new THREE.BoxGeometry(0.64, 0.08, 0.12)), silver, [0, -0.08, 0.4]);

    // Broad folded mantle and split hem: an unmistakable royal silhouette,
    // behind the legs rather than a field of floating bone ornaments.
    const mantle = geometry('mantle', () => {
        const positions = [];
        const indices = [];
        for (let row = 0; row < 3; row++) {
            for (let column = 0; column < 5; column++) {
                const x = (column - 2) * (row === 0 ? 0.62 : 0.68);
                const y = row === 0 ? 1.26 : row === 1 ? -0.3 : -1.75 + (column === 2 ? 0.32 : 0);
                positions.push(x, y, -0.63 - row * 0.2 - (column % 2) * 0.14);
            }
        }
        for (let row = 0; row < 2; row++) for (let column = 0; column < 4; column++) {
            const a = row * 5 + column;
            indices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
        }
        const result = new THREE.BufferGeometry();
        result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        result.setIndex(indices);
        result.computeVertexNormals();
        return result;
    });
    part(body, 'RoyalMantle', mantle, cloth, [0, 0, 0]);
    const clasp = geometry('clasp', () => new THREE.OctahedronGeometry(0.2));
    for (const sign of [-1, 1]) part(body, `MantleClasp${sign}`, clasp, gold, [sign * 0.85, 1.2, 0.12], [1, 0.8, 0.5]);
    // The four imprisoned elements foreshadow the restored Eidolons' answer.
    for (const [index, color] of [0x788961, 0x759aa7, 0xbc7757, 0x9d93b5].entries()) {
        part(body, `BoundElement${index}`, clasp, material(`element${index}`, color, 0.25, 0.5),
            [(index - 1.5) * 0.27, 0.22, 0.72], [0.5, 0.65, 0.35]);
    }

    part(weapon, 'SwordGrip', geometry('grip', () => new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8)), iron, [0, 0.05, 0]);
    part(weapon, 'SwordPommel', clasp, gold, [0, 0.48, 0], [0.7, 0.7, 0.7]);
    part(weapon, 'SwordGuard', geometry('guard', () => new THREE.BoxGeometry(0.9, 0.12, 0.2)), gold, [0, -0.36, 0]);
    part(weapon, 'SovereignBlade', geometry('sword', () => bladeGeometry([[-0.19, 0], [0.19, 0], [0.28, -1.55], [0, -2.3], [-0.28, -1.55]], 0.12)), silver, [0, -0.48, 0]);
    weapon.rotation.x = -Math.PI / 3;
    root.updateMatrixWorld(true);
    const footHeight = new THREE.Box3().setFromObject(root.getObjectByName('HollowSentinel_RootFootLeft')).min.y;
    body.position.y -= footHeight;
    for (const clip of root.userData.animations) {
        for (const track of clip.tracks) {
            if (track.name === 'Rig_HollowSentinelBody.position[y]') {
                for (let index = 0; index < track.values.length; index++) track.values[index] -= footHeight;
            }
        }
    }
    root.name = 'ProceduralDarkKing';
    Object.assign(root.userData, {
        proceduralActorType: 'UmbraPrime', proceduralBossFamily: 'umbral',
        proceduralSourceType: 'HollowSentinel',
        artStyle: 'Broken Covenant sovereign: black iron, fractured crown, royal mantle and oathbreaker blade',
        region: 'Dark Realm — Malachar’s Court', faction: 'broken covenant'
    });
    root.userData.bounds = Object.freeze({ radius: 3.1, height: 6.75, origin: 'feet' });
    // Rebuild rest pose after recomposition so pool reuse restores new pieces
    // and does not retain removed decorative meshes through the old closure.
    const poses = [];
    root.traverse((object) => poses.push([object, object.position.clone(), object.quaternion.clone(), object.scale.clone(), object.visible]));
    root.userData.resetPose = () => {
        poses.forEach(([object, position, quaternion, scale, visible]) => {
            object.position.copy(position); object.quaternion.copy(quaternion); object.scale.copy(scale); object.visible = visible;
        });
        root.updateMatrixWorld(true);
    };
    return root;
}
