import { installPrototypeMethods } from '../core/PrototypeInstaller.js';
import { formatQuestRewards } from './questRewards.js';

class UIManagerFeedbackMethods {
    createDeathScreen() {
        const existing = document.getElementById('death-screen');
        const div = existing || document.createElement('div');
        div.id = 'death-screen';
        div.className = 'death-screen';
        div.style.display = 'none';

        div.innerHTML = `
            <h1 id="death-screen-title" class="death-screen__title">YOU DIED</h1>
            <div id="death-screen-hint" class="death-screen__hint"></div>
            <div id="death-screen-meta" class="death-screen__meta"></div>
            <button id="btn-death-respawn" class="menu-btn death-screen__button">Respawn in Town</button>
        `;

        if (!existing) {
            document.body.appendChild(div);
        }

        const btn = div.querySelector('#btn-death-respawn');
        btn.onclick = () => {
            if (this.pvp?.state?.match) {
                if (this.pvp.state.match.status !== 'complete') this.pvp.onLeave?.();
            } else if (this.onRespawn) {
                this.onRespawn();
            }
        };

        this.deathScreen = div;
        this.deathScreenTitle = div.querySelector('#death-screen-title');
        this.deathScreenHint = div.querySelector('#death-screen-hint');
        this.deathScreenMeta = div.querySelector('#death-screen-meta');
    }

    showDeathScreen(details = {}) {
        if (this.deathScreen) {
            const match = this.pvp?.state?.match;
            const title = match ? 'ELIMINATED' : (details.title || 'YOU DIED');
            const hint = match
                ? (match.status === 'complete' ? 'Match complete. You will return automatically.'
                    : match.roundPending ? 'Round over. You will recover automatically for the next round.'
                        : 'Your teammate can still win this round. You will recover when the round ends.')
                : (details.hint || 'Respawn in town to recover, repair, and re-enter the fight.');
            const button = this.deathScreen.querySelector('#btn-death-respawn');
            if (button) {
                button.textContent = match ? (match.status === 'complete' ? 'Returning…' : 'Forfeit and Leave Match') : 'Respawn in Town';
                button.disabled = match?.status === 'complete';
            }
            const elapsedSeconds = Number(details.elapsedSeconds || 0);
            if (this.deathScreenTitle) {
                this.deathScreenTitle.textContent = title;
            }
            if (this.deathScreenHint) {
                this.deathScreenHint.textContent = hint;
            }
            if (this.deathScreenMeta) {
                this.deathScreenMeta.textContent = match
                    ? (match.mode === 'duel' ? 'Practice duels do not affect your ranked record.' : 'Forfeiting ends the match for your team and applies a five-minute queue penalty.')
                    : elapsedSeconds > 0
                    ? `Down for ${elapsedSeconds.toFixed(1)}s • Town respawn restores your footing fast.`
                    : 'Town respawn restores your footing fast.';
            }
            this.deathScreen.style.display = 'flex';
        }
    }

    hideDeathScreen() {
        if (this.deathScreen) {
            this.deathScreen.style.display = 'none';
        }
    }

    handleSellAll(rarityName) { this.inventory.handleSellAll(rarityName); }

    resetDisplaySignatures() {
        this.lastCombatIntentSignature = '';
        this.lastDungeonEntranceHintSignature = '';
        this.lastPlayerStatsSignature = '';
        this.lastXpSignature = '';
        this.lastHotbarCooldownSignature = '';
        this.lastCharacterSheetSignature = '';
    }

    /**
     * Update the connection-state HUD pill.
     * @param {'connected'|'reconnecting'|'lost'} state
     */
    setConnectionState(state) {
        const el = this.connIndicator;
        if (!el) return;
        el.classList.remove('conn-indicator--reconnecting', 'conn-indicator--lost');
        if (state === 'reconnecting') {
            el.textContent = 'Reconnecting\u2026';
            el.classList.add('conn-indicator--reconnecting');
        } else if (state === 'lost') {
            el.textContent = 'Connection lost';
            el.classList.add('conn-indicator--lost');
        } else {
            // 'connected' — hide the indicator; normal play state needs no banner.
            el.style.display = 'none';
            el.textContent = '';
        }
    }


