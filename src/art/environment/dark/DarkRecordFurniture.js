import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Occupation remnants inside the existing record houses. These are scenery,
// not extra services, rewards, interactables or blocking walk volumes.
export function createDarkRecordFurniture(site) {
    const batches = new Map();
    const add = (surface, geometry, position, rotation = [0, 0, 0]) => {
        const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        geometry.dispose();
        part.rotateX(rotation[0]); part.rotateY(rotation[1]); part.rotateZ(rotation[2]);
        part.translate(...position);
        if (!batches.has(surface)) batches.set(surface, []);
        batches.get(surface).push(part);
    };
    const box = (surface, width, height, depth, x, y, z) =>
        add(surface, new THREE.BoxGeometry(width, height, depth), [x, y, z]);
    const bench = (x, z, width = 1.8) => {
        box('wood', width, .12, .52, x, .58, z);
        for (const side of [-1, 1]) box('wood', .16, .54, .44, x + side * (width / 2 - .22), .27, z);
    };
    const table = (x, z) => {
        box('wood', 1.65, .12, .85, x, .99, z);
        for (const side of [-1, 1]) box('wood', .16, .93, .68, x + side * .56, .465, z);
        box('brass', 1.2, .035, .035, x, .35, z);
    };
    const roll = (x, y, z) => {
        add('paper', new THREE.CylinderGeometry(.09, .09, .55, 8), [x, y, z], [0, 0, Math.PI / 2]);
        box('brass', .035, .19, .18, x, y, z);
    };
    if (site.model === 'observatory') {
        // These six sites are charters, ledgers, petitions and plans, rather
        // than astronomical instruments. Keep the original central evidence.
        for (const x of [-2.9, -1.75]) box('wood', .09, 1.8, .62, x, .9, -1.95);
        box('wood', 1.24, 1.8, .06, -2.325, .9, -2.27);
        for (const y of [.2, .72, 1.25, 1.8]) box('wood', 1.24, .07, .64, -2.325, y, -1.95);
        for (let index = 0; index < 7; index++) {
            const x = -2.78 + index * .15, height = .29 + (index % 3) * .055;
            box('paper', .11, height, .4, x, .755 + height / 2, -1.95);
            box('brass', .115, .025, .405, x, .83, -1.95);
        }
        table(1.9, -1.7);
        if (site.id === 'dark_architect_plan') {
            box('paper', 1.3, .012, .61, 1.9, 1.06, -1.7);
            roll(1.9, 1.15, -1.99); roll(1.9, 1.15, -1.4);
            for (let index = 0; index < 3; index++) box('wood', .015, .005, .42, 1.65 + index * .22, 1.07, -1.7);
        } else if (site.id === 'dark_production_tally') {
            box('wood', 1.2, .84, .06, 1.9, 1.55, -2.08);
            for (let index = 0; index < 6; index++) box('paper', .28, .24, .012,
                1.5 + (index % 3) * .39, 1.32 + Math.floor(index / 3) * .35, -2.04);
        } else {
            for (let index = 0; index < 3; index++) roll(1.62 + index * .25, 1.15, -1.7);
            box('paper', .55, .055, .42, 1.9, 1.08, -1.35);
        }
    } else if (site.id === 'dark_waiting_table') {
        // An empty chair and a deliberately laid table make the unfinished
        // celebration readable before opening the existing personal account.
        box('wood', .62, .12, .62, 1.75, .58, .1);
        for (const x of [1.52, 1.98]) for (const z of [-.13, .33]) box('wood', .09, .55, .09, x, .275, z);
        box('wood', .62, .63, .09, 1.75, .95, -.17);
        for (const x of [-.86, .86]) {
            add('brass', new THREE.CylinderGeometry(.19, .16, .035, 12), [x, 1.37, .05]);
            const profile = [[.08, 0], [.095, .22], [.065, .22], [.055, .04], [0, .04]];
            add('brass', new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 10), [x, 1.34, .45]);
        }
        for (const x of [-2.6, 2.6]) box('wood', .09, 2.1, .09, x, 1.05, -2.85);
        const banner = new THREE.PlaneGeometry(4.8, .65, 8, 1);
        const position = banner.attributes.position;
        for (let index = 0; index < position.count; index++) {
            const x = position.getX(index);
            position.setY(index, position.getY(index) - .2 * (1 - (x / 2.4) ** 2));
            position.setZ(index, Math.sin(x * 2.2) * .025);
        }
        banner.computeVertexNormals();
        add('paper', banner, [0, 1.85, -2.8]);
        for (let index = 0; index < 7; index++) box('brass', .11, .18, .015, -1.65 + index * .55, 1.76, -2.76);
    } else if (site.id === 'dark_stayers_shelter') {
        bench(-1.65, -1.75, 2.1); bench(1.65, -1.75, 2.1);
        for (const x of [-2.15, 1.15]) {
            add('paper', new THREE.CylinderGeometry(.17, .17, .65, 10), [x, .79, -1.75], [0, 0, Math.PI / 2]);
            box('brass', .05, .35, .35, x, .79, -1.75);
        }
    } else {
        // The ferry manifest and copied crossing ledger retain mooring posts,
        // alongside a waiting bench and bundled supplies, not a glowing flood
        // stripe carried over from the Water realm's generic shelter recipe.
        bench(-1.8, -1.85);
        for (const x of [-2.5, 2.5]) {
            add('wood', new THREE.CylinderGeometry(.14, .18, 2.7, 10), [x, 1.35, 1.6]);
            add('brass', new THREE.TorusGeometry(.3, .07, 5, 12), [x, 1.9, 1.6], [Math.PI / 2, 0, 0]);
        }
        box('wood', 1.1, .7, .85, 2, .35, -1.8);
        for (const x of [1.6, 2.4]) box('brass', .045, .73, .87, x, .35, -1.8);
        roll(2, .82, -1.8);
    }
    const result = {};
    for (const [surface, parts] of batches) {
        const geometry = mergeGeometries(parts, false);
        for (const part of parts) part.dispose();
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        result[surface] = geometry;
    }
    return result;
}
