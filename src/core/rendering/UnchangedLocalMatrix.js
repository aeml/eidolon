import { Object3D } from 'three';

// Owned scene/foliage containers cache only unchanged local TRS composition.
// Preserve updateMatrix's dirty side effect: ordinary world traversal must
// still force manual descendants, even when they wrote no explicit dirty flag.
// Animated actor/bone/skinned-mesh methods are never replaced.
export function cacheUnchangedLocalMatrix(object) {
    if (!(object?.isScene || object?.isGroup) ||
        object.updateMatrix !== Object3D.prototype.updateMatrix ||
        object.updateMatrixWorld !== Object3D.prototype.updateMatrixWorld) return null;
    const update = object.updateMatrix;
    const position = object.position.clone(), quaternion = object.quaternion.clone(), scale = object.scale.clone();
    const matrix = object.matrix.clone();
    let active = true, valid = false;
    function updateLocal() {
        if (!active || this !== object) return update.call(this);
        if (!this.matrixAutoUpdate || !valid || !position.equals(this.position) ||
            !quaternion.equals(this.quaternion) || !scale.equals(this.scale) || !matrix.equals(this.matrix)) {
            update.call(this);
            position.copy(this.position); quaternion.copy(this.quaternion); scale.copy(this.scale);
            matrix.copy(this.matrix); valid = true;
        }
        this.matrixWorldNeedsUpdate = true;
    }
    object.updateMatrix = updateLocal;
    return () => {
        active = false;
        if (object.updateMatrix === updateLocal) object.updateMatrix = update;
    };
}
