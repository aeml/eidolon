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

export function spawnEffectSceneFallback(gameEngine, position, color, type = 'impact') {
    const scene = gameEngine?.effectScene || gameEngine?.scene;
    if (!scene) {
        return false;
    }

    const config = TYPE_CONFIG[type] || {};
    const geometry = new THREE.SphereGeometry(config.radius || 0.5, config.segments || 8, config.segments || 8);
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: config.opacity || 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    scene.add(mesh);

    const animate = () => {
        if (mesh.material.opacity <= 0) {
            mesh.parent?.remove(mesh);
            geometry.dispose();
            material.dispose();
            return;
        }

        mesh.scale.multiplyScalar(config.scaleStep || 1.1);
        mesh.material.opacity -= config.fadeStep || 0.1;
        requestAnimationFrame(animate);
    };

    animate();
    return true;
}
