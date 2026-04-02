/**
 * Quest UI module — handles the quest NPC window (accept / turn-in)
 * and the quest journal (active quest progress).
 *
 * Extracted from UIManager to keep each UI domain independently readable.
 * The parent UIManager passes shared helpers via the `ctx` object.
 */
export class QuestUI {
    /**
     * @param {Object} ctx
     * @param {Function} ctx.getLastPlayer – returns current player ref
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.activeQuestSummary = [];

        // --- DOM refs ---
        this.questWindow = document.getElementById('quest-window');
        this.questList = document.getElementById('quest-list');
        this.questJournal = document.getElementById('quest-journal');
        this.journalList = document.getElementById('journal-list');
        this.objectivesPanel = document.getElementById('objectives-panel');
        this.objectivesList = document.getElementById('objectives-list');
        this.btnCloseQuest = document.getElementById('btn-close-quest');
        this.btnCloseJournal = document.getElementById('btn-close-journal');

        // --- Callbacks (set by GameEngine) ---
        this.onAcceptQuest = null;
        this.onCompleteQuest = null;

        // --- Event listeners ---
        if (this.btnCloseQuest) this.btnCloseQuest.addEventListener('click', () => this.toggleQuestWindow());
        if (this.btnCloseJournal) this.btnCloseJournal.addEventListener('click', () => this.toggleJournal());
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    /** Whether the quest NPC window is visible. */
    get isQuestWindowOpen() {
        return this.questWindow &&
               this.questWindow.style.display === 'flex';
    }

    /** Whether the quest journal is visible. */
    get isJournalOpen() {
        return this.questJournal &&
               this.questJournal.style.display === 'flex';
    }