    addChatMessage(sender, message, options = {}) {
        this.chat?.addMessage(sender, message, { ...options, stream: 'chat' });
    }

    addGameMessage(sender, message, options = {}) {
        this.chat?.addMessage(sender, message, { ...options, stream: 'game' });
    }

    setTooltipDescription(lines, detailText = '') {
        if (!this.statTooltipDesc) return;

        this.statTooltipDesc.replaceChildren();

        lines.forEach((line) => {
            const text = String(line || '').trim();
            if (!text) return;

            const lineEl = document.createElement('div');
            lineEl.style.color = '#ccc';
            lineEl.textContent = text;
            this.statTooltipDesc.appendChild(lineEl);
        });

        if (detailText) {
            const detailEl = document.createElement('div');
            detailEl.style.color = '#9aa0a6';
            detailEl.style.marginTop = '6px';
            detailEl.style.fontSize = '12px';
            detailEl.textContent = detailText;
            this.statTooltipDesc.appendChild(detailEl);
        }
    }

    showLootPickupToast(message, options = {}) {
        if (!message) return;
        const sender = options.sender || 'Loot';
        this.addGameMessage(sender, message);
    }

    formatRewardSummary(summary = {}) {
        const currencyParts = [];
        const lootParts = [];

        if (summary.gold) currencyParts.push(`+${summary.gold} gold`);
        if (summary.xp) currencyParts.push(`+${summary.xp} XP`);
        if (summary.itemCount) lootParts.push(`${summary.itemCount} item${summary.itemCount === 1 ? '' : 's'}`);
        if (summary.gemCount) lootParts.push(`${summary.gemCount} gem${summary.gemCount === 1 ? '' : 's'}`);
        if (summary.heartCount) lootParts.push(`${summary.heartCount} heart${summary.heartCount === 1 ? '' : 's'}`);

        return {
            currencyLine: currencyParts.join(', '),
            lootLine: lootParts.join(', ')
        };
    }

    formatRewardHeadline(summary = {}) {
        const parts = [];
        if (summary.bossName) parts.push(`${summary.bossName} down`);
        if (summary.itemCount) parts.push(`${summary.itemCount} item${summary.itemCount === 1 ? '' : 's'} secured`);
        if (summary.gemCount) parts.push(`${summary.gemCount} gem${summary.gemCount === 1 ? '' : 's'} secured`);
        if (summary.heartCount) parts.push(`${summary.heartCount} heart${summary.heartCount === 1 ? '' : 's'} secured`);
        if (parts.length === 0) return '';
        return parts.join(' • ');
    }

    formatRewardPulse(summary = {}) {
        const parts = [];
        if (summary.gold) parts.push(`+${summary.gold} gold`);
        if (summary.xp) parts.push(`+${summary.xp} XP`);
        if (summary.itemCount || summary.gemCount || summary.heartCount) {
            parts.push('build drops ready');
        }
        return parts.join(' • ');
    }

    formatRewardDifficultyNote(summary = {}) {
        if (!summary.difficultyNote) return '';
        return summary.difficultyNote;
    }

