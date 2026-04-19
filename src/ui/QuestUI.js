import {
    findNextDungeonMeaningfulRoom,
    getDungeonCadenceLabel,
    getDungeonRoomRole,
    isLiveDungeonBossRoom
} from '../utils/dungeonRoomMetadata.js';

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

    clearElement(element) {
        element?.replaceChildren();
    }

    createMessage(text, styles = {}) {
        const message = document.createElement('div');
        Object.assign(message.style, styles);
        message.textContent = text;
        return message;
    }

    isPlayerInTown(player = this.ctx.getLastPlayer?.()) {
        if (!player?.position) return false;
        const x = Number(player.position.x);
        const z = Number(player.position.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
        return x >= -100 && x <= 100 && z >= 100 && z <= 300;
    }

    isStarterProgressionWindow(player = this.ctx.getLastPlayer?.()) {
        const level = Number(player?.level);
        return !Number.isFinite(level) || level < 30;
    }

    buildTownRecoveryObjective(quests) {
        const hasAcceptedQuest = Array.isArray(quests) && quests.some((q) => q?.accepted && !q?.completed);
        if (!hasAcceptedQuest) return null;
        if (!this.isStarterProgressionWindow()) return null;
        if (this.ctx.getCurrentInstanceId?.()) return null;
        if ((this.ctx.getCurrentInstanceType?.() || 'overworld') !== 'overworld') return null;
        if (!this.isPlayerInTown()) return null;

        const recovery = this.ctx.getOnboardingRecoveryContext?.() || null;
        const reason = recovery?.reason || 'town_return';
        const copyByReason = {
            respawn: {
                title: 'Recover in town and re-orient',
                hint: 'Respawned in town. Recover at the Stash, Vendor / Repair, or Forge, then open World Map (M) or Journal (J) and head back to your next quest stop.'
            },
            recall: {
                title: 'Re-orient after recalling',
                hint: 'Recalled to town. Sort gear, repair if needed, then open World Map (M) or Journal (J) and pick the route back up.'
            },
            town_return: {
                title: 'Pick up the route again',
                hint: 'Back in town. Open World Map (M) or Journal (J), get your bearings, then head back to the next quest objective.'
            }
        };
        const details = copyByReason[reason] || copyByReason.town_return;

        return {
            id: `starter-town-recovery-${reason}`,
            title: details.title,
            progressLabel: 'Town',
            progressPct: 12,
            rewardXP: 0,
            completed: false,
            badge: 'Town',
            badgeClass: 'is-objective',
            routeTone: 'support',
            hint: details.hint
        };
    }

    buildStarterTownObjective(quests) {
        const hasAcceptedQuest = Array.isArray(quests) && quests.some((q) => q?.accepted && !q?.completed);
        if (hasAcceptedQuest) return null;
        if (!this.isStarterProgressionWindow()) return null;
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
            hint: 'Head to the Quest Giver by the Forge. Open World Map (M) or Journal (J) if you need a reminder, use the Stash to sort gear, vendor obvious Common junk, check stronger drops before selling, and keep Shards, Hearts, and Gems for the Forge before heading out.'
        };
    }

    buildTownProgressionObjective(quests) {
        const hasAcceptedQuest = Array.isArray(quests) && quests.some((q) => q?.accepted && !q?.completed);
        if (hasAcceptedQuest) return null;
        if (this.isStarterProgressionWindow()) return null;
        if (this.ctx.getCurrentInstanceId?.()) return null;
        if ((this.ctx.getCurrentInstanceType?.() || 'overworld') !== 'overworld') return null;
        if (!this.isPlayerInTown()) return null;

        const level = Number(this.ctx.getLastPlayer?.()?.level || 0);
        if (level >= 100) {
            return {
                id: 'town-progression-endgame',
                title: 'Push Heroic and Mythic runs',
                progressLabel: 'Town',
                progressPct: 84,
                rewardXP: 0,
                completed: false,
                badge: 'Endgame',
                badgeClass: 'is-objective',
                routeTone: 'support',
                hint: 'Level 100 unlocked Heroic and Mythic. Visit the Dungeon Guide, choose a difficulty, check your build in Skills (K), and use the Forge before your next push.'
            };
        }

        return {
            id: 'town-progression-dungeon-guide',
            title: 'Check the Dungeon Guide',
            progressLabel: 'Town',
            progressPct: 48,
            rewardXP: 0,
            completed: false,
            badge: 'Town',
            badgeClass: 'is-objective',
            routeTone: 'support',
            hint: 'Level 30 unlocked all base dungeons. Visit the Dungeon Guide, choose your next run, and use World Map (M), Journal (J), Stash, and Forge to get ready before leaving town.'
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

        const nextMeaningfulRoom = findNextDungeonMeaningfulRoom(summary, currentObjectiveIndex);

        const labelForRoom = (room) => {
            if (!room) return null;
            const role = getDungeonRoomRole(room);
            if (role === 'reward') return 'Chest';
            if (role === 'event') return 'Ambush';
            if (role === 'recovery') return 'Shrine';
            if (role === 'boss') return 'Boss';
            if (role === 'elite') return 'Elite';
            if (room.index === currentObjectiveIndex && getDungeonRoomRole(nextMeaningfulRoom) === 'recovery') return 'Approach';
            if (room.index === currentObjectiveIndex && getDungeonRoomRole(nextMeaningfulRoom) === 'boss') return 'Approach';
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
        const isLiveBossObjective = isLiveDungeonBossRoom(objectiveRoom, summary);
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

        const nextUnclearedBeat = objectiveRoom ? findNextDungeonMeaningfulRoom(summary, objectiveRoom.index) : null;
        const cadenceLabel = getDungeonCadenceLabel(objectiveRoom);

        if (getDungeonRoomRole(objectiveRoom) === 'recovery') {
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
                hint: getDungeonRoomRole(nextUnclearedBeat) === 'boss'
                    ? 'Last reset before the boss push'
                    : objectiveRoom.explored
                        ? 'Shrine discovered'
                        : 'A restorative shrine lies ahead',
                sequenceHint,
                cadenceLabel
            };
        }

        if (getDungeonRoomRole(objectiveRoom) === 'reward') {
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
                hint: getDungeonRoomRole(nextUnclearedBeat) === 'event'
                    ? 'Quick score before the ambush spike'
                    : objectiveRoom.explored
                        ? 'Treasure room discovered'
                        : 'Treasure cache detected deeper inside',
                sequenceHint,
                cadenceLabel
            };
        }

        if (getDungeonRoomRole(objectiveRoom) === 'event') {
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
                sequenceHint,
                cadenceLabel
            };
        }

        if (getDungeonRoomRole(objectiveRoom) === 'boss') {
            return {
                id: `dungeon-route-${instanceType}`,
                title: isLiveBossObjective ? 'Survive the boss fight' : 'Commit to the boss room',
                progressLabel,
                progressPct,
                rewardXP: 0,
                completed: false,
                badge: isLiveBossObjective ? 'Boss Now' : 'Boss',
                badgeClass: 'is-boss',
                routeTone: 'danger',
                hint: isLiveBossObjective
                    ? 'You are in the boss room — commit and survive'
                    : 'Boss room ahead — reset and commit',
                sequenceHint,
                cadenceLabel
            };
        }

        if (getDungeonRoomRole(objectiveRoom) === 'elite') {
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
                sequenceHint,
                cadenceLabel
            };
        }

        const unclearedNonBossRooms = traversableRooms.filter((room) => !room.cleared && room.type !== 'boss');
        const remainingRooms = Math.max(1, unclearedNonBossRooms.length);
        const nextMeaningfulRoom = findNextDungeonMeaningfulRoom(summary, objectiveRoom.index);
        const isBridgeToBoss = getDungeonRoomRole(nextMeaningfulRoom) === 'boss' && remainingRooms === 1;
        const isBridgeToShrine = getDungeonRoomRole(nextMeaningfulRoom) === 'recovery';

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
            sequenceHint,
            cadenceLabel
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

        const townRecoveryObjective = this.buildTownRecoveryObjective(quests);
        if (townRecoveryObjective) {
            return [townRecoveryObjective, ...questObjectives];
        }

        const starterTownObjective = this.buildStarterTownObjective(quests);
        if (starterTownObjective) {
            return [starterTownObjective, ...questObjectives];
        }

        const townProgressionObjective = this.buildTownProgressionObjective(quests);
        return townProgressionObjective ? [townProgressionObjective, ...questObjectives] : questObjectives;
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
        const heading = this.createMessage('Next Step', {
            color: '#ffd700',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '4px'
        });
        const title = this.createMessage(objective.title, {
            color: '#fff',
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '4px'
        });
        const body = this.createMessage(guidanceBody);
        const cadence = objective.cadenceLabel
            ? this.createMessage(`Cadence: ${objective.cadenceLabel}`, {
                color: '#8fd3ff',
                marginTop: '6px',
                fontSize: '11px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
            })
            : null;
        const footer = this.createMessage('Closed a menu or got turned around? Open World Map (M) and Journal (J) to re-orient.', {
            color: '#aaa',
            marginTop: '6px'
        });

        guidance.appendChild(heading);
        guidance.appendChild(title);
        guidance.appendChild(body);

        if (cadence) {
            guidance.appendChild(cadence);
        }

        if (objective.sequenceHint) {
            guidance.appendChild(this.createMessage(objective.sequenceHint, {
                color: '#ffdf8a',
                marginTop: '6px',
                fontSize: '11px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
            }));
        }

        guidance.appendChild(footer);
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
        this.clearElement(this.objectivesList);
        this.objectivesPanel.querySelector('.objective-guidance')?.remove();

        if (this.activeQuestSummary.length > 0) {
            this.renderObjectiveGuidance(this.activeQuestSummary[0]);
        }

        this.activeQuestSummary.forEach((objective) => {
            const item = document.createElement('div');
            item.className = `objective-entry ${objective.routeTone ? `is-${objective.routeTone}` : ''}`.trim();
            const header = document.createElement('div');
            header.className = 'objective-entry__header';

            const titleWrap = document.createElement('span');
            titleWrap.className = 'objective-entry__title-wrap';

            if (objective.badge) {
                const badge = document.createElement('span');
                badge.className = `objective-entry__badge ${objective.badgeClass || ''}`.trim();
                badge.textContent = objective.badge;
                titleWrap.appendChild(badge);
            }

            const title = document.createElement('span');
            title.className = 'objective-entry__title';
            title.textContent = objective.title;
            titleWrap.appendChild(title);

            const status = document.createElement('span');
            status.className = `objective-entry__status ${objective.completed ? 'is-complete' : ''}`.trim();
            status.textContent = objective.completed ? 'Ready' : objective.progressLabel;

            header.appendChild(titleWrap);
            header.appendChild(status);

            const progress = document.createElement('div');
            progress.className = 'objective-entry__progress';
            const progressFill = document.createElement('div');
            progressFill.className = `objective-entry__progress-fill ${objective.completed ? 'is-complete' : ''}`.trim();
            progressFill.style.width = `${Math.max(0, Math.min(100, Number(objective.progressPct) || 0))}%`;
            progress.appendChild(progressFill);

            const hint = document.createElement('div');
            hint.className = 'objective-entry__hint';
            hint.textContent = objective.completed ? `Reward: ${objective.rewardXP} XP` : objective.hint;

            item.appendChild(header);
            item.appendChild(progress);
            item.appendChild(hint);
            this.objectivesList.appendChild(item);
        });
    }

    // ================================================================
    // QUEST NPC WINDOW
    // ================================================================

    updateQuestWindow(quests) {
        this.clearElement(this.questList);
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

            const targetLabel = this.formatQuestTarget(q.target, q.maxCount);
            const statusText = document.createElement('div');
            const actionButton = document.createElement('button');
            actionButton.className = 'menu-btn';
            actionButton.type = 'button';
            actionButton.style.marginTop = '5px';

            if (!q.accepted) {
                statusText.style.color = '#ffd700';
                statusText.style.fontWeight = 'bold';
                statusText.textContent = `Daily: Kill ${q.maxCount} ${targetLabel}`;
                actionButton.textContent = 'Accept Quest';
                actionButton.style.background = '#4CAF50';
                actionButton.style.borderColor = '#45a049';
            } else if (q.accepted && !q.completed && q.count >= q.maxCount) {
                statusText.style.color = '#4CAF50';
                statusText.style.fontWeight = 'bold';
                statusText.textContent = `COMPLETE: Kill ${q.maxCount} ${targetLabel}`;
                actionButton.textContent = 'Claim Reward';
                actionButton.style.background = '#FFD700';
                actionButton.style.color = '#000';
                actionButton.style.borderColor = '#FFA000';
            } else {
                return;
            }

            const reward = document.createElement('div');
            reward.style.color = '#aaa';
            reward.style.fontSize = '12px';
            reward.textContent = `Reward: ${q.rewardXP} XP`;

            actionButton.addEventListener('click', () => {
                if (!q.accepted) {
                    if (this.onAcceptQuest) this.onAcceptQuest(q.id);
                } else {
                    if (this.onCompleteQuest) this.onCompleteQuest(q.id);
                }
            });

            div.appendChild(statusText);
            div.appendChild(reward);
            div.appendChild(actionButton);
            this.questList.appendChild(div);
        });

        if (this.questList.children.length === 0) {
            this.questList.appendChild(this.createMessage('No available quests. Check your Journal (J) for active quests.', {
                color: '#888',
                textAlign: 'center',
                marginTop: '20px'
            }));
        }
    }

    // ================================================================
    // QUEST JOURNAL
    // ================================================================

    updateJournal(quests) {
        this.renderObjectivesPanel(this.buildObjectiveSummary(quests));
        this.clearElement(this.journalList);

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

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';

            const title = document.createElement('span');
            title.style.color = '#fff';
            title.style.fontWeight = 'bold';
            title.textContent = `Kill ${targetLabel}`;

            const statusEl = document.createElement('span');
            statusEl.style.color = color;
            statusEl.style.fontSize = '12px';
            statusEl.textContent = status;

            header.appendChild(title);
            header.appendChild(statusEl);

            const progress = document.createElement('div');
            progress.style.background = '#111';
            progress.style.height = '10px';
            progress.style.border = '1px solid #444';
            progress.style.position = 'relative';

            const progressFill = document.createElement('div');
            progressFill.style.background = color;
            progressFill.style.width = `${pct}%`;
            progressFill.style.height = '100%';

            const progressLabel = document.createElement('div');
            progressLabel.style.position = 'absolute';
            progressLabel.style.top = '0';
            progressLabel.style.left = '0';
            progressLabel.style.width = '100%';
            progressLabel.style.textAlign = 'center';
            progressLabel.style.fontSize = '8px';
            progressLabel.style.lineHeight = '10px';
            progressLabel.style.color = '#fff';
            progressLabel.textContent = `${q.count} / ${q.maxCount}`;

            progress.appendChild(progressFill);
            progress.appendChild(progressLabel);

            const reward = document.createElement('div');
            reward.style.color = '#aaa';
            reward.style.fontSize = '12px';
            reward.textContent = `Reward: ${q.rewardXP} XP`;

            div.appendChild(header);
            div.appendChild(progress);
            div.appendChild(reward);

            if (q.completed) {
                // Turn in at NPC for now
            }
            this.journalList.appendChild(div);
        });

        if (!hasActive) {
            this.clearElement(this.journalList);
            this.journalList.appendChild(this.createMessage('No active quests.', {
                color: '#888',
                textAlign: 'center',
                marginTop: '20px'
            }));
        }
    }
}
