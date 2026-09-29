import * as THREE from 'three';

const CREATURES = Object.freeze({
    InfernalBehemoth: { kind: 'gore', reach: .55 },
    PhoenixSentinel: { kind: 'peck', reach: .45 },
    ThunderRoc: { kind: 'peck', reach: .45 },
    RocMatriarch: { kind: 'peck', reach: .5 },
    Cindermaw: { kind: 'bite', reach: .45 },
    TiderendLeviathan: { kind: 'bite', reach: .5 },
    StormHarpy: { kind: 'jab', reach: .12 }
});

// These creatures previously borrowed a humanoid weapon sweep (or rotated a
// jaw sideways). Author the actual contact anatomy while keeping feet, actor
// position and gameplay hit volumes fixed. Called after rest-ground offsets.
export function configureCreatureAttack(root, type, clips) {
    const profile = CREATURES[type];
    if (!profile) return;
    const index = clips.findIndex(clip => clip.name === 'Attack');
    if (index < 0) throw new Error(`Missing creature attack: ${type}`);
    const times = [0, .16, .25, .35, .44, .66, 1], tracks = [];
    const add = (part, property, axis, offsets) => {
        const node = root.getObjectByName(`Rig_${type}${part}`);
        if (!node) throw new Error(`Missing creature attack joint: ${type}/${part}`);
        const rest = node[property][axis];
        tracks.push(new THREE.NumberKeyframeTrack(`${node.name}.${property}[${axis}]`, times,
            offsets.map(offset => rest + offset)));
    };
    const still = [0, 0, 0, 0, 0, 0, 0];
    add('Body', 'position', 'y', still);
    add('Body', 'rotation', 'x', still); add('Body', 'rotation', 'y', still);
    add('Head', 'position', 'z', [0, -.12, -.18, profile.reach, profile.reach * .45, 0, 0]);
    add('Head', 'position', 'y', [0, .08, .12, -.12, -.04, 0, 0]);
    add('Head', 'rotation', 'x', [0, -.12, -.22, profile.kind === 'gore' ? .3 : .22, .08, 0, 0]);
    add('Head', 'rotation', 'y', still);
    // Explicit planted leg tracks also restore the pose after a moving gait.
    root.traverse(node => {
        const prefix = `Rig_${type}`;
        if (node.isGroup && node.name.startsWith(prefix) && /^(Leg|Hind)/.test(node.name.slice(prefix.length))) {
            add(node.name.slice(prefix.length), 'rotation', 'x', still);
        }
    });
    if (profile.kind === 'bite') {
        // +X lowers the front of the lower jaw; close at contact, not beyond
        // the upper skull. Remove the inherited sideways weapon rotation.
        add('Weapon', 'rotation', 'x', [0, .32, .53, -.1, -.02, 0, 0]);
        add('Weapon', 'rotation', 'z', still);
    }
    if (profile.kind === 'peck' || profile.kind === 'jab') {
        for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
            add(`Arm${side}`, 'rotation', 'z', [0, sign * .2, sign * .4, sign * .14, sign * .08, 0, 0]);
            add(`Arm${side}`, 'rotation', 'x', [0, .08, .12, -.14, -.06, 0, 0]);
        }
        add('Weapon', 'rotation', 'z', still);
        if (profile.kind === 'jab') {
            // The Harpy's hanging javelin needs a forward thrust, not a
            // reversed wing flap that barely moves its point toward the foe.
            add('Weapon', 'rotation', 'x', [0, .12, .2, -1.35, -.95, 0, 0]);
        }
    }
    add('Accent', 'rotation', 'y', [0, -.06, -.12, .12, .04, 0, 0]);
    clips[index] = new THREE.AnimationClip('Attack', 1, tracks);
    root.userData.basicAttackContactTime = .35;
    root.userData.creatureAttackKind = profile.kind;
}
