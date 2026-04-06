import { GEM_TYPES, GEM_QUALITIES, getGemStats } from '../core/ItemSystem.js';

/**
 * Forge UI module — handles upgrade, potency, socket, and gem sub-systems.
 *
 * Extracted from UIManager to keep each UI domain independently readable.
 * The parent UIManager passes shared helpers (`getItemIconPath`,
 * `formatStatName`) and a `lastPlayerRef` accessor via the `ctx` object.
 */
export class ForgeUI {
    /**
     * @param {Object} ctx
     * @param {Function} ctx.getItemIconPath
     * @param {Function} ctx.formatStatName
     * @param {Function} ctx.getLastPlayer  – returns current player ref
     * @param {HTMLElement} ctx.inventoryScreen – needed to open inventory alongside forge
     */
    constructor(ctx) {
        this.ctx = ctx;

        // --- DOM refs ---
        this.forgeScreen = document.getElementById('forge-screen');
        this.forgeEquipmentList = document.getElementById('forge-equipment-list');
        this.forgeUpgradeInfo = document.getElementById('forge-upgrade-info');
        this.forgeSelectedItemName = document.getElementById('forge-selected-item-name');
        this.forgeCostValue = document.getElementById('forge-cost-value');
        this.forgeUpgradeStats = document.getElementById('forge-upgrade-stats');
        this.btnForgeUpgrade = document.getElementById('btn-forge-upgrade');
        this.btnForgeUpgrade1 = document.getElementById('btn-forge-upgrade-1');
        this.btnForgeUpgrade10 = document.getElementById('btn-forge-upgrade-10');
        this.btnCloseForge = document.getElementById('btn-close-forge');

        // Potency
        this.forgePotencyList = document.getElementById('forge-potency-list');
        this.forgePotencyInfo = document.getElementById('forge-potency-info');
        this.forgePotencyItemName = document.getElementById('forge-potency-item-name');
        this.forgePotencyStats = document.getElementById('forge-potency-stats');
        this.forgePotencyCostValue = document.getElementById('forge-potency-cost-value');
        this.btnForgePotency = document.getElementById('btn-forge-potency');

        // Tabs
        this.tabForgeUpgrade = document.getElementById('tab-forge-upgrade');
        this.tabForgePotency = document.getElementById('tab-forge-potency');
        this.tabForgeSocket = document.getElementById('tab-forge-socket');
        this.tabForgeGems = document.getElementById('tab-forge-gems');
        this.forgePanelUpgrade = document.getElementById('forge-panel-upgrade');
        this.forgePanelPotency = document.getElementById('forge-panel-potency');
        this.forgePanelSocket = document.getElementById('forge-panel-socket');
        this.forgePanelGems = document.getElementById('forge-panel-gems');

        // Socket
        this.forgeSocketList = document.getElementById('forge-socket-list');
        this.forgeSocketInfo = document.getElementById('forge-socket-info');
        this.forgeSocketItemName = document.getElementById('forge-socket-item-name');
        this.forgeSocketStats = document.getElementById('forge-socket-stats');
        this.forgeSocketCostHearts = document.getElementById('forge-socket-cost-hearts');
        this.forgeSocketCostShards = document.getElementById('forge-socket-cost-shards');
        this.btnForgeSocket = document.getElementById('btn-forge-socket');

        // Gems (insert)
        this.forgeGemEquipment = document.getElementById('forge-gem-equipment');
        this.forgeGemInventory = document.getElementById('forge-gem-inventory');
        this.forgeGemInfo = document.getElementById('forge-gem-info');
        this.forgeGemEquipName = document.getElementById('forge-gem-equip-name');
        this.forgeGemSocketSlots = document.getElementById('forge-gem-socket-slots');
        this.forgeGemSelectedName = document.getElementById('forge-gem-selected-name');
        this.forgeGemPreview = document.getElementById('forge-gem-preview');
        this.btnForgeInsertGem = document.getElementById('btn-forge-insert-gem');

        // Gem sub-tabs
        this.tabGemInsert = document.getElementById('tab-gem-insert');
        this.tabGemCombine = document.getElementById('tab-gem-combine');
        this.tabGemRemove = document.getElementById('tab-gem-remove');
        this.gemPanelInsert = document.getElementById('gem-panel-insert');
        this.gemPanelCombine = document.getElementById('gem-panel-combine');
        this.gemPanelRemove = document.getElementById('gem-panel-remove');

        // Gem combine
        this.forgeGemCombineInventory = document.getElementById('forge-gem-combine-inventory');
        this.forgeGemCombineSlots = document.getElementById('forge-gem-combine-slots');
        this.forgeGemCombineResult = document.getElementById('forge-gem-combine-result');
        this.forgeGemCombinePreview = document.getElementById('forge-gem-combine-preview');
        this.btnForgeCombineGem = document.getElementById('btn-forge-combine-gem');

        // Gem remove
        this.forgeGemRemoveEquipment = document.getElementById('forge-gem-remove-equipment');
        this.forgeGemRemoveInfo = document.getElementById('forge-gem-remove-info');
        this.forgeGemRemoveEquipName = document.getElementById('forge-gem-remove-equip-name');
        this.forgeGemRemoveSlots = document.getElementById('forge-gem-remove-slots');
        this.forgeGemRemovePreview = document.getElementById('forge-gem-remove-preview');
        this.btnForgeRemoveGem = document.getElementById('btn-forge-remove-gem');

        // --- Selection state ---
        this.selectedForgeSlot = null;
        this.selectedForgePotencySlot = null;
        this.selectedForgeSocketSlot = null;
        this.selectedGemEquipSlot = null;
        this.selectedGemSocketIndex = null;
        this.selectedGemInvIndex = null;
        this.selectedCombineGemIndices = [];
        this.selectedRemoveEquipSlot = null;
        this.selectedRemoveSocketIndex = null;
        this.currentGemSubTab = 'insert';

        // --- Callbacks (set by GameEngine) ---
        this.onForgeUpgrade = null;
        this.onForgePotency = null;
        this.onForgeSocket = null;
        this.onForgeInsertGem = null;
        this.onForgeCombineGem = null;
        this.onForgeRemoveGem = null;

        // --- Event listeners ---
        if (this.btnCloseForge) this.btnCloseForge.addEventListener('click', () => this.toggle());
        if (this.btnForgeUpgrade) this.btnForgeUpgrade.addEventListener('click', () => this.handleForgeUpgrade(1));
        if (this.btnForgeUpgrade1) this.btnForgeUpgrade1.addEventListener('click', () => this.handleForgeUpgrade(1));
        if (this.btnForgeUpgrade10) this.btnForgeUpgrade10.addEventListener('click', () => this.handleForgeUpgrade(10));
        if (this.btnForgePotency) this.btnForgePotency.addEventListener('click', () => this.handleForgePotency());
        if (this.btnForgeSocket) this.btnForgeSocket.addEventListener('click', () => this.handleForgeSocket());
        if (this.btnForgeInsertGem) this.btnForgeInsertGem.addEventListener('click', () => this.handleForgeInsertGem());
        if (this.btnForgeCombineGem) this.btnForgeCombineGem.addEventListener('click', () => this.handleForgeCombineGem());
        if (this.btnForgeRemoveGem) this.btnForgeRemoveGem.addEventListener('click', () => this.handleForgeRemoveGem());

        if (this.tabForgeUpgrade) this.tabForgeUpgrade.addEventListener('click', () => this.switchForgeTab('upgrade'));
        if (this.tabForgePotency) this.tabForgePotency.addEventListener('click', () => this.switchForgeTab('potency'));
        if (this.tabForgeSocket) this.tabForgeSocket.addEventListener('click', () => this.switchForgeTab('socket'));
        if (this.tabForgeGems) this.tabForgeGems.addEventListener('click', () => this.switchForgeTab('gems'));

        if (this.tabGemInsert) this.tabGemInsert.addEventListener('click', () => this.switchGemSubTab('insert'));
        if (this.tabGemCombine) this.tabGemCombine.addEventListener('click', () => this.switchGemSubTab('combine'));
        if (this.tabGemRemove) this.tabGemRemove.addEventListener('click', () => this.switchGemSubTab('remove'));
    }

