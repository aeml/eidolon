import * as THREE from 'three';
import { Stash } from '../entities/Stash.js';

// The west-side coffer is beside the rotated Trading House. Its exposed south
// face is reachable from the town arrival/market lane; chasing its centre cuts
// across that building. Keep normal collision and the existing interaction range.
export function interactionApproachPoint(entity, playerHeight) {
    const target = entity.position.clone();
    if (entity instanceof Stash) {
        target.add(new THREE.Vector3(0, 0, 3).applyQuaternion(entity.rotation));
    }
    target.y = playerHeight;
    return target;
}