    getDungeonDailyQuestEntries(dungeonKey, difficultyKey, quests = this.lastPlayerRef?.quests) {
        if (!Array.isArray(quests)) {
            return [];
        }

        const dungeonQuestByType = {
            verdant_bastion_catacombs: 'daily_verdant_bastion_bosses',
            abyssal_well: 'daily_abyssal_well_bosses',
            molten_core: 'daily_molten_core_bosses',
            tempest_spire: 'daily_tempest_spire_bosses'
        };
        const difficultyQuestByType = {
            normal: 'daily_dungeon_bosses',
            heroic: 'daily_dungeon_bosses_heroic',
            mythic: 'daily_dungeon_bosses_mythic'
        };
        const labelByQuestId = {
            daily_dungeon_bosses: 'Any dungeon bosses',
            daily_verdant_bastion_bosses: 'Verdant Bastion bosses',
            daily_abyssal_well_bosses: 'Abyssal Well bosses',
            daily_molten_core_bosses: 'Molten Core bosses',
            daily_tempest_spire_bosses: 'Tempest Spire bosses',
            daily_dungeon_bosses_heroic: 'Heroic dungeon bosses',
            daily_dungeon_bosses_mythic: 'Mythic dungeon bosses'
        };

        const questIds = [
            dungeonQuestByType[dungeonKey],
            difficultyQuestByType[difficultyKey]
        ].filter(Boolean);

        return questIds
            .map((id) => quests.find((quest) => quest && quest.id === id))
            .filter(Boolean)
            .map((quest) => {
                const count = Number(quest.count) || 0;
                const maxCount = Math.max(1, Number(quest.maxCount) || 0);
                return {
                    id: quest.id,
                    label: labelByQuestId[quest.id] || quest.id,
                    progressText: `${Math.min(count, maxCount)} / ${maxCount}`,
                    rewardXP: Number(quest.rewardXP) || 0,
                    rewardLabel: formatQuestRewards(quest, this.lastPlayerRef),
                    complete: Boolean(quest.completed || count >= maxCount)
                };
            });
    }

    formatRoomClearHeadline(summary = {}) {
        const parts = [];
        if (summary.roomType === 'elite') parts.push('elite room broken');
        if (summary.itemCount) parts.push(`${summary.itemCount} item${summary.itemCount === 1 ? '' : 's'} dropped`);
        if (summary.gemCount) parts.push(`${summary.gemCount} gem${summary.gemCount === 1 ? '' : 's'} dropped`);
        if (summary.heartCount) parts.push(`${summary.heartCount} heart${summary.heartCount === 1 ? '' : 's'} dropped`);
        if (summary.healthRestored || summary.manaRestored) parts.push('reset secured');
        if (parts.length === 0) return '';
        return parts.join(' • ');
    }

    formatRewardSummarySubtitle(summary = {}) {
        const parts = [];
        if (summary.subtitle) parts.push(summary.subtitle);
        if (summary.runLevel) parts.push(`Level ${summary.runLevel}`);
        return parts.join(' • ');
    }

    formatRewardSummaryCompletion(summary = {}) {
        const parts = [];
        if (summary.roomsCleared || summary.totalRooms) {
            parts.push(`${summary.roomsCleared || 0} / ${summary.totalRooms || 0} rooms`);
        }
        if (summary.eliteRoomsCleared || summary.totalEliteRooms) {
            parts.push(`${summary.eliteRoomsCleared || 0} / ${summary.totalEliteRooms || 0} elite rooms`);
        }
        if (parts.length === 0) return '';
        return `Dungeon complete • ${parts.join(' • ')}`;
    }

    showRewardSummary(summary = {}) {
        if (!summary.title) return;

        const headlineLine = this.formatRewardHeadline(summary);
        const subtitleLine = this.formatRewardSummarySubtitle(summary);
        const completionLine = this.formatRewardSummaryCompletion(summary);
        const difficultyNoteLine = this.formatRewardDifficultyNote(summary);
        const pulseLine = this.formatRewardPulse(summary);
        const { currencyLine, lootLine } = this.formatRewardSummary(summary);
        const calloutSubtitle = [completionLine, difficultyNoteLine, headlineLine, pulseLine, summary.exitHint || 'Dungeon rewards ready.']
            .filter(Boolean)
            .join(' • ');

        this.showCombatCallout({
            title: summary.title,
            tone: 'support',
            metaText: subtitleLine || 'Reward Summary',
            subtitle: calloutSubtitle,
            duration: 2.8
        });

        this.addGameMessage('Rewards', summary.title);

        if (subtitleLine) {
            this.addGameMessage('Rewards', subtitleLine);
        }

        if (completionLine) {
            this.addGameMessage('Rewards', completionLine);
        }

        if (difficultyNoteLine) {
            this.addGameMessage('Rewards', difficultyNoteLine);
        }

        if (headlineLine) {
            this.addGameMessage('Rewards', headlineLine);
        }

        if (currencyLine) {
            this.addGameMessage('Rewards', currencyLine);
        }
        if (lootLine) {
            this.addGameMessage('Rewards', lootLine);
        }
        if (pulseLine && pulseLine !== currencyLine) {
            this.addGameMessage('Rewards', pulseLine);
        }
        if (summary.exitHint) {
            this.addGameMessage('Rewards', summary.exitHint);
        }
    }

