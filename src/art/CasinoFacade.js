import * as THREE from 'three';
import { createLanternholdArchFrame, createLanternholdArchPanel } from './LanternholdFacadeGeometry.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';

// Applied to the town exterior before its ordinary material batching.
// Window relief sits outside the opaque wall, not behind it. Ground-level
// supports stay within the legacy pilaster envelope and doorway clearance.
export function addCasinoFacade(parent, palette) {
    const trim = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x908a79, roughness: .91 }), 'stone');
    trim.name = 'casino-carved-limestone';
    const glass = palette.felt;
    glass.color.setHex(0x574932); glass.emissive.setHex(0x9b652c); glass.emissiveIntensity = .32;
    glass.roughness = .48; glass.userData.casinoExteriorGlass = true;
    const frameGeometry = createLanternholdArchFrame(), paneGeometry = createLanternholdArchPanel();
    const mesh = (group, name, geometry, material, position, scale = [1, 1, 1]) => {
        const part = new THREE.Mesh(geometry, material);
        part.name = name; part.position.set(...position); part.scale.set(...scale);
        part.castShadow = true; part.receiveShadow = true; group.add(part); return part;
    };
    const box = (group, name, material, size, position) => mesh(group, name, new THREE.BoxGeometry(...size), material, position);
    const window = (surface, x, y, width = 2.1, height = 3.2) => {
        const group = new THREE.Group(); group.name = 'casino-arched-window';
        group.position.set(x, y, 0); surface.add(group);
        mesh(group, 'casino-window-surround', frameGeometry.clone(), trim, [0, 0, .21], [width, height, .26]);
        mesh(group, 'casino-window-glass', paneGeometry.clone(), glass, [0, 0, .06], [width * .8, height * .86, .065]);
        box(group, 'casino-window-mullion', palette.gold, [.055, height * .72, .075], [0, -.08, .12]);
        box(group, 'casino-window-transom', palette.gold, [width * .8, .065, .075], [0, -.38, .12]);
        box(group, 'casino-window-sill', trim, [width + .22, .16, .5], [0, -height / 2 - .05, .16]);
        for (const side of [-1, 1]) box(group, 'casino-sill-corbel', trim,
            [.24, .34, .3], [side * width * .33, -height / 2 - .23, .08]);
    };
    const front = new THREE.Group(); front.name = 'casino-front-facade'; front.position.z = 8.26; parent.add(front);
    box(parent, 'casino-overdoor-wall', palette.stone, [5, 6, .5], [0, 7.8, 8]);
    for (const x of [-10.3, -6.6, 6.6, 10.3]) {
        window(front, x, 8.25, 2.25, 3.3);
        window(front, x, 3.1, 1.9, 3.25);
    }
    for (const x of [-12.5, -8.5, -4.5, 4.5, 8.5, 12.5]) {
        // No farther forward than the old pilasters (z=8.475).
        box(front, 'casino-support-foot', trim, [.9, .7, .42], [x, .35, -.02]);
        box(front, 'casino-support-shaft', trim, [.42, 9.75, .32], [x, 5.05, .04]);
        for (const y of [2, 5.6, 10.05]) box(front, 'casino-support-collar', trim, [.68, .25, .42], [x, y, -.05]);
    }
    for (const side of [-1, 1]) {
        const surface = new THREE.Group(); surface.name = `casino-side-facade-${side}`;
        surface.position.x = side * 13.26; surface.rotation.y = side * Math.PI / 2; parent.add(surface);
        for (const x of [-4.8, 0, 4.8]) {
            window(surface, x, 8.25, 2.05, 3.3);
            window(surface, x, 3.1, 1.8, 3.25);
        }
    }
    // Carved entrance jambs frame, but do not narrow, the five-unit opening.
    for (const side of [-1, 1]) {
        box(front, 'casino-door-jamb', trim, [.42, 5.25, .34], [side * 2.8, 2.625, .04]);
        box(front, 'casino-door-capital', trim, [.68, .28, .52], [side * 2.8, 5.13, .03]);
    }
    // Small rose above the sign: an architectural light, not another magic ring.
    const rose = new THREE.Group(); rose.name = 'casino-rose-window'; rose.position.set(0, 9.05, .05); front.add(rose);
    mesh(rose, 'casino-rose-glass', new THREE.CircleGeometry(.78, 20), glass, [0, 0, 0]);
    mesh(rose, 'casino-rose-stone', new THREE.TorusGeometry(.88, .13, 5, 24), trim, [0, 0, .04]);
    for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
        const bar = box(rose, 'casino-rose-bar', palette.gold, [.045, 1.54, .055], [0, 0, .06]);
        bar.rotation.z = angle;
    }
    for (const y of [5.85, 10.65]) {
        box(parent, 'casino-stone-stringcourse', trim, [26.6, .22, 16.6], [0, y, 0]);
        box(parent, 'casino-cornice-shadow', palette.wood, [26.64, .08, 16.64], [0, y - .18, 0]);
    }
    frameGeometry.dispose(); paneGeometry.dispose();
}

export function createCasinoHippedRoof() {
    // Same eaves and peak bounds as the legacy roof, with a constructed ridge
    // along the long axis instead of a single tent-like point.
    const points = [[-14, -1.75, -9], [14, -1.75, -9], [14, -1.75, 9], [-14, -1.75, 9], [-7, 1.75, 0], [7, 1.75, 0]];
    const faces = [3, 2, 5, 3, 5, 4, 0, 4, 5, 0, 5, 1, 0, 3, 4, 2, 1, 5];
    const positions = [], uv = [];
    for (const index of faces) {
        const point = points[index]; positions.push(...point); uv.push((point[0] + 14) / 28, (point[2] + 9) / 18);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return geometry;
}