    /** Toggle the quest NPC window. */
    toggleQuestWindow() {
        const isHidden = this.questWindow.style.display === 'none' || this.questWindow.style.display === '';
        this.questWindow.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            const player = this.ctx.getLastPlayer();
            if (player && player.quests) {
                this.updateQuestWindow(player.quests);
            }
        }
    }

    /** Toggle the quest journal. */
    toggleJournal() {
        const isHidden = this.questJournal.style.display === 'none' || this.questJournal.style.display === '';
        this.questJournal.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            const player = this.ctx.getLastPlayer();
            if (player && player.quests) {
                this.updateJournal(player.quests);
            }
        }
    }

    /** Close the quest NPC window if open. */
    closeQuestWindow() {
        if (this.questWindow) this.questWindow.style.display = 'none';
    }

    /** Close the quest journal if open. */
    closeJournal() {
        if (this.questJournal) this.questJournal.style.display = 'none';
    }

    // ================================================================
    // HELPERS
    // ================================================================

    formatQuestTarget(target, maxCount) {
        const targetMap = {
            DungeonBoss: 'Dungeon Boss',
            DungeonBossNormal: 'Dungeon Boss (Normal)',
            DungeonBossHeroic: 'Dungeon Boss (Heroic)',
            DungeonBossMythic: 'Dungeon Boss (Mythic)',
            VerdantBastionBoss: 'Verdant Bastion Boss',
            MoltenCoreBoss: 'Molten Core Boss',
            TempestSpireBoss: 'Tempest Spire Boss',
            AbyssalWellBoss: 'Abyssal Well Boss'
        };

        const label = targetMap[target] || target;
        if (maxCount === 1) return label;
        if (label.includes('Boss')) {
            return label.replace('Boss', 'Bosses');
        }
        if (label.endsWith('s')) return label;
        return `${label}s`;
    }

    buildObjectiveSummary(quests) {
        if (!Array.isArray(quests)) return [];

        return quests
            .filter((q) => q && q.accepted && !q.completed)
            .map((q) => {
                const targetLabel = this.formatQuestTarget(q.target, q.maxCount);
                const remaining = Math.max(0, (q.maxCount || 0) - (q.count || 0));
                return {
                    id: q.id,
                    title: `Kill ${targetLabel}`,
                    progressLabel: `${q.count || 0} / ${q.maxCount || 0}`,
                    progressPct: q.maxCount > 0 ? Math.min(100, ((q.count || 0) / q.maxCount) * 100) : 0,
                    rewardXP: q.rewardXP || 0,
                    completed: Boolean(q.completed || ((q.count || 0) >= (q.maxCount || 0))),
                    hint: remaining > 0 ? `${remaining} remaining` : 'Return to the quest NPC for your reward'
                };
            });
    }

    renderObjectivesPanel(summary) {
        if (!this.objectivesPanel || !this.objectivesList) return;

        this.activeQuestSummary = Array.isArray(summary) ? summary : [];
        this.objectivesPanel.style.display = this.activeQuestSummary.length > 0 ? 'flex' : 'none';
        this.objectivesList.innerHTML = '';

        this.activeQuestSummary.forEach((objective) => {
            const item = document.createElement('div');
            item.className = 'objective-entry';
            const badgeMarkup = objective.badge
                ? `<span class="objective-entry__badge ${objective.badgeClass || ''}">${objective.badge}</span>`
                : '';
            item.innerHTML = `
                <div class="objective-entry__header">
                    <span class="objective-entry__title-wrap">
                        ${badgeMarkup}
                        <span class="objective-entry__title">${objective.title}</span>
                    </span>
                    <span class="objective-entry__status ${objective.completed ? 'is-complete' : ''}">${objective.completed ? 'Ready' : objective.progressLabel}</span>
                </div>
                <div class="objective-entry__progress">
                    <div class="objective-entry__progress-fill ${objective.completed ? 'is-complete' : ''}" style="width: ${objective.progressPct}%;"></div>
                </div>
                <div class="objective-entry__hint">${objective.completed ? `Reward: ${objective.rewardXP} XP` : objective.hint}</div>
            `;
            this.objectivesList.appendChild(item);
        });
    }

    // ================================================================
    // QUEST NPC WINDOW
    // ================================================================

    updateQuestWindow(quests) {
        this.questList.innerHTML = '';
        if (!quests) return;

        quests.forEach(q => {
            if (q.accepted && !q.completed && q.count < q.maxCount) return;
            if (q.completed && q.accepted) {
                // Ready to turn in
            } else if (q.accepted && q.completed) {
                return;
            }

            const div = document.createElement('div');
            div.style.background = '#222';
            div.style.border = '1px solid #444';
            div.style.padding = '10px';
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.gap = '5px';

            let btnHtml = '';
            let statusText = '';
            const targetLabel = this.formatQuestTarget(q.target, q.maxCount);

            if (!q.accepted) {
                statusText = `<div style="color: #ffd700; font-weight: bold;">Daily: Kill ${q.maxCount} ${targetLabel}</div>`;
                btnHtml = `<button class="menu-btn" style="margin-top: 5px; background: #4CAF50; border-color: #45a049;">Accept Quest</button>`;
            } else if (q.accepted && !q.completed && q.count >= q.maxCount) {
                statusText = `<div style="color: #4CAF50; font-weight: bold;">COMPLETE: Kill ${q.maxCount} ${targetLabel}</div>`;
                btnHtml = `<button class="menu-btn" style="margin-top: 5px; background: #FFD700; color: #000; border-color: #FFA000;">Claim Reward</button>`;
            } else {
                return;
            }

            div.innerHTML = `
                ${statusText}
                <div style="color: #aaa; font-size: 12px;">Reward: ${q.rewardXP} XP</div>
                ${btnHtml}
            `;

            const btn = div.querySelector('button');
            btn.onclick = () => {
                if (!q.accepted) {
                    if (this.onAcceptQuest) this.onAcceptQuest(q.id);
                } else {
                    if (this.onCompleteQuest) this.onCompleteQuest(q.id);
                }
            };
            this.questList.appendChild(div);
        });

        if (this.questList.children.length === 0) {
            this.questList.innerHTML = '<div style="color: #888; text-align: center; margin-top: 20px;">No available quests. Check your Journal (J) for active quests.</div>';
        }
    }

    // ================================================================
    // QUEST JOURNAL
    // ================================================================

    updateJournal(quests) {
        this.renderObjectivesPanel(this.buildObjectiveSummary(quests));
        this.journalList.innerHTML = '';

        const infoDiv = document.createElement('div');
        infoDiv.style.color = '#888';
        infoDiv.style.fontSize = '12px';
        infoDiv.style.marginBottom = '15px';
        infoDiv.style.textAlign = 'center';
        infoDiv.style.borderBottom = '1px solid #444';
        infoDiv.style.paddingBottom = '10px';
        infoDiv.textContent = `Daily quests reset at 12:00 AM Eastern Time`;
        this.journalList.appendChild(infoDiv);

        if (!quests) return;
        let hasActive = false;

        quests.forEach(q => {
            if (!q.accepted || q.completed) return;
            hasActive = true;

            const div = document.createElement('div');
            div.style.background = '#222';
            div.style.border = '1px solid #444';
            div.style.padding = '10px';
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.gap = '5px';

            const pct = Math.min(100, (q.count / q.maxCount) * 100);
            const color = q.completed ? '#4CAF50' : '#ffd700';
            const status = q.completed ? 'COMPLETED' : 'IN PROGRESS';
            const targetLabel = this.formatQuestTarget(q.target, q.maxCount);

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #fff; font-weight: bold;">Kill ${targetLabel}</span>
                    <span style="color: ${color}; font-size: 12px;">${status}</span>
                </div>
                <div style="background: #111; height: 10px; border: 1px solid #444; position: relative;">
                    <div style="background: ${color}; width: ${pct}%; height: 100%;"></div>
                    <div style="position: absolute; top: 0; left: 0; width: 100%; text-align: center; font-size: 8px; line-height: 10px; color: #fff;">${q.count} / ${q.maxCount}</div>
                </div>
                <div style="color: #aaa; font-size: 12px;">Reward: ${q.rewardXP} XP</div>
            `;

            if (q.completed) {
                // Turn in at NPC for now
            }
            this.journalList.appendChild(div);
        });

        if (!hasActive) {
            this.journalList.innerHTML = '<div style="color: #888; text-align: center; margin-top: 20px;">No active quests.</div>';
        }
    }
}
