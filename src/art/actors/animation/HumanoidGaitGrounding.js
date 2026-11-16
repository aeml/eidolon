import * as THREE from 'three';

// Bake against the code-owned default footwear once per class, not a runtime
// IK/vertex scan. Equipped boots share these foot anchors and sole envelopes.
// Imported actor models do not pass through this procedural factory helper.
const profiles = new Map();
const SAMPLES = 64;

export function groundHumanoidGaits(root) {
    const type = root.userData.proceduralClass;
    if (!root.userData.proceduralHumanoid || !type) return;
    const hips = root.getObjectByName('Rig_Hips');
    if (!hips) throw new Error(`Missing procedural gait hips: ${type}`);
    for (const clip of root.userData.animations.filter(value => value.name === 'Walk' || value.name === 'Run')) {
        const track = clip.tracks.find(value => value.name === 'Rig_Hips.position[y]');
        if (!track) throw new Error(`Missing procedural gait height: ${type}/${clip.name}`);
        const key = `${type}:${clip.name}`;
        if (!profiles.has(key)) {
            const soles = [];
            for (const side of ['Left', 'Right']) {
                const foot = root.getObjectByName(`Equipment_Foot${side}`);
                if (!foot) throw new Error(`Missing procedural gait foot: ${type}/${side}`);
                foot.traverseVisible(part => { if (part.isMesh) soles.push(part); });
            }
            if (!soles.length) throw new Error(`Missing procedural gait footwear: ${type}`);
            const mixer = new THREE.AnimationMixer(root), values = [], vertex = new THREE.Vector3();
            mixer.clipAction(clip).play();
            try {
                for (let sample = 0; sample <= SAMPLES; sample++) {
                    const phase = sample / SAMPLES;
                    mixer.setTime(phase * clip.duration); root.updateMatrixWorld(true);
                    let lowest = Infinity;
                    for (const mesh of soles) {
                        const positions = mesh.geometry.attributes.position;
                        for (let i = 0; i < positions.count; i++) {
                            vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
                            lowest = Math.min(lowest, vertex.y);
                        }
                    }
                    // Walk always has a support foot. Run keeps a short flight
                    // between alternating stance windows rather than becoming
                    // a grounded shuffle. Only local pelvis height changes.
                    const flight = clip.name === 'Run' ? .1 * Math.max(0, Math.cos(phase * Math.PI * 4)) ** 2 : 0;
                    const rise = hips.parent.matrixWorld.elements[5];
                    values.push(hips.position.y + (.008 + flight - lowest) / rise);
                }
            } finally {
                mixer.stopAllAction(); mixer.uncacheRoot(root); root.updateMatrixWorld(true);
            }
            // Exact loop closure avoids a seam from floating-point phase wrap.
            values[SAMPLES] = values[0];
            profiles.set(key, Object.freeze(values));
        }
        track.times = Float32Array.from(profiles.get(key), (_, index) => clip.duration * index / SAMPLES);
        track.values = Float32Array.from(profiles.get(key));
        track.setInterpolation(THREE.InterpolateSmooth);
    }
}
