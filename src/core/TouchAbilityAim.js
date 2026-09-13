import * as THREE from 'three';

const DEAD_ZONE = 14;
const FULL_RANGE_DRAG = 80;

// A thumb-relative aim stick: taps retain selected-target/self/ally behavior.
// Only the owning finger may release a cast; browser cancellation never casts.
export class TouchAbilityAim {
    constructor(engine) {
        this.engine = engine;
        this.gesture = null;
        this.suppressClickUntil = 0;
        this.preview = new THREE.Group();
        this.preview.visible = false;
        const material = new THREE.LineBasicMaterial({ color: 0x87e5ff, transparent: true, opacity: 0.8 });
        const circle = Array.from({ length: 65 }, (_, i) => {
            const angle = i / 64 * Math.PI * 2;
            return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        });
        this.rangeRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circle), material);
        this.aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(), new THREE.Vector3()
        ]), material);
        this.endpoint = new THREE.Line(this.rangeRing.geometry, material);
        this.endpoint.scale.setScalar(0.35);
        this.preview.add(this.rangeRing, this.aimLine, this.endpoint);
        engine.renderSystem.scene.add(this.preview);
        this.hint = document.createElement('div');
        this.hint.className = 'touch-ability-aim-hint';
        this.hint.hidden = true;
        // Small, non-interactive overlay; does not compete with world gestures.
        this.hint.style.cssText = 'position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:150;pointer-events:none;width:max-content;max-width:min(320px,80vw);padding:8px 12px;border:1px solid #87e5ff;border-radius:12px;background:#101c2eee;color:#e7faff;font:14px/1.4 sans-serif;text-align:center;';
        document.body.appendChild(this.hint);
        const listen = (...args) => engine.inputManager._registerListener(...args);
        const controls = [document.getElementById('btn-mobile-ability'), ...document.querySelectorAll('.hotbar-slot')];
        controls.forEach((button, index) => {
            if (!button) return;
            button.title = 'Tap to cast. Drag to aim; slide back to cancel.';
            const slot = index === 0 ? null : index - 1;
            // Capture consumes the legacy touchstart cast and compatibility click.
            listen(button, 'touchstart', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (this.gesture || !event.changedTouches.length || !this.canCast()) return;
                const skill = slot === null ? engine.player.abilityName : engine.player.hotbar?.[slot];
                if (!skill) return;
                const touch = event.changedTouches[0];
                this.gesture = { id: touch.identifier, slot, skill, startX: touch.clientX,
                    startY: touch.clientY, x: touch.clientX, y: touch.clientY, dragged: false };
                this.suppressClickUntil = Date.now() + 1000;
            }, { passive: false, capture: true });
            listen(button, 'click', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (Date.now() < this.suppressClickUntil || !this.canCast()) return;
                this.castTap(slot);
            }, true);
        });
        for (const type of ['touchmove', 'touchend', 'touchcancel']) {
            listen(window, type, event => {
                const gesture = this.gesture;
                if (!gesture) return;
                const touch = Array.from(event.changedTouches).find(t => t.identifier === gesture.id);
                if (!touch) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                gesture.x = touch.clientX;
                gesture.y = touch.clientY;
                this.update();
                if (type === 'touchmove') return;
                if (type !== 'touchcancel' && this.gesture && this.canCast()) {
                    if (!gesture.dragged) this.castTap(gesture.slot);
                    else if (gesture.target) {
                        engine.cancelMobilePursuit?.();
                        engine.abilityController.performAbility(gesture.target.clone(), gesture.skill);
                    }
                }
                this.cancel();
            }, { passive: false, capture: true });
        }
        engine.inputManager.touchAbilityAim = this;
    }

    canCast() {
        const { player, uiManager: ui, playerJumpState } = this.engine;
        return player && player.state !== 'DEAD' && player.state !== 'JUMPING' && !playerJumpState
            && !ui?.isEscMenuOpen && !ui?.isPatchNotesOpen && !ui?.isShopOpen
            && ui?.reportScreen?.style.display !== 'block';
    }

    castTap(slot) {
        if (slot === null) this.engine.abilityController.performAbility();
        else this.engine.abilityController.performHotbarAbility(slot);
    }

    update() {
        const gesture = this.gesture;
        if (!gesture) return;
        const { player, abilityController, renderSystem } = this.engine;
        const currentSkill = gesture.slot === null ? player?.abilityName : player?.hotbar?.[gesture.slot];
        if (!this.canCast() || currentSkill !== gesture.skill) { this.cancel(); return; }
        const dx = gesture.x - gesture.startX;
        const dy = gesture.y - gesture.startY;
        const distance = Math.hypot(dx, dy);
        gesture.dragged ||= distance > DEAD_ZONE;
        if (!gesture.dragged) return;
        gesture.target = null;
        const aimed = distance > DEAD_ZONE && abilityController.canGroundAim(gesture.skill);
        this.hint.hidden = false;
        this.preview.visible = aimed;
        if (!aimed) {
            this.hint.textContent = 'Release to cancel';
            return;
        }
        const range = abilityController.getAbilityCastRange(gesture.skill);
        const length = Math.min(1, distance / FULL_RANGE_DRAG) * range;
        const camera = renderSystem.camera;
        camera.updateMatrixWorld();
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        right.y = up.y = 0;
        right.normalize(); up.normalize();
        const offset = right.multiplyScalar(dx).add(up.multiplyScalar(-dy)).normalize().multiplyScalar(length);
        // Keep the player's actual realm elevation (not a hard-coded y=0 plane).
        gesture.target = player.position.clone().add(offset);
        this.preview.position.copy(player.position);
        this.preview.position.y += 0.12;
        this.rangeRing.scale.setScalar(range);
        this.endpoint.position.copy(offset);
        const positions = this.aimLine.geometry.attributes.position;
        positions.setXYZ(1, offset.x, 0, offset.z);
        positions.needsUpdate = true;
        this.aimLine.geometry.computeBoundingSphere();
        this.hint.textContent = `${gesture.skill} · ${length.toFixed(1)} / ${range.toFixed(1)}m${distance >= FULL_RANGE_DRAG ? ' · Max range' : ''} — release to cast; slide back to cancel`;
    }

    cancel() {
        if (this.gesture) this.suppressClickUntil = Date.now() + 1000;
        this.gesture = null;
        this.preview.visible = false;
        this.hint.hidden = true;
    }

    dispose() {
        this.cancel();
        this.preview.removeFromParent();
        this.rangeRing.geometry.dispose();
        this.aimLine.geometry.dispose();
        this.rangeRing.material.dispose();
        this.hint.remove();
    }
}
