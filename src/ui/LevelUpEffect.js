import * as THREE from 'three';

export class LevelUpEffect {
    constructor(scene, position) {
        this.scene = scene;
        this.position = position.clone();
        this.isActive = true;
        this.time = 0;
        this.duration = 3.0; // Total duration

        this.meshes = [];

        // 1. Pillar of Light
        const pillarGeo = new THREE.CylinderGeometry(1, 1, 20, 16, 1, true);
        const pillarMat = new THREE.MeshBasicMaterial({
            color: 0xffd700, // Gold
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.pillar = new THREE.Mesh(pillarGeo, pillarMat);
        this.pillar.position.copy(this.position);
        this.pillar.position.y += 10; // Center it
        this.scene.add(this.pillar);
        this.meshes.push(this.pillar);

        // 2. Shockwave Ring
        const ringGeo = new THREE.RingGeometry(0.5, 1.0, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.ring = new THREE.Mesh(ringGeo, ringMat);
        this.ring.position.copy(this.position);
        this.ring.position.y += 0.1; // Just above ground
        this.ring.rotation.x = -Math.PI / 2;
        this.scene.add(this.ring);
        this.meshes.push(this.ring);

        // 3. Particles
        const particleCount = 50;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);
        const offsets = new Float32Array(particleCount); // Random starting offsets

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = this.position.x + (Math.random() - 0.5) * 2;
            positions[i * 3 + 1] = this.position.y + Math.random() * 2;
            positions[i * 3 + 2] = this.position.z + (Math.random() - 0.5) * 2;
            
            speeds[i] = 2.0 + Math.random() * 3.0; // Upward speed
            offsets[i] = Math.random() * Math.PI * 2; // Rotation offset
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMat = new THREE.PointsMaterial({
            color: 0xffff00,
            size: 0.3,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(particleGeo, particleMat);
        this.particles.userData = { speeds, offsets, initialY: this.position.y };
        this.scene.add(this.particles);
        this.meshes.push(this.particles);

        // 4. Fire Whirl (Red/Orange Particles)
        const fireCount = 100;
        const fireGeo = new THREE.BufferGeometry();
        const firePos = new Float32Array(fireCount * 3);
        const fireSpeeds = new Float32Array(fireCount);
        const fireOffsets = new Float32Array(fireCount);

        for (let i = 0; i < fireCount; i++) {
            const r = 1.5 + Math.random(); // Wider radius
            const theta = Math.random() * Math.PI * 2;
            firePos[i * 3] = this.position.x + Math.cos(theta) * r;
            firePos[i * 3 + 1] = this.position.y + Math.random() * 3;
            firePos[i * 3 + 2] = this.position.z + Math.sin(theta) * r;
            
            fireSpeeds[i] = 3.0 + Math.random() * 4.0; // Faster
            fireOffsets[i] = theta;
        }
        fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3));
        const fireMat = new THREE.PointsMaterial({
            color: 0xff4500, // OrangeRed
            size: 0.4,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.fireParticles = new THREE.Points(fireGeo, fireMat);
        this.fireParticles.userData = { speeds: fireSpeeds, offsets: fireOffsets, initialY: this.position.y };
        this.scene.add(this.fireParticles);
        this.meshes.push(this.fireParticles);

        // 5. Wind Whirl (Rotating Cylinder)
        const windGeo = new THREE.CylinderGeometry(2.5, 0.5, 15, 16, 1, true);
        const windMat = new THREE.MeshBasicMaterial({
            color: 0xccffff, // Cyan/White
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            wireframe: true // Wireframe looks like wind streaks
        });
        this.wind = new THREE.Mesh(windGeo, windMat);
        this.wind.position.copy(this.position);
        this.wind.position.y += 7.5;
        this.scene.add(this.wind);
        this.meshes.push(this.wind);
    }

    update(dt) {
        this.time += dt;
        if (this.time >= this.duration) {
            this.isActive = false;
            this.dispose();
            return;
        }

        const t = this.time / this.duration;

        // Animate Pillar
        // Fade in quickly (0.2s), fade out slowly
        if (this.time < 0.2) {
            this.pillar.material.opacity = this.time / 0.2 * 0.6;
        } else {
            this.pillar.material.opacity = (1 - (this.time - 0.2) / (this.duration - 0.2)) * 0.6;
        }
        this.pillar.scale.setScalar(1 + Math.sin(this.time * 10) * 0.1); // Pulse width
        this.pillar.rotation.y += dt * 2;

        // Animate Ring (Shockwave)
        // Expands quickly and fades
        if (this.time < 1.0) {
            const ringT = this.time / 1.0;
            this.ring.scale.setScalar(1 + ringT * 10); // Expand to 10x size
            this.ring.material.opacity = (1 - ringT) * 0.8;
        } else {
            this.ring.visible = false;
        }

        // Animate Wind
        if (this.time < 0.5) {
            this.wind.material.opacity = (this.time / 0.5) * 0.3;
        } else {
            this.wind.material.opacity = (1 - (this.time - 0.5) / (this.duration - 0.5)) * 0.3;
        }
        this.wind.rotation.y -= dt * 15; // Spin fast
        this.wind.scale.setScalar(1 + t * 0.5); // Expand slightly

        // Animate Gold Particles
        this.updateParticles(this.particles, dt, 2.0);

        // Animate Fire Particles
        this.updateParticles(this.fireParticles, dt, 5.0); // Faster spiral
    }

    updateParticles(system, dt, spiralSpeed) {
        const positions = system.geometry.attributes.position.array;
        const speeds = system.userData.speeds;
        const offsets = system.userData.offsets;
        const initialY = system.userData.initialY;

        // Fade particles in/out
        if (this.time < 0.5) {
            system.material.opacity = this.time / 0.5;
        } else {
            system.material.opacity = 1 - (this.time - 0.5) / (this.duration - 0.5);
        }

        for (let i = 0; i < speeds.length; i++) {
            // Move Up
            positions[i * 3 + 1] += speeds[i] * dt;
            
            // Spiral
            const angle = this.time * spiralSpeed + offsets[i];
            const radius = 1.0 + (positions[i * 3 + 1] - initialY) * 0.2; // Widen as they go up
            
            positions[i * 3] = this.position.x + Math.cos(angle) * radius;
            positions[i * 3 + 2] = this.position.z + Math.sin(angle) * radius;

            // Reset if too high (looping effect within the duration)
            if (positions[i * 3 + 1] > initialY + 10) {
                positions[i * 3 + 1] = initialY;
            }
        }
        system.geometry.attributes.position.needsUpdate = true;
    }

    dispose() {
        this.meshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            this.scene.remove(mesh);
        });
        this.meshes = [];
    }
}
