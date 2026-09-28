import * as THREE from 'three';

const PALETTES = Object.freeze({
    1: { name: 'Orun', color: 0x79c267, light: 0xd8e6a4 },
    2: { name: 'Neris', color: 0x62c7ff, light: 0xd9f7ff },
    3: { name: 'Pyralis', color: 0xff7b3d, light: 0xffe5a3 },
    4: { name: 'Aeral', color: 0xb8ddf4, light: 0xf3fcff }
});

// A brief, non-colliding acknowledgement at the living player's position.
// No floor discs, damage outlines, lights, textures or gameplay state changes.
// TransientEffect owns and disposes this small set of geometries/materials.
export function createEidolonAidPresentation(phase, quality = 'high') {
    if (!Number.isInteger(phase)) return null;
    const palette = PALETTES[phase];
    if (!palette) return null;
    const root = new THREE.Group();
    root.name = `EidolonAid:${palette.name}`;
    root.userData.eidolonAidPhase = phase;
    const geometry = phase === 1 ? new THREE.DodecahedronGeometry(.14, 0)
        : phase === 2 ? new THREE.SphereGeometry(.12, 8, 5)
            : phase === 3 ? new THREE.ConeGeometry(.12, .48, 5)
                : new THREE.TorusGeometry(.2, .045, 4, 12, Math.PI * 1.2);
    const materials = [palette.color, palette.light].map(color => new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    const count = quality === 'low' ? 4 : 8;
    for (let index = 0; index < count; index++) {
        const mote = new THREE.Mesh(geometry, materials[index % 2]);
        mote.name = `${palette.name}:mote-${index}`;
        mote.userData.angle = index * Math.PI * 2 / count;
        mote.raycast = () => {}; // The cue is never an interaction target.
        root.add(mote);
    }
    const duration = 2.4;
    const update = ({ t }) => {
        const envelope = Math.min(1, t / .15, (1 - t) / .3);
        for (const material of materials) material.opacity = Math.max(0, envelope) * .7;
        for (const mote of root.children) {
            const angle = mote.userData.angle + t * (phase === 1 ? .45 : phase === 4 ? 5 : 3);
            const radius = phase === 1 ? .72 : .72 * (1 - t * .5);
            mote.position.set(Math.cos(angle) * radius,
                .35 + t * (phase === 1 ? .65 : 1.65) + (phase === 2 ? Math.sin(angle * 2) * .08 : 0),
                Math.sin(angle) * radius);
            mote.rotation.set(phase === 4 ? Math.PI / 3 : 0, angle, phase === 1 ? .4 : -.25);
            mote.scale.setScalar(.65 + envelope * .35);
        }
    };
    update({ t: 0 });
    return { root, duration, update };
}
