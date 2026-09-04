import * as THREE from 'three';
import { MeshFactory } from '../utils/MeshFactory.js';

const NAME_TEXTURE_CACHE = new Map();

export class Entity {
    constructor(id) {
        this.id = id || crypto.randomUUID();
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        this.previousPosition = new THREE.Vector3();
        this.previousRotation = new THREE.Quaternion();
        this.renderPosition = new THREE.Vector3();
        this.renderRotation = new THREE.Quaternion();
        this._transformHistoryReady = false;
        this.isActive = true;
        this.mesh = null;
        this.meshType = null;
        this.isMeshLoading = false;
        this.scale = 1.0;
        this.guildId = '';
        this.guildTag = '';
    }

    async ensureMesh() {
        if (this.mesh || this.isMeshLoading || !this.meshType) return;
        
        this.isMeshLoading = true;
        try {
            // console.log(`Entity ${this.id} loading mesh type ${this.meshType}...`);
            const mesh = await MeshFactory.createMeshForType(this.meshType);
            if (mesh) {
                if (!this.isActive) {
                    // Entity died/removed while loading
                    MeshFactory.releaseMesh(this.meshType, mesh);
                    return;
                }
                this.setMesh(mesh);
            }
        } catch (e) {
            console.error(`Entity ${this.id} failed to load mesh ${this.meshType}`, e);
        } finally {
            this.isMeshLoading = false;
        }
    }

    setScale(scale) {
        this.scale = scale;
        if (this.mesh) {
            if (!this.mesh.userData.baseScale) {
                this.mesh.userData.baseScale = this.mesh.scale.clone();
            }
            const s = (this.scale && this.scale > 0) ? this.scale : 1.0;
            this.mesh.scale.copy(this.mesh.userData.baseScale).multiplyScalar(s);
        }
    }

    update(dt) {
    }

    capturePreviousTransform() {
        this.previousPosition.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this._transformHistoryReady = true;
    }

    resetTransformInterpolation() {
        this.previousPosition.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this.renderPosition.copy(this.position);
        this.renderRotation.copy(this.rotation);
        this._transformHistoryReady = true;
    }

    render(interpolation) {
        if (this.mesh) {
            if (!this._transformHistoryReady) this.resetTransformInterpolation();
            const alpha = Math.max(0, Math.min(1, Number(interpolation) || 0));
            this.renderPosition.lerpVectors(this.previousPosition, this.position, alpha);
            this.renderRotation.copy(this.previousRotation).slerp(this.rotation, alpha);
            this.mesh.position.copy(this.renderPosition);
            if (this.visualOffset) this.mesh.position.add(this.visualOffset);
            this.mesh.quaternion.copy(this.renderRotation);
        }
    }
    
    setMesh(mesh) {
        this.mesh = mesh;
        this.resetTransformInterpolation();
        this.mesh.userData.entityId = this.id;
        
        if (!this.mesh.userData.baseScale) {
            this.mesh.userData.baseScale = this.mesh.scale.clone();
        }
        const s = (this.scale && this.scale > 0) ? this.scale : 1.0;
        this.mesh.scale.copy(this.mesh.userData.baseScale).multiplyScalar(s);
        
        if (this.modifyMesh) {
            this.modifyMesh(mesh);
        }

        if (this.name) {
            this.updateNameTag();
        }

        // Restore party ring if party highlight was set before mesh loaded.
        if (this._partyHighlightActive) {
            this._updatePartyRing();
        }
        if (this._pvpHostileActive) {
            this._updatePvPRing();
        }

        if (this.onMeshReady) {
            this.onMeshReady(mesh);
            this.onMeshReady = null; // Clear callback
        }
    }

    setName(name) {
        this.name = name;
        if (this.mesh) {
            this.updateNameTag();
        }
    }

    // -----------------------------------------------------------------------
    // Party member highlight (0.37.2)
    // -----------------------------------------------------------------------

    /**
     * Show or hide a teal ground ring that marks this entity as a party member
     * of the local player.  Safe to call before the mesh has loaded — the ring
     * will be attached when setMesh() fires.
     * @param {boolean} active
     */
    setPartyHighlight(active) {
        active = Boolean(active);
        if (active === Boolean(this._partyHighlightActive)) return; // no-op
        this._partyHighlightActive = active;
        if (this.mesh) this._updatePartyRing();
    }

