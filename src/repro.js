import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RenderSystem } from './core/RenderSystem.js';

const urlParams = new URLSearchParams(window.location.search);
const perfOverlayEnabled = urlParams.get('perf') === '1';
const instanceCount = Number.parseInt(urlParams.get('instances') || '250', 10);
const useInstancing = urlParams.get('instancing') !== '0';

const perfOverlay = document.getElementById('perf-overlay');
const readout = document.getElementById('repro-readout');
const previewWindow = document.getElementById('repro-preview-window');
const triggerTelegraphButton = document.getElementById('repro-trigger-telegraph');
const triggerLootButton = document.getElementById('repro-trigger-loot');
const triggerJumpButton = document.getElementById('repro-trigger-jump');
const toggleWindowButton = document.getElementById('repro-toggle-window');
const resetSceneButton = document.getElementById('repro-reset-scene');
const previewWindowCloseButton = document.getElementById('repro-window-close');

const renderSystem = new RenderSystem(false);
renderSystem.scene.background = new THREE.Color(0x0b0e13);

if (perfOverlayEnabled && perfOverlay) {
    renderSystem.enablePerfOverlay(perfOverlay);
}

await renderSystem.preloadEnvironment();

const controls = new OrbitControls(renderSystem.camera, renderSystem.renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 10;
controls.maxDistance = 120;
controls.target.set(0, 0, 0);
controls.update();

const gridHelper = new THREE.GridHelper(200, 20, 0x3366aa, 0x223344);
gridHelper.position.y = 0.01;
renderSystem.scene.add(gridHelper);

const marker = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x66f7ff, opacity: 0.6, transparent: true })
);
marker.rotation.x = -Math.PI / 2;
marker.position.y = 0.05;
marker.visible = false;
renderSystem.scene.add(marker);

const telegraphPreview = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.2, 48),
    new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
);
telegraphPreview.rotation.x = -Math.PI / 2;
telegraphPreview.position.set(0, 0.08, 0);
telegraphPreview.visible = false;
renderSystem.scene.add(telegraphPreview);

const lootPreview = new THREE.Group();
lootPreview.visible = false;
for (let i = 0; i < 6; i += 1) {
    const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xffd700 : 0x55ddff, emissive: i % 2 === 0 ? 0x664400 : 0x113355, emissiveIntensity: 0.7 })
    );
    gem.position.set(Math.cos((i / 6) * Math.PI * 2) * 1.8, 0.8 + (i % 2) * 0.2, Math.sin((i / 6) * Math.PI * 2) * 1.8);
    lootPreview.add(gem);
}
renderSystem.scene.add(lootPreview);

const jumpPreview = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.7, 0.2, 24),
    new THREE.MeshStandardMaterial({ color: 0xcaa46c, transparent: true, opacity: 0.7 })
);
jumpPreview.position.set(0, 0.1, 0);
jumpPreview.visible = false;
renderSystem.scene.add(jumpPreview);

const baseGeometry = new THREE.IcosahedronGeometry(0.8, 0);
const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xff9f66, roughness: 0.4, metalness: 0.1 });

const instances = [];
let instancedMesh = null;
let lightEnabled = true;
let gridEnabled = true;
let telegraphPreviewUntil = 0;
let lootPreviewUntil = 0;
let jumpPreviewUntil = 0;
const spawnCount = Math.max(1, Math.min(instanceCount, 2000));

function setReadout(message) {
    if (readout) {
        readout.textContent = message;
    }
}

function triggerTelegraphPreview() {
    telegraphPreview.visible = true;
    telegraphPreviewUntil = performance.now() + 1400;
    setReadout('Preview: telegraph ring\nUse to sanity-check delayed danger readability.');
}

function triggerLootPreview() {
    lootPreview.visible = true;
    lootPreviewUntil = performance.now() + 1400;
    setReadout('Preview: loot burst\nUse to sanity-check reward punch and object readability.');
}

function triggerJumpPreview() {
    jumpPreview.visible = true;
    jumpPreview.scale.set(1.6, 1, 1.6);
    jumpPreviewUntil = performance.now() + 800;
    setReadout('Preview: jump landing\nUse to sanity-check impact footprint and camera-follow context.');
}

function toggleWindowPreview(forceOpen = null) {
    if (!previewWindow) return;
    const isOpen = previewWindow.style.display === 'block';
    const nextOpen = forceOpen === null ? !isOpen : forceOpen;
    previewWindow.style.display = nextOpen ? 'block' : 'none';
    previewWindow.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    if (nextOpen) {
        setReadout('Preview: menu chrome\nCheck close button, Esc dismissal, and non-selectable window text.');
    }
}

function resetPreviewState() {
    telegraphPreview.visible = false;
    lootPreview.visible = false;
    jumpPreview.visible = false;
    telegraphPreviewUntil = 0;
    lootPreviewUntil = 0;
    jumpPreviewUntil = 0;
    marker.visible = false;
    toggleWindowPreview(false);
    setReadout('Last pick: none');
}

