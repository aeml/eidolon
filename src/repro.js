import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RenderSystem } from './core/RenderSystem.js';

const urlParams = new URLSearchParams(window.location.search);
const perfOverlayEnabled = urlParams.get('perf') === '1';
const instanceCount = Number.parseInt(urlParams.get('instances') || '250', 10);
const useInstancing = urlParams.get('instancing') !== '0';

const perfOverlay = document.getElementById('perf-overlay');
const readout = document.getElementById('repro-readout');

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

const baseGeometry = new THREE.IcosahedronGeometry(0.8, 0);
const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xff9f66, roughness: 0.4, metalness: 0.1 });

const instances = [];
let instancedMesh = null;

const spawnCount = Math.max(1, Math.min(instanceCount, 2000));

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
        if (readout) {
            readout.textContent = `Last pick: ${intersection.x.toFixed(1)}, ${intersection.z.toFixed(1)}`;
        }
    }
};

renderSystem.renderer.domElement.addEventListener('pointermove', onPointerMove);
renderSystem.renderer.domElement.addEventListener('pointerdown', onPointerDown);

let lightEnabled = true;
const toggleLight = () => {
    lightEnabled = !lightEnabled;
    renderSystem.scene.traverse((obj) => {
        if (obj.isLight) {
            obj.visible = lightEnabled;
        }
    });
};

let gridEnabled = true;
const toggleGrid = () => {
    gridEnabled = !gridEnabled;
    gridHelper.visible = gridEnabled;
};

const togglePerf = () => {
    if (!perfOverlay) return;
    const isVisible = perfOverlay.style.display === 'block';
    perfOverlay.style.display = isVisible ? 'none' : 'block';
};

window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'p') togglePerf();
    if (event.key.toLowerCase() === 'g') toggleGrid();
    if (event.key.toLowerCase() === 'l') toggleLight();
});

const clock = new THREE.Clock();

const animate = () => {
    const delta = clock.getDelta();
    controls.update();

    if (instancedMesh) {
        instancedMesh.rotation.y += delta * 0.1;
    } else {
        for (const mesh of instances) {
            mesh.rotation.y += delta * 0.1;
        }
    }

    renderSystem.render();
    requestAnimationFrame(animate);
};

animate();
