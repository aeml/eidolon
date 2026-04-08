import * as THREE from 'three';

const TYPE_CONFIG = {
    wave: { radius: 1.1, opacity: 0.45, scaleStep: 1.08, fadeStep: 0.06, segments: 12 },
    cone: { radius: 0.95, opacity: 0.45, scaleStep: 1.07, fadeStep: 0.06, segments: 12 },
    pillar: { radius: 0.85, opacity: 0.55, scaleStep: 1.06, fadeStep: 0.06, segments: 10 },
    buff: { radius: 0.7, opacity: 0.55, scaleStep: 1.05, fadeStep: 0.07, segments: 10 },
    spin: { radius: 0.9, opacity: 0.45, scaleStep: 1.08, fadeStep: 0.06, segments: 12 },
    smoke: { radius: 0.75, opacity: 0.4, scaleStep: 1.09, fadeStep: 0.05, segments: 10 },
    smoke_cloud: { radius: 1.1, opacity: 0.35, scaleStep: 1.07, fadeStep: 0.04, segments: 12 }
};

export function disposeSceneMesh(mesh) {
    if (!mesh) {
        return;
    }

    mesh.parent?.remove(mesh);

    if (mesh.geometry) {
        mesh.geometry.dispose();
    }

    if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) {
            material?.dispose?.();
        }
    } else if (mesh.material) {
        mesh.material.dispose();
    }
}

export function spawnSceneFallbackBurst(scene, position, color, options = {}) {
    if (!scene) {
        return false;
    }

    const radius = options.radius ?? 0.5;
    const segments = options.segments ?? 8;
    const geometry = new THREE.SphereGeometry(radius, segments, segments);
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: options.opacity ?? 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    scene.add(mesh);

    const animate = () => {
        if (mesh.material.opacity <= 0) {
            disposeSceneMesh(mesh);
            return;
        }

        mesh.scale.multiplyScalar(options.scaleStep ?? 1.1);
        mesh.material.opacity -= options.fadeStep ?? 0.1;
        requestAnimationFrame(animate);
    };

    animate();
    return true;
}

export function spawnSceneFallbackBeam(scene, start, end, color, options = {}) {
    if (!scene) {
        return false;
    }

    const direction = end.clone().sub(start);
    const range = Math.max(0.001, direction.length());
    direction.normalize();

    const beamGeo = new THREE.CylinderGeometry(options.radius ?? 0.2, options.radius ?? 0.2, range, options.segments ?? 8);
    beamGeo.rotateX(-Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: options.opacity ?? 0.8
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    const midPoint = start.clone().add(direction.multiplyScalar(range / 2));
    beamMesh.position.copy(midPoint);
    beamMesh.lookAt(end);
    scene.add(beamMesh);

    const animateBeam = () => {
        if (beamMesh.material.opacity <= 0) {
            disposeSceneMesh(beamMesh);
            return;
        }

        beamMesh.material.opacity -= options.fadeStep ?? 0.05;
        beamMesh.scale.x *= options.scaleXStep ?? 0.9;
        beamMesh.scale.z *= options.scaleZStep ?? 0.9;
        requestAnimationFrame(animateBeam);
    };

    animateBeam();
    return true;
}

export function spawnEffectSceneFallback(gameEngine, position, color, type = 'impact') {
    const scene = gameEngine?.effectScene || gameEngine?.scene;
    if (!scene) {
        return false;
    }

    return spawnSceneFallbackBurst(scene, position, color, TYPE_CONFIG[type] || {});
}
