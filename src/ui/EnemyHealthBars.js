import { Vector3 } from 'three';

// Values reconcile only when combat state changes. Projection follows rendered
// meshes every frame, independently of the slower health/network updates.
export class EnemyHealthBars {
    constructor(container, bars, mobile = false) {
        this.container = container;
        this.bars = bars;
        this.limit = mobile ? 12 : 24;
        this.records = new Map();
        this.pool = [];
        this.point = new Vector3();
        this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    }

    reconcile(entities, hovered, reveal, target, now = performance.now()) {
        const active = new Set();
        for (const entity of entities) {
            const hp = Number(entity.stats?.hp), max = Number(entity.stats?.maxHp);
            if (!entity.mesh || entity.isActive === false || entity.state === 'DEAD'
                || !Number.isFinite(hp) || !Number.isFinite(max) || hp <= 0 || max <= 0) continue;
            const selected = target?.id === entity.id || hovered?.id === entity.id;
            if (!reveal && !selected && hp >= max) continue;
            active.add(entity.id);
            const ratio = Math.min(1, hp / max);
            let record = this.records.get(entity.id);
            if (!record || record.entity !== entity || record.max !== max) {
                record = { entity, ratio, from: ratio, changedAt: now, max };
                this.records.set(entity.id, record);
            } else if (ratio !== record.ratio) {
                record.from = ratio < record.ratio ? this.trailRatio(record, now) : ratio;
                record.ratio = ratio;
                record.changedAt = now;
            }
            record.selected = selected;
            record.priority = target?.id === entity.id ? 0 : hovered?.id === entity.id ? 1 : hp < max ? 2 : 3;
        }
        for (const id of this.records.keys()) if (!active.has(id)) this.records.delete(id);
    }

    trailRatio(record, now) {
        if (this.reducedMotion?.matches) return record.ratio;
        const t = Math.min(1, Math.max(0, (now - record.changedAt - 140) / 320));
        return record.ratio + Math.max(0, record.from - record.ratio) * (1 - t) ** 2;
    }

    createBar() {
        const bar = document.createElement('div'); bar.className = 'floating-bar';
        bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0');
        const trail = document.createElement('div'); trail.className = 'floating-loss';
        const fill = document.createElement('div'); fill.className = 'floating-fill';
        bar.append(trail, fill); bar._fill = fill; bar._trail = trail;
        this.container.appendChild(bar);
        return bar;
    }

    updatePositions(camera, now = performance.now()) {
        if (!this.container || !camera?.isCamera) return;
        camera.updateMatrixWorld();
        const width = window.innerWidth, height = window.innerHeight, candidates = [];
        for (const [id, record] of this.records) {
            const entity = record.entity, mesh = entity.mesh;
            if (!mesh || mesh.visible === false || entity.isActive === false || entity.state === 'DEAD' || entity.stats.hp <= 0) continue;
            const declaredHeight = Number(mesh.userData.bounds?.height);
            this.point.set(0, (declaredHeight > 0 ? declaredHeight : 2.5) + .18, 0);
            // localToWorld uses the interpolated root, including elite scale,
            // jump and visual correction. Logical actor positions stay untouched.
            mesh.localToWorld(this.point); this.point.project(camera);
            if (!Number.isFinite(this.point.x + this.point.y + this.point.z) || Math.abs(this.point.z) > 1) continue;
            const x = (this.point.x + 1) * width / 2, y = (1 - this.point.y) * height / 2;
            const halfWidth = record.selected ? 46 : 35;
            if (x - halfWidth < 0 || x + halfWidth > width || y < 5 || y > height - 5) continue;
            candidates.push({ id, record, x, y });
        }
        // Selected targets survive crowd limits. Within each priority preserve
        // stable ids, avoiding rapid swaps as enemies take tiny steps.
        candidates.sort((a, b) => a.record.priority - b.record.priority || a.id.localeCompare(b.id));
        const visible = candidates.slice(0, this.limit), ids = new Set(visible.map(value => value.id));
        for (const [id, bar] of this.bars) {
            if (ids.has(id)) continue;
            bar.style.display = 'none'; this.bars.delete(id);
            if (this.pool.length < this.limit) this.pool.push(bar); else bar.remove();
        }
        for (const { id, record, x, y } of visible) {
            let bar = this.bars.get(id);
            if (!bar) { bar = this.pool.pop() || this.createBar(); this.bars.set(id, bar); }
            bar.style.display = 'block'; bar.dataset.entityId = id;
            bar.classList.toggle('floating-bar--selected', record.selected);
            bar.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -50%)`;
            bar._fill.style.transform = `scaleX(${record.ratio})`;
            bar._trail.style.transform = `scaleX(${this.trailRatio(record, now)})`;
            const hp = Math.min(record.max, Math.max(0, Number(record.entity.stats.hp)));
            const label = `${record.entity.name || 'Enemy'} health`;
            // Avoid re-announcing or writing unchanged accessibility values.
            const signature = `${label}|${hp}|${record.max}`;
            if (bar._valueSignature !== signature) {
                bar.setAttribute('aria-label', label); bar.setAttribute('aria-valuemax', String(record.max));
                bar.setAttribute('aria-valuenow', String(hp)); bar._valueSignature = signature;
            }
        }
    }

    clear() {
        for (const bar of this.bars.values()) bar.remove();
        for (const bar of this.pool) bar.remove();
        this.bars.clear(); this.pool.length = 0; this.records.clear();
    }
}