    /** @returns {boolean} */
    get isOpen() {
        return this.forgeScreen && this.forgeScreen.style.display === 'flex';
    }

    /** Close forge (used by handleEscape). */
    close() {
        if (this.forgeScreen) this.forgeScreen.style.display = 'none';
    }

    toggle() {
        const isHidden = this.forgeScreen.style.display === 'none' || this.forgeScreen.style.display === '';
        this.forgeScreen.style.display = isHidden ? 'flex' : 'none';

        if (isHidden) {
            if (this.ctx.inventoryScreen) this.ctx.inventoryScreen.style.display = 'block';
            this.switchForgeTab('upgrade');
            const player = this.ctx.getLastPlayer();
            if (player) {
                this.updateForgeUI(player);
                this.updateForgePotencyUI(player);
                this.updateForgeSocketUI(player);
                this.updateForgeGemsUI(player);
            }
        } else {
            this.selectedForgeSlot = null;
            this.selectedForgePotencySlot = null;
            this.selectedForgeSocketSlot = null;
            this.selectedGemEquipSlot = null;
            this.selectedGemSocketIndex = null;
            this.selectedGemInvIndex = null;
            this.forgeUpgradeInfo.style.display = 'none';
            this.forgePotencyInfo.style.display = 'none';
            this.forgeSocketInfo.style.display = 'none';
            if (this.forgeGemInfo) this.forgeGemInfo.style.display = 'none';
        }
    }

    // ------------------------------------------------------------------
    // Tab switching
    // ------------------------------------------------------------------

    switchForgeTab(tab) {
        if (this.tabForgeUpgrade) this.tabForgeUpgrade.classList.toggle('is-active', tab === 'upgrade');
        if (this.tabForgePotency) this.tabForgePotency.classList.toggle('is-active', tab === 'potency');
        if (this.tabForgeSocket) this.tabForgeSocket.classList.toggle('is-active', tab === 'socket');
        if (this.tabForgeGems) this.tabForgeGems.classList.toggle('is-active', tab === 'gems');

        if (this.forgePanelUpgrade) this.forgePanelUpgrade.style.display = 'none';
        if (this.forgePanelPotency) this.forgePanelPotency.style.display = 'none';
        if (this.forgePanelSocket) this.forgePanelSocket.style.display = 'none';
        if (this.forgePanelGems) this.forgePanelGems.style.display = 'none';

        if (tab === 'upgrade') {
            if (this.forgePanelUpgrade) this.forgePanelUpgrade.style.display = 'flex';
        } else if (tab === 'potency') {
            if (this.forgePanelPotency) this.forgePanelPotency.style.display = 'flex';
        } else if (tab === 'socket') {
            if (this.forgePanelSocket) this.forgePanelSocket.style.display = 'flex';
        } else if (tab === 'gems') {
            if (this.forgePanelGems) this.forgePanelGems.style.display = 'flex';
            const player = this.ctx.getLastPlayer();
            if (player) this.updateForgeGemsUI(player);
        }
    }

    switchGemSubTab(tab) {
        this.currentGemSubTab = tab;

        if (this.tabGemInsert) this.tabGemInsert.classList.toggle('is-active', tab === 'insert');
        if (this.tabGemCombine) this.tabGemCombine.classList.toggle('is-active', tab === 'combine');
        if (this.tabGemRemove) this.tabGemRemove.classList.toggle('is-active', tab === 'remove');

        if (this.gemPanelInsert) this.gemPanelInsert.style.display = tab === 'insert' ? 'flex' : 'none';
        if (this.gemPanelCombine) this.gemPanelCombine.style.display = tab === 'combine' ? 'flex' : 'none';
        if (this.gemPanelRemove) this.gemPanelRemove.style.display = tab === 'remove' ? 'flex' : 'none';

        this.selectedCombineGemIndices = [];
        this.selectedRemoveEquipSlot = null;
        this.selectedRemoveSocketIndex = null;

        const player = this.ctx.getLastPlayer();
        if (player) {
            if (tab === 'combine') this.updateGemCombineUI(player);
            else if (tab === 'remove') this.updateGemRemoveUI(player);
        }
    }

    // ------------------------------------------------------------------
    // Upgrade
    // ------------------------------------------------------------------

