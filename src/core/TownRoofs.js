import * as THREE from 'three';
import { TOWN_ROOFS } from '../data/townRoofs.generated.js';

const CELL = 2, EPSILON = 1e-6;
const localRay = new THREE.Ray(), hit = new THREE.Vector3();
const localPoint = new THREE.Vector3(), worldPoint = new THREE.Vector3();

export class TownRoofField {
    constructor(data = TOWN_ROOFS) {
        this.families = new Map();
        for (const [id, rows] of Object.entries(data.families)) {
            const cells = new Map(), bounds = new THREE.Box3();
            const triangles = rows.map(row => {
                const [a, b, c] = [0, 3, 6].map(offset => new THREE.Vector3(...row.slice(offset, offset + 3)));
                bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
                const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
                return { a, b, c, d };
            });
            triangles.forEach((triangle, index) => {
                const points = [triangle.a, triangle.b, triangle.c];
                for (let x = Math.floor(Math.min(...points.map(p => p.x)) / CELL); x <= Math.floor(Math.max(...points.map(p => p.x)) / CELL); x++) {
                    for (let z = Math.floor(Math.min(...points.map(p => p.z)) / CELL); z <= Math.floor(Math.max(...points.map(p => p.z)) / CELL); z++) {
                        const key = `${x}:${z}`;
                        if (!cells.has(key)) cells.set(key, { indices: [], bounds: new THREE.Box3(new THREE.Vector3(x * CELL, bounds.min.y, z * CELL), new THREE.Vector3((x + 1) * CELL, bounds.max.y, (z + 1) * CELL)) });
                        cells.get(key).indices.push(index);
                    }
                }
            });
            this.families.set(id, { triangles, cells, bounds });
        }
        this.placements = data.placements.map(p => ({ ...p, cos: Math.cos(p.rotation), sin: Math.sin(p.rotation), mesh: this.families.get(p.family) }));
        this.byId = new Map(this.placements.map(p => [p.id, p]));
    }

    sample(x, z, id = '') {
        let result = null;
        const candidates = id ? [this.byId.get(id)] : this.placements;
        for (const p of candidates) {
            if (!p) continue;
            const dx = x - p.x, dz = z - p.z;
            const lx = p.cos * dx - p.sin * dz, lz = p.sin * dx + p.cos * dz;
            const cell = p.mesh.cells.get(`${Math.floor(lx / CELL)}:${Math.floor(lz / CELL)}`);
            if (!cell) continue;
            for (const index of cell.indices) {
                const t = p.mesh.triangles[index], { a, b, c, d } = t;
                if (Math.abs(d) < EPSILON) continue;
                const wa = ((b.z - c.z) * (lx - c.x) + (c.x - b.x) * (lz - c.z)) / d;
                const wb = ((c.z - a.z) * (lx - c.x) + (a.x - c.x) * (lz - c.z)) / d;
                const wc = 1 - wa - wb;
                if (wa < -EPSILON || wb < -EPSILON || wc < -EPSILON) continue;
                const y = p.y + wa * a.y + wb * b.y + wc * c.y;
                if (!result || y > result.y) result = { id: p.id, y };
            }
        }
        return result;
    }

    intersectRay(ray, target, maxDistance = Infinity) {
        let nearest = maxDistance, found = false;
        for (const p of this.placements) {
            const dx = ray.origin.x - p.x, dz = ray.origin.z - p.z;
            localRay.origin.set(p.cos * dx - p.sin * dz, ray.origin.y - p.y, p.sin * dx + p.cos * dz);
            localRay.direction.set(p.cos * ray.direction.x - p.sin * ray.direction.z, ray.direction.y, p.sin * ray.direction.x + p.cos * ray.direction.z);
            if (!localRay.intersectBox(p.mesh.bounds, localPoint)) continue;
            const seen = new Set();
            for (const cell of p.mesh.cells.values()) {
                if (!localRay.intersectBox(cell.bounds, localPoint)) continue;
                for (const index of cell.indices) {
                    if (seen.has(index)) continue;
                    seen.add(index);
                    const t = p.mesh.triangles[index];
                    if (!localRay.intersectTriangle(t.a, t.b, t.c, false, hit)) continue;
                    worldPoint.set(p.x + p.cos * hit.x + p.sin * hit.z, p.y + hit.y, p.z - p.sin * hit.x + p.cos * hit.z);
                    const distance = ray.origin.distanceTo(worldPoint);
                    if (distance < nearest) { nearest = distance; target.copy(worldPoint); found = true; }
                }
            }
        }
        return found ? target : null;
    }
}

let shared;
export function getTownRoofField() { return shared ||= new TownRoofField(); }
