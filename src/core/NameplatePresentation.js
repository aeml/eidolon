import { Vector3 } from 'three';

const LABEL_HEIGHT = 22;
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// Stable, bounded screen-space layout. Priority always beats previous visibility;
// within a distance band, keep an existing label to avoid crowd flicker.
export function chooseNameplates(candidates, limit = 12) {
    const chosen = [];
    const ordered = [...candidates].sort((a, b) => a.priority - b.priority ||
        Math.floor(a.distance / 10) - Math.floor(b.distance / 10) ||
        Number(b.wasVisible) - Number(a.wasVisible) || String(a.id).localeCompare(String(b.id)));
    for (const candidate of ordered) {
        if (chosen.length >= limit) break;
        if (!chosen.some(other => overlaps(candidate, other))) chosen.push(candidate);
    }
    return new Set(chosen.map(candidate => candidate.id));
}

export class NameplatePresentation {
    constructor() {
        this.position = new Vector3();
        this.parentScale = new Vector3();
        this.markerPosition = new Vector3();
        this.markerScale = new Vector3();
        this.visibleIds = new Set();
        this.suspended = false;
    }

    update(entities, { camera, width, height, player, target, isInteractable, mobile = false }) {
        if (this.suspended || !camera?.isOrthographicCamera || !(width > 0 && height > 0)) return;
        camera.updateMatrixWorld();
        const worldPerPixel = (camera.top - camera.bottom) / camera.zoom / height;
        const worldHeight = worldPerPixel * LABEL_HEIGHT;
        const candidates = [];
        for (const entity of entities) {
            const tag = entity.nameTag;
            if (!tag?.parent) continue;
            tag.visible = false;
            if (!entity.isActive || entity.state === 'DEAD' || entity.mesh?.visible === false) continue;
            tag.userData.nameplateAnchor ||= tag.position.clone();
            tag.position.copy(tag.userData.nameplateAnchor);
            tag.getWorldPosition(this.position);
            this.position.project(camera);
            if (Math.abs(this.position.z) > 1 || Math.abs(this.position.x) > 1 || Math.abs(this.position.y) > 1) continue;
            const aspect = tag.material?.map?.image?.width / tag.material?.map?.image?.height;
            if (!Number.isFinite(aspect) || aspect <= 0) continue;
            tag.parent.getWorldScale(this.parentScale);
            if (!(this.parentScale.x > 0 && this.parentScale.y > 0)) continue;
            tag.scale.set(worldHeight * aspect / this.parentScale.x, worldHeight / this.parentScale.y, 1);
            const x = (this.position.x + 1) * width / 2;
            // Keep the enlarged text above the head, and above (not across)
            // an NPC's independent gold/blue quest marker. Move only this sprite.
            let y = (1 - this.position.y) * height / 2 - LABEL_HEIGHT / 2;
            if (entity.questMarker?.visible) {
                entity.questMarker.getWorldPosition(this.markerPosition).project(camera);
                entity.questMarker.getWorldScale(this.markerScale);
                y = Math.min(y, (1 - this.markerPosition.y) * height / 2 -
                    this.markerScale.y / worldPerPixel / 2 - LABEL_HEIGHT / 2 - 4);
            }
            this.position.y = 1 - y * 2 / height;
            this.position.unproject(camera);
            tag.position.copy(tag.parent.worldToLocal(this.position));
            const halfWidth = LABEL_HEIGHT * aspect / 2 + 3, halfHeight = LABEL_HEIGHT / 2 + 3;
            const bounds = { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
            if (bounds.left < 0 || bounds.right > width || bounds.top < 0 || bounds.bottom > height) continue;
            const priority = entity === target ? 0 : isInteractable?.(entity) ? 1
                : entity._partyHighlightActive ? 2 : entity === player ? 3 : 4;
            tag.material.color.setHex(entity === target ? 0xffdd89 : 0xffffff);
            candidates.push({ ...bounds, id: entity.id, priority,
                distance: player?.position?.distanceTo(entity.position) || 0,
                wasVisible: this.visibleIds.has(entity.id), tag });
        }
        this.visibleIds = chooseNameplates(candidates, mobile ? 8 : 12);
        for (const candidate of candidates) candidate.tag.visible = this.visibleIds.has(candidate.id);
    }
}