    /** @private */
    _equipSlots() {
        return ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'ring1', 'ring2', 'trinket1', 'trinket2', 'neck'];
    }

    _getInventoryStackCount(item) {
        if (!item) return 0;
        return item.stack && item.stack > 0 ? item.stack : 1;
    }

    _isHeartItem(item) {
        if (!item) return false;
        return item.name === 'Eidolon Heart' || item.name === 'Heart';
    }

    _isShardItem(item) {
        if (!item) return false;
        return item.name === 'Eidolon Shard' || item.name === 'Shard';
    }

    _isGemItem(item) {
        if (!item) return false;
        return item.type === 'Gem' || item.type === 'GEM';
    }

    _countInventoryItems(player, matcher) {
        if (!player || !player.inventory) return 0;

        return player.inventory.reduce((total, item) => {
            if (!matcher(item)) return total;
            return total + this._getInventoryStackCount(item);
        }, 0);
    }

    updateForgeUI(player) {
        if (!this.forgeEquipmentList) return;

        const slots = this._equipSlots();
        const existingEls = {};
        Array.from(this.forgeEquipmentList.children).forEach(child => {
            existingEls[child.dataset.slot] = child;
        });

        slots.forEach(slot => {
            const item = player.equipment ? player.equipment[slot] : null;
            let el = existingEls[slot];

            if (item) {
                if (!el) {
                    el = document.createElement('div');
                    el.className = 'inv-slot';
                    el.dataset.slot = slot;
                    el.style.position = 'relative';
                    el.style.cursor = 'pointer';
                    el.style.pointerEvents = 'auto';

                    const levelDiv = document.createElement('div');
                    levelDiv.className = 'level-indicator';
                    levelDiv.style.position = 'absolute';
                    levelDiv.style.bottom = '2px';
                    levelDiv.style.right = '2px';
                    levelDiv.style.color = '#ffffff';
                    levelDiv.style.fontWeight = 'bold';
                    levelDiv.style.fontSize = '10px';
                    levelDiv.style.textShadow = '1px 1px 0 #000';
                    levelDiv.style.pointerEvents = 'none';
                    el.appendChild(levelDiv);

                    this.forgeEquipmentList.appendChild(el);
                }

                const iconPath = this.ctx.getItemIconPath(item);
                if (!el.style.backgroundImage.includes(iconPath)) {
                    el.style.backgroundImage = `url('${iconPath}')`;
                }
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';

                const color = item.rarity ? item.rarity.color : '#ffffff';
                const border = `1px solid ${color}`;
                if (el.dataset.originalBorder !== border) {
                    el.style.border = border;
                    el.dataset.originalBorder = border;
                }

                const levelDiv = el.querySelector('.level-indicator');
                if (levelDiv) levelDiv.textContent = `Lvl ${item.level}`;

                if (this.selectedForgeSlot === slot) {
                    el.style.boxShadow = '0 0 10px #ffd700';
                    el.style.borderColor = '#ffd700';
                } else {
                    el.style.boxShadow = 'none';
                    el.style.border = el.dataset.originalBorder;
                }

                el.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedForgeSlot = slot;
                    this.updateForgeInfo(item);
                    Array.from(this.forgeEquipmentList.children).forEach(child => {
                        if (child.dataset.slot === slot) {
                            child.style.boxShadow = '0 0 10px #ffd700';
                            child.style.borderColor = '#ffd700';
                        } else {
                            child.style.boxShadow = 'none';
                            child.style.border = child.dataset.originalBorder;
                        }
                    });
                };

                el.title = `${item.name} (Lvl ${item.level})`;
            } else {
                if (el) el.remove();
            }
        });
    }

    updateForgeInfo(item) {
        if (!item) return;
        this.forgeUpgradeInfo.style.display = 'flex';
        if (this.forgeSelectedItemName) {
            this.forgeSelectedItemName.textContent = item.name;
            this.forgeSelectedItemName.style.color = item.rarity ? item.rarity.color : 'white';
        }

        let perLevelCost = 0;
        if (item.level < 90) {
            const tier = Math.floor(item.level / 10);
            const baseTierCost = Math.pow(2, tier);
            perLevelCost = Math.floor(baseTierCost / 100);
            if (perLevelCost < 1) perLevelCost = 1;
        } else {
            perLevelCost = 2;
        }

        const cost1 = perLevelCost;
        const targetLevel1 = item.level + 1;

        let cost10 = perLevelCost * 10;
        let targetLevel10 = item.level + 10;
        if (targetLevel10 > 100) {
            targetLevel10 = 100;
            const actualLevels = targetLevel10 - item.level;
            cost10 = perLevelCost * actualLevels;
        }

        if (this.forgeCostValue) {
            if (item.level >= 100) {
                this.forgeCostValue.textContent = "MAX";
            } else {
                this.forgeCostValue.textContent = `${cost1} (1 Lvl) / ${cost10} (10 Lvl)`;
            }
        }

        if (item.level >= 100) {
            if (this.btnForgeUpgrade1) this.btnForgeUpgrade1.disabled = true;
            if (this.btnForgeUpgrade10) this.btnForgeUpgrade10.disabled = true;
            if (this.forgeUpgradeStats) this.forgeUpgradeStats.innerHTML = '';
            return;
        }

        if (this.btnForgeUpgrade1) {
            this.btnForgeUpgrade1.disabled = false;
            this.btnForgeUpgrade1.textContent = `+1 Level (${cost1})`;
        }
        if (this.btnForgeUpgrade10) {
            this.btnForgeUpgrade10.disabled = false;
            this.btnForgeUpgrade10.textContent = `+${targetLevel10 - item.level} Levels (${cost10})`;
        }

        if (this.forgeUpgradeStats) {
            let statsHtml = '<div style="margin-top: 10px; font-size: 12px;">';
            statsHtml += `<div style="color: #aaa; margin-bottom: 5px;">Level: ${item.level} <span style="color: #0f0;">-> ${targetLevel1} / ${targetLevel10}</span></div>`;
            if (item.stats) {
                const currentMult = 1.0 + (item.level * 0.15);
                const nextMult1 = 1.0 + (targetLevel1 * 0.15);
                const ratio1 = nextMult1 / currentMult;
                const nextMult10 = 1.0 + (targetLevel10 * 0.15);
                const ratio10 = nextMult10 / currentMult;
                for (const [stat, value] of Object.entries(item.stats)) {
                    const nextValue1 = Math.floor(value * ratio1);
                    const nextValue10 = Math.floor(value * ratio10);
                    statsHtml += `<div>${stat}: ${value} <span style="color: #0f0;">-> ${nextValue1} / ${nextValue10}</span></div>`;
                }
            }
            statsHtml += '</div>';
            this.forgeUpgradeStats.innerHTML = statsHtml;
        }
    }

    handleForgeUpgrade(amount) {
        if (!this.selectedForgeSlot) return;
        if (this.onForgeUpgrade) this.onForgeUpgrade(this.selectedForgeSlot, amount);
    }

    // ------------------------------------------------------------------
    // Potency
    // ------------------------------------------------------------------

    updateForgePotencyUI(player) {
        if (!this.forgePotencyList) return;

        const slots = this._equipSlots();
        const existingEls = {};
        Array.from(this.forgePotencyList.children).forEach(child => {
            existingEls[child.dataset.slot] = child;
        });

        slots.forEach(slot => {
            const item = player.equipment ? player.equipment[slot] : null;
            let el = existingEls[slot];

            if (item) {
                if (!el) {
                    el = document.createElement('div');
                    el.className = 'inv-slot';
                    el.dataset.slot = slot;
                    el.style.position = 'relative';
                    el.style.cursor = 'pointer';
                    el.style.pointerEvents = 'auto';

                    const potencyDiv = document.createElement('div');
                    potencyDiv.className = 'potency-indicator';
                    potencyDiv.style.position = 'absolute';
                    potencyDiv.style.bottom = '2px';
                    potencyDiv.style.right = '2px';
                    potencyDiv.style.color = '#00ff00';
                    potencyDiv.style.fontWeight = 'bold';
                    potencyDiv.style.fontSize = '10px';
                    potencyDiv.style.textShadow = '1px 1px 0 #000';
                    potencyDiv.style.pointerEvents = 'none';
                    el.appendChild(potencyDiv);

                    this.forgePotencyList.appendChild(el);
                }

                const iconPath = this.ctx.getItemIconPath(item);
                if (!el.style.backgroundImage.includes(iconPath)) {
                    el.style.backgroundImage = `url('${iconPath}')`;
                }
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';

                const color = item.rarity ? item.rarity.color : '#ffffff';
                const border = `1px solid ${color}`;
                if (el.dataset.originalBorder !== border) {
                    el.style.border = border;
                    el.dataset.originalBorder = border;
                }

                const potencyDiv = el.querySelector('.potency-indicator');
                if (potencyDiv) {
                    if (item.potency > 0) {
                        potencyDiv.style.display = 'block';
                        potencyDiv.textContent = `+${item.potency}`;
                    } else {
                        potencyDiv.style.display = 'none';
                    }
                }

                if (this.selectedForgePotencySlot === slot) {
                    el.style.boxShadow = '0 0 10px #ff4444';
                    el.style.borderColor = '#ff4444';
                } else {
                    el.style.boxShadow = 'none';
                    el.style.border = el.dataset.originalBorder;
                }

                el.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedForgePotencySlot = slot;
                    this.updateForgePotencyInfo(item);
                    Array.from(this.forgePotencyList.children).forEach(child => {
                        if (child.dataset.slot === slot) {
                            child.style.boxShadow = '0 0 10px #ff4444';
                            child.style.borderColor = '#ff4444';
                        } else {
                            child.style.boxShadow = 'none';
                            child.style.border = child.dataset.originalBorder;
                        }
                    });
                };

                el.title = `${item.name} (Potency +${item.potency || 0})`;
            } else {
                if (el) el.remove();
            }
        });
    }

    updateForgePotencyInfo(item, player = this.ctx.getLastPlayer()) {
        if (!item) return;
        this.forgePotencyInfo.style.display = 'flex';
        if (this.forgePotencyItemName) {
            this.forgePotencyItemName.textContent = item.name;
            this.forgePotencyItemName.style.color = item.rarity ? item.rarity.color : 'white';
        }

        const currentPotency = item.potency || 0;
        if (currentPotency >= 20) {
            if (this.forgePotencyCostValue) this.forgePotencyCostValue.textContent = "MAX";
            if (this.btnForgePotency) this.btnForgePotency.disabled = true;
            if (this.forgePotencyStats) this.forgePotencyStats.innerHTML = '';
            return;
        }

        const cost = Math.pow(2, currentPotency);
        const availableHearts = this._countInventoryItems(player, (invItem) => this._isHeartItem(invItem));
        const hasEnoughHearts = availableHearts >= cost;
        if (this.forgePotencyCostValue) this.forgePotencyCostValue.textContent = cost;
        if (this.forgePotencyCostValue) this.forgePotencyCostValue.style.color = hasEnoughHearts ? '#00ff88' : '#ff4444';
        if (this.btnForgePotency) {
            this.btnForgePotency.disabled = !hasEnoughHearts;
            this.btnForgePotency.textContent = hasEnoughHearts
                ? `Empower to +${currentPotency + 1}`
                : `Need ${cost - availableHearts} More Hearts`;
        }

        if (this.forgePotencyStats) {
            let statsHtml = '<div style="margin-top: 10px; font-size: 12px;">';
            statsHtml += '<div style="color: #8fb7d9; margin-bottom: 6px;">Potency permanently boosts this item. Hearts are the fuel for each rank.</div>';
            statsHtml += `<div style="color: #aaa; margin-bottom: 5px;">Potency: +${currentPotency} <span style="color: #0f0;">-> +${currentPotency + 1}</span></div>`;
            if (item.stats) {
                const currentMult = 1.0 + (currentPotency * 0.1);
                const nextMult = 1.0 + ((currentPotency + 1) * 0.1);
                const ratio = nextMult / currentMult;
                for (const [stat, value] of Object.entries(item.stats)) {
                    const nextValue = Math.floor(value * ratio);
                    statsHtml += `<div>${stat}: ${value} <span style="color: #0f0;">-> ${nextValue}</span></div>`;
                }
            }
            const resourceColor = hasEnoughHearts ? '#00ff88' : '#ff6666';
            statsHtml += `<div style="color: ${resourceColor}; margin-top: 8px;">Hearts Available: ${availableHearts} / ${cost}</div>`;
            statsHtml += '</div>';
            this.forgePotencyStats.innerHTML = statsHtml;
        }
    }

    handleForgePotency() {
        if (!this.selectedForgePotencySlot) return;
        if (this.onForgePotency) this.onForgePotency(this.selectedForgePotencySlot);
    }

    // ------------------------------------------------------------------
    // Socket
    // ------------------------------------------------------------------

    updateForgeSocketUI(player) {
        if (!this.forgeSocketList) return;

        const slots = this._equipSlots();
        const existingEls = {};
        Array.from(this.forgeSocketList.children).forEach(child => {
            existingEls[child.dataset.slot] = child;
        });

        slots.forEach(slot => {
            const item = player.equipment ? player.equipment[slot] : null;
            let el = existingEls[slot];

            if (item) {
                if (!el) {
                    el = document.createElement('div');
                    el.className = 'inv-slot';
                    el.dataset.slot = slot;
                    el.style.position = 'relative';
                    el.style.cursor = 'pointer';
                    el.style.pointerEvents = 'auto';

                    const socketDiv = document.createElement('div');
                    socketDiv.className = 'socket-indicator';
                    socketDiv.style.position = 'absolute';
                    socketDiv.style.bottom = '2px';
                    socketDiv.style.left = '2px';
                    socketDiv.style.display = 'flex';
                    socketDiv.style.gap = '1px';
                    socketDiv.style.pointerEvents = 'none';
                    el.appendChild(socketDiv);

                    this.forgeSocketList.appendChild(el);
                }

                const iconPath = this.ctx.getItemIconPath(item);
                if (!el.style.backgroundImage.includes(iconPath)) {
                    el.style.backgroundImage = `url('${iconPath}')`;
                }
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';

                const color = item.rarity ? item.rarity.color : '#ffffff';
                const border = `1px solid ${color}`;
                if (el.dataset.originalBorder !== border) {
                    el.style.border = border;
                    el.dataset.originalBorder = border;
                }

                const socketDiv = el.querySelector('.socket-indicator');
                if (socketDiv) {
                    socketDiv.innerHTML = '';
                    const sockets = item.sockets || 0;
                    if (sockets > 0) {
                        for (let i = 0; i < sockets; i++) {
                            const dot = document.createElement('div');
                            dot.style.width = '4px';
                            dot.style.height = '4px';
                            dot.style.borderRadius = '50%';
                            dot.style.backgroundColor = '#00ffff';
                            dot.style.boxShadow = '0 0 2px #00ffff';
                            socketDiv.appendChild(dot);
                        }
                    }
                }

                if (this.selectedForgeSocketSlot === slot) {
                    el.style.boxShadow = '0 0 10px #00ffff';
                    el.style.borderColor = '#00ffff';
                } else {
                    el.style.boxShadow = 'none';
                    el.style.border = el.dataset.originalBorder;
                }

                el.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedForgeSocketSlot = slot;
                    this.updateForgeSocketInfo(item);
                    Array.from(this.forgeSocketList.children).forEach(child => {
                        if (child.dataset.slot === slot) {
                            child.style.boxShadow = '0 0 10px #00ffff';
                            child.style.borderColor = '#00ffff';
                        } else {
                            child.style.boxShadow = 'none';
                            child.style.border = child.dataset.originalBorder;
                        }
                    });
                };

                el.title = `${item.name} (Sockets: ${item.sockets || 0})`;
            } else {
                if (el) el.remove();
            }
        });
    }

    updateForgeSocketInfo(item, player = this.ctx.getLastPlayer()) {
        if (!item) return;
        this.forgeSocketInfo.style.display = 'flex';
        if (this.forgeSocketItemName) {
            this.forgeSocketItemName.textContent = item.name;
            this.forgeSocketItemName.style.color = item.rarity ? item.rarity.color : 'white';
        }

        const currentSockets = item.sockets || 0;
        if (currentSockets >= 4) {
            if (this.forgeSocketCostHearts) this.forgeSocketCostHearts.textContent = "MAX";
            if (this.forgeSocketCostShards) this.forgeSocketCostShards.textContent = "MAX";
            if (this.btnForgeSocket) this.btnForgeSocket.disabled = true;
            if (this.forgeSocketStats) this.forgeSocketStats.innerHTML = '';
            return;
        }

        const shardCost = 250 * Math.pow(2, currentSockets);
        const heartCost = 25;
        const availableHearts = this._countInventoryItems(player, (invItem) => this._isHeartItem(invItem));
        const availableShards = this._countInventoryItems(player, (invItem) => this._isShardItem(invItem));
        const hasEnoughHearts = availableHearts >= heartCost;
        const hasEnoughShards = availableShards >= shardCost;
        const hasEnoughResources = hasEnoughHearts && hasEnoughShards;

        if (this.forgeSocketCostHearts) this.forgeSocketCostHearts.textContent = heartCost;
        if (this.forgeSocketCostShards) this.forgeSocketCostShards.textContent = shardCost;
        if (this.forgeSocketCostHearts) this.forgeSocketCostHearts.style.color = hasEnoughHearts ? '#00ff88' : '#ff4444';
        if (this.forgeSocketCostShards) this.forgeSocketCostShards.style.color = hasEnoughShards ? '#00ff88' : '#ffd700';
        if (this.btnForgeSocket) {
            this.btnForgeSocket.disabled = !hasEnoughResources;
            this.btnForgeSocket.textContent = hasEnoughResources
                ? `Add Socket (${currentSockets + 1}/4)`
                : 'Missing Forge Materials';
        }

        if (this.forgeSocketStats) {
            let statsHtml = '<div style="margin-top: 10px; font-size: 12px;">';
            statsHtml += '<div style="color: #8fb7d9; margin-bottom: 6px;">Sockets let this item hold gems. Opening one costs Hearts and Shards.</div>';
            statsHtml += `<div style="color: #aaa; margin-bottom: 5px;">Sockets: ${currentSockets} <span style="color: #0f0;">-> ${currentSockets + 1}</span></div>`;
            statsHtml += `<div style="color: ${hasEnoughHearts ? '#00ff88' : '#ff6666'}; margin-top: 8px;">Hearts Available: ${availableHearts} / ${heartCost}</div>`;
            statsHtml += `<div style="color: ${hasEnoughShards ? '#00ff88' : '#ffdd66'};">Shards Available: ${availableShards} / ${shardCost}</div>`;
            statsHtml += '</div>';
            this.forgeSocketStats.innerHTML = statsHtml;
        }
    }

    handleForgeSocket() {
        if (!this.selectedForgeSocketSlot) return;
        if (this.onForgeSocket) this.onForgeSocket(this.selectedForgeSocketSlot);
    }

    // ------------------------------------------------------------------
    // Gems — Insert
    // ------------------------------------------------------------------

    updateForgeGemsUI(player) {
        if (!this.forgeGemEquipment || !this.forgeGemInventory) return;

        this.forgeGemEquipment.innerHTML = '';
        this.forgeGemInventory.innerHTML = '';

        const slots = this._equipSlots();

        slots.forEach(slot => {
            const item = player.equipment ? player.equipment[slot] : null;
            if (item && item.sockets && item.sockets > 0) {
                const el = document.createElement('div');
                el.className = 'inv-slot';
                el.style.position = 'relative';
                el.style.cursor = 'pointer';
                el.style.width = '48px';
                el.style.height = '48px';

                const iconPath = this.ctx.getItemIconPath(item);
                el.style.backgroundImage = `url('${iconPath}')`;
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';

                const color = item.rarity ? item.rarity.color : '#ffffff';
                el.style.border = `1px solid ${color}`;

                const socketDiv = document.createElement('div');
                socketDiv.style.position = 'absolute';
                socketDiv.style.bottom = '2px';
                socketDiv.style.left = '2px';
                socketDiv.style.display = 'flex';
                socketDiv.style.gap = '2px';

                const usedSockets = item.gems ? item.gems.length : 0;
                for (let i = 0; i < item.sockets; i++) {
                    const dot = document.createElement('div');
                    dot.style.width = '6px';
                    dot.style.height = '6px';
                    dot.style.borderRadius = '50%';
                    if (i < usedSockets) {
                        const gem = item.gems[i];
                        const gemType = GEM_TYPES[gem.type];
                        dot.style.backgroundColor = gemType ? gemType.color : '#ff00ff';
                        dot.style.boxShadow = `0 0 3px ${gemType ? gemType.color : '#ff00ff'}`;
                    } else {
                        dot.style.backgroundColor = '#333';
                        dot.style.border = '1px solid #666';
                    }
                    socketDiv.appendChild(dot);
                }
                el.appendChild(socketDiv);

                if (this.selectedGemEquipSlot === slot) {
                    el.style.boxShadow = '0 0 10px #ff00ff';
                    el.style.borderColor = '#ff00ff';
                }

                el.onclick = () => {
                    this.selectedGemEquipSlot = slot;
                    this.selectedGemSocketIndex = null;
                    this.updateForgeGemsUI(player);
                    this.updateForgeGemInfo(item, player);
                };

                el.title = `${item.name} (${usedSockets}/${item.sockets} gems)`;
                this.forgeGemEquipment.appendChild(el);
            }
        });

        // Gems in inventory
        if (player.inventory) {
            player.inventory.forEach((item, index) => {
                if (this._isGemItem(item)) {
                    const el = document.createElement('div');
                    el.className = 'inv-slot';
                    el.style.cursor = 'pointer';
                    el.style.width = '48px';
                    el.style.height = '48px';
                    el.style.display = 'flex';
                    el.style.alignItems = 'center';
                    el.style.justifyContent = 'center';

                    const gemType = GEM_TYPES[item.gemType];
                    const gemQuality = GEM_QUALITIES[item.gemQuality];
                    const gemColor = gemType ? gemType.color : '#ff00ff';

                    el.style.backgroundColor = '#1a1a1a';
                    el.style.border = `1px solid ${gemColor}`;
                    el.innerHTML = `<div style="color: ${gemColor}; font-size: 24px; text-shadow: 0 0 5px ${gemColor};">◆</div>`;

                    if (this.selectedGemInvIndex === index) {
                        el.style.boxShadow = '0 0 10px #ff00ff';
                        el.style.borderColor = '#ff00ff';
                    }

                    el.onclick = () => {
                        this.selectedGemInvIndex = index;
                        this.updateForgeGemsUI(player);
                        this.updateForgeGemInfo(null, player);
                    };

                    el.title = `${gemQuality ? gemQuality.name : ''} ${gemType ? gemType.name : 'Gem'}`;
                    this.forgeGemInventory.appendChild(el);
                }
            });
        }

        if (this.forgeGemInventory.children.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '10px';
            msg.style.textAlign = 'center';
            msg.style.gridColumn = '1 / -1';
            msg.textContent = 'No gems in inventory';
            this.forgeGemInventory.appendChild(msg);
        }

        if (this.forgeGemEquipment.children.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '10px';
            msg.style.textAlign = 'center';
            msg.style.gridColumn = '1 / -1';
            msg.textContent = 'No equipment with sockets';
            this.forgeGemEquipment.appendChild(msg);
        }
    }

    updateForgeGemInfo(item, player) {
        if (!this.forgeGemInfo) return;

        const equipItem = item || (this.selectedGemEquipSlot && player.equipment ? player.equipment[this.selectedGemEquipSlot] : null);
        const gemItem = this.selectedGemInvIndex !== null && player.inventory ? player.inventory[this.selectedGemInvIndex] : null;

        if (!equipItem || !this.selectedGemEquipSlot) {
            this.forgeGemInfo.style.display = 'none';
            return;
        }

        this.forgeGemInfo.style.display = 'flex';

        if (this.forgeGemEquipName) {
            this.forgeGemEquipName.textContent = equipItem.name;
            this.forgeGemEquipName.style.color = equipItem.rarity ? equipItem.rarity.color : '#fff';
        }

        if (this.forgeGemSocketSlots) {
            this.forgeGemSocketSlots.innerHTML = '';
            const usedSockets = equipItem.gems ? equipItem.gems.length : 0;

            for (let i = 0; i < equipItem.sockets; i++) {
                const socketEl = document.createElement('div');
                socketEl.style.width = '20px';
                socketEl.style.height = '20px';
                socketEl.style.borderRadius = '3px';
                socketEl.style.cursor = 'pointer';
                socketEl.style.display = 'flex';
                socketEl.style.alignItems = 'center';
                socketEl.style.justifyContent = 'center';

                if (i < usedSockets) {
                    const gem = equipItem.gems[i];
                    const gemType = GEM_TYPES[gem.type];
                    const gemColor = gemType ? gemType.color : '#ff00ff';
                    socketEl.style.backgroundColor = '#222';
                    socketEl.style.border = `2px solid ${gemColor}`;
                    socketEl.innerHTML = `<span style="color: ${gemColor};">◆</span>`;
                    socketEl.title = `${gem.quality || ''} ${gemType ? gemType.name : 'Gem'} (filled)`;
                } else {
                    socketEl.style.backgroundColor = '#111';
                    socketEl.style.border = '2px dashed #444';
                    socketEl.title = 'Empty socket';

                    if (this.selectedGemSocketIndex === i) {
                        socketEl.style.borderColor = '#ff00ff';
                        socketEl.style.boxShadow = '0 0 5px #ff00ff';
                    }

                    socketEl.onclick = () => {
                        this.selectedGemSocketIndex = i;
                        this.updateForgeGemInfo(equipItem, player);
                    };
                }

                this.forgeGemSocketSlots.appendChild(socketEl);
            }
        }

        if (this.forgeGemSelectedName) {
            if (gemItem) {
                const gemType = GEM_TYPES[gemItem.gemType];
                const gemQuality = GEM_QUALITIES[gemItem.gemQuality];
                this.forgeGemSelectedName.textContent = `${gemQuality ? gemQuality.name : ''} ${gemType ? gemType.name : 'Gem'}`;
                this.forgeGemSelectedName.style.color = gemType ? gemType.color : '#ff00ff';
            } else {
                this.forgeGemSelectedName.textContent = 'Select a gem';
                this.forgeGemSelectedName.style.color = '#666';
            }
        }

        if (this.forgeGemPreview) {
            if (gemItem) {
                const gemStats = getGemStats(gemItem.gemType, gemItem.gemQuality);
                let preview = 'Stats: ';
                for (const stat in gemStats) {
                    preview += `+${gemStats[stat]} ${this.ctx.formatStatName(stat)} `;
                }
                this.forgeGemPreview.textContent = preview;
            } else {
                this.forgeGemPreview.textContent = '';
            }
        }

        if (this.btnForgeInsertGem) {
            const usedSockets = equipItem.gems ? equipItem.gems.length : 0;
            const hasEmptySocket = usedSockets < equipItem.sockets;
            const canInsert = gemItem && hasEmptySocket && this.selectedGemSocketIndex !== null;
            this.btnForgeInsertGem.disabled = !canInsert;
        }
    }

    handleForgeInsertGem() {
        if (!this.selectedGemEquipSlot || this.selectedGemInvIndex === null || this.selectedGemSocketIndex === null) return;

        if (this.onForgeInsertGem) {
            this.onForgeInsertGem(this.selectedGemEquipSlot, this.selectedGemInvIndex, this.selectedGemSocketIndex);
        }

        this.selectedGemInvIndex = null;
        this.selectedGemSocketIndex = null;

        const player = this.ctx.getLastPlayer();
        if (player) {
            this.updateForgeGemsUI(player);
            this.updateForgeGemInfo(null, player);
        }
    }

    // ------------------------------------------------------------------
    // Gems — Combine
    // ------------------------------------------------------------------

    updateGemCombineUI(player) {
        if (!this.forgeGemCombineInventory) return;

        this.forgeGemCombineInventory.innerHTML = '';

        if (player.inventory) {
            player.inventory.forEach((item, index) => {
                if (this._isGemItem(item)) {
                    const el = document.createElement('div');
                    el.className = 'inv-slot';
                    el.style.cursor = 'pointer';
                    el.style.width = '40px';
                    el.style.height = '40px';
                    el.style.display = 'flex';
                    el.style.alignItems = 'center';
                    el.style.justifyContent = 'center';
                    el.style.position = 'relative';

                    const gemType = GEM_TYPES[item.gemType];
                    const gemQuality = GEM_QUALITIES[item.gemQuality];
                    const gemColor = gemType ? gemType.color : '#ff00ff';

                    el.style.backgroundColor = '#1a1a1a';
                    el.style.border = `1px solid ${gemColor}`;
                    el.innerHTML = `<div style="color: ${gemColor}; font-size: 20px; text-shadow: 0 0 5px ${gemColor};">◆</div>`;

                    const isSelected = this.selectedCombineGemIndices.includes(index);
                    if (isSelected) {
                        el.style.boxShadow = '0 0 10px #ff00ff';
                        el.style.borderColor = '#ff00ff';
                        const num = this.selectedCombineGemIndices.indexOf(index) + 1;
                        el.innerHTML += `<div style="position: absolute; top: 2px; right: 2px; color: #ff00ff; font-size: 10px; font-weight: bold;">${num}</div>`;
                    }

                    let canSelect = true;
                    if (this.selectedCombineGemIndices.length > 0 && !isSelected) {
                        const firstGem = player.inventory[this.selectedCombineGemIndices[0]];
                        if (firstGem.gemType !== item.gemType || firstGem.gemQuality !== item.gemQuality) {
                            canSelect = false;
                            el.style.opacity = '0.4';
                        }
                    }

                    if (item.gemQuality === 'Radiant') {
                        el.style.opacity = '0.4';
                        canSelect = false;
                    }

                    el.onclick = () => {
                        if (!canSelect && !isSelected) return;
                        if (isSelected) {
                            this.selectedCombineGemIndices = this.selectedCombineGemIndices.filter(i => i !== index);
                        } else if (this.selectedCombineGemIndices.length < 3) {
                            this.selectedCombineGemIndices.push(index);
                        }
                        this.updateGemCombineUI(player);
                    };

                    el.title = `${gemQuality ? gemQuality.name : ''} ${gemType ? gemType.name : 'Gem'}`;
                    this.forgeGemCombineInventory.appendChild(el);
                }
            });
        }

        if (this.forgeGemCombineInventory.children.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '10px';
            msg.style.textAlign = 'center';
            msg.style.gridColumn = '1 / -1';
            msg.textContent = 'No gems in inventory';
            this.forgeGemCombineInventory.appendChild(msg);
        }

        this.updateGemCombineSlots(player);
    }

    updateGemCombineSlots(player) {
        if (!this.forgeGemCombineSlots || !this.forgeGemCombineResult) return;

        const slots = this.forgeGemCombineSlots.children;
        for (let i = 0; i < 3; i++) {
            const slot = slots[i];
            if (!slot) continue;

            if (this.selectedCombineGemIndices[i] !== undefined) {
                const gem = player.inventory[this.selectedCombineGemIndices[i]];
                const gemType = GEM_TYPES[gem.gemType];
                const gemColor = gemType ? gemType.color : '#ff00ff';
                slot.innerHTML = `<div style="color: ${gemColor}; font-size: 20px; text-shadow: 0 0 5px ${gemColor};">◆</div>`;
                slot.style.border = `2px solid ${gemColor}`;
            } else {
                slot.innerHTML = `${i + 1}`;
                slot.style.border = '2px dashed #444';
                slot.style.color = '#666';
            }
        }

        if (this.selectedCombineGemIndices.length === 3) {
            const firstGem = player.inventory[this.selectedCombineGemIndices[0]];
            const gemType = GEM_TYPES[firstGem.gemType];
            const gemColor = gemType ? gemType.color : '#ff00ff';

            const qualityOrder = ['Chipped', 'Flawed', 'Normal', 'Flawless', 'Perfect', 'Radiant'];
            const currentIdx = qualityOrder.indexOf(firstGem.gemQuality);
            const nextQuality = qualityOrder[currentIdx + 1];

            this.forgeGemCombineResult.innerHTML = `<div style="color: ${gemColor}; font-size: 24px; text-shadow: 0 0 8px ${gemColor};">◆</div>`;
            this.forgeGemCombineResult.style.border = `2px solid ${gemColor}`;

            if (this.forgeGemCombinePreview) {
                const nextQualityObj = GEM_QUALITIES[nextQuality];
                this.forgeGemCombinePreview.textContent = `Result: ${nextQualityObj ? nextQualityObj.name : nextQuality} ${gemType ? gemType.name : 'Gem'}`;
            }
        } else {
            this.forgeGemCombineResult.innerHTML = '?';
            this.forgeGemCombineResult.style.border = '2px solid #444';
            this.forgeGemCombineResult.style.color = '#666';

            if (this.forgeGemCombinePreview) {
                this.forgeGemCombinePreview.textContent = 'Select 3 gems of the same type and quality';
            }
        }

        if (this.btnForgeCombineGem) {
            this.btnForgeCombineGem.disabled = this.selectedCombineGemIndices.length !== 3;
        }
    }

    handleForgeCombineGem() {
        if (this.selectedCombineGemIndices.length !== 3) return;

        if (this.onForgeCombineGem) this.onForgeCombineGem(this.selectedCombineGemIndices);

        this.selectedCombineGemIndices = [];
        const player = this.ctx.getLastPlayer();
        if (player) this.updateGemCombineUI(player);
    }

    // ------------------------------------------------------------------
    // Gems — Remove
    // ------------------------------------------------------------------

    updateGemRemoveUI(player) {
        if (!this.forgeGemRemoveEquipment) return;

        this.forgeGemRemoveEquipment.innerHTML = '';

        const slots = this._equipSlots();

        slots.forEach(slot => {
            const item = player.equipment ? player.equipment[slot] : null;
            if (item && item.gems && item.gems.length > 0) {
                const el = document.createElement('div');
                el.className = 'inv-slot';
                el.style.position = 'relative';
                el.style.cursor = 'pointer';
                el.style.width = '48px';
                el.style.height = '48px';

                const iconPath = this.ctx.getItemIconPath(item);
                el.style.backgroundImage = `url('${iconPath}')`;
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';

                const color = item.rarity ? item.rarity.color : '#ffffff';
                el.style.border = `1px solid ${color}`;

                const socketDiv = document.createElement('div');
                socketDiv.style.position = 'absolute';
                socketDiv.style.bottom = '2px';
                socketDiv.style.left = '2px';
                socketDiv.style.display = 'flex';
                socketDiv.style.gap = '2px';

                for (let i = 0; i < item.gems.length; i++) {
                    const dot = document.createElement('div');
                    dot.style.width = '6px';
                    dot.style.height = '6px';
                    dot.style.borderRadius = '50%';
                    const gem = item.gems[i];
                    const gemType = GEM_TYPES[gem.type];
                    dot.style.backgroundColor = gemType ? gemType.color : '#ff00ff';
                    dot.style.boxShadow = `0 0 3px ${gemType ? gemType.color : '#ff00ff'}`;
                    socketDiv.appendChild(dot);
                }
                el.appendChild(socketDiv);

                if (this.selectedRemoveEquipSlot === slot) {
                    el.style.boxShadow = '0 0 10px #ff4444';
                    el.style.borderColor = '#ff4444';
                }

                el.onclick = () => {
                    this.selectedRemoveEquipSlot = slot;
                    this.selectedRemoveSocketIndex = null;
                    this.updateGemRemoveUI(player);
                    this.updateGemRemoveInfo(item, player);
                };

                el.title = `${item.name} (${item.gems.length} gems)`;
                this.forgeGemRemoveEquipment.appendChild(el);
            }
        });

        if (this.forgeGemRemoveEquipment.children.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '10px';
            msg.style.textAlign = 'center';
            msg.style.gridColumn = '1 / -1';
            msg.textContent = 'No equipment with socketed gems';
            this.forgeGemRemoveEquipment.appendChild(msg);
        }

        if (this.selectedRemoveEquipSlot && player.equipment) {
            this.updateGemRemoveInfo(player.equipment[this.selectedRemoveEquipSlot], player);
        } else if (this.forgeGemRemoveInfo) {
            this.forgeGemRemoveInfo.style.display = 'none';
        }
    }

    updateGemRemoveInfo(item, player) {
        if (!this.forgeGemRemoveInfo || !item || !item.gems || item.gems.length === 0) {
            if (this.forgeGemRemoveInfo) this.forgeGemRemoveInfo.style.display = 'none';
            return;
        }

        this.forgeGemRemoveInfo.style.display = 'flex';

        if (this.forgeGemRemoveEquipName) {
            this.forgeGemRemoveEquipName.textContent = item.name;
            this.forgeGemRemoveEquipName.style.color = item.rarity ? item.rarity.color : '#fff';
        }

        if (this.forgeGemRemoveSlots) {
            this.forgeGemRemoveSlots.innerHTML = '';

            for (let i = 0; i < item.gems.length; i++) {
                const gem = item.gems[i];
                const gemType = GEM_TYPES[gem.type];
                const gemColor = gemType ? gemType.color : '#ff00ff';

                const socketEl = document.createElement('div');
                socketEl.style.width = '30px';
                socketEl.style.height = '30px';
                socketEl.style.borderRadius = '3px';
                socketEl.style.cursor = 'pointer';
                socketEl.style.display = 'flex';
                socketEl.style.alignItems = 'center';
                socketEl.style.justifyContent = 'center';
                socketEl.style.backgroundColor = '#222';
                socketEl.style.border = `2px solid ${gemColor}`;
                socketEl.innerHTML = `<span style="color: ${gemColor}; font-size: 18px;">◆</span>`;

                if (this.selectedRemoveSocketIndex === i) {
                    socketEl.style.boxShadow = '0 0 8px #ff4444';
                    socketEl.style.borderColor = '#ff4444';
                }

                socketEl.onclick = () => {
                    this.selectedRemoveSocketIndex = i;
                    this.updateGemRemoveInfo(item, player);
                };

                const gemQualityObj = GEM_QUALITIES[gem.quality];
                socketEl.title = `${gemQualityObj ? gemQualityObj.name : gem.quality} ${gemType ? gemType.name : 'Gem'}`;
                this.forgeGemRemoveSlots.appendChild(socketEl);
            }
        }

        if (this.forgeGemRemovePreview) {
            if (this.selectedRemoveSocketIndex !== null && item.gems[this.selectedRemoveSocketIndex]) {
                const gem = item.gems[this.selectedRemoveSocketIndex];
                const gemType = GEM_TYPES[gem.type];
                const gemQualityObj = GEM_QUALITIES[gem.quality];
                this.forgeGemRemovePreview.textContent = `Will destroy: ${gemQualityObj ? gemQualityObj.name : gem.quality} ${gemType ? gemType.name : 'Gem'}`;
            } else {
                this.forgeGemRemovePreview.textContent = 'Click a gem above to select for removal';
            }
        }

        if (this.btnForgeRemoveGem) {
            this.btnForgeRemoveGem.disabled = this.selectedRemoveSocketIndex === null;
        }
    }

    handleForgeRemoveGem() {
        if (!this.selectedRemoveEquipSlot || this.selectedRemoveSocketIndex === null) return;

        if (this.onForgeRemoveGem) this.onForgeRemoveGem(this.selectedRemoveEquipSlot, this.selectedRemoveSocketIndex);

        this.selectedRemoveSocketIndex = null;
        const player = this.ctx.getLastPlayer();
        if (player) this.updateGemRemoveUI(player);
    }
}
