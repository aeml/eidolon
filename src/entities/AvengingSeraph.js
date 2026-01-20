import * as THREE from 'three';
import { Actor } from './Actor.js';

export class AvengingSeraph extends Actor {
    constructor(id) {
        super(id, 'AvengingSeraph');
        console.log(`AvengingSeraph constructor called for ${id}`);
        this.meshType = 'AvengingSeraph';
        this.name = 'Avenging Seraph';
        this.radius = 1.5;
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (!gameEngine || !gameEngine.scene) return;
        
        if (type === "impact") {
            const geometry = new THREE.SphereGeometry(0.5, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            gameEngine.scene.add(mesh);
            
            setTimeout(() => {
                gameEngine.scene.remove(mesh);
                geometry.dispose();
                material.dispose();
            }, 200);
        }
    }
}
