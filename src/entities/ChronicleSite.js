import { Entity } from './Entity.js';
import { chronicleInvestigations } from '../data/chronicleInvestigations.generated.js';
import { getRecordedChronicleDiscoveries } from '../core/ChronicleInvestigation.js';
import { createChronicleSiteModel, getChronicleSiteColliders } from '../art/ChronicleSiteModels.js';

const sites = new Map(chronicleInvestigations.flatMap(chapter => chapter.sites
    .filter(site => site.kind === 'inspect').map(site => [site.entityId, { chapter, site }])));

// A readable landmark is not an Actor: targeting it cannot consume attacks.
export class ChronicleSite extends Entity {
    constructor(id) {
        super(id);
        this.type = 'ChronicleSite';
        this.discovery = sites.get(id);
        this.name = this.discovery?.site.title || 'Chronicle discovery';
    }

    async ensureMesh() {
        if (this.mesh || !this.isActive || !this.discovery) return;
        this.siteModel = createChronicleSiteModel(this.discovery.site, this.discovery.chapter.realm);
        this.setMesh(this.siteModel.mesh);
        this.mesh.position.copy(this.position);
        this.mesh.quaternion.copy(this.rotation);
        const manager = this.gameEngine?.collisionManager;
        if (manager) {
            const colliders = getChronicleSiteColliders(this.mesh, this.siteModel.walls);
            colliders.forEach(collider => manager.addOrientedCollider(collider));
            this.clearWalkCollider = () => colliders.forEach(collider => manager.removeOrientedCollider(collider));
        }
        this.update();
    }

    update() {
        if (!this.siteModel) return;
        const quest = this.gameEngine?.player?.quests?.find(value => value.id === this.discovery.chapter.id);
        const recorded = getRecordedChronicleDiscoveries(quest);
        const prerequisiteRecorded = Boolean(this.discovery.site.requires &&
            recorded.some(site => site.id === this.discovery.site.requires));
        if (this.siteModel.boundEmber && this.siteModel.releasedEmber) {
            this.siteModel.boundEmber.visible = !prerequisiteRecorded;
            this.siteModel.releasedEmber.visible = prerequisiteRecorded;
        }
        this.siteModel.beacon.visible = Boolean(quest?.accepted && !quest.completed
            && !recorded.some(site => site.id === this.discovery.site.id)
            && (!this.discovery.site.requires || prerequisiteRecorded));
    }

    dispose() {
        super.dispose();
        this.siteModel?.dispose();
        this.siteModel = null;
    }
}
