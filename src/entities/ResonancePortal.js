import * as THREE from 'three';
import { createMotionPreference } from '../core/MotionPreference.js';
import { Entity } from './Entity.js';
import { RESONANCE_PORTAL } from '../data/worldLocations.js';
import { createResonancePortalModel } from '../art/ResonancePortalModel.js';
import { getResonancePortalState, PORTAL_INTERACTION_RANGE } from '../core/ResonancePortalState.js';
import { openResonancePortalDialog } from '../ui/ResonancePortalDialog.js';

export class ResonancePortal extends Entity {
    constructor(id) {
        super(id);
        this.type = 'ResonancePortal';
        this.name = RESONANCE_PORTAL.name;
        this.motionPreference = createMotionPreference();
    }

    async ensureMesh() {
        if (this.mesh || !this.isActive) return;
        this.portalModel = createResonancePortalModel();
        this.setMesh(this.portalModel.mesh);
        this.mesh.position.copy(this.position);
        this.mesh.quaternion.copy(this.rotation);
        this.mesh.updateMatrixWorld(true);
        const manager = this.gameEngine?.collisionManager;
        if (manager) {
            const colliders = this.portalModel.walls.map(wall => ({
                box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(wall.x, wall.height / 2, wall.z),
                    new THREE.Vector3(wall.width, wall.height, wall.depth)),
                matrix: this.mesh.matrixWorld.clone(), inverse: this.mesh.matrixWorld.clone().invert()
            }));
            colliders.forEach(collider => manager.addOrientedCollider(collider));
            this.clearWalkCollider = () => colliders.forEach(collider => manager.removeOrientedCollider(collider));
        }
        this.update();
    }

    canInteract(engine) {
        const player = engine?.player;
        return Boolean(this.isActive && player && player.state !== 'DEAD' && !engine.currentInstanceId &&
            Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= PORTAL_INTERACTION_RANGE);
    }

    interact(engine) {
        if (!this.canInteract(engine)) return false;
        engine.inputManager?.clearInputState?.();
        engine.clearCombatIntentState?.();
        engine.pendingInteraction = null;
        engine.player.targetPosition = null;
        if (engine.player.state === 'MOVING') {
            engine.player.state = 'IDLE';
            engine.player.playAnimation?.('Idle');
        }
        this.dialog?.close();
        this.dialog = openResonancePortalDialog(engine, this);
        return true;
    }

    update(dt = 0) {
        this.portalModel?.update(dt, getResonancePortalState(this.gameEngine?.player), this.motionPreference.matches);
        this.dialog?.update();
    }

    dispose() {
        this.dialog?.close(); this.dialog = null;
        super.dispose();
        this.portalModel?.dispose(); this.portalModel = null;
    }
}