    _updatePartyRing() {
        if (!this.mesh) return;
        const NAME = 'PartyRing';
        const existing = this.mesh.getObjectByName(NAME);
        if (this._partyHighlightActive) {
            if (!existing) {
                const declaredRadius = Number(this.mesh.userData.bounds?.radius) || 0;
                const innerRadius = declaredRadius ? declaredRadius * 0.75 : 0.55;
                const outerRadius = declaredRadius ? declaredRadius * 1.05 : 0.75;
                const ring = new THREE.Mesh(
                    new THREE.RingGeometry(innerRadius, outerRadius, 32),
                    new THREE.MeshBasicMaterial({
                        color: 0x44ff88,
                        transparent: true,
                        opacity: 0.7,
                        side: THREE.DoubleSide
                    })
                );
                ring.name = NAME;
                ring.rotation.x = -Math.PI / 2;
                ring.position.y = 0.05; // just above ground
                this.mesh.add(ring);
            }
        } else {
            if (existing) {
                existing.geometry?.dispose();
                existing.material?.dispose();
                this.mesh.remove(existing);
            }
        }
    }

    setGuildIdentity(guildId, guildTag) {
        const nextId = guildId || '';
        const nextTag = guildTag || '';
        if (this.guildId === nextId && this.guildTag === nextTag) return;
        this.guildId = nextId;
        this.guildTag = nextTag;
        if (this.mesh && this.name) this.updateNameTag();
    }

    setPvPHostile(active) {
        this._pvpHostileActive = Boolean(active);
        if (this.mesh) this._updatePvPRing();
    }

    _updatePvPRing() {
        if (!this.mesh) return;
        const name = 'PvPHostileRing';
        const existing = this.mesh.getObjectByName(name);
        if (this._pvpHostileActive && !existing) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.78, 1.0, 32),
                new THREE.MeshBasicMaterial({ color: 0xff3f4f, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
            );
            ring.name = name;
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.06;
            this.mesh.add(ring);
        } else if (!this._pvpHostileActive && existing) {
            existing.geometry?.dispose();
            existing.material?.dispose();
            this.mesh.remove(existing);
        }
    }

    updateNameTag() {
        if (!this.mesh || !this.name) return;

        // Remove existing name tag
        const existingTag = this.mesh.getObjectByName("NameTag");
        if (existingTag) {
            if (existingTag.material) {
                // Do NOT dispose map here as it might be cached
                existingTag.material.dispose();
            }
            this.mesh.remove(existingTag);
        }

        const displayName = this.guildTag ? `[${this.guildTag}] ${this.name}` : this.name;
        let texture = NAME_TEXTURE_CACHE.get(displayName);
        let width, height;

        if (!texture) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontSize = 32; // Higher resolution for texture
            context.font = `bold ${fontSize}px Arial`;
            const textWidth = context.measureText(displayName).width;
            
            canvas.width = textWidth + 20;
            canvas.height = fontSize + 20;
            
            context.font = `bold ${fontSize}px Arial`;
            context.fillStyle = "white";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.strokeStyle = 'black';
            context.lineWidth = 4;
            context.strokeText(displayName, canvas.width / 2, canvas.height / 2);
            context.fillText(displayName, canvas.width / 2, canvas.height / 2);

            texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            
            if (NAME_TEXTURE_CACHE.size > 200) {
                NAME_TEXTURE_CACHE.forEach(t => t.dispose());
                NAME_TEXTURE_CACHE.clear();
            }
            NAME_TEXTURE_CACHE.set(displayName, texture);
            
            width = canvas.width;
            height = canvas.height;
        } else {
            width = texture.image.width;
            height = texture.image.height;
        }
        
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        
        sprite.name = "NameTag";
        const declaredHeight = Number(this.mesh.userData.bounds?.height) || 0;
        sprite.position.set(0, declaredHeight ? declaredHeight + 0.35 : 2.5, 0);
        
        // Scale based on aspect ratio to prevent distortion
        // User wanted "smaller", so we reduce the world-space height
        const scaleHeight = declaredHeight ? 0.48 : 0.4;
        const scaleWidth = (width / height) * scaleHeight;
        
        sprite.scale.set(scaleWidth, scaleHeight, 1); 
        
        this.mesh.add(sprite);
    }

    dispose() {
        if (this.mesh) {
            // Dispose NameTag
            const nameTag = this.mesh.getObjectByName("NameTag");
            if (nameTag) {
                // Only dispose material, texture is cached
                if (nameTag.material) nameTag.material.dispose();
            }

            // Dispose PartyRing
            const partyRing = this.mesh.getObjectByName("PartyRing");
            if (partyRing) {
                partyRing.geometry?.dispose();
                partyRing.material?.dispose();
            }

            // Remove from parent
            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }

            // Release to pool if applicable
            if (this.meshType && !this.isElite) {
                MeshFactory.releaseMesh(this.meshType, this.mesh);
            }
            
            this.mesh = null;
        }
    }
}
