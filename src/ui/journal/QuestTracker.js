const node = (tag, className = '') => {
    const element = document.createElement(tag); element.className = className; return element;
};
const text = (element, value) => {
    const next = value == null ? '' : String(value);
    if (element.textContent !== next) element.textContent = next;
};

// Tracker cards remain mounted through progress snapshots. Changed objectives
// and retired readers lose their callbacks instead of acting on stale data.
export class QuestTracker {
    constructor(ui) {
        this.ui = ui; this.panel = ui.objectivesPanel; this.list = ui.objectivesList;
        this.rows = new Map(); this.epoch = 0;
        this.panel?._questTracker?.dispose();
        if (this.panel) this.panel._questTracker = this;
        this.list?.replaceChildren();
    }
    identity() {
        const player = this.ui.ctx.getLastPlayer?.();
        return player?.id || player?.characterId || null;
    }
    current(epoch) {
        return !this.disposed && !this.ui.disposed && epoch === this.epoch
            && this.panel?._questTracker === this && this.panel.isConnected && this.list?.isConnected
            && this.playerId === this.identity() && this.mobile === Boolean(this.ui.ctx.isMobile)
            && this.ui.activeQuestSummary.length > 0;
    }
    clear() {
        this.epoch++;
        for (const row of this.rows.values()) row.item.remove();
        this.rows.clear(); this.more?.remove(); this.controls?.remove();
        this.more = this.controls = this.next = null; this.ui.objectiveSignature = null;
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.clear();
        if (this.panel?._questTracker === this) delete this.panel._questTracker;
    }
    createRow(key, interactive) {
        const epoch = this.epoch;
        const row = { item: node(interactive ? 'button' : 'div', 'objective-entry'),
            titleWrap: node('span', 'objective-entry__title-wrap'), title: node('span', 'objective-entry__title'),
            status: node('span', 'objective-entry__status'), fill: node('div', 'objective-entry__progress-fill'),
            hint: node('div', 'objective-entry__hint') };
        const header = node('div', 'objective-entry__header'), progress = node('div', 'objective-entry__progress');
        row.titleWrap.append(row.title); header.append(row.titleWrap, row.status); progress.append(row.fill);
        row.item.append(header, progress, row.hint);
        if (interactive) {
            row.item.type = 'button';
            row.item.onclick = () => {
                if (!this.current(epoch) || this.rows.get(key) !== row || row.item.parentNode !== this.list) return;
                this.ui.openTrackedObjective(row.objective);
            };
        }
        this.rows.set(key, row); return row;
    }
    update(summary) {
        if (this.disposed || !this.panel || !this.list || this.panel._questTracker !== this) return;
        const ui = this.ui;
        ui.activeQuestSummary = Array.isArray(summary) ? summary : [];
        const tracked = ui.getTrackedObjectives(), mobile = Boolean(ui.ctx.isMobile), playerId = this.identity();
        if (this.playerId !== playerId || this.mobile !== mobile) {
            this.clear(); this.playerId = playerId; this.mobile = mobile;
        }
        const phoneIndex = Math.max(0, tracked.findIndex(objective => ui.questTrackingKey(objective) === ui.phoneObjectiveKey));
        const visible = mobile ? tracked.slice(phoneIndex, phoneIndex + 1) : tracked;
        const signature = JSON.stringify([ui.activeQuestSummary, tracked, ui.trackingStorageKey, mobile, phoneIndex]);
        if (ui.objectiveSignature === signature) return;
        ui.objectiveSignature = signature;
        const scrollTop = this.list.scrollTop;
        this.panel.style.display = ui.activeQuestSummary.length > 0 ? 'flex' : 'none';
        const heading = this.panel.querySelector('.objectives-panel__header');
        if (heading) text(heading, mobile && tracked.length ? `TRACKED · ${phoneIndex + 1} / ${tracked.length}` : `TRACKED · ${tracked.length}`);
        if (!ui.activeQuestSummary.length) { this.clear(); ui.objectiveSignature = signature; return; }
        const entries = visible.map((objective, index) => {
            const interactive = mobile || (ui.lastJournalQuests || []).some(quest => quest?.id === objective.id);
            const key = JSON.stringify([objective.id ?? objective.title ?? index, interactive]);
            return { objective, index, interactive, key };
        });
        const present = new Set(entries.map(entry => entry.key));
        for (const [key, row] of this.rows) if (!present.has(key)) { row.item.remove(); this.rows.delete(key); }
        let cursor = this.list.firstChild;
        entries.forEach(({ objective, index, interactive, key }) => {
            const row = this.rows.get(key) || this.createRow(key, interactive);
            row.objective = objective;
            row.item.className = `objective-entry ${objective.routeTone ? `is-${objective.routeTone}` : ''}`.trim();
            row.item.title = [objective.title, objective.completed ? 'Ready' : objective.progressLabel, objective.hint].filter(Boolean).join(' · ');
            if (interactive) row.item.setAttribute('aria-label', `Open journal: ${objective.title} · ${objective.completed ? 'Ready' : objective.progressLabel || ''}`);
            if (objective.badge) {
                if (!row.badge) { row.badge = node('span'); row.titleWrap.prepend(row.badge); }
                row.badge.className = `objective-entry__badge ${objective.badgeClass || ''}`.trim(); text(row.badge, objective.badge);
            } else { row.badge?.remove(); row.badge = null; }
            text(row.title, objective.title); text(row.status, objective.completed ? 'Ready' : objective.progressLabel);
            row.status.classList.toggle('is-complete', Boolean(objective.completed));
            row.fill.classList.toggle('is-complete', Boolean(objective.completed));
            row.fill.style.width = `${Math.max(0, Math.min(100, Number(objective.progressPct) || 0))}%`;
            text(row.hint, objective.completed && objective.badgeClass !== 'is-exit'
                ? `${objective.hint} · ${objective.rewardLabel || ui.getQuestRewardLabel(objective)}` : objective.hint);
            const guidance = !mobile && index === 0 && !objective.badge?.startsWith('Story') && objective.badge !== 'Daily';
            const guidanceSignature = JSON.stringify([guidance, objective.cadenceLabel, objective.sequenceHint]);
            row.item.classList.toggle('objective-guidance', guidance);
            if (row.guidanceSignature !== guidanceSignature) {
                row.item.querySelectorAll('.objective-guidance__heading,.objective-guidance__cadence,.objective-guidance__sequence,.objective-guidance__footer')
                    .forEach(element => element.remove());
                if (guidance) ui.renderObjectiveGuidance(objective, row.item);
                row.guidanceSignature = guidanceSignature;
            }
            if (row.item !== cursor) this.list.insertBefore(row.item, cursor);
            cursor = row.item.nextSibling;
        });
        this.updateNavigation(tracked, visible, phoneIndex);
        this.list.scrollTop = scrollTop;
    }
    updateNavigation(tracked, visible, phoneIndex) {
        const ui = this.ui, epoch = this.epoch;
        if (!this.more) {
            const more = this.more = node('button', 'objectives-panel__more'); more.type = 'button';
            text(more, this.mobile ? 'Journal' : 'Track quests · Journal (J)');
            more.onclick = () => { if (this.current(epoch) && more.isConnected && this.more === more) ui.toggleJournal(); };
        }
        if (!this.mobile) { if (this.more.parentNode !== this.panel) this.panel.append(this.more); return; }
        if (!this.controls) { this.controls = node('div', 'phone-objectives-controls'); this.panel.append(this.controls); }
        if (!visible.length) { if (this.more.parentNode !== this.controls) this.controls.prepend(this.more); }
        else this.more.remove();
        if (tracked.length > 1) {
            if (!this.next) {
                const next = this.next = node('button', 'phone-objectives-next'); next.type = 'button'; text(next, '›');
                next.setAttribute('aria-label', 'Show next tracked objective');
                next.onclick = () => {
                    if (!this.current(epoch) || this.next !== next || !next.isConnected) return;
                    const latest = ui.getTrackedObjectives(); if (latest.length < 2) return;
                    const index = Math.max(0, latest.findIndex(objective => ui.questTrackingKey(objective) === ui.phoneObjectiveKey));
                    ui.phoneObjectiveKey = ui.questTrackingKey(latest[(index + 1) % latest.length]);
                    ui.renderObjectivesPanel(ui.activeQuestSummary); this.next?.focus({ preventScroll: true });
                };
                this.controls.append(next);
            }
            this.next.title = `${phoneIndex + 1} of ${tracked.length} tracked objectives`;
        } else { this.next?.remove(); this.next = null; }
    }
}
