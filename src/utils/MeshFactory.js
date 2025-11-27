import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONSTANTS } from '../core/Constants.js';

export class MeshFactory {
    static loader = new GLTFLoader();
    static cache = {};
    static pool = {};

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
                        c.frustumCulled = false;
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
                        c.frustumCulled = false;
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
                        c.frustumCulled = false;
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
                        c.frustumCulled = false;
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
                        c.frustumCulled = false;
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
                        c.frustumCulled = false;
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
                        c.frustumCulled = false;
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
                        c.frustumCulled = false;
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
        }

        switch (type) {
            case 'Fighter':
                geometry = new THREE.BoxGeometry(1, 1, 1);
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.FIGHTER.COLOR });
                break;
            case 'Rogue':
                geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.ROGUE.COLOR });
                break;
            case 'Wizard':
                geometry = new THREE.ConeGeometry(0.5, 1.5, 8);
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.WIZARD.COLOR });
                break;
            case 'Cleric':
                geometry = new THREE.SphereGeometry(0.6, 16, 16);
                material = new THREE.MeshStandardMaterial({ color: CONSTANTS.ENTITIES.CLERIC.COLOR });
                break;
            default:
                geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        }

        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.y = 0.5; 
        return mesh;
    }
}