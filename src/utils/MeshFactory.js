import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONSTANTS } from '../core/Constants.js';

export class MeshFactory {
    static loader = new GLTFLoader();
    static cache = {};

    static async loadModel(path) {
        // We don't clone the scene here because we need the raw GLTF object for animations sometimes
        // But for caching purposes, we should probably cache the GLTF object
        if (this.cache[path]) return this.cache[path];
        
        return new Promise((resolve, reject) => {
            this.loader.load(path, (gltf) => {
                this.cache[path] = gltf;
                resolve(gltf);
            }, undefined, reject);
        });
    }

    static async createMeshForType(type) {
        let geometry, material, mesh;

        // Try to load GLB for Fighter first
        if (type === 'Fighter') {
            try {
                // Load Base Mesh (Idle)
                const idleGltf = await this.loadModel('./assets/archetypes/Fighter/idle.glb');
                // Use SkeletonUtils to clone properly, preserving bone/skin connections
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                console.log("Structure of loaded mesh:");
                mesh.traverse((node) => {
                    console.log(` - ${node.name} [${node.type}]`);
                    if (node.isMesh) {
                        console.log(`   > Material: ${node.material ? node.material.name : 'none'}`);
                        console.log(`   > Geometry: ${node.geometry.type}`);
                    }
                });

                // Initialize animations array
                mesh.userData.animations = [];

                // Helper to add animation
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        // Strip scale tracks to prevent size popping between animations
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                // Add Idle Animation
                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                } else {
                    console.warn("MeshFactory: No animations found in idle.glb");
                }

                // Load and Add Walk
                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Fighter/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                // Load and Add Run
                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Fighter/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                // Load and Add Attack
                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Fighter/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); // Reduced scale from 10 to 2.5
                
                // Restore original materials but ensure they react to light
                mesh.traverse(c => {
                    if (c.isMesh) {
                        // If the model has no material, give it a default one
                        if (!c.material) {
                            c.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                        }
                        // Ensure shadows are enabled
                        c.castShadow = true;
                        c.receiveShadow = true;
                        c.frustumCulled = false;
                    }
                });
                
                // Ensure mesh is centered
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                if (size.length() === 0) {
                    console.error("MeshFactory: Mesh has ZERO size! It might be empty or scale 0.");
                }

                mesh.position.sub(center); // Center the mesh at 0,0,0
                mesh.position.y += size.y / 2; // Lift to sit on ground

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
            }
        }

        // Try to load GLB for Wizard
        if (type === 'Wizard') {
            try {
                // Load Base Mesh (Idle)
                const idleGltf = await this.loadModel('./assets/archetypes/Wizard/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                // Initialize animations array
                mesh.userData.animations = [];

                // Helper to add animation
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        // Strip scale tracks to prevent size popping between animations
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                // Add Idle Animation
                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                // Load and Add Walk
                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Wizard/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                // Load and Add Run
                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Wizard/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                // Load and Add Attack
                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Wizard/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                // Restore original materials but ensure they react to light
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
                
                // Ensure mesh is centered
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
            }
        }

        // Try to load GLB for Rogue
        if (type === 'Rogue') {
            try {
                // Load Base Mesh (Idle)
                const idleGltf = await this.loadModel('./assets/archetypes/Rogue/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                // Initialize animations array
                mesh.userData.animations = [];

                // Helper to add animation
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        // Strip scale tracks to prevent size popping between animations
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                // Add Idle Animation
                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                // Load and Add Walk
                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Rogue/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                // Load and Add Run
                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Rogue/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                // Load and Add Attack
                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Rogue/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                // Restore original materials but ensure they react to light
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
                
                // Ensure mesh is centered
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
            }
        }

        // Try to load GLB for Cleric
        if (type === 'Cleric') {
            try {
                // Load Base Mesh (Idle)
                const idleGltf = await this.loadModel('./assets/archetypes/Cleric/idle.glb');
                mesh = SkeletonUtils.clone(idleGltf.scene);
                
                // Initialize animations array
                mesh.userData.animations = [];

                // Helper to add animation
                const addAnim = (clip, name) => {
                    if (clip) {
                        const newClip = clip.clone();
                        newClip.name = name;
                        // Strip scale tracks to prevent size popping between animations
                        newClip.tracks = newClip.tracks.filter(t => !t.name.endsWith('.scale'));
                        mesh.userData.animations.push(newClip);
                    }
                };

                // Add Idle Animation
                if (idleGltf.animations.length > 0) {
                    addAnim(idleGltf.animations[0], 'Idle');
                }

                // Load and Add Walk
                try {
                    const walkGltf = await this.loadModel('./assets/archetypes/Cleric/walk.glb');
                    if (walkGltf.animations.length > 0) addAnim(walkGltf.animations[0], 'Walk');
                } catch (e) { console.warn("Missing walk anim"); }

                // Load and Add Run
                try {
                    const runGltf = await this.loadModel('./assets/archetypes/Cleric/run.glb');
                    if (runGltf.animations.length > 0) addAnim(runGltf.animations[0], 'Run');
                } catch (e) { console.warn("Missing run anim"); }

                // Load and Add Attack
                try {
                    const attackGltf = await this.loadModel('./assets/archetypes/Cleric/attack.glb');
                    if (attackGltf.animations.length > 0) addAnim(attackGltf.animations[0], 'Attack');
                } catch (e) { console.warn("Missing attack anim"); }

                mesh.scale.set(2.5, 2.5, 2.5); 
                
                // Restore original materials but ensure they react to light
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
                
                // Ensure mesh is centered
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                mesh.position.sub(center); 
                mesh.position.y += size.y / 2; 

                return mesh;
            } catch (e) {
                console.warn(`Failed to load model for ${type}, falling back to primitive.`, e);
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
        // Lift up so it sits on ground (assuming height ~1)
        mesh.position.y = 0.5; 
        return mesh;
    }
}