import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONSTANTS } from '../core/Constants.js';

export class MeshFactory {
    static loader = new GLTFLoader();
    static cache = {};
    static pool = {};

    // Cache for primitive geometries to avoid recreation and leaks
    static geometryCache = {
        fighter: new THREE.BoxGeometry(1, 1, 1),
        rogue: new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8),
        wizard: new THREE.ConeGeometry(0.5, 1.5, 8),
        cleric: new THREE.SphereGeometry(0.6, 16, 16),
        default: new THREE.BoxGeometry(0.5, 0.5, 0.5),
        fence: new THREE.BoxGeometry(4.5, 8, 1.5),
        questNPC: new THREE.BoxGeometry(1, 2, 1),
        stash: new THREE.BoxGeometry(1.5, 1.5, 1.5),
        seraph: new THREE.CylinderGeometry(0.5, 0.5, 2, 8)
    };

    static getPooledMesh(type) {
        if (this.pool[type] && this.pool[type].length > 0) {
            const mesh = this.pool[type].pop();
            mesh.visible = true;
            return mesh;
        }
        return null;
    }

    static releaseMesh(type, mesh) {
        if (!mesh) return;
        if (!this.pool[type]) this.pool[type] = [];
        
        mesh.visible = false;
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        if (mesh.parent) mesh.parent.remove(mesh);
        
        if (this.pool[type].length < 50) {
            this.pool[type].push(mesh);
        } else {
            // Pool is full, dispose of the mesh resources
            // We only dispose materials, as geometries are either shared (GLTF) or cached (Primitives)
            mesh.traverse((child) => {
                if (child.isMesh) {
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                    // DO NOT dispose geometry as it is likely shared
                }
            });
        }
    }

    static async loadModel(path) {
        if (this.cache[path]) return this.cache[path];
        
        return new Promise((resolve, reject) => {
            this.loader.load(path, (gltf) => {
                this.cache[path] = gltf;
                resolve(gltf);
            }, undefined, reject);
        });
    }

    static async createMeshForType(type) {
        const pooled = this.getPooledMesh(type);
        if (pooled) return pooled;

        let geometry, material, mesh;
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;

        if (type === 'Fighter') {
            try {
                const idleGltf = await this.loadModel('./assets/archetypes/Fighter/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                console.log("Structure of loaded mesh:");
                mesh.traverse((node) => {
                    console.log(` - ${node.name} [${node.type}]`);
                    if (node.isMesh) {
                        console.log(`   > Material: ${node.material ? node.material.name : 'none'}`);
                        console.log(`   > Geometry: ${node.geometry.type}`);
                    }
                });

                mesh.userData.animations = [];

                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                } else {
                    console.warn("MeshFactory: No animations found in idle.glb");
                }

                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Fighter/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Fighter/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Fighter/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // c.frustumCulled = false;
                    }
                });
                
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                if (size.length() === 0) {
                    console.error("MeshFactory: Mesh has ZERO size! It might be empty or scale 0.");
                }

                mesh.position.sub(center);
                mesh.position.y += size.y / 2;

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
                const geometry = new THREE.BoxGeometry(1, 1, 1);
                const material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.FIGHTER.COLOR });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.5;
                return mesh;
            }
        }

        if (type === 'Wizard') {
            try {
                const idleGltf = await this.loadModel('./assets/archetypes/Wizard/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];

                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Wizard/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Wizard/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Wizard/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // c.frustumCulled = false;
                    }
                });
                
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
                const geometry = new THREE.ConeGeometry(0.5, 1.5, 8);
                const material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.WIZARD.COLOR });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.75;
                return mesh;
            }
        }

        if (type === 'Rogue') {
            try {
                const idleGltf = await this.loadModel('./assets/archetypes/Rogue/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];

                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Rogue/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Rogue/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Rogue/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // c.frustumCulled = false;
                    }
                });
                
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
                const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
                const material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.ROGUE.COLOR });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.75;
                return mesh;
            }
        }

        if (type === 'Cleric') {
            try {
                const idleGltf = await this.loadModel('./assets/archetypes/Cleric/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];

                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Cleric/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Cleric/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Cleric/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // c.frustumCulled = false;
                    }
                });
                
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                const hitGeo = new THREE.BoxGeometry(1.5, 2.0, 1.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 0.9;
                mesh.add(hitMesh);

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
                const geometry = new THREE.SphereGeometry(0.6, 16, 16);
                const material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.CLERIC.COLOR });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.6;
                return mesh;
            }
        }

        if (type === 'Skeleton') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/undead/skeleton/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/undead/skeleton/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/undead/skeleton/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/undead/skeleton/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/undead/skeleton/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // c.frustumCulled = false;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.0, 2.5, 2.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.0;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load Skeleton:", e);
            }
        }

        if (type === 'DemonOrc') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/demons/demon_orc/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/demons/demon_orc/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/demons/demon_orc/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/demons/demon_orc/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/demons/demon_orc/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.0, 3.0, 3.0);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // c.frustumCulled = false;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.0;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load DemonOrc:", e);
                const geometry = new THREE.BoxGeometry(1.5, 2, 1.5);
                const material = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1;
                return mesh;
            }
        } else if (type === 'Imp') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/demons/imp/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/demons/imp/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/demons/imp/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/demons/imp/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/demons/imp/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(1.8, 1.8, 1.8);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // c.frustumCulled = false;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 0.75;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load Imp:", e);
                const geometry = new THREE.BoxGeometry(0.8, 1, 0.8);
                const material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 0.5;
                return mesh;
            }
        } else if (type === 'DwarfSalesman') {
            try {
                const gltf = await this.loadModel('./assets/npc/dwarf_salesman/idle.glb');
                mesh = SkeletonUtils.clone(gltf.scene);
                
                mesh.userData.animations = [];
                if (gltf.animations.length > 0) {
                    const clip = gltf.animations[0].clone();
                    clip.name = 'Idle';
                    mesh.userData.animations.push(clip);
                }

                mesh.scale.set(2.0, 2.0, 2.0);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.5, 3.5, 2.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.5;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load DwarfSalesman:", err);
                geometry = new THREE.BoxGeometry(1, 1.5, 1);
                material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        } else if (type === 'Construct') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/undead/construct/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/undead/construct/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/undead/construct/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/undead/construct/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0x555555 });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // c.frustumCulled = false;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.5;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load Construct:", e);
                const geometry = new THREE.BoxGeometry(1.5, 2.5, 1.5);
                const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.25;
                return mesh;
            }
        } else if (type === 'InfernoTitan') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/demons/inferno_titan/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(4.0, 4.0, 4.0);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.0;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load InfernoTitan:", e);
                const geometry = new THREE.BoxGeometry(2.0, 3.5, 2.0);
                const material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.75;
                return mesh;
            }
        } else if (type === 'RootboundWarden') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}
                try {
                    const runGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}
                try {
                    const attackGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}
                try {
                    const deathGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rootbound_warden/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                return mesh;
            } catch (e) {
                console.error("Failed to load RootboundWarden:", e);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshStandardMaterial({ color: 0x006400 }));
                return mesh;
            }
        } else if (type === 'BriarMatron') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}
                try {
                    const runGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}
                try {
                    const attackGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}
                try {
                    const deathGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/briar_matron/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.0, 2.0, 2.0);
                mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                return mesh;
            } catch (e) {
                console.error("Failed to load BriarMatron:", e);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.5), new THREE.MeshStandardMaterial({ color: 0x8B0000 }));
                return mesh;
            }
        } else if (type === 'RustboundColossus') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}
                try {
                    const runGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}
                try {
                    const attackGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}
                try {
                    const deathGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/rustbound_colossus/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.5, 3.5, 3.5);
                mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                return mesh;
            } catch (e) {
                console.error("Failed to load RustboundColossus:", e);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 3), new THREE.MeshStandardMaterial({ color: 0xA0522D }));
                return mesh;
            }
        } else if (type === 'HollowSentinel') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}
                try {
                    const runGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}
                try {
                    const attackGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}
                try {
                    const deathGltf = await this.loadModel('./assets/enemies/dungeon/verdant_bastion_catacombs/hollow_sentinel/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.0, 3.0, 3.0);
                mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                return mesh;
            } catch (e) {
                console.error("Failed to load HollowSentinel:", e);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4.5, 2.5), new THREE.MeshStandardMaterial({ color: 0x708090 }));
                return mesh;
            }
        } else if (type === 'Siren') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/snow/siren/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/snow/siren/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/snow/siren/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/snow/siren/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/snow/siren/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0x00ffff });
                        }
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(1.5, 2.5, 1.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.25;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load Siren:", e);
                const geometry = new THREE.BoxGeometry(1.0, 2.0, 1.0);
                const material = new THREE.MeshStandardMaterial({ color: 0x00ffff });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.0;
                return mesh;
            }
        } else if (type === 'AquaGolem') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/golems/aqua_golem/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.5;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load AquaGolem:", e);
                const geometry = new THREE.BoxGeometry(2.0, 3.0, 2.0);
                const material = new THREE.MeshStandardMaterial({ color: 0x0088ff });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.5;
                return mesh;
            }
        } else if (type === 'MountainTroll') {
            try {
                const idleGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/humanoid/mountain_troll/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.0, 3.0, 3.0); 
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(3.0, 3.5, 3.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.75;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load MountainTroll:", e);
                const geometry = new THREE.BoxGeometry(2.5, 3.5, 2.5);
                const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.75;
                return mesh;
            }
        } else if (type === 'FrostGuardian') {
            try {
                // Reuse Construct model but with Ice styling
                const idleGltf = await this.loadModel('./assets/enemies/undead/construct/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/enemies/undead/construct/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/enemies/undead/construct/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/enemies/undead/construct/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(3.0, 3.0, 3.0); // Slightly larger than Construct
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        // Force Ice Material
                        c.material = new THREE.MeshStandardMaterial({ 
                            color: 0x00FFFF, // Cyan/Ice
                            metalness: 0.8,
                            roughness: 0.2
                        });
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(3.0, 3.5, 3.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.75;
                mesh.add(hitMesh);
                
                return mesh;
            } catch (e) {
                console.error("Failed to load FrostGuardian:", e);
                const geometry = new THREE.BoxGeometry(2.0, 3.0, 2.0);
                const material = new THREE.MeshStandardMaterial({ color: 0x00FFFF });
                mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.position.y = 1.5;
                return mesh;
            }
        } else if (type === 'AvengingSeraph') {
            console.log("MeshFactory: Loading AvengingSeraph model...");
            try {
                // Try loading from folder structure first
                const idleGltf = await this.loadModel('./assets/summons/avenging_seraph/idle.glb');
                console.log("MeshFactory: Loaded AvengingSeraph idle.glb");
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                mesh.userData.animations = [];
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                if (idleGltf.animations.length > 0) addAnim(idleGltf.animations[0], 'Idle');

                try {
                    const walkGltf = await this.loadModel('./assets/summons/avenging_seraph/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) {}

                try {
                    const runGltf = await this.loadModel('./assets/summons/avenging_seraph/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) {}

                try {
                    const attackGltf = await this.loadModel('./assets/summons/avenging_seraph/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) {}

                try {
                    const deathGltf = await this.loadModel('./assets/summons/avenging_seraph/death.glb');
                    if (deathGltf.animations.length > 0) addAnim(deathGltf.animations[0], 'Death');
                } catch (e) {}

                mesh.scale.set(2.5, 2.5, 2.5);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                        // Make it glow a bit
                        if (c.material) {
                            c.material.emissive = new THREE.Color(0xffd700);
                            c.material.emissiveIntensity = 0.2;
                        }
                    }
                });

                return mesh;
            } catch (e) {
                console.warn("Failed to load AvengingSeraph from folder, trying single file...", e);
                try {
                    // Try single file
                    const gltf = await this.loadModel('./assets/summons/avenging_seraph.glb');
                    console.log("MeshFactory: Loaded AvengingSeraph single file");
                    mesh = SkeletonUtils.clone(gltf.scene);
                    mesh.scale.set(2.5, 2.5, 2.5);
                    return mesh;
                } catch (e2) {
                    console.error("Failed to load AvengingSeraph (all attempts):", e2);
                    // Fallback to simple geometry
                    const geometry = this.geometryCache.seraph;
                    const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
                    mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = 1.0;
                    return mesh;
                }
            }
        } else if (type === 'Fence') {
            const geometry = this.geometryCache.fence;
            const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown
            mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.position.y = 4.0;
            return mesh;
        } else if (type === 'QuestNPC') {
            try {
                const gltf = await this.loadModel('./assets/npc/quest_man/idle.glb');
                mesh = SkeletonUtils.clone(gltf.scene);
                
                mesh.userData.animations = [];
                if (gltf.animations.length > 0) {
                    const clip = gltf.animations[0].clone();
                    clip.name = 'Idle';
                    mesh.userData.animations.push(clip);
                }

                mesh.scale.set(2.0, 2.0, 2.0);
                
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                const hitGeo = new THREE.BoxGeometry(1.5, 3.5, 1.5);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.75;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load QuestNPC:", err);
                geometry = this.geometryCache.questNPC;
                material = new THREE.MeshStandardMaterial({ color: 0x0000FF });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        } else if (type === 'TradingHouse') {
            try {
                const gltf = await this.loadModel('./assets/buildings/trading_house.glb');
                const model = SkeletonUtils.clone(gltf.scene);
                
                // Scale 7.8x (matching WorldGenerator)
                model.scale.set(7.8, 7.8, 7.8);
                
                model.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                // Calculate bounding box to center and ground the mesh
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                model.position.sub(center); // Center at 0,0,0
                model.position.y += size.y / 2; // Move up so bottom is at 0
                model.position.y -= 0.5; // Slight sink to blend with ground

                // Wrapper Group to persist offset
                mesh = new THREE.Group();
                mesh.add(model);

                // Hitbox (Invisible, for clicking)
                // Make it roughly the size of the building
                const hitGeo = new THREE.BoxGeometry(12, 12, 12);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 6.0;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load TradingHouse:", err);
                geometry = new THREE.BoxGeometry(10, 10, 10);
                material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        } else if (type === 'Stash') {
            try {
                const gltf = await this.loadModel('./assets/objects/chests/stash_base.glb');
                const model = SkeletonUtils.clone(gltf.scene);
                
                model.scale.set(2.0, 2.0, 2.0);
                
                model.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                // Calculate bounding box to center and ground the mesh
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                model.position.sub(center); // Center at 0,0,0
                model.position.y += size.y / 2 + 0.2; // Move up so bottom is at 0

                // Wrapper Group to persist offset
                mesh = new THREE.Group();
                mesh.add(model);

                const hitGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 1.0;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load Stash:", err);
                geometry = this.geometryCache.stash;
                material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        } else if (type === 'Forge') {
            try {
                const gltf = await this.loadModel('./assets/buildings/blacksmith_forge.glb');
                const model = SkeletonUtils.clone(gltf.scene);
                
                model.scale.set(4.0, 4.0, 4.0);
                
                model.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });

                // Calculate bounding box to center and ground the mesh
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                model.position.sub(center); // Center at 0,0,0
                model.position.y += size.y / 2; // Move up so bottom is at 0

                // Wrapper Group to persist offset
                mesh = new THREE.Group();
                mesh.add(model);

                // Hitbox
                const hitGeo = new THREE.BoxGeometry(4.0, 4.0, 4.0);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 2.0;
                mesh.add(hitMesh);

                return mesh;
            } catch (err) {
                console.error("Failed to load Forge:", err);
                geometry = new THREE.BoxGeometry(2, 2, 2);
                material = new THREE.MeshStandardMaterial({ color: 0x555555 });
                mesh = new THREE.Mesh(geometry, material);
                return mesh;
            }
        }

        switch (type) {
            case 'Fighter':
                geometry = this.geometryCache.fighter;
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.FIGHTER.COLOR });
                break;
            case 'Rogue':
                geometry = this.geometryCache.rogue;
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.ROGUE.COLOR });
                break;
            case 'Wizard':
                geometry = this.geometryCache.wizard;
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.WIZARD.COLOR });
                break;
            case 'Cleric':
                geometry = this.geometryCache.cleric;
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.CLERIC.COLOR });
                break;
            default:
                geometry = this.geometryCache.default;
                material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        }

        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.y = 0.5; 
        return mesh;
    }
}