import * as THREE from 'three';

class TransientEffect {
    constructor(scene, meshes, duration, updateFn = null) {
        this.scene = scene;
        this.meshes = Array.isArray(meshes) ? meshes : [meshes];
        this.duration = duration;
        this.updateFn = updateFn;
        this.elapsed = 0;
        this.isActive = true;
    }

    update(dt) {
        if (!this.isActive) return;

        this.elapsed += dt;
        const t = Math.min(1, this.elapsed / this.duration);

        if (this.updateFn) {
            this.updateFn({ meshes: this.meshes, elapsed: this.elapsed, t, dt });
        }

        if (this.elapsed >= this.duration) {
            this.isActive = false;
            this.dispose();
        }
    }

    dispose() {
        const geometries = new Set();
        const materials = new Set();

        for (const mesh of this.meshes) {
            if (mesh.parent?.remove) {
                mesh.parent.remove(mesh);
            } else if (this.scene?.remove) {
                this.scene.remove(mesh);
            }
            mesh.traverse((child) => {
                if (child.geometry) geometries.add(child.geometry);
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        for (const mat of child.material) materials.add(mat);
                    } else {
                        materials.add(child.material);
                    }
                }
            });
        }

        geometries.forEach((geo) => geo.dispose());
        materials.forEach((mat) => mat.dispose());
        this.meshes.length = 0;
    }
}

function addToScene(scene, meshOrMeshes) {
    const meshes = Array.isArray(meshOrMeshes) ? meshOrMeshes : [meshOrMeshes];
    for (const mesh of meshes) {
        scene.add(mesh);
    }
    return meshes;
}

function getForwardVector(options = {}) {
    if (options.direction && options.direction.isVector3) {
        return options.direction.clone().normalize();
    }
    if (options.source && options.source.mesh && options.source.mesh.quaternion) {
        return new THREE.Vector3(0, 0, 1).applyQuaternion(options.source.mesh.quaternion).normalize();
    }
    return new THREE.Vector3(0, 0, 1);
}