if (useInstancing) {
    instancedMesh = new THREE.InstancedMesh(baseGeometry, baseMaterial, spawnCount);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < spawnCount; i += 1) {
        const angle = (i / spawnCount) * Math.PI * 2;
        const radius = 20 + (i % 8) * 3;
        dummy.position.set(Math.cos(angle) * radius, 1.2, Math.sin(angle) * radius);
        dummy.rotation.y = angle;
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    renderSystem.scene.add(instancedMesh);
} else {
    for (let i = 0; i < spawnCount; i += 1) {
        const angle = (i / spawnCount) * Math.PI * 2;
        const radius = 20 + (i % 8) * 3;
        const mesh = new THREE.Mesh(baseGeometry, baseMaterial.clone());
        mesh.position.set(Math.cos(angle) * radius, 1.2, Math.sin(angle) * radius);
        mesh.rotation.y = angle;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        renderSystem.scene.add(mesh);
        instances.push(mesh);
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersection = new THREE.Vector3();

const onPointerMove = (event) => {
    const rect = renderSystem.renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
};

const onPointerDown = () => {
    raycaster.setFromCamera(mouse, renderSystem.camera);
    if (raycaster.ray.intersectPlane(plane, intersection)) {
        marker.visible = true;
        marker.position.set(intersection.x, 0.05, intersection.z);
        setReadout(`Last pick: ${intersection.x.toFixed(1)}, ${intersection.z.toFixed(1)}`);
    }
};

renderSystem.renderer.domElement.addEventListener('pointermove', onPointerMove);
renderSystem.renderer.domElement.addEventListener('pointerdown', onPointerDown);

const toggleLight = () => {
    lightEnabled = !lightEnabled;
    renderSystem.scene.traverse((obj) => {
        if (obj.isLight) {
            obj.visible = lightEnabled;
        }
    });
};

const toggleGrid = () => {
    gridEnabled = !gridEnabled;
    gridHelper.visible = gridEnabled;
};

const togglePerf = () => {
    if (!perfOverlay) return;
    const isVisible = perfOverlay.style.display === 'block';
    perfOverlay.style.display = isVisible ? 'none' : 'block';
};

triggerTelegraphButton?.addEventListener('click', () => triggerTelegraphPreview());
triggerLootButton?.addEventListener('click', () => triggerLootPreview());
triggerJumpButton?.addEventListener('click', () => triggerJumpPreview());
toggleWindowButton?.addEventListener('click', () => toggleWindowPreview());
resetSceneButton?.addEventListener('click', () => resetPreviewState());
previewWindowCloseButton?.addEventListener('click', () => toggleWindowPreview(false));

window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'p') togglePerf();
    if (key === 'g') toggleGrid();
    if (key === 'l') toggleLight();
    if (key === 'escape') toggleWindowPreview(false);
});

const clock = new THREE.Clock();

const animate = () => {
    const delta = clock.getDelta();
    const now = performance.now();
    controls.update();

    if (instancedMesh) {
        instancedMesh.rotation.y += delta * 0.1;
    } else {
        for (const mesh of instances) {
            mesh.rotation.y += delta * 0.1;
        }
    }

    if (telegraphPreview.visible) {
        telegraphPreview.scale.setScalar(1 + Math.sin(now * 0.01) * 0.08);
        telegraphPreview.material.opacity = 0.5 + Math.sin(now * 0.018) * 0.2;
        if (now >= telegraphPreviewUntil) {
            telegraphPreview.visible = false;
        }
    }

    if (lootPreview.visible) {
        lootPreview.rotation.y += delta * 1.8;
        lootPreview.children.forEach((gem, index) => {
            gem.position.y = 0.7 + Math.sin(now * 0.006 + index) * 0.35;
        });
        if (now >= lootPreviewUntil) {
            lootPreview.visible = false;
        }
    }

    if (jumpPreview.visible) {
        const t = Math.max(0, (jumpPreviewUntil - now) / 800);
        const squash = 1 + (1 - t) * 0.8;
        jumpPreview.scale.set(1.8 * squash, Math.max(0.35, t), 1.8 * squash);
        jumpPreview.material.opacity = Math.max(0.15, t * 0.7);
        if (now >= jumpPreviewUntil) {
            jumpPreview.visible = false;
            jumpPreview.scale.set(1, 1, 1);
            jumpPreview.material.opacity = 0.7;
        }
    }

    renderSystem.render();
    requestAnimationFrame(animate);
};

setReadout('Last pick: none');
animate();

export {
    triggerTelegraphPreview,
    triggerLootPreview,
    triggerJumpPreview,
    toggleWindowPreview,
    resetPreviewState
};
