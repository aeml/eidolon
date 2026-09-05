import {
    findNextDungeonMeaningfulRoom,
    getDungeonCadenceLabel,
    getDungeonDifficultyPacingHint,
    getDungeonDifficultyPacingLabel,
    getDungeonRoomIdentityHint,
    getDungeonRoomIdentityLabel,
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
        this.onRequestQuests = null;

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
        if (this.ctx.toggleManagedWindow) {
            this.ctx.toggleManagedWindow('quest');
        } else {
            this.questWindow.style.display = isHidden ? 'flex' : 'none';
        }
        if (isHidden) {
            this.onRequestQuests?.();
            const player = this.ctx.getLastPlayer();
            if (player && player.quests) {
                this.updateQuestWindow(player.quests);
            }
        }
    }

    /** Toggle the quest journal. */
    toggleJournal() {
        const isHidden = this.questJournal.style.display === 'none' || this.questJournal.style.display === '';
        if (isHidden && !this.ctx.toggleManagedWindow) {
            this.ctx.closePrimaryHudMenus?.({ except: 'journal' });
        }
        if (this.ctx.toggleManagedWindow) {
            this.ctx.toggleManagedWindow('journal');
        } else {
            this.questJournal.style.display = isHidden ? 'flex' : 'none';
        }
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

    getQuestTitle(quest) {
        if (quest?.title) return quest.title;
        const target = this.formatQuestTarget(quest?.target, quest?.maxCount);
        return quest?.type === 'COLLECT' ? `Collect ${target}` : `Kill ${target}`;
    }

    getQuestObjective(quest) {
        if (quest?.objectiveText) return quest.objectiveText;
        const target = this.formatQuestTarget(quest?.target, quest?.maxCount);
        const verb = quest?.type === 'COLLECT' ? 'Collect' : 'Defeat';
        return `${verb} ${quest?.maxCount || 0} ${target}.`;
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

    buildRepeatableLadderSummary(quests) {
        if (!Array.isArray(quests)) return null;

        const repeatableQuests = quests.filter((quest) => quest?.id?.startsWith('daily_'));
        if (repeatableQuests.length === 0) return null;

        const formatLadderLabel = (quest) => {
            if (quest?.target === 'DungeonBossHeroic') return 'Dungeon Boss (Heroic)';
            if (quest?.target === 'DungeonBossMythic') return 'Dungeon Boss (Mythic)';
            return this.formatQuestTarget(quest?.target, quest?.maxCount);
        };

        const topEntries = [...repeatableQuests]
            .sort((left, right) => (Number(right?.rewardXP) || 0) - (Number(left?.rewardXP) || 0))
            .slice(0, 3)
            .map((quest) => ({
                id: quest.id,
                label: formatLadderLabel(quest),
                accepted: Boolean(quest.accepted && !quest.completed),
                completed: Boolean(quest.accepted && quest.completed),
                progressText: `${Math.max(0, Number(quest.count) || 0)} / ${Math.max(0, Number(quest.maxCount) || 0)}`,
                rewardXP: Number(quest.rewardXP) || 0
            }));

        return {
            acceptedCount: repeatableQuests.filter((quest) => quest?.accepted && !quest?.completed).length,
            readyCount: repeatableQuests.filter((quest) => quest?.accepted && quest?.completed).length,
            topEntries
        };
    }

    getDailyResetSnapshot() {
        const serverEpochSeconds = Number(this.ctx.getServerEpochSeconds?.() || 0);
        if (!Number.isFinite(serverEpochSeconds) || serverEpochSeconds <= 0) {
            return {
                statusLine: 'Daily quests reset at 12:00 AM Eastern Time',
                ladderLine: 'Highest-value dailies reset tomorrow, so this is the fastest XP ladder to pick back up.'
            };
        }

        const now = new Date(serverEpochSeconds * 1000);
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        const parts = formatter.formatToParts(now);
        const part = (type) => parts.find((entry) => entry.type === type)?.value || '';
        const weekday = part('weekday');
        const month = part('month');
        const day = part('day');
        const hour = part('hour');
        const minute = Number(part('minute') || 0);
        const second = Number(part('second') || 0);
        const dayPeriod = part('dayPeriod');
        const hour24 = Number(new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            hourCycle: 'h23'
        }).format(now));

        let remainingTotalSeconds = (24 * 60 * 60) - ((hour24 * 60 * 60) + (minute * 60) + second);
        if (remainingTotalSeconds <= 0) {
            remainingTotalSeconds = 24 * 60 * 60;
        }
        const remainingHours = Math.floor(remainingTotalSeconds / 3600);
        const remainingMinutes = Math.floor((remainingTotalSeconds % 3600) / 60);
        const remainingSeconds = remainingTotalSeconds % 60;

        const countdown = [remainingHours, remainingMinutes, remainingSeconds]
            .map((value) => String(Math.max(0, value)).padStart(2, '0'))
            .join(':');
        const easternNow = `${weekday} ${month} ${day} • ${hour}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} ${dayPeriod} ET`.trim();

        return {
            statusLine: `Daily reset: ${countdown} remaining (${easternNow})`,
            ladderLine: `Server clock says the daily ladder rolls in ${countdown}, so this is the fastest XP route still paying before reset.`
        };
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
        // The auto-start Chronicle is already a concrete next step. Generic
        // town orientation should not displace it; explicit recovery still can.
        if (!['respawn', 'recall'].includes(recovery?.reason) && quests.some((quest) => quest?.category === 'chronicle' && quest.accepted && !quest.completed)) return null;
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
            if (['reward', 'event', 'recovery', 'boss', 'elite', 'approach'].includes(role)) return getDungeonRoomIdentityLabel(room);
            if (room.index === currentObjectiveIndex && getDungeonRoomRole(nextMeaningfulRoom) === 'recovery') return getDungeonRoomIdentityLabel(room);
            if (room.index === currentObjectiveIndex && getDungeonRoomRole(nextMeaningfulRoom) === 'boss') return getDungeonRoomIdentityLabel(room);
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
        const roomIdentityLabel = getDungeonRoomIdentityLabel(objectiveRoom);
        const roomIdentityHint = getDungeonRoomIdentityHint(objectiveRoom);
        const difficultyPacingLabel = getDungeonDifficultyPacingLabel(summary);
        const difficultyPacingHint = getDungeonDifficultyPacingHint(summary);
        const cadenceWithContext = [cadenceLabel, roomIdentityLabel, difficultyPacingLabel].filter(Boolean).join(' • ');
        const withRouteContext = (hint) => [hint, roomIdentityHint, difficultyPacingHint].filter(Boolean).join(' ');

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
                hint: withRouteContext(getDungeonRoomRole(nextUnclearedBeat) === 'boss'
                    ? 'Last reset before the boss push'
                    : objectiveRoom.explored
                        ? 'Shrine discovered'
                        : 'A restorative shrine lies ahead'),
                sequenceHint,
                cadenceLabel: cadenceWithContext
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
                hint: withRouteContext(getDungeonRoomRole(nextUnclearedBeat) === 'event'
                    ? 'Quick score before the ambush spike'
                    : objectiveRoom.explored
                        ? 'Treasure room discovered'
                        : 'Treasure cache detected deeper inside'),
                sequenceHint,
                cadenceLabel: cadenceWithContext
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
                hint: withRouteContext('Elite room ahead — pressure spike incoming'),
                sequenceHint,
                cadenceLabel: cadenceWithContext
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
                hint: withRouteContext(isLiveBossObjective
                    ? 'You are in the boss room — commit and survive'
                    : 'Boss room ahead — reset and commit'),
                sequenceHint,
                cadenceLabel: cadenceWithContext
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
                hint: withRouteContext(objectiveRoom.explored ? 'Elite room discovered' : 'Elite threat ahead'),
                sequenceHint,
                cadenceLabel: cadenceWithContext
            };
        }

        if (getDungeonRoomRole(objectiveRoom) === 'approach') {
            return {
                id: `dungeon-route-${instanceType}`,
                title: 'Break through the boss approach',
                progressLabel,
                progressPct,
                rewardXP: 0,
                completed: false,
                badge: 'Approach',
                badgeClass: 'is-approach',
                routeTone: 'warning',
                hint: withRouteContext('Final room before the boss — clear it, then commit'),
                sequenceHint,
                cadenceLabel: cadenceWithContext
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
            hint: withRouteContext(isBridgeToBoss
                ? 'Boss path open — one last room before the boss'
                : isBridgeToShrine
                    ? `${remainingRooms} rooms remain before the shrine reset`
                    : `Clear ${remainingRooms} more rooms`),
            sequenceHint,
            cadenceLabel: cadenceWithContext
        };
    }

    buildObjectiveSummary(quests) {
        const questObjectives = Array.isArray(quests)
            ? quests
                .filter((q) => q && q.accepted && !q.completed)
                .map((q) => {
                    const remaining = Math.max(0, (q.maxCount || 0) - (q.count || 0));
                    const isChronicle = q.category === 'chronicle';
                    return {
                        id: q.id,
                        title: this.getQuestTitle(q),
                        progressLabel: `${q.count || 0} / ${q.maxCount || 0}`,
                        progressPct: q.maxCount > 0 ? Math.min(100, ((q.count || 0) / q.maxCount) * 100) : 0,
                        rewardXP: q.rewardXP || 0,
                        completed: Boolean(q.completed || ((q.count || 0) >= (q.maxCount || 0))),
                        badge: isChronicle ? `Story ${q.chapter || ''}`.trim() : 'Daily',
                        badgeClass: isChronicle ? 'is-objective' : '',
                        routeTone: isChronicle ? 'warning' : 'neutral',
                        hint: isChronicle
                            ? this.getQuestObjective(q)
                            : remaining > 0 ? `${remaining} remaining` : 'Return to the quest NPC for your reward'
                    };
                })
                .sort((left, right) => Number(right.badge?.startsWith('Story')) - Number(left.badge?.startsWith('Story')))
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

    renderObjectiveGuidance(objective, entry) {
        if (!objective || !entry) return;
        // Enrich the primary objective itself instead of repeating its title
        // and instructions in a separate card above the objective list.
        entry.classList.add('objective-guidance');
        const heading = this.createMessage('Next Step');
        heading.className = 'objective-guidance__heading';
        entry.prepend(heading);
        const appendDetail = (text, className) => {
            const detail = this.createMessage(text);
            detail.className = className;
            entry.appendChild(detail);
        };
        if (objective.cadenceLabel) appendDetail(`Cadence: ${objective.cadenceLabel}`, 'objective-guidance__cadence');
        if (objective.sequenceHint) appendDetail(objective.sequenceHint, 'objective-guidance__sequence');
        appendDetail('World Map (M) · Journal (J)', 'objective-guidance__footer');
    }

    renderObjectivesPanel(summary) {
        if (!this.objectivesPanel || !this.objectivesList) return;

        this.activeQuestSummary = Array.isArray(summary) ? summary : [];
        this.objectivesPanel.style.display = this.activeQuestSummary.length > 0 ? 'flex' : 'none';
        this.clearElement(this.objectivesList);
        this.objectivesPanel.querySelector('.objective-guidance')?.remove();

        this.activeQuestSummary.forEach((objective, index) => {
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
            hint.textContent = objective.completed && objective.badgeClass !== 'is-exit'
                ? `Return for your reward: ${objective.rewardXP || 0} XP` : objective.hint;

            item.appendChild(header);
            item.appendChild(progress);
            item.appendChild(hint);
            if (index === 0) this.renderObjectiveGuidance(objective, item);
            this.objectivesList.appendChild(item);
        });
    }

    // ================================================================
    // QUEST NPC WINDOW
    // ================================================================

    updateQuestWindow(quests) {
        this.clearElement(this.questList);
        if (!quests) return;

        quests.filter((q) => q?.category !== 'chronicle' && !q?.id?.startsWith('chronicle_')).forEach(q => {
            if (q.accepted && !q.completed && q.count < q.maxCount) return;
            if (q.completed && q.accepted) {
                // Ready to turn in
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

    renderChronicleSection(quests) {
        const chronicle = Array.isArray(quests)
            ? quests.filter((q) => q?.category === 'chronicle' || q?.id?.startsWith('chronicle_'))
                .sort((left, right) => (Number(left.chapter) || 0) - (Number(right.chapter) || 0))
            : [];
        if (chronicle.length === 0) return false;

        const completed = chronicle.filter((quest) => quest.completed);
        const current = chronicle.find((quest) => quest.accepted && !quest.completed) || null;
        const section = document.createElement('section');
        section.className = 'chronicle-journal';

        section.appendChild(this.createMessage('The Fourfold Chronicle', {
            color: '#dfb5ff', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase'
        }));
        section.appendChild(this.createMessage(
            `${completed.length} of 15 chapters complete • Earth → Water → Fire → Air → Dark Realm`,
            { color: '#aab8d0', fontSize: '11px' }
        ));

        if (current) {
            section.appendChild(this.createMessage(`Chapter ${current.chapter}: ${this.getQuestTitle(current)}`, {
                color: '#fff2bd', fontSize: '15px', fontWeight: 'bold', marginTop: '3px'
            }));
            section.appendChild(this.createMessage(current.description || this.getQuestObjective(current), {
                color: '#e0e4ed', fontSize: '12px', lineHeight: '1.55'
            }));
            section.appendChild(this.createMessage(`Objective — ${this.getQuestObjective(current)}`, {
                color: '#ffd36f', fontSize: '12px', fontWeight: 'bold'
            }));
            section.appendChild(this.createMessage(`${current.count || 0} / ${current.maxCount || 0} • ${Number(current.rewardXP || 0).toLocaleString()} XP`, {
                color: '#8fd3ff', fontSize: '11px'
            }));
            if (current.lore) {
                const lore = document.createElement('blockquote');
                lore.style.margin = '5px 0 0';
                lore.style.padding = '9px 11px';
                lore.style.borderLeft = '3px solid rgba(192, 102, 255, 0.65)';
                lore.style.background = 'rgba(6, 8, 15, 0.42)';
                lore.style.color = '#c9bed6';
                lore.style.fontSize = '11px';
                lore.style.lineHeight = '1.55';
                lore.textContent = current.lore;
                section.appendChild(lore);
            }
        } else {
            section.appendChild(this.createMessage('The resonance is whole. Malachar has fallen, and Eidolon belongs to no king.', {
                color: '#7cf0a5', fontSize: '13px', fontWeight: 'bold'
            }));
        }

        if (completed.length > 0) {
            const archive = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = `Recovered Lore (${completed.length})`;
            summary.style.color = '#caa8e7';
            summary.style.cursor = 'pointer';
            summary.style.fontSize = '11px';
            archive.appendChild(summary);
            completed.forEach((quest) => {
                const entry = document.createElement('div');
                entry.style.marginTop = '8px';
                entry.style.paddingTop = '8px';
                entry.style.borderTop = '1px solid rgba(255,255,255,0.08)';
                entry.appendChild(this.createMessage(`Chapter ${quest.chapter}: ${this.getQuestTitle(quest)}`, {
                    color: '#ded3e8', fontSize: '11px', fontWeight: 'bold'
                }));
                entry.appendChild(this.createMessage(quest.lore || quest.description || '', {
                    color: '#9fa8b8', fontSize: '11px', lineHeight: '1.45', marginTop: '3px'
                }));
                archive.appendChild(entry);
            });
            section.appendChild(archive);
        }
        this.journalList.appendChild(section);
        return Boolean(current);
    }

    updateJournal(quests) {
        this.renderObjectivesPanel(this.buildObjectiveSummary(quests));
        this.clearElement(this.journalList);
        const resetSnapshot = this.getDailyResetSnapshot();

        const infoDiv = document.createElement('div');
        infoDiv.style.color = '#888';
        infoDiv.style.fontSize = '12px';
        infoDiv.style.marginBottom = '15px';
        infoDiv.style.textAlign = 'center';
        infoDiv.style.borderBottom = '1px solid #444';
        infoDiv.style.paddingBottom = '10px';
        infoDiv.textContent = resetSnapshot.statusLine;
        this.journalList.appendChild(infoDiv);

        const hasActiveChronicle = this.renderChronicleSection(quests);

        const repeatableLadder = this.buildRepeatableLadderSummary(quests);
        if (repeatableLadder) {
            const ladder = document.createElement('div');
            ladder.style.background = 'linear-gradient(180deg, rgba(29, 35, 46, 0.95), rgba(18, 22, 29, 0.95))';
            ladder.style.border = '1px solid rgba(143, 176, 217, 0.35)';
            ladder.style.padding = '10px';
            ladder.style.marginBottom = '14px';
            ladder.style.display = 'flex';
            ladder.style.flexDirection = 'column';
            ladder.style.gap = '6px';

            const title = this.createMessage('Repeatable Ladder', {
                color: '#ffd700',
                fontSize: '11px',
                fontWeight: 'bold',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
            });
            const body = this.createMessage(
                `Accepted now: ${repeatableLadder.acceptedCount} • Ready to claim: ${repeatableLadder.readyCount}. ${resetSnapshot.ladderLine}`,
                { color: '#d7dfef', fontSize: '12px', lineHeight: '1.5' }
            );

            ladder.appendChild(title);
            ladder.appendChild(body);

            repeatableLadder.topEntries.forEach((entry) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.gap = '10px';
                row.style.fontSize = '12px';
                row.style.alignItems = 'baseline';

                const left = this.createMessage(
                    `${entry.label}${entry.completed ? ' • Ready' : entry.accepted ? ' • Active' : ' • Available'}`,
                    { color: entry.completed ? '#7cf0a5' : entry.accepted ? '#ffd36f' : '#cfd7e2' }
                );
                const right = this.createMessage(
                    `${entry.progressText} • ${entry.rewardXP.toLocaleString()} XP`,
                    { color: '#8fd3ff', whiteSpace: 'nowrap' }
                );

                row.appendChild(left);
                row.appendChild(right);
                ladder.appendChild(row);
            });

            this.journalList.appendChild(ladder);
        }

        if (!quests) return;
        let hasActive = hasActiveChronicle;

        quests.forEach(q => {
            if (!q.accepted || q.completed) return;
            if (q.category === 'chronicle' || q.id?.startsWith('chronicle_')) return;
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

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';

            const title = document.createElement('span');
            title.style.color = '#fff';
            title.style.fontWeight = 'bold';
            title.textContent = this.getQuestTitle(q);

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
            this.journalList.appendChild(this.createMessage('No active quests.', {
                color: '#888',
                textAlign: 'center',
                marginTop: '20px'
            }));
        }
    }
}
