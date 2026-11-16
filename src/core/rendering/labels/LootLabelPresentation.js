import { Vector3 } from 'three';

const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// Labels move in the camera plane, never the item or its pickup volume. Keep
// a bounded local fan so a crowded pile cannot cover the entire game view.
export function arrangeLootLabels(candidates, { width, height, rowHeight, limit, exclusions = [] }) {
    const placed = [], occupied = [...exclusions];
    const ordered = [...candidates].sort((a, b) => Number(b.selected) - Number(a.selected)
        || Math.floor(a.distance / 10) - Math.floor(b.distance / 10) || String(a.id).localeCompare(String(b.id)));
    for (const item of ordered) {
        if (placed.length >= limit) break;
        const x = Math.max(item.width / 2 + 4, Math.min(width - item.width / 2 - 4, item.x));
        const rows = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6];
        if (rows.includes(item.row)) rows.unshift(...rows.splice(rows.indexOf(item.row), 1));
        for (const row of rows) {
            const y = item.y + row * (rowHeight + 4);
            const rect = { left: x - item.width / 2 - 2, right: x + item.width / 2 + 2,
                top: y - rowHeight / 2 - 2, bottom: y + rowHeight / 2 + 2 };
            if (rect.left < 0 || rect.right > width || rect.top < 4 || rect.bottom > height - 4
                || occupied.some(other => intersects(rect, other))) continue;
            placed.push({ ...item, x, y, row }); occupied.push(rect); break;
        }
    }
    return placed;
}

export class LootLabelPresentation {
    constructor() {
        this.point = new Vector3(); this.scale = new Vector3(); this.head = new Vector3();
        this.rows = new Map();
    }

    update(entities, { camera, width, height, player, target, mobile = false }) {
        if (!camera?.isOrthographicCamera || !(width > 0 && height > 0)) return;
        camera.updateMatrixWorld();
        const rowHeight = mobile ? 32 : 26;
        const worldPerPixel = (camera.top - camera.bottom) / camera.zoom / height;
        const candidates = [], exclusions = [];
        if (player?.mesh?.visible !== false && player?.mesh) {
            player.mesh.localToWorld(this.point.set(0, 0, 0)).project(camera);
            player.mesh.localToWorld(this.head.set(0, player.mesh.userData.bounds?.height || 3, 0)).project(camera);
            if (Math.abs(this.point.z) < 1) {
                const x = (this.point.x + 1) * width / 2;
                exclusions.push({ left: x - 26, right: x + 26,
                    top: (1 - this.head.y) * height / 2 - 8, bottom: (1 - this.point.y) * height / 2 + 8 });
            }
        }
        for (const entity of entities) {
            const tag = entity.label;
            if (!tag?.isSprite || tag.name !== 'LootLabel' || !tag.parent) continue;
            tag.visible = false;
            if (entity.isActive === false || entity.mesh?.visible === false) continue;
            // Always start at the physical drop, not last frame's displaced label.
            tag.parent.localToWorld(this.point.set(0, 1.38, 0)).project(camera);
            if (!Number.isFinite(this.point.x + this.point.y + this.point.z)
                || Math.abs(this.point.z) > 1 || Math.abs(this.point.x) > 1 || Math.abs(this.point.y) > 1) continue;
            const image = tag.material.map?.image, aspect = image?.width / image?.height;
            if (!(aspect > 0)) continue;
            const labelWidth = Math.min(rowHeight * aspect, width - 12);
            candidates.push({ id: entity.id, entity, tag, width: labelWidth, row: this.rows.get(entity.id),
                x: (this.point.x + 1) * width / 2, y: (1 - this.point.y) * height / 2, z: this.point.z,
                selected: entity === target, distance: player?.position?.distanceTo(entity.position) || 0 });
        }
        const layout = arrangeLootLabels(candidates, { width, height, rowHeight, limit: mobile ? 12 : 24, exclusions });
        this.rows = new Map(layout.map(item => [item.id, item.row]));
        for (const { tag, x, y, z, width: labelWidth, selected } of layout) {
            tag.parent.getWorldScale(this.scale);
            if (!(this.scale.x > 0 && this.scale.y > 0)) continue;
            tag.scale.set(labelWidth * worldPerPixel / this.scale.x, rowHeight * worldPerPixel / this.scale.y, 1);
            this.point.set(x / width * 2 - 1, 1 - y / height * 2, z).unproject(camera);
            tag.position.copy(tag.parent.worldToLocal(this.point));
            tag.material.opacity = selected ? 1 : .94;
            tag.visible = true;
            tag.updateWorldMatrix(true, false);
        }
    }
}