    showRoomClearReward(summary = {}) {
        if (!summary.title) return;

        const parts = [];
        const headlineLine = this.formatRoomClearHeadline(summary);
        if (summary.gold) parts.push(`+${summary.gold} gold`);
        if (summary.xp) parts.push(`+${summary.xp} XP`);
        if (summary.itemCount) parts.push(`+${summary.itemCount} item${summary.itemCount === 1 ? '' : 's'}`);
        if (summary.gemCount) parts.push(`+${summary.gemCount} gem${summary.gemCount === 1 ? '' : 's'}`);
        if (summary.heartCount) parts.push(`+${summary.heartCount} heart${summary.heartCount === 1 ? '' : 's'}`);
        if (summary.healthRestored) parts.push(`+${summary.healthRestored} health`);
        if (summary.manaRestored) parts.push(`+${summary.manaRestored} mana`);
        if (summary.buffName && summary.buffDurationSeconds) {
            const buffDetail = summary.damageReductionPct
                ? `${summary.buffName} for ${summary.buffDurationSeconds}s (${summary.damageReductionPct}% DR)`
                : `${summary.buffName} for ${summary.buffDurationSeconds}s`;
            parts.push(buffDetail);
        }
        if (summary.hint) parts.push(summary.hint);

        this.showCombatCallout({
            title: summary.title,
            tone: summary.roomType === 'elite' ? 'warning' : 'support',
            metaText: summary.subtitle || 'Room Clear',
            subtitle: [headlineLine, ...parts].filter(Boolean).join(' • ') || 'Room rewards secured.',
            duration: summary.roomType === 'elite' ? 2.3 : 2.1
        });

        this.addGameMessage('Room', summary.title);
        if (summary.subtitle) {
            this.addGameMessage('Room', summary.subtitle);
        }

        if (headlineLine) {
            this.addGameMessage('Room', headlineLine);
        }

        if (parts.length > 0) {
            this.addGameMessage('Room', parts.join(' • '));
        }
    }

    toggleChat(show) {
        this.chat?.show(show);
    }

    showHUD() {
        this.hud.style.display = 'block';
        this.abilityContainer.style.display = 'block';
        if (this.gameTimer) this.gameTimer.style.display = 'flex';
        if (this.hotbarContainer) this.hotbarContainer.style.display = 'flex';
        if (this.menuBar) this.menuBar.style.display = this.isMobile ? 'none' : 'flex';

        // Show XP Bar
        const xpContainer = document.getElementById('xp-bar-container');
        if (xpContainer) xpContainer.style.display = 'block';
    }

    formatCombatIntentStatus(status) {
        if (status === 'in_range') return 'In Range';
        if (status === 'move_into_range') return 'Move Into Range';
        return 'Invalid';
    }

    getCombatIntentStatusClass(status) {
        if (status === 'in_range') return 'is-in-range';
        if (status === 'move_into_range') return 'is-move-into-range';
        return 'is-invalid';
    }

    serializeCombatIntent(intent) {
        if (!intent) return '';
        return [
            intent.entityId || '',
            intent.status || '',
            Math.round((intent.distance || 0) * 10) / 10,
            intent.preview?.basicAttack ?? '',
            intent.preview?.ability ?? '',
            intent.preview?.abilityName ?? ''
        ].join('|');
    }