function createPulseRingMaterial(color, opacity = 0.55) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uColor: { value: new THREE.Color(color) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3 uColor;
            varying vec2 vUv;

            void main() {
                vec2 p = vUv - 0.5;
                float radial = length(p) * 2.0;
                float ringMask = smoothstep(1.0, 0.78, radial) * (1.0 - smoothstep(0.68, 0.58, radial));
                float pulse = 0.65 + 0.35 * sin(uTime * 11.0 + radial * 20.0);
                float shimmer = 0.8 + 0.2 * sin(uTime * 19.0 + p.x * 35.0 + p.y * 28.0);
                vec3 col = uColor + vec3(0.18, 0.15, 0.1) * pulse;
                gl_FragColor = vec4(col, ringMask * uOpacity * pulse * shimmer);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
}

function createEnergySphereMaterial(color, opacity = 0.5) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uColor: { value: new THREE.Color(color) }
        },
        vertexShader: `
            varying vec3 vNormalW;
            varying vec3 vWorldPos;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vNormalW = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3 uColor;
            varying vec3 vNormalW;
            varying vec3 vWorldPos;

            void main() {
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                float fresnel = pow(1.0 - max(dot(vNormalW, viewDir), 0.0), 2.2);
                float ripple = 0.7 + 0.3 * sin(uTime * 12.0 + vWorldPos.y * 2.5 + vWorldPos.x * 1.7);
                vec3 glow = uColor + vec3(0.12, 0.18, 0.2) * ripple;
                gl_FragColor = vec4(glow, uOpacity * fresnel * ripple);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
}

function createBeamMaterial(color, opacity = 0.82) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uColor: { value: new THREE.Color(color) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3 uColor;
            varying vec2 vUv;

            void main() {
                float core = smoothstep(0.5, 0.18, abs(vUv.x - 0.5));
                float arc = 0.55 + 0.45 * sin(vUv.y * 28.0 - uTime * 24.0);
                float flare = 0.75 + 0.25 * sin(vUv.y * 52.0 + uTime * 19.0);
                float alpha = core * arc * flare * uOpacity;
                vec3 col = uColor + vec3(0.3, 0.25, 0.18) * (arc * core);
                gl_FragColor = vec4(col, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
}

function createEnergyShardMaterial(color, opacity = 0.95) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uColor: { value: new THREE.Color(color) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3 uColor;
            varying vec2 vUv;

            void main() {
                float edgeX = smoothstep(0.0, 0.2, vUv.x) * (1.0 - smoothstep(0.8, 1.0, vUv.x));
                float edgeY = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
                float energy = edgeX * edgeY;
                float flicker = 0.75 + 0.25 * sin(uTime * 21.0 + vUv.y * 35.0);
                vec3 col = uColor + vec3(0.2, 0.2, 0.2) * (energy * flicker);
                gl_FragColor = vec4(col, uOpacity * energy * flicker);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
}

function getTelegraphTheme(options = {}) {
    const tier = options.threatTier || 'danger';

    const dungeonThemes = {
        verdant_bastion_catacombs: {
            ringColor: 0xb8ff72,
            fillColor: 0x5e8b45,
            motifColor: 0xd7ff9a,
            labelColor: '#eaffc8'
        },
        molten_core: {
            ringColor: 0xff7a24,
            fillColor: 0xb52618,
            motifColor: 0xffc052,
            labelColor: '#ffe0a8'
        },
        tempest_spire: {
            ringColor: 0x8cecff,
            fillColor: 0x6554c7,
            motifColor: 0xf1e8ff,
            labelColor: '#e8faff'
        },
        abyssal_well: {
            ringColor: 0x55f1dc,
            fillColor: 0x126c83,
            motifColor: 0xa8fff3,
            labelColor: '#d6fffa'
        }
    };
    const dungeonTheme = dungeonThemes[options.theme];

    if (dungeonTheme && (tier === 'boss' || tier === 'lethal')) {
        return {
            ...dungeonTheme,
            ringOpacity: 0.78,
            fillOpacity: 0.22,
            ringPulseBoost: 0.2,
            fillPulseBoost: 0.24
        };
    }

    if (tier === 'minor') {
        return {
            ringColor: 0xffd54a,
            fillColor: 0xfff0a8,
            ringOpacity: 0.42,
            fillOpacity: 0.08,
            ringPulseBoost: 0.24,
            fillPulseBoost: 0.16,
            labelColor: '#fff1b8'
        };
    }

    if (tier === 'boss' || tier === 'lethal') {
        return {
            ringColor: 0xff3b30,
            fillColor: 0xff6b57,
            ringOpacity: 0.7,
            fillOpacity: 0.22,
            ringPulseBoost: 0.32,
            fillPulseBoost: 0.24,
            labelColor: '#ffd7cf'
        };
    }

    return {
        ringColor: 0xff7a1a,
        fillColor: 0xffaa5c,
        ringOpacity: 0.55,
        fillOpacity: 0.14,
        ringPulseBoost: 0.28,
        fillPulseBoost: 0.2,
        labelColor: '#ffe1bf'
    };
}

function createDungeonTelegraphMotif(themeId, radius, position, color) {
    if (!themeId) return null;

    const root = new THREE.Group();
    root.name = `DungeonTelegraphMotif:${themeId}`;
    root.position.copy(position);
    root.position.y += 0.075;
    root.userData.dungeonTelegraphTheme = themeId;
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const addGroundMesh = (geometry, name, x = 0, z = 0, rotationZ = 0) => {
        const mesh = new THREE.Mesh(geometry, material.clone());
        mesh.name = name;
        mesh.position.set(x, 0, z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = rotationZ;
        root.add(mesh);
        return mesh;
    };

    if (themeId === 'verdant_bastion_catacombs') {
        for (let i = 0; i < 8; i += 1) {
            const angle = (i / 8) * Math.PI * 2;
            addGroundMesh(
                new THREE.ConeGeometry(radius * 0.065, radius * 0.34, 3),
                `RootThorn:${i}`,
                Math.cos(angle) * radius * 0.63,
                Math.sin(angle) * radius * 0.63,
                -angle
            );
        }
    } else if (themeId === 'molten_core') {
        for (let i = 0; i < 5; i += 1) {
            const angle = (i / 5) * Math.PI * 2;
            addGroundMesh(
                new THREE.PlaneGeometry(radius * 0.08, radius * 0.76),
                `MagmaFault:${i}`,
                Math.cos(angle) * radius * 0.28,
                Math.sin(angle) * radius * 0.28,
                -angle + (i % 2 ? 0.18 : -0.12)
            );
        }
    } else if (themeId === 'tempest_spire') {
        for (let i = 0; i < 6; i += 1) {
            const angle = (i / 6) * Math.PI * 2;
            addGroundMesh(
                new THREE.PlaneGeometry(radius * 0.055, radius * 0.62),
                `LightningConductor:${i}`,
                Math.cos(angle) * radius * 0.38,
                Math.sin(angle) * radius * 0.38,
                -angle + 0.24
            );
        }
        addGroundMesh(new THREE.RingGeometry(radius * 0.22, radius * 0.27, 6), 'StormHex');
    } else if (themeId === 'abyssal_well') {
        for (let i = 0; i < 3; i += 1) {
            addGroundMesh(
                new THREE.RingGeometry(radius * (0.26 + i * 0.18), radius * (0.3 + i * 0.18), 40),
                `UndertowRing:${i}`
            );
        }
    } else {
        material.dispose();
        return null;
    }

    material.dispose();
    return root;
}

function createTelegraphLabelSprite(text, color = '#ffffff') {
    if (!text) return null;

    let texture = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext?.('2d');
        if (ctx && typeof ctx.clearRect === 'function') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(12, 16, 24, 0.72)';
            ctx.fillRect(0, 8, canvas.width, 48);
            ctx.strokeStyle = 'rgba(255, 215, 140, 0.65)';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 9, canvas.width - 2, 46);
            let fontSize = 28;
            ctx.font = `bold ${fontSize}px Arial`;
            while (fontSize > 16 && ctx.measureText(text).width > canvas.width - 24) {
                fontSize -= 2;
                ctx.font = `bold ${fontSize}px Arial`;
            }
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color;
            ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
            texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
        }
    }

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        depthWrite: false
    }));
    sprite.scale.set(6.5, 1.8, 1);
    sprite.userData.text = text;
    sprite.userData.baseScale = [6.5, 1.8];
    return sprite;
}

export function createTransientEffect(scene, type, position, color = 0xffffff, options = {}) {
    if (!scene || !position) return null;
    const effectScale = Number.isFinite(options.effectScale) ? options.effectScale : 1.0;
    const quality = options.quality || 'high';

    if (type === 'impact') {
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 10, 10),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false })
        );
        mesh.position.copy(position);
        group.add(mesh);

        if (quality !== 'low') {
            const halo = new THREE.Mesh(
                new THREE.SphereGeometry(0.35, 10, 10),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            halo.position.copy(position);
            halo.userData.isHalo = true;
            group.add(halo);
        }

        addToScene(scene, group);
        return new TransientEffect(scene, group, 0.28, ({ meshes, t }) => {
            const g = meshes[0];
            const m = g.children[0];
            m.scale.setScalar(1 + t * 1.7);
            m.material.opacity = 0.85 * (1 - t);
            if (g.children[1]) {
                g.children[1].scale.setScalar(1 + t * 2.5);
                g.children[1].material.opacity = 0.7 * (1 - t);
            }
        });
    }

    if (type === 'spin') {
        const radius = Number.isFinite(options.radius) && options.radius > 0 ? options.radius : 3.5;
        const mesh = new THREE.Mesh(
            new THREE.RingGeometry(Math.max(0.2, radius * 0.82), radius, 32),
            createPulseRingMaterial(color, 0.55)
        );
        mesh.userData.gameplayRadius = radius;
        mesh.rotation.x = Math.PI / 2;
        mesh.position.copy(position);
        mesh.position.y += 0.5;
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, 0.85, ({ meshes, dt, t }) => {
            const m = meshes[0];
            m.rotation.z += dt * 10.5;
            m.material.uniforms.uTime.value += dt;
            m.material.uniforms.uOpacity.value = (0.55 + (quality === 'high' ? 0.08 : 0.0)) * (1 - t);
        });
    }

    if (type === 'wave' || type === 'ring') {
        const isBigRing = type === 'ring';
        const exactRadius = Number.isFinite(options.radius) && options.radius > 0
            ? options.radius
            : null;
        const outerRadius = exactRadius || (isBigRing ? 8.0 : 1.0);
        const innerRadius = exactRadius
            ? Math.max(0.2, outerRadius - Math.max(0.22, Math.min(0.5, outerRadius * 0.04)))
            : 0.5;
        const mesh = new THREE.Mesh(
            new THREE.RingGeometry(innerRadius, outerRadius, 32),
            createPulseRingMaterial(color, 0.5)
        );
        if (exactRadius) mesh.userData.gameplayRadius = exactRadius;
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(position);
        mesh.position.y += 0.1;
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, exactRadius ? 0.75 : (isBigRing ? 0.5 : 1.0), ({ meshes, t }) => {
            const m = meshes[0];
            if (exactRadius) {
                // Keep the authoritative boundary visible at its true size for
                // the whole cast flash. A small outward-only pulse preserves
                // impact without implying a smaller hit area.
                m.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.015);
            } else {
                m.scale.setScalar(1 + t * (isBigRing ? 1.0 : 9.0));
            }
            m.material.uniforms.uTime.value = t * 2.0;
            m.material.uniforms.uOpacity.value = (0.5 + (quality === 'high' ? 0.06 : 0.0)) * (1 - t);
        });
    }

    if (type === 'jump_land') {
        const impact = Math.max(0.5, Math.min(1.2, Number.isFinite(options.impact) ? options.impact : 0.9));
        const className = options.className || '';
        const classTint = className === 'Wizard'
            ? 0xbcdcff
            : className === 'Rogue'
                ? 0xcfd6df
                : className === 'Cleric'
                    ? 0xf3e7bd
                    : color;
        const group = new THREE.Group();

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.85, 1.25, 32),
            createPulseRingMaterial(classTint, 0.52)
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(position);
        ring.position.y += 0.08;
        group.add(ring);

        const dust = new THREE.Mesh(
            new THREE.CircleGeometry(1.25, 28),
            new THREE.MeshBasicMaterial({
                color: 0xb7aa94,
                transparent: true,
                opacity: 0.42,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        dust.rotation.x = -Math.PI / 2;
        dust.position.copy(position);
        dust.position.y += 0.04;
        group.add(dust);

        const burstDust = new THREE.Mesh(
            new THREE.RingGeometry(0.35, 0.95, 24),
            new THREE.MeshBasicMaterial({
                color: 0xc7b8a0,
                transparent: true,
                opacity: 0.28,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        burstDust.rotation.x = -Math.PI / 2;
        burstDust.position.copy(position);
        burstDust.position.y += 0.06;
        group.add(burstDust);

        addToScene(scene, group);
        return new TransientEffect(scene, group, 0.48, ({ meshes, t }) => {
            const g = meshes[0];
            const [ringMesh, dustMesh, burstDustMesh] = g.children;
            const burstScale = 1 + t * (3.8 * impact);
            ringMesh.scale.setScalar(burstScale);
            ringMesh.material.uniforms.uTime.value = t * 2.8;
            ringMesh.material.uniforms.uOpacity.value = (0.56 + (quality === 'high' ? 0.1 : 0.0)) * (1 - t);

            dustMesh.scale.setScalar(1 + t * (2.8 * impact));
            dustMesh.material.opacity = 0.42 * (1 - t);

            burstDustMesh.scale.setScalar(1 + t * (4.2 * impact));
            burstDustMesh.material.opacity = 0.28 * (1 - t);
        });
    }

    if (type === 'buff') {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 2, 8),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })
        );
        mesh.position.copy(position);
        mesh.position.y += 1.0;
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, 1.0, ({ meshes, dt, t }) => {
            const m = meshes[0];
            m.position.y += dt * 4.8;
            m.material.opacity = (0.5 + (quality === 'high' ? 0.08 : 0.0)) * (1 - t);
        });
    }

    if (type === 'burst') {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.9, 8, 8),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false })
        );
        mesh.position.copy(position);
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, 0.22, ({ meshes, t }) => {
            const m = meshes[0];
            m.scale.setScalar(1 + t * 0.8);
            m.material.opacity = (0.8 + (quality === 'high' ? 0.1 : 0.0)) * (1 - t);
        });
    }

    if (type === 'pillar') {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 4, 8),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })
        );
        mesh.position.copy(position);
        mesh.position.y = 2;
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, 1.0, ({ meshes, t }) => {
            const m = meshes[0];
            m.material.opacity = 0.5 * (1 - t);
            m.scale.setScalar(1 + t);
        });
    }

    if (type === 'smoke') {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8, depthWrite: false })
        );
        mesh.position.copy(position);
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, 0.95, ({ meshes, t }) => {
            const m = meshes[0];
            m.scale.setScalar(1 + t * 1.4);
            m.material.opacity = 0.8 * (1 - t);
        });
    }

    if (type === 'mark') {
        const mesh = new THREE.Mesh(
            new THREE.TorusGeometry(0.5, 0.05, 8, 16),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false })
        );
        mesh.position.copy(position);
        mesh.position.y += 2.0;
        mesh.rotation.x = Math.PI / 2;
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, 1.0, ({ meshes, dt, t }) => {
            const m = meshes[0];
            m.rotation.z += dt * 2.5;
            m.material.opacity = 0.75 * (1 - t * 0.9);
        });
    }

    if (type === 'blood') {
        const group = new THREE.Group();
        const dropletCount = Math.max(3, Math.round(5 * effectScale));
        for (let i = 0; i < dropletCount; i += 1) {
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 4, 4),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false })
            );
            mesh.position.set(
                position.x + (Math.random() - 0.5),
                position.y + Math.random(),
                position.z + (Math.random() - 0.5)
            );
            mesh.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2.0,
                1.0 + Math.random() * 1.2,
                (Math.random() - 0.5) * 2.0
            );
            group.add(mesh);
        }
        addToScene(scene, group);
        return new TransientEffect(scene, group, 0.35, ({ meshes, dt, t }) => {
            const g = meshes[0];
            g.children.forEach((child) => {
                child.userData.velocity.y -= 8.0 * dt;
                child.position.addScaledVector(child.userData.velocity, dt);
                child.material.opacity = 0.95 * (1 - t);
            });
        });
    }

    if (type === 'smoke_cloud') {
        const group = new THREE.Group();
        const radius = Number.isFinite(options.radius) && options.radius > 0
            ? options.radius
            : null;
        const cloudRadius = radius || 2.0;
        const cloudCount = Math.max(4, Math.round(10 * effectScale));
        for (let i = 0; i < cloudCount; i += 1) {
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 8, 8),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false })
            );
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * Math.max(0, cloudRadius - 0.5);
            mesh.position.set(
                position.x + Math.cos(angle) * distance,
                position.y + Math.random() * 2.0,
                position.z + Math.sin(angle) * distance
            );
            mesh.userData.drift = new THREE.Vector3(
                (Math.random() - 0.5) * 0.35,
                0.6 + Math.random() * 0.9,
                (Math.random() - 0.5) * 0.35
            );
            group.add(mesh);
        }

        if (radius) {
            const boundary = new THREE.Mesh(
                new THREE.RingGeometry(Math.max(0.2, radius - 0.3), radius, 40),
                createPulseRingMaterial(color, 0.38)
            );
            boundary.rotation.x = -Math.PI / 2;
            boundary.position.copy(position);
            boundary.position.y += 0.06;
            boundary.userData.gameplayRadius = radius;
            boundary.userData.isGameplayBoundary = true;
            group.add(boundary);
        }
        addToScene(scene, group);
        return new TransientEffect(scene, group, 1.15, ({ meshes, dt, t }) => {
            const g = meshes[0];
            g.children.forEach((child) => {
                if (child.userData.isGameplayBoundary) {
                    child.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.015);
                    child.material.uniforms.uTime.value += dt;
                    child.material.uniforms.uOpacity.value = 0.38 * (1 - t);
                    return;
                }
                child.position.addScaledVector(child.userData.drift, dt);
                child.scale.multiplyScalar(1 + dt * 0.7);
                child.material.opacity = 0.8 * (1 - t);
            });
        });
    }

    if (type === 'ground_circle') {
        const radius = Number.isFinite(options.radius) && options.radius > 0 ? options.radius : 5.0;
        const mesh = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 32),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        mesh.userData.gameplayRadius = radius;
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(position);
        mesh.position.y += 0.05;
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, 8.0, ({ meshes, t }) => {
            const m = meshes[0];
            m.material.opacity = 0.3 * (1 - t * 0.2);
        });
    }

    if (type === 'sphere') {
        const radius = Math.max(0.25, Number.isFinite(options.radius) ? options.radius : 1.0);
        const duration = Math.max(0.1, Number.isFinite(options.duration) ? options.duration : 0.8);
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 16, 16),
            createEnergySphereMaterial(color, 0.5)
        );
        mesh.position.copy(position);
        mesh.position.y += 1.0;
        addToScene(scene, mesh);
        return new TransientEffect(scene, mesh, duration, ({ meshes, t }) => {
            const m = meshes[0];
            m.scale.setScalar(1 + t * 2.2);
            m.material.uniforms.uTime.value = t * 3.0;
            m.material.uniforms.uOpacity.value = 0.5 * (1 - t);
        });
    }

    if (type === 'beam') {
        const start = options.source && options.source.position
            ? options.source.position.clone().add(new THREE.Vector3(0, 1.5, 0))
            : position.clone().add(new THREE.Vector3(0, 1.0, 0));
        const end = position.clone();
        if (end.y < start.y - 0.5) end.y = start.y;
        const direction = end.clone().sub(start);
        const range = Math.max(0.001, direction.length());
        direction.normalize();

        const beamGeo = new THREE.CylinderGeometry(0.22, 0.22, range, 10);
        beamGeo.rotateX(-Math.PI / 2);
        const beamMat = createBeamMaterial(color, 0.82);
        const beamMesh = new THREE.Mesh(beamGeo, beamMat);
        const midPoint = start.clone().add(direction.multiplyScalar(range / 2));
        beamMesh.position.copy(midPoint);
        beamMesh.lookAt(end);
        addToScene(scene, beamMesh);

        return new TransientEffect(scene, beamMesh, 0.35, ({ meshes, t }) => {
            const m = meshes[0];
            const shrink = 1 - t * 0.85;
            m.scale.set(Math.max(0.08, shrink), 1, Math.max(0.08, shrink));
            m.material.uniforms.uTime.value = t * 2.0;
            m.material.uniforms.uOpacity.value = (0.82 + (quality === 'high' ? 0.1 : 0.0)) * (1 - t);
        });
    }

    if (type === 'cone' || type === 'cone_large') {
        const forward = getForwardVector(options);
        const isLarge = type === 'cone_large';
        const baseCount = isLarge ? 30 : 6;
        const count = Math.max(isLarge ? 12 : 4, Math.round(baseCount * effectScale));
        const life = isLarge ? 0.9 : 0.65;
        const hasExactRadius = Number.isFinite(options.radius) && options.radius > 0;
        const radius = hasExactRadius
            ? options.radius
            : (isLarge ? 18.0 : 6.5);
        const speed = radius / life;
        const totalArc = Number.isFinite(options.arc) && options.arc > 0
            ? options.arc
            : (isLarge ? Math.PI / 2 : Math.PI / 4);
        const group = new THREE.Group();

        for (let i = 0; i < count; i += 1) {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(isLarge ? 0.5 : 0.2, isLarge ? 0.5 : 0.2, isLarge ? 1.5 : 0.5),
                createEnergyShardMaterial(color, 0.95)
            );
            mesh.position.copy(position);
            mesh.position.y += 1.0;

            const angle = count <= 1 ? 0 : ((i / (count - 1)) - 0.5) * totalArc;
            const dir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
            mesh.lookAt(mesh.position.clone().add(dir));
            mesh.userData.dir = dir;
            mesh.userData.speed = hasExactRadius ? speed : speed * (0.85 + Math.random() * 0.3);
            mesh.userData.gameplayRadius = radius;
            group.add(mesh);
        }

        addToScene(scene, group);
        return new TransientEffect(scene, group, life, ({ meshes, dt, t }) => {
            const g = meshes[0];
            g.children.forEach((child) => {
                child.position.addScaledVector(child.userData.dir, child.userData.speed * dt);
                child.scale.multiplyScalar(1 - dt * (isLarge ? 1.4 : 1.8));
                child.material.uniforms.uTime.value += dt;
                child.material.uniforms.uOpacity.value = 0.95 * (1 - t);
            });
        });
    }

    if (type === 'telegraph') {
        const radius = (options && options.radius) || 10.0;
        const telegraphDuration = (options && options.telegraphDuration) || 2.0;
        const theme = getTelegraphTheme(options);

        // Outer warning ring
        const ringGeo = new THREE.RingGeometry(radius * 0.92, radius, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color: theme.ringColor,
            transparent: true,
            opacity: theme.ringOpacity,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(position);
        ring.position.y += 0.06;

        // Inner fill disc
        const fillGeo = new THREE.CircleGeometry(radius, 48);
        const fillMat = new THREE.MeshBasicMaterial({
            color: theme.fillColor,
            transparent: true,
            opacity: theme.fillOpacity,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const fill = new THREE.Mesh(fillGeo, fillMat);
        fill.rotation.x = -Math.PI / 2;
        fill.position.copy(position);
        fill.position.y += 0.05;

        const motif = createDungeonTelegraphMotif(
            options?.theme,
            radius,
            position,
            theme.motifColor || theme.ringColor
        );
        if (motif) {
            motif.userData.attack = options?.attack || '';
        }

        const label = createTelegraphLabelSprite(options.label, theme.labelColor);
        if (label) {
            label.position.copy(position);
            label.position.y += 2.6;
        }

        const telegraphMeshes = [ring, fill];
        if (motif) telegraphMeshes.push(motif);
        if (label) telegraphMeshes.push(label);
        addToScene(scene, telegraphMeshes);
        return new TransientEffect(scene, telegraphMeshes, telegraphDuration, ({ t }) => {
            // Pulsing opacity — gets more urgent near the end
            const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
            ring.material.opacity = (theme.ringOpacity + theme.ringPulseBoost * t) * pulse;
            // Fill grows more opaque as impact approaches
            fill.material.opacity = theme.fillOpacity + theme.fillPulseBoost * t;
            // Slight scale pulse
            const s = 1.0 - 0.04 * Math.sin(t * Math.PI * 8);
            ring.scale.set(s, s, s);
            if (motif) {
                motif.rotation.y = t * Math.PI * 0.22;
                motif.scale.setScalar(0.96 + (0.08 * t) + (0.02 * pulse));
                motif.traverse((part) => {
                    if (part.material) part.material.opacity = 0.44 + (0.38 * t) + (0.1 * pulse);
                });
            }
            if (label?.material) {
                label.material.opacity = 0.72 + 0.2 * pulse;
                const labelPulse = 1.0 + (0.04 * pulse);
                const [baseWidth, baseHeight] = label.userData.baseScale || [6.5, 1.8];
                label.scale.set(baseWidth * labelPulse, baseHeight * labelPulse, 1);
            }
        });
    }

    return null;
}
