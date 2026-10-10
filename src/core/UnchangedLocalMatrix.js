import { Object3D } from 'three';

// Opt-in for owned scene containers and foliage groups only. Keep Three's
// normal flags and world traversal: only unchanged local composition is skipped,
// so idle parents no longer force every static descendant's world multiply.
// Animated actor/bone/skinned-mesh methods are never replaced.
export function cacheUnchangedLocalMatrix(object) {
    if (!(object?.isScene || object?.isGroup) ||
        object.updateMatrix !== Object3D.prototype.updateMatrix ||
        object.updateMatrixWorld !== Object3D.prototype.updateMatrixWorld) return null;
    const update = object.updateMatrix, world = object.updateMatrixWorld;
    const position = object.position.clone(), quaternion = object.quaternion.clone(), scale = object.scale.clone();
    const matrix = object.matrix.clone(), worldMatrix = object.matrixWorld.clone();
    let active = true, valid = false, parent = object.parent;
    let autoLocal = object.matrixAutoUpdate, autoWorld = object.matrixWorldAutoUpdate;
    function updateLocal() {
        if (!active || this !== object) return update.call(this);
        if (!this.matrixAutoUpdate || !valid || !position.equals(this.position) ||
            !quaternion.equals(this.quaternion) || !scale.equals(this.scale) || !matrix.equals(this.matrix)) {
            update.call(this);
            position.copy(this.position); quaternion.copy(this.quaternion); scale.copy(this.scale);
            matrix.copy(this.matrix); valid = true;
        }
    }
    function updateWorld(force) {
        if (!active || this !== object) return world.call(this, force);
        // A manual matrix is not a cached TRS composition. Restoring either
        // automatic flag must rebuild even when the TRS values stay unchanged.
        if (autoLocal !== this.matrixAutoUpdate) valid = false;
        if (parent !== this.parent ||
            (this.matrixAutoUpdate && (autoWorld !== this.matrixWorldAutoUpdate || !worldMatrix.equals(this.matrixWorld))) ||
            (!this.matrixAutoUpdate && !matrix.equals(this.matrix))) {
            this.matrixWorldNeedsUpdate = true;
        }
        parent = this.parent;
        autoLocal = this.matrixAutoUpdate; autoWorld = this.matrixWorldAutoUpdate;
        if (!this.matrixAutoUpdate) matrix.copy(this.matrix);
        const result = world.call(this, force);
        worldMatrix.copy(this.matrixWorld);
        return result;
    }
    const added = event => { event.child.matrixWorldNeedsUpdate = true; };
    object.updateMatrix = updateLocal; object.updateMatrixWorld = updateWorld;
    object.addEventListener('childadded', added);
    return () => {
        active = false;
        object.removeEventListener('childadded', added);
        if (object.updateMatrix === updateLocal) object.updateMatrix = update;
        if (object.updateMatrixWorld === updateWorld) object.updateMatrixWorld = world;
    };
}