    showCombatCallout(callout = {}) {
        if (!this.combatIntentPanel || !callout?.title) return;

        const tone = callout.tone || 'warning';
        const duration = Number(callout.duration || 0);
        this.combatIntentPanel.style.display = 'block';
        this.combatIntentPanel.dataset.calloutTone = tone;

        if (this.combatIntentName) {
            this.combatIntentName.textContent = callout.title;
        }
        if (this.combatIntentMeta) {
            this.combatIntentMeta.textContent = callout.metaText || (duration > 0 ? `Incoming in ${duration.toFixed(1)}s` : '');
        }
        if (this.combatIntentStatus) {
            this.combatIntentStatus.textContent = callout.subtitle || 'Brace for impact';
        }
        if (this.combatIntentPreviewBasic) {
            this.combatIntentPreviewBasic.textContent = '';
        }
        if (this.combatIntentPreviewAbility) {
            this.combatIntentPreviewAbility.textContent = '';
        }
        if (this.combatIntentPreviewAbilityLabel) {
            this.combatIntentPreviewAbilityLabel.textContent = tone === 'boss' ? 'Boss Telegraph' : 'Threat Warning';
        }
    }

    /**
     * Show a brief toast notification when a friend comes online or goes offline.
     * No-ops if the user has opted out or if a toast for this friend was shown
     * within the last 30 seconds (rate-limit guard against reconnect spam).
     *
     * @param {string} username
     * @param {boolean} online
     */
    showFriendToast(username, online) {
        if (!this.friendOnlineToastEnabled) return;

        // Only show toasts for online events (offline is implicit / low-value noise).
        if (!online) return;

        // Rate-limit: one toast per friend per 30 seconds.
        const now = Date.now();
        const last = this._friendToastLastShown.get(username) || 0;
        if (now - last < 30_000) return;
        this._friendToastLastShown.set(username, now);

        this._renderFriendToast(`${username} is now online.`);
    }

    /** Toggle the friend-online toast setting and persist it. */
    setFriendOnlineToastEnabled(enabled) {
        this.friendOnlineToastEnabled = enabled;
        localStorage.setItem('eidolon.friendOnlineToast', String(enabled));
    }

    /** @returns {boolean} */
    getFriendOnlineToastEnabled() {
        return this.friendOnlineToastEnabled;
    }

    /**
     * Render a transient friend notification toast in the bottom-right corner.
     * The element fades out after 4 seconds then is removed from the DOM.
     * @param {string} text
     */
    _renderFriendToast(text) {
        const toast = document.createElement('div');
        toast.className = 'friend-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.textContent = text;
        document.body.appendChild(toast);

        // Force reflow so the transition fires.
        toast.offsetHeight;
        toast.classList.add('friend-toast--visible');

        const DISMISS_MS = 4000;
        const FADE_MS = 400;
        setTimeout(() => {
            toast.classList.remove('friend-toast--visible');
            setTimeout(() => toast.remove(), FADE_MS);
        }, DISMISS_MS);
    }

    updateCombatIntent(intent) {
        if (!this.combatIntentPanel || !intent) return;

        const signature = this.serializeCombatIntent(intent);
        if (signature === this.lastCombatIntentSignature) return;
        this.lastCombatIntentSignature = signature;

        const distanceLabel = `${(intent.distance || 0).toFixed(1)}m`;
        const typeLabel = intent.targetType || 'Enemy';
        const preview = intent.preview || {};

        this.combatIntentPanel.style.display = 'block';
        if (this.combatIntentName) this.combatIntentName.textContent = intent.name || 'Enemy';
        if (this.combatIntentMeta) this.combatIntentMeta.textContent = `${typeLabel} • ${distanceLabel}`;
        if (this.combatIntentStatus) {
            this.combatIntentStatus.textContent = this.formatCombatIntentStatus(intent.status);
            this.combatIntentStatus.className = `combat-intent__status ${this.getCombatIntentStatusClass(intent.status)}`;
        }
        if (this.combatIntentPreviewBasic) this.combatIntentPreviewBasic.textContent = `~${preview.basicAttack ?? 0}`;
        if (this.combatIntentPreviewAbilityLabel) this.combatIntentPreviewAbilityLabel.textContent = preview.abilityName || 'Ability';
        if (this.combatIntentPreviewAbility) this.combatIntentPreviewAbility.textContent = `~${preview.ability ?? 0}`;
    }

