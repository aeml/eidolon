import * as THREE from 'three';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../art/ProceduralHumanoid.js';
import { applyProceduralEquipment, equipmentVisualSignature } from '../art/ProceduralEquipment.js';
import { createProceduralReflectionEnvironment } from '../art/ProceduralReflectionEnvironment.js';

const FACTORIES = Object.freeze({ Fighter: createProceduralFighter, Rogue: createProceduralRogue, Wizard: createProceduralWizard, Cleric: createProceduralCleric });
const INITIAL_YAW = -0.28;

/** A lazy, on-demand dressing room. Never animates alongside the game loop. */
export class CharacterPreview {
    constructor(host, { createRenderer = (options) => new THREE.WebGLRenderer(options) } = {}) {
        this.host = host;
        this.createRenderer = createRenderer;
        this.yaw = INITIAL_YAW;
        this.signature = '';
        this.disposed = false;
        this.onClick = (event) => {
            const control = event.target.closest('[data-preview-turn]');
            if (!control || !this.host.contains(control)) return;
            this.yaw = control.dataset.previewTurn === 'reset' ? INITIAL_YAW : this.yaw + Number(control.dataset.previewTurn);
            this.render();
        };
        host.addEventListener('click', this.onClick);
        if (typeof ResizeObserver !== 'undefined') {
            this.observer = new ResizeObserver(() => this.render());
            this.observer.observe(host);
        }
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
        this.renderer.toneMapping = THREE.LinearToneMapping;
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
        const signature = `${type}|${equipmentVisualSignature(player.equipment)}`;
        this.host.querySelector('.character-preview-label').textContent = `${type} · Level ${player.level}`;
        if (signature === this.signature) return;
        this.signature = signature;
        if (type !== this.type) {
            this.model?.removeFromParent();
            // A fresh hierarchy: cloning a live actor copies rest-pose closures.
            this.model = FACTORIES[type]();
            this.scene.add(this.model);
            this.type = type;
            this.yaw = INITIAL_YAW;
        }
        applyProceduralEquipment(this.model, player.equipment);
        this.render();
    }

    render() {
        const stage = this.host.querySelector('.character-preview-stage');
        if (this.disposed || !this.renderer || !this.model || !stage?.clientWidth || !stage.clientHeight) return;
        this.model.rotation.y = this.yaw;
        this.model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(this.model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const aspect = stage.clientWidth / stage.clientHeight;
        const halfHeight = Math.max(5.2, size.y, size.x / aspect) * 0.58;
        this.camera.left = -halfHeight * aspect;
        this.camera.right = halfHeight * aspect;
        this.camera.top = halfHeight;
        this.camera.bottom = -halfHeight;
        this.camera.position.set(center.x, center.y + 0.6, center.z + 12);
        this.camera.lookAt(center);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(stage.clientWidth, stage.clientHeight, false);
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.observer?.disconnect();
        this.host.removeEventListener('click', this.onClick);
        this.model?.removeFromParent();
        // Humanoids/equipment borrow cached geometry and materials also used by
        // live players. Only the preview's own texture and renderer are owned.
        if (this.scene) this.scene.environment = null;
        this.environment?.dispose();
        this.renderer?.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
        this.renderer?.dispose();
        this.renderer?.forceContextLoss();
        this.renderer?.domElement.remove();
    }
}
