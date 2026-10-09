import { LatheGeometry, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Constructor-only, owned geometry for existing material batches. Modest edge
// bevels catch the scene's actual light, rather than painting a bright outline.
export function createLanternholdBenchPlank(width, height, depth) {
    return new RoundedBoxGeometry(width, height, depth, 1, Math.min(height, depth) * .18);
}

// A real open vessel: the profile crosses the rim, returns down the inner wall
// and closes at the floor. No opaque top cap or transparent substitute.
export function createLanternholdWellBucket(quality = 'high') {
    const profile = [[0, -.35], [.35, -.35], [.45, .35],
        [.4, .35], [.305, -.28], [0, -.28]];
    return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), quality === 'low' ? 12 : 24);
}
