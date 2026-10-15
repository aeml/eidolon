import * as THREE from 'three';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../art/ProceduralHumanoid.js';
import { equipmentVisualSignature } from '../art/ProceduralEquipment.js';
import { applyEquipmentVisuals, clearEquipmentVisuals } from '../art/EquipmentVisuals.js';
import { equipmentWithAppearances } from '../core/EquipmentAppearance.js';
import { createProceduralReflectionEnvironment } from '../art/ProceduralReflectionEnvironment.js';
import { MeshFactory } from '../utils/MeshFactory.js';

const FACTORIES = Object.freeze({ Fighter: createProceduralFighter, Rogue: createProceduralRogue, Wizard: createProceduralWizard, Cleric: createProceduralCleric });
const INITIAL_YAW = -0.28;

/** A lazy, on-demand dressing room. Never animates alongside the game loop. */
export class CharacterPreview {
    constructor(host, { createRenderer = (options) => new THREE.WebGLRenderer(options),
        loadFighter = (quality) => MeshFactory.createMeshForType('Fighter', { quality }),
        loadCharacter = (type, quality) => MeshFactory.createMeshForType(type, { quality }) } = {}) {
        this.host = host;
        this.createRenderer = createRenderer;
        this.loadFighter = loadFighter;
        this.loadCharacter = loadCharacter;
        this.modelRequest = 0;
        this.yaw = INITIAL_YAW;
        this.focusSlot = null; this.focusDirection = null; this.focusUp = null;
        this.host.dataset.previewFocus = 'character';
        this.signature = '';
        this.disposed = false;
        this.onClick = (event) => {
            const control = event.target.closest('[data-preview-turn]');
            if (!control || !this.host.contains(control)) return;
            this.yaw = control.dataset.previewTurn === 'reset' ? INITIAL_YAW : this.yaw + Number(control.dataset.previewTurn);
            if (control.dataset.previewTurn === 'reset') { this.focusDirection = null; this.focusUp = null; }
            this.render();
        };
        host.addEventListener('click', this.onClick);
        if (typeof ResizeObserver !== 'undefined') {
            this.observer = new ResizeObserver(() => this.render());
            this.observer.observe(host);
        }
    }

    setFocusSlot(slot) {
        const next = ['mainHand', 'offHand'].includes(slot) ? slot : null;
        if (this.disposed || this.focusSlot === next) return;
        this.focusSlot = next; this.focusDirection = null; this.focusUp = null;
        this.host.dataset.previewFocus = next || 'character';
        this.render();
    }

