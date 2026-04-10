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
        if (isHidden) {
            this.ctx.closePrimaryHudMenus?.({ except: 'journal' });
        }
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

    isPlayerInTown(player = this.ctx.getLastPlayer?.()) {
        if (!player?.position) return false;
        const x = Number(player.position.x);
        const z = Number(player.position.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
        return x >= -100 && x <= 100 && z >= 100 && z <= 300;
    }

    buildStarterTownObjective(quests) {
        const hasAcceptedQuest = Array.isArray(quests) && quests.some((q) => q?.accepted && !q?.completed);
        if (hasAcceptedQuest) return null;
        if (this.ctx.getCurrentInstanceId?.()) return null;
        if ((this.ctx.getCurrentInstanceType?.() || 'overworld') !== 'overworld') return null;
        if (!this.isPlayerInTown()) return null;

        return {
            id: 'starter-town-quest-giver',
            title: 'Meet the Quest Giver',
            progressLabel: 'Town',
            progressPct: 5,
            rewardXP: 0,
            completed: false,
            badge: 'Town',
            badgeClass: 'is-objective',
            routeTone: 'support',
            hint: 'Head to the Quest Giver by the Forge. Open World Map (M) or Journal (J) if you need a reminder, use the Stash to sort gear, sell junk to Vendor / Repair, and save valuable drops for the Trading House before heading out.'
        };
    }

    buildDungeonRouteSequenceHint(summary, objectiveRoom) {
        if (!summary || !Array.isArray(summary.rooms) || !objectiveRoom) {
            return '';
        }

        const currentObjectiveIndex = typeof objectiveRoom.index === 'number'
            ? objectiveRoom.index
            : Number(summary.objectiveRoomIndex);
        if (!Number.isFinite(currentObjectiveIndex)) {
            return '';
        }

        const nextMeaningfulRoom = Array.isArray(summary.rooms)
            ? summary.rooms.find((room) => room
                && typeof room.index === 'number'
                && room.index > currentObjectiveIndex
                && !room.cleared
                && (room.hook === 'elite_ambush' || room.hook === 'shrine' || room.hook === 'chest' || room.type === 'elite' || room.type === 'boss'))
            : null;

        const labelForRoom = (room) => {
            if (!room) return null;
            if (room.hook === 'chest') return 'Chest';
            if (room.hook === 'elite_ambush') return 'Ambush';
            if (room.hook === 'shrine') return 'Shrine';
            if (room.type === 'boss') return 'Boss';
            if (room.type === 'elite') return 'Elite';
            if (room.index === currentObjectiveIndex && nextMeaningfulRoom?.hook === 'shrine') return 'Approach';
            if (room.index === currentObjectiveIndex && nextMeaningfulRoom?.type === 'boss') return 'Approach';
            return null;
        };

        const orderedBeats = summary.rooms
            .filter((room) => room && typeof room.index === 'number' && room.index >= currentObjectiveIndex && !room.cleared)
            .map((room) => labelForRoom(room))
            .filter(Boolean)
            .filter((label, index, labels) => labels.indexOf(label) === index);

        return orderedBeats.length >= 2 ? `Route: ${orderedBeats.join(' -> ')}` : '';
    }

    buildDungeonRoutingObjective() {
        const instanceId = this.ctx.getCurrentInstanceId?.();
        const summary = this.ctx.getDungeonRoomSummary?.();
        if (!instanceId || !summary || !Array.isArray(summary.rooms) || summary.rooms.length === 0) {
            return null;
        }

        const instanceType = this.ctx.getCurrentInstanceType?.() || 'dungeon';
        const objectiveRoom = typeof summary.objectiveRoomIndex === 'number' && summary.objectiveRoomIndex >= 0
            ? summary.rooms.find((room) => room && room.index === summary.objectiveRoomIndex)
            : null;

        const clearedCount = summary.rooms.filter((room) => room?.cleared && room.type !== 'start').length;
        const traversableRooms = summary.rooms.filter((room) => room && room.type !== 'start');
        const totalProgressRooms = Math.max(1, traversableRooms.length);
        const progressLabel = `${Math.min(clearedCount, totalProgressRooms)} / ${totalProgressRooms}`;
        const progressPct = Math.min(100, (Math.min(clearedCount, totalProgressRooms) / totalProgressRooms) * 100);
        const isLiveBossObjective = objectiveRoom?.type === 'boss'
            && typeof summary.currentRoomIndex === 'number'
            && typeof summary.objectiveRoomIndex === 'number'
            && summary.currentRoomIndex === objectiveRoom.index
            && summary.objectiveRoomIndex === objectiveRoom.index;
        const sequenceHint = isLiveBossObjective ? '' : this.buildDungeonRouteSequenceHint(summary, objectiveRoom);

        if (!objectiveRoom) {
            return {
                id: `dungeon-route-${instanceType}`,
                title: 'Extract through the entrance',
                progressLabel,
                progressPct,
                rewardXP: 0,
                completed: true,
                badge: 'Exit',
                badgeClass: 'is-exit',
                routeTone: 'support',
                hint: 'Boss down — backtrack to the entrance and leave with the loot',
                sequenceHint: ''
            };
        }

        const nextUnclearedBeat = objectiveRoom
            ? summary.rooms.find((room) => room
                && typeof room.index === 'number'
                && room.index > objectiveRoom.index
                && !room.cleared
                && (room.hook === 'elite_ambush' || room.hook === 'shrine' || room.hook === 'chest' || room.type === 'elite' || room.type === 'boss'))
            : null;

        if (objectiveRoom.hook === 'shrine') {
            return {
                id: `dungeon-route-${instanceType}`,
                title: 'Reach the shrine room',
                progressLabel,
                progressPct,
                rewardXP: 0,
                completed: false,
                badge: 'Shrine',
                badgeClass: 'is-shrine',
                routeTone: 'support',
                hint: nextUnclearedBeat?.type === 'boss'
                    ? 'Last reset before the boss push'
                    : objectiveRoom.explored
                        ? 'Shrine discovered'
                        : 'A restorative shrine lies ahead',
                sequenceHint
            };
        }

        if (objectiveRoom.hook === 'chest') {
            return {
                id: `dungeon-route-${instanceType}`,
                title: 'Secure the treasure room',
                progressLabel,
                progressPct,
                rewardXP: 0,
                completed: false,
                badge: 'Chest',
                badgeClass: 'is-chest',
                routeTone: 'support',
                hint: nextUnclearedBeat?.hook === 'elite_ambush'
                    ? 'Quick score before the ambush spike'
                    : objectiveRoom.explored
                        ? 'Treasure room discovered'
                        : 'Treasure cache detected deeper inside',
                sequenceHint
            };
        }

        if (objectiveRoom.hook === 'elite_ambush') {
            return {
                id: `dungeon-route-${instanceType}`,
                title: 'Survive the ambush room',
                progressLabel,
                progressPct,
                rewardXP: 0,
                completed: false,
                badge: 'Ambush',
                badgeClass: 'is-ambush',
                routeTone: 'warning',
                hint: 'Elite room ahead — pressure spike incoming',
                sequenceHint
            };
        }

        if (objectiveRoom.type === 'boss') {
            return {
                id: `dungeon-route-${instanceType}`,
                title: isLiveBossObjective ? 'Survive the boss fight' : 'Confront the boss',
                progressLabel,
                progressPct,
                rewardXP: 0,
                completed: false,
                badge: isLiveBossObjective ? 'Boss Now' : 'Boss',
                badgeClass: 'is-boss',
                routeTone: 'danger',
                hint: isLiveBossObjective
                    ? 'You are in the boss room — commit and survive'
                    : objectiveRoom.explored
                        ? 'Boss room discovered'
                        : 'Push toward the boss room',
                sequenceHint
            };
        }

        if (objectiveRoom.type === 'elite') {
            return {
                id: `dungeon-route-${instanceType}`,
                title: 'Clear the elite room',
                progressLabel,
                progressPct,
                rewardXP: 0,
                completed: false,
                badge: 'Elite',
                badgeClass: 'is-elite',
                routeTone: 'warning',
                hint: objectiveRoom.explored ? 'Elite room discovered' : 'Elite threat ahead',
                sequenceHint
            };
        }

        const unclearedNonBossRooms = traversableRooms.filter((room) => !room.cleared && room.type !== 'boss');
        const remainingRooms = Math.max(1, unclearedNonBossRooms.length);
        const nextMeaningfulRoom = summary.rooms.find((room) => room
            && typeof room.index === 'number'
            && room.index > objectiveRoom.index
            && !room.cleared
            && (room.hook === 'elite_ambush' || room.hook === 'shrine' || room.hook === 'chest' || room.type === 'elite' || room.type === 'boss'));
        const isBridgeToBoss = nextMeaningfulRoom?.type === 'boss' && remainingRooms === 1;
        const isBridgeToShrine = nextMeaningfulRoom?.hook === 'shrine';

        return {
            id: `dungeon-route-${instanceType}`,
            title: isBridgeToBoss
                ? 'Break through the last approach room'
                : isBridgeToShrine
                    ? 'Clear through to the shrine route'
                    : 'Push deeper into the dungeon',
            progressLabel,
            progressPct,
            rewardXP: 0,
            completed: false,
            badge: 'Objective',
            badgeClass: 'is-objective',
            routeTone: 'neutral',
            hint: isBridgeToBoss
                ? 'Boss path open — one last room before the boss'
                : isBridgeToShrine
                    ? `${remainingRooms} rooms remain before the shrine reset`
                    : `Clear ${remainingRooms} more rooms`,
            sequenceHint
        };
    }

    buildObjectiveSummary(quests) {
        const questObjectives = Array.isArray(quests)
            ? quests
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
                })
            : [];

        const dungeonObjective = this.buildDungeonRoutingObjective();
        if (dungeonObjective) {
            return [dungeonObjective, ...questObjectives];
        }

        const starterTownObjective = this.buildStarterTownObjective(quests);
        return starterTownObjective ? [starterTownObjective, ...questObjectives] : questObjectives;
    }

    renderObjectiveGuidance(objective) {
        if (!this.objectivesPanel || !objective) return;

        const existing = this.objectivesPanel.querySelector('.objective-guidance');
        if (existing) existing.remove();

        const guidance = document.createElement('div');
        guidance.className = 'objective-guidance';
        guidance.style.marginBottom = '10px';
        guidance.style.padding = '10px 12px';
        guidance.style.border = '1px solid rgba(255, 215, 90, 0.35)';
        guidance.style.background = 'linear-gradient(180deg, rgba(38, 32, 18, 0.92), rgba(24, 20, 12, 0.92))';
        guidance.style.color = '#ddd';
        guidance.style.fontSize = '12px';
        guidance.style.lineHeight = '1.5';
        const guidanceBody = objective.badgeClass === 'is-exit'
            ? objective.hint
            : objective.completed
                ? `Turn this in for ${objective.rewardXP || 0} XP.`
                : objective.hint;
        guidance.innerHTML = `
            <div style="color: #ffd700; font-size: 11px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px;">Next Step</div>
            <div style="color: #fff; font-size: 13px; font-weight: bold; margin-bottom: 4px;">${objective.title}</div>
            <div>${guidanceBody}</div>
            ${objective.sequenceHint ? `<div style="color: #ffdf8a; margin-top: 6px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase;">${objective.sequenceHint}</div>` : ''}
            <div style="color: #aaa; margin-top: 6px;">Open World Map (M) and Journal (J) if you need to re-orient.</div>
        `;
        if (this.objectivesList.parentNode === this.objectivesPanel) {
            this.objectivesPanel.insertBefore(guidance, this.objectivesList);
        } else {
            this.objectivesPanel.appendChild(guidance);
        }
    }

    renderObjectivesPanel(summary) {
        if (!this.objectivesPanel || !this.objectivesList) return;

        this.activeQuestSummary = Array.isArray(summary) ? summary : [];
        this.objectivesPanel.style.display = this.activeQuestSummary.length > 0 ? 'flex' : 'none';
        this.objectivesList.innerHTML = '';
        this.objectivesPanel.querySelector('.objective-guidance')?.remove();

        if (this.activeQuestSummary.length > 0) {
            this.renderObjectiveGuidance(this.activeQuestSummary[0]);
        }

        this.activeQuestSummary.forEach((objective) => {
            const item = document.createElement('div');
            item.className = `objective-entry ${objective.routeTone ? `is-${objective.routeTone}` : ''}`.trim();
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