    clearCombatIntent() {
        this.lastCombatIntentSignature = '';
        if (!this.combatIntentPanel) return;
        this.combatIntentPanel.style.display = 'none';
        if (this.combatIntentName) this.combatIntentName.textContent = '';
        if (this.combatIntentMeta) this.combatIntentMeta.textContent = '';
        if (this.combatIntentStatus) {
            this.combatIntentStatus.textContent = '';
            this.combatIntentStatus.className = 'combat-intent__status';
        }
        if (this.combatIntentPreviewBasic) this.combatIntentPreviewBasic.textContent = '';
        if (this.combatIntentPreviewAbilityLabel) this.combatIntentPreviewAbilityLabel.textContent = 'Ability';
        if (this.combatIntentPreviewAbility) this.combatIntentPreviewAbility.textContent = '';
    }

    serializeDungeonEntranceHint(hint) {
        if (!hint) return '';
        return [
            hint.dungeonType || '',
            hint.dungeonName || '',
            hint.inRange ? 1 : 0,
            hint.statusLabel || '',
            hint.promptLabel || ''
        ].join('|');
    }

    updateDungeonEntranceHint(hint) {
        if (!this.dungeonEntranceHint || !hint) return;

        const signature = this.serializeDungeonEntranceHint(hint);
        if (signature === this.lastDungeonEntranceHintSignature) return;
        this.lastDungeonEntranceHintSignature = signature;

        this.dungeonEntranceHint.style.display = 'block';
        if (this.dungeonEntranceHintName) this.dungeonEntranceHintName.textContent = hint.dungeonName || 'Dungeon Portal';
        if (this.dungeonEntranceHintStatus) this.dungeonEntranceHintStatus.textContent = hint.statusLabel || '';
        if (this.dungeonEntranceHintPrompt) this.dungeonEntranceHintPrompt.textContent = hint.promptLabel || '';
    }

    clearDungeonEntranceHint() {
        this.lastDungeonEntranceHintSignature = '';
        if (!this.dungeonEntranceHint) return;
        this.dungeonEntranceHint.style.display = 'none';
        if (this.dungeonEntranceHintName) this.dungeonEntranceHintName.textContent = '';
        if (this.dungeonEntranceHintStatus) this.dungeonEntranceHintStatus.textContent = '';
        if (this.dungeonEntranceHintPrompt) this.dungeonEntranceHintPrompt.textContent = '';
    }

    updateTimer(seconds) {
        if (!this.gameTimer) return;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        this.gameTimer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    updateServerTime(epochSeconds) {
        const nextEpochSeconds = Number(epochSeconds) || 0;
        if (!Number.isFinite(nextEpochSeconds) || nextEpochSeconds <= 0) return;

        this.serverEpochSeconds = nextEpochSeconds;

        const serverDate = new Date(nextEpochSeconds * 1000);
        if (this.gameTimer) {
            this.gameTimer.textContent = serverDate.toLocaleTimeString([], {
                timeZone: 'America/New_York',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            this.gameTimer.title = 'Authoritative server time (ET)';
        }

        if (this.quest?.isJournalOpen) {
            this.quest.updateJournal(Array.isArray(this.lastPlayerRef?.quests) ? this.lastPlayerRef.quests : []);
        }
    }

}

export function installUIManagerFeedback(targetClass) {
    installPrototypeMethods(targetClass, UIManagerFeedbackMethods);
}