    initialize() {
        if (this.renderer || this.failed || this.disposed) return;
        try {
            this.renderer = this.createRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
        } catch {
            this.failed = true;
            this.host.querySelector('.character-preview-status').textContent = 'Preview unavailable. Your equipment is still shown in the slots.';
            return;
        }
        this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.35;
        this.renderer.domElement.setAttribute('aria-hidden', 'true');
        this.onContextRestored = () => this.render();
        this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
        this.host.querySelector('.character-preview-stage').append(this.renderer.domElement);
        this.scene = new THREE.Scene();
        this.environment = createProceduralReflectionEnvironment();
        this.scene.environment = this.environment;
        this.scene.environmentIntensity = 0.65;
        this.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x473323, 2.1));
        const key = new THREE.DirectionalLight(0xffe4c4, 3.2);
        key.position.set(-4, 7, 6);
        this.scene.add(key);
        const rim = new THREE.DirectionalLight(0xb5d2ff, 2.2);
        rim.position.set(4, 5, -3);
        this.scene.add(rim);
        this.camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 40);
        this.host.querySelector('.character-preview-status').textContent = '';
    }

    update(player) {
        if (this.disposed) return;
        const type = player?.subType || player?.meshType;
        if (!Object.hasOwn(FACTORIES, type)) return;
        this.initialize();
        if (!this.renderer) return;
        const equipment = equipmentWithAppearances(player.equipment, player.appearances);
        const quality = MeshFactory.getFighterQuality(player.mesh?.userData.authoredQuality ||
            (player.gameEngine?.renderSystem?.isMobile ? 'low' : player.gameEngine?.renderSystem?.graphicsQuality));
        const modelKey = `${type}:${quality}`;
        const signature = `${modelKey}|${equipmentVisualSignature(equipment)}`;
        this.pendingEquipment = equipment;
        this.host.querySelector('.character-preview-label').textContent = `${type} · Level ${player.level}`;
        if (signature === this.signature) return;
        this.signature = signature;
        this.focusDirection = null; this.focusUp = null;
        if (modelKey !== this.modelKey) {
            const request = ++this.modelRequest;
            this.previewMixer?.stopAllAction();
            this.previewMixer?.uncacheRoot(this.model);
            this.previewMixer = null;
            clearEquipmentVisuals(this.model);
            this.model?.userData.disposeInstance?.();
            this.model?.removeFromParent();
            // A fresh hierarchy: cloning a live actor copies rest-pose closures.
            this.model = FACTORIES[type]();
            this.scene.add(this.model);
            this.type = type;
            this.modelKey = modelKey;
            this.yaw = INITIAL_YAW;
            {
                this.host.querySelector('.character-preview-status').textContent = `Loading ${type} model…`;
                this.modelReady = Promise.resolve().then(() => type === 'Fighter' ? this.loadFighter(quality) : this.loadCharacter(type, quality)).then(model => {
                    if (this.disposed || request !== this.modelRequest) {
                        MeshFactory.releaseMesh(type, model);
                        return;
                    }
                    clearEquipmentVisuals(this.model); this.model.removeFromParent();
                    this.model = model; this.scene.add(model);
                    this.previewMixer = new THREE.AnimationMixer(model);
                    applyEquipmentVisuals(model, this.pendingEquipment);
                    this.syncWeaponPose();
                    this.renderAfterEquipment(model, request);
                    this.host.querySelector('.character-preview-status').textContent = model.userData.assetFallback ? `Using fallback ${type} model.` : '';
                    this.render();
                }).catch(() => {
                    if (!this.disposed && request === this.modelRequest) this.host.querySelector('.character-preview-status').textContent = `Using fallback ${type} model.`;
                });
            }
        }
        applyEquipmentVisuals(this.model, equipment);
        this.syncWeaponPose();
        this.renderAfterEquipment(this.model, this.modelRequest);
        this.render();
    }

    syncWeaponPose() {
        if (!this.previewMixer) return;
        const name = this.model.userData.resolveAnimationName?.('Idle') || 'Idle';
        const idle = this.model.userData.animations?.find(clip => clip.name === name);
        if (!idle) return;
        this.previewMixer.stopAllAction(); this.model.userData.resetRestPose?.();
        this.previewMixer.clipAction(idle).reset().play(); this.previewMixer.setTime(.25);
    }

    renderAfterEquipment(model, request) {
        if (!model?.userData.equipmentReady) return;
        model.userData.equipmentReady.then(() => {
            if (!this.disposed && request === this.modelRequest && model === this.model) {
                this.syncWeaponPose(); this.render();
            }
        });
    }

    render() {
        const stage = this.host.querySelector('.character-preview-stage');
        if (this.disposed || !this.renderer || !this.model || !stage?.clientWidth || !stage.clientHeight) return;
        this.model.rotation.y = this.yaw;
        this.model.userData.updateEquipmentPose?.();
        this.model.updateMatrixWorld(true);
        let focused;
        if (this.focusSlot) this.model.traverse(part => {
            if (!focused && part.userData.authoredEquipment && part.userData.slot === this.focusSlot) focused = part;
        });
        const bounds = new THREE.Box3().setFromObject(focused || this.model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const aspect = stage.clientWidth / stage.clientHeight;
        const halfHeight = focused ? Math.max(.35, size.x / aspect, size.y, size.z) * .65
            : Math.max(5.2, size.y, size.x / aspect) * .58;
        this.camera.left = -halfHeight * aspect;
        this.camera.right = halfHeight * aspect;
        this.camera.top = halfHeight;
        this.camera.bottom = -halfHeight;
        if (focused) {
            // Start from the item's modeled front, including a horizontal idle
            // shield/tome. Keep that camera direction when the player rotates.
            this.focusDirection ||= new THREE.Vector3(0, 0, 1).applyMatrix3(new THREE.Matrix3().getNormalMatrix(focused.matrixWorld)).normalize();
            this.focusUp ||= new THREE.Vector3(0, 1, 0).transformDirection(focused.matrixWorld);
            this.camera.up.copy(this.focusUp);
            this.camera.position.copy(center).addScaledVector(this.focusDirection, 12);
        } else {
            this.camera.up.set(0, 1, 0);
            this.camera.position.set(center.x, center.y + .6, center.z + 12);
        }
        this.camera.lookAt(center);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(stage.clientWidth, stage.clientHeight, false);
        // Inspection borrows the exact equipped mesh. Hide other meshes only
        // for this on-demand frame, then restore every original visibility flag.
        const hidden = [];
        if (focused) {
            const included = new Set(); focused.traverse(part => included.add(part));
            this.model.traverse(part => {
                if (part.isMesh && !included.has(part)) { hidden.push([part, part.visible]); part.visible = false; }
            });
        }
        try { this.renderer.render(this.scene, this.camera); }
        finally { for (const [part, visible] of hidden) part.visible = visible; }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.modelRequest++;
        this.previewMixer?.stopAllAction();
        this.previewMixer?.uncacheRoot(this.model);
        this.observer?.disconnect();
        this.host.removeEventListener('click', this.onClick);
        clearEquipmentVisuals(this.model);
        this.model?.userData.disposeInstance?.();
        this.model?.removeFromParent();
        // Humanoids/equipment borrow cached geometry and materials also used by
        // live players. Its cloned skeletons, environment and renderer are owned.
        if (this.scene) this.scene.environment = null;
        this.environment?.dispose();
        this.renderer?.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
        this.renderer?.dispose();
        this.renderer?.forceContextLoss();
        this.renderer?.domElement.remove();
    }
}
