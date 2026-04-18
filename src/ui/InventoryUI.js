import { SLOTS, Item, BASE_ITEMS, RARITY, SET_DEFINITIONS, UNIQUE_EFFECTS, GEM_TYPES, GEM_QUALITIES } from '../core/ItemSystem.js';

/**
 * InventoryUI — handles inventory grid, equipment slots, shop/gamble,
 * stash, item tooltips, drag-and-drop, split-stack, buyback, and sell logic.
 *
 * Constructed by UIManager; communicates with the rest of the app through a
 * `ctx` object that provides shared helpers and callbacks.
 */
export class InventoryUI {
    constructor(ctx) {
        this.ctx = ctx;

        // --- DOM refs ---
        this.inventoryScreen = document.getElementById('inventory-screen');
        this.inventoryGrid = document.getElementById('inventory-grid');
        this.inventoryGuidance = document.getElementById('inventory-guidance');
        this.goldDisplay = document.getElementById('gold-display');
        this.btnSortInventory = document.getElementById('btn-sort-inventory');
        this.btnCloseInventory = document.getElementById('btn-close-inventory');
        this.shopScreen = document.getElementById('shop-screen');

        this.shopGambleTitle = document.getElementById('shop-gamble-title');
        this.shopContentMain = document.getElementById('shop-content-main');
        this.shopContentBuyback = document.getElementById('shop-content-buyback');
        this.tabShopMain = document.getElementById('tab-shop-main');
        this.tabShopBuyback = document.getElementById('tab-shop-buyback');
        this.btnCloseShop = document.getElementById('btn-close-shop');
        this.btnCloseShopHeader = document.getElementById('btn-close-shop-header');
        this.btnSellCommon = document.getElementById('btn-sell-common');
        this.btnSellUncommon = document.getElementById('btn-sell-uncommon');
        this.btnSellRare = document.getElementById('btn-sell-rare');
        this.stashScreen = document.getElementById('stash-screen');
        this.btnCloseStash = document.getElementById('btn-close-stash');
        this.stashGrid = document.getElementById('stash-grid');
        this.buybackGrid = document.getElementById('buyback-grid');

        // Tooltip DOM refs (shared with UIManager for stat tooltips)
        this.statTooltip = document.getElementById('stat-tooltip');
        this.statTooltipTitle = document.getElementById('stat-tooltip-title');
        this.statTooltipDesc = document.getElementById('stat-tooltip-desc');
        this.compareTooltip = document.getElementById('compare-tooltip');
        this.compareTooltipTitle = document.getElementById('compare-tooltip-title');
        this.compareTooltipDesc = document.getElementById('compare-tooltip-desc');

        // Split Stack UI
        this.splitStackWindow = document.getElementById('split-stack-window');
        this.btnCloseSplit = document.getElementById('btn-close-split');
        this.splitItemName = document.getElementById('split-item-name');
        this.splitAmountRange = document.getElementById('split-amount-range');
        this.splitAmountInput = document.getElementById('split-amount-input');
        this.btnConfirmSplit = document.getElementById('btn-confirm-split');
        this.btnCancelSplit = document.getElementById('btn-cancel-split');

        // --- State ---
        this.selectedSlot = -1;
        this.hoveredItem = null;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.compareMode = false;
        this.pendingSplitItem = null;
        this.pendingSplitSlot = -1;

        // --- Callbacks (set by GameEngine) ---
        this.onBuyGamble = null;
        this.onSellItem = null;
        this.onSellAll = null;
        this.onBuyback = null;
        this.onStashDeposit = null;
        this.onStashWithdraw = null;
        this.onUnequipRequest = null;
        this.onSortInventory = null;

        // --- Event listeners ---
        this._bindSplitEvents();
        this._bindInventoryEvents();
        this._bindShopEvents();
        this._bindTooltipEvents();
        this._bindCompareMode();

        this.setupShop();
    }

    // ---- helpers that reach back to UIManager via ctx ----
    get isMobile() { return this.ctx.isMobile; }
    _getLastPlayer() { return this.ctx.getLastPlayer(); }
    _getItemIconPath(item) { return this.ctx.getItemIconPath(item); }
    _formatStatName(key) { return this.ctx.formatStatName(key); }
    _getRarityColor(rarity) { return this.ctx.getRarityColor(rarity); }
    _addChatMessage(sender, msg) { return this.ctx.addChatMessage(sender, msg); }
    _updateCharacterSheet(player) { return this.ctx.updateCharacterSheet(player); }
    _isGemItem(item) { return !!item && (item.type === 'GEM' || item.type === 'Gem'); }
    _getGemTypeInfo(itemOrGem) {
        if (!itemOrGem) return null;
        const gemType = itemOrGem.gemType || itemOrGem.type;
        return GEM_TYPES[gemType] || GEM_TYPES[String(gemType || '').toUpperCase()] || null;
    }
    _getGemQualityInfo(itemOrGem) {
        if (!itemOrGem) return null;
        const gemQuality = itemOrGem.gemQuality || itemOrGem.quality;
        return GEM_QUALITIES[gemQuality] || GEM_QUALITIES[String(gemQuality || '').toUpperCase()] || null;
    }
    _getGemTooltipHeader(item) {
        const gemType = this._getGemTypeInfo(item);
        const gemQuality = this._getGemQualityInfo(item);
        if (!gemType || !gemQuality) return '';
        return `<div style="margin-bottom: 6px;"><span style="color: ${gemQuality.color}; font-weight: bold;">${gemQuality.name}</span> <span style="color: ${gemType.color}; font-weight: bold;">${gemType.name}</span> <span style="color: #aaa;">Gem</span></div>`;
    }
    _formatSocketedGemLine(gem) {
        const gemType = this._getGemTypeInfo(gem) || { name: gem?.type || 'Gem', color: '#fff' };
        const gemQuality = this._getGemQualityInfo(gem) || { name: gem?.quality || 'Unknown', color: '#fff' };
        return `<div><span style="color: ${gemQuality.color}; font-weight: bold;">◆ ${gemQuality.name}</span> <span style="color: ${gemType.color};">${gemType.name}</span></div>`;
    }
    _getGemSlotStyle(item) {
        const gemQuality = this._getGemQualityInfo(item);
        if (!this._isGemItem(item) || !gemQuality) return null;
        return {
            border: `2px solid ${gemQuality.color}`,
            boxShadow: `0 0 10px ${gemQuality.color}`,
            backgroundColor: 'rgba(255,255,255,0.08)',
            overlay: `linear-gradient(180deg, ${gemQuality.color}22 0%, rgba(0,0,0,0) 70%)`
        };
    }
    _getGemIndicatorStyle(item) {
        const gemQuality = this._getGemQualityInfo(item);
        if (!this._isGemItem(item) || !gemQuality) return null;
        return {
            color: gemQuality.color,
            textShadow: `0 0 4px ${gemQuality.color}, 1px 1px 0 #000`,
            badgeBackground: 'rgba(8,12,18,0.85)',
            badgeBorder: `1px solid ${gemQuality.color}`,
            dotShadow: `0 0 4px ${gemQuality.color}`
        };
    }
    _getInventorySortCategory(item) {
        if (!item) return 99;
        if (item.name === 'Eidolon Heart' || item.name === 'Heart') return 0;
        if (item.name === 'Eidolon Shard' || item.name === 'Shard') return 1;
        if (this._isGemItem(item)) return 2;
        return 3;
    }
    _getInventoryTypeRank(item) {
        const type = item?.type || '';
        const ranks = {
            WEAPON: 0,
            ARMOR: 1,
            ACCESSORY: 2,
            NECK: 3,
            GLOVES: 4,
            MATERIAL: 5,
            RELIC: 6,
            GEM: 7
        };
        return Object.prototype.hasOwnProperty.call(ranks, type) ? ranks[type] : 99;
    }
    _getItemRarityName(item) {
        if (!item?.rarity) return '';
        return typeof item.rarity === 'string' ? item.rarity : (item.rarity.name || '');
    }
    _getItemRarityMultiplier(item) {
        const rarity = item?.rarity;
        if (!rarity) return 0;

        if (typeof rarity === 'string') {
            const key = rarity.toUpperCase();
            if (RARITY[key]) return RARITY[key].multiplier || 0;
            for (const rarityKey of Object.keys(RARITY)) {
                if (RARITY[rarityKey].name === rarity) {
                    return RARITY[rarityKey].multiplier || 0;
                }
            }
            return 0;
        }

        if (typeof rarity.multiplier === 'number') return rarity.multiplier;
        if (typeof rarity.name === 'string') {
            const key = rarity.name.toUpperCase();
            if (RARITY[key]) return RARITY[key].multiplier || 0;
        }

        return 0;
    }
    _isEquippableItem(item) {
        if (!item?.slot) return false;
        if (this._isGemItem(item)) return false;
        if (item.type === 'MATERIAL' || item.type === 'RELIC') return false;
        if (item.slot === 'material' || item.slot === 'relic' || item.slot === 'gem') return false;
        return true;
    }
    _formatEquipmentSlotLabel(slotKey) {
        const explicitLabels = {
            mainHand: 'Main Hand',
            offHand: 'Off Hand',
            ring1: 'Ring 1',
            ring2: 'Ring 2',
            trinket1: 'Trinket 1',
            trinket2: 'Trinket 2'
        };

        if (explicitLabels[slotKey]) return explicitLabels[slotKey];
        return String(slotKey || '')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (match) => match.toUpperCase());
    }
    _getWeakerEquipmentSlot(player, slot1, slot2) {
        const item1 = player?.equipment?.[slot1];
        const item2 = player?.equipment?.[slot2];

        if (!item1) return slot1;
        if (!item2) return slot2;

        const level1 = Number(item1.level || 0);
        const level2 = Number(item2.level || 0);
        if (level1 !== level2) return level1 < level2 ? slot1 : slot2;

        const rarity1 = this._getItemRarityMultiplier(item1);
        const rarity2 = this._getItemRarityMultiplier(item2);
        if (rarity1 !== rarity2) return rarity1 < rarity2 ? slot1 : slot2;

        return slot1;
    }
    _getComparisonTarget(player, item) {
        if (!this._isEquippableItem(item)) return null;

        let slotKey = item.slot;
        if (item.slot === 'ring') {
            slotKey = this._getWeakerEquipmentSlot(player, 'ring1', 'ring2');
        } else if (item.slot === 'trinket') {
            slotKey = this._getWeakerEquipmentSlot(player, 'trinket1', 'trinket2');
        }

        return {
            slotKey,
            slotLabel: this._formatEquipmentSlotLabel(slotKey),
            equippedItem: player?.equipment?.[slotKey] || null
        };
    }
    _isStarterProgressionWindow(player) {
        const level = Number(player?.level);
        return !Number.isFinite(level) || level < 30;
    }
    _buildInventoryGuidance(player) {
        if (!this._isStarterProgressionWindow(player)) {
            return 'Sort your bag often. Shards handle item levels, Hearts handle long-term empowerment and sockets, and gems are worth stashing or forging instead of selling by accident.';
        }

        return 'Common gear is usually vendor junk unless it is an immediate upgrade. Uncommon and Rare gear are worth checking. Shards raise item level, Hearts empower gear or add sockets, gems are crafting pieces, and the Trading House is for drops actually worth listing.';
    }
    _buildStarterItemGuidance(item, player) {
        if (!item || !this._isStarterProgressionWindow(player)) return '';

        const rarityName = this._getItemRarityName(item);
        const comparison = this._getComparisonTarget(player, item);
        let quickRead = '';
        if (comparison) {
            const equippedItem = comparison.equippedItem;
            if (!equippedItem) {
                quickRead = `Quick read: open ${comparison.slotLabel}. Free equips are usually worth trying immediately.`;
            } else {
                const levelDiff = Number(item.level || 0) - Number(equippedItem.level || 0);
                const rarityDiff = this._getItemRarityMultiplier(item) - this._getItemRarityMultiplier(equippedItem);

                if (levelDiff > 0 && rarityDiff >= 0) {
                    quickRead = `Quick read: likely upgrade for ${comparison.slotLabel}. It is higher level and at least matching rarity versus your equipped ${equippedItem.name}.`;
                } else if (levelDiff === 0 && rarityDiff > 0) {
                    quickRead = `Quick read: likely upgrade for ${comparison.slotLabel}. It matches your equipped ${equippedItem.name} on level and beats it on rarity.`;
                } else if (levelDiff < 0 && rarityDiff <= 0) {
                    quickRead = `Quick read: likely weaker than your equipped ${equippedItem.name}. Keep it only if the stat mix solves a specific gap.`;
                } else if (levelDiff === 0 && rarityDiff === 0) {
                    quickRead = `Quick read: sidegrade candidate against your equipped ${equippedItem.name}. Compare the stat mix before swapping.`;
                } else {
                    quickRead = `Quick read: mixed signal against your equipped ${equippedItem.name}. Compare the stat mix before deciding.`;
                }
            }
        }

        if (this._isGemItem(item)) {
            return `${quickRead ? `${quickRead} ` : ''}Gems are build pieces, not vendor junk. Stash extras, socket good ones into gear, or combine matching gems into stronger versions at the Forge.`;
        }
        if (item.type === 'MATERIAL' || item.slot === 'material' || item.name === 'Eidolon Shard' || item.name === 'Shard') {
            return `${quickRead ? `${quickRead} ` : ''}Shards are upgrade currency. Save them for raising the item level of gear that is actually worth keeping.`;
        }
        if (item.type === 'RELIC' || item.slot === 'relic' || item.name === 'Eidolon Heart' || item.name === 'Heart') {
            return `${quickRead ? `${quickRead} ` : ''}Hearts are forge currency. Save them for potency upgrades and adding sockets to gear you plan to keep.`;
        }
        if (rarityName === 'Common') {
            return `${quickRead ? `${quickRead} ` : ''}Common gear is usually safe vendor junk once you have something better equipped.`;
        }
        if (rarityName === 'Uncommon') {
            return `${quickRead ? `${quickRead} ` : ''}Uncommon gear is worth a quick stat check. Keep it if it is an upgrade, otherwise vendor it.`;
        }
        if (rarityName === 'Rare' || rarityName === 'Legendary' || rarityName === 'Eidolic') {
            return `${quickRead ? `${quickRead} ` : ''}Higher-rarity drops are worth comparing carefully before selling. Good upgrades can be forged further, and standout pieces may be worth listing on the Trading House.`;
        }
        return quickRead;
    }
    _buildCompareHint(item, player) {
        if (this.isMobile || !item) return '';

        const comparison = this._getComparisonTarget(player, item);
        if (!comparison?.equippedItem) return '';

        return `Hold Shift to compare with ${comparison.equippedItem.name} in ${comparison.slotLabel}.`;
    }
    sortInventoryItems(items) {
        const source = Array.isArray(items) ? items : [];
        const size = source.length;
        const populated = source.filter((item) => item && item.id);

        populated.sort((a, b) => {
            const categoryDiff = this._getInventorySortCategory(a) - this._getInventorySortCategory(b);
            if (categoryDiff !== 0) return categoryDiff;

            if (this._getInventorySortCategory(a) === 2) {
                const gemTypeDiff = String(a.gemType || '').localeCompare(String(b.gemType || ''));
                if (gemTypeDiff !== 0) return gemTypeDiff;

                const qualityDiff = (GEM_QUALITIES[String(a.gemQuality || '').toUpperCase()]?.value || 0) - (GEM_QUALITIES[String(b.gemQuality || '').toUpperCase()]?.value || 0);
                if (qualityDiff !== 0) return qualityDiff;
            }

            const typeDiff = this._getInventoryTypeRank(a) - this._getInventoryTypeRank(b);
            if (typeDiff !== 0) return typeDiff;

            const rarityDiff = String(a.rarity?.name || a.rarity || '').localeCompare(String(b.rarity?.name || b.rarity || ''));
            if (rarityDiff !== 0) return rarityDiff;

            const levelDiff = (a.level || 0) - (b.level || 0);
            if (levelDiff !== 0) return levelDiff;

            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        const sorted = new Array(size).fill(null);
        for (let i = 0; i < populated.length && i < size; i++) {
            sorted[i] = populated[i];
        }
        return sorted;
    }
    handleSortInventory() {
        const player = this._getLastPlayer();
        if (!player || !Array.isArray(player.inventory)) return;

        if (this.onSortInventory) {
            this.onSortInventory();
        }
    }
    _getItemInnerHtml(item, iconPath) {
        const color = item.rarity ? item.rarity.color : '#ffffff';
        const isEidolic = item.rarity && item.rarity.name === 'Eidolic';
        const gemSlotStyle = this._getGemSlotStyle(item);

        if (isEidolic) {
            return `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>`;
        }

        if (gemSlotStyle) {
            return `<div style="width:100%; height:100%; background-image:${gemSlotStyle.overlay}, url('${iconPath}'); background-color:${gemSlotStyle.backgroundColor}; background-size:cover, contain; background-repeat:no-repeat; background-position:center;"></div>`;
        }

        return `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-color:${color}; background-blend-mode:multiply; background-size:contain; background-repeat:no-repeat; background-position:center;"></div>`;
    }
    _applyItemSlotVisual(slotEl, item, iconPath, extraHtml = '') {
        const color = item.rarity ? item.rarity.color : '#ffffff';
        const isEidolic = item.rarity && item.rarity.name === 'Eidolic';
        const gemSlotStyle = this._getGemSlotStyle(item);

        slotEl.innerHTML = `${this._getItemInnerHtml(item, iconPath)}${extraHtml}`;

        if (gemSlotStyle) {
            slotEl.style.border = gemSlotStyle.border;
            slotEl.style.boxShadow = gemSlotStyle.boxShadow;
            slotEl.style.backgroundColor = gemSlotStyle.backgroundColor;
        } else if (isEidolic) {
            slotEl.style.border = `2px solid ${color}`;
            slotEl.style.boxShadow = `0 0 5px ${color}`;
            slotEl.style.backgroundColor = '#222';
        } else {
            slotEl.style.border = `1px solid ${color}`;
            slotEl.style.boxShadow = 'none';
            slotEl.style.backgroundColor = '#222';
        }

        slotEl.style.color = color;
        slotEl.style.borderColor = gemSlotStyle ? this._getGemQualityInfo(item).color : color;
        slotEl.removeAttribute('title');
    }

    // ---- getters ----
    get isInventoryOpen() { return this.inventoryScreen.style.display === 'block'; }
    get isShopOpen() { return this.shopScreen.style.display === 'flex'; }
    get isStashOpen() { return this.stashScreen.style.display === 'flex'; }

    // ---- constructor helpers ----

    _bindSplitEvents() {
        if (this.btnCloseSplit) this.btnCloseSplit.addEventListener('click', () => this.hideSplitWindow());
        if (this.btnCancelSplit) this.btnCancelSplit.addEventListener('click', () => this.hideSplitWindow());
        if (this.btnConfirmSplit) this.btnConfirmSplit.addEventListener('click', () => this.confirmSplit());

        if (this.splitAmountRange) {
            this.splitAmountRange.addEventListener('input', (e) => {
                if (this.splitAmountInput) this.splitAmountInput.value = e.target.value;
            });
        }
        if (this.splitAmountInput) {
            this.splitAmountInput.addEventListener('input', (e) => {
                if (this.splitAmountRange) this.splitAmountRange.value = e.target.value;
            });
        }
    }

    _bindInventoryEvents() {
        if (this.btnSortInventory) {
            this.btnSortInventory.addEventListener('click', () => this.handleSortInventory());
        }
        if (this.btnCloseInventory) {
            this.btnCloseInventory.addEventListener('click', () => this.toggleInventory());
        }
    }

    _bindShopEvents() {
        if (this.tabShopMain) {
            this.tabShopMain.addEventListener('click', () => this.switchShopTab('main'));
        }
        if (this.tabShopBuyback) {
            this.tabShopBuyback.addEventListener('click', () => this.switchShopTab('buyback'));
        }
        if (this.btnCloseShop) {
            this.btnCloseShop.addEventListener('click', () => this.toggleShop());
        }
        if (this.btnCloseShopHeader) {
            this.btnCloseShopHeader.addEventListener('click', () => this.toggleShop());
        }
        if (this.btnCloseStash) {
            this.btnCloseStash.addEventListener('click', () => this.toggleStash());
        }
        if (this.btnSellCommon) {
            this.btnSellCommon.addEventListener('click', () => this.handleSellAll('Common'));
        }
        if (this.btnSellUncommon) {
            this.btnSellUncommon.addEventListener('click', () => this.handleSellAll('Uncommon'));
        }
        if (this.btnSellRare) {
            this.btnSellRare.addEventListener('click', () => this.handleSellAll('Rare'));
        }
    }

    _bindTooltipEvents() {
        // Inventory Grid Tooltips
        this.inventoryGrid.addEventListener('mousemove', (e) => {
            if (this.selectedSlot !== -1) return;
            const slot = e.target.closest('.inv-slot');
            if (slot && slot._item) {
                this.showItemTooltip(slot._item, e.clientX, e.clientY, e);
            } else {
                this.hideTooltips();
            }
        });
        this.inventoryGrid.addEventListener('mouseleave', () => {
            if (this.selectedSlot === -1) this.hideTooltips();
        });

        // Equipment Tooltips
        const equipContainer = document.querySelector('#character-sheet .equipment-slots');
        if (equipContainer) {
            equipContainer.addEventListener('mousemove', (e) => {
                const slot = e.target.closest('.equip-slot');
                if (slot && slot._item) {
                    this.showItemTooltip(slot._item, e.clientX, e.clientY, e);
                } else {
                    this.hideTooltips();
                }
            });
            equipContainer.addEventListener('mouseleave', () => this.hideTooltips());
        }

        // Close tooltip/selection when clicking outside
        window.addEventListener('click', (e) => {
            if (this.selectedSlot !== -1 && !e.target.closest('#stat-tooltip') && !e.target.closest('.inv-slot')) {
                this.selectedSlot = -1;
                this.hideTooltips();
            }
        });
    }

    _bindCompareMode() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                this.compareMode = true;
                if (this.hoveredItem) {
                    this.showItemTooltip(this.hoveredItem, this.lastMouseX, this.lastMouseY);
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                this.compareMode = false;
                if (this.hoveredItem) {
                    this.showItemTooltip(this.hoveredItem, this.lastMouseX, this.lastMouseY);
                }
            }
        });
    }

    // ================================================================
    // Toggle methods
    // ================================================================

    toggleInventory() {
        const isHidden = this.inventoryScreen.style.display === 'none' || this.inventoryScreen.style.display === '';
        if (isHidden) {
            this.ctx.closePrimaryHudMenus?.({ except: 'inventory' });
        }
        this.inventoryScreen.style.display = isHidden ? 'block' : 'none';

        if (isHidden) {
            const player = this._getLastPlayer();
            if (player) {
                this.updateInventory(player);
            }
        }
    }

    toggleShop() {
        const isHidden = this.shopScreen.style.display === 'none' || this.shopScreen.style.display === '';
        this.shopScreen.style.display = isHidden ? 'flex' : 'none';

        if (isHidden) {
            this.switchShopTab('main');
            this.inventoryScreen.style.display = 'block';
            const player = this._getLastPlayer();
            if (player) {
                this.updateInventory(player);
                if (this.shopGambleTitle) {
                    const cost = Math.ceil(34.68 * player.level);
                    this.shopGambleTitle.textContent = `MYSTERY BOXES (${cost}g)`;
                }
            }
        }
    }

    toggleStash() {
        const isHidden = this.stashScreen.style.display === 'none' || this.stashScreen.style.display === '';
        this.stashScreen.style.display = isHidden ? 'flex' : 'none';

        if (isHidden) {
            this.inventoryScreen.style.display = 'block';
            const player = this._getLastPlayer();
            if (player) {
                this.updateInventory(player);
                this.updateStash(player);
            }
        }
    }

    // ================================================================
    // Split Stack
    // ================================================================

    showSplitWindow(item, slotIndex) {
        if (!this.splitStackWindow) return;

        this.pendingSplitItem = item;
        this.pendingSplitSlot = slotIndex;
        this.splitItemName.textContent = item.name;

        const maxSplit = item.stack - 1;
        if (maxSplit < 1) return;

        this.splitAmountRange.min = 1;
        this.splitAmountRange.max = maxSplit;
        this.splitAmountRange.value = Math.floor(item.stack / 2) || 1;

        this.splitAmountInput.min = 1;
        this.splitAmountInput.max = maxSplit;
        this.splitAmountInput.value = Math.floor(item.stack / 2) || 1;

        this.splitStackWindow.style.display = 'block';
    }

    hideSplitWindow() {
        if (this.splitStackWindow) this.splitStackWindow.style.display = 'none';
        this.pendingSplitItem = null;
        this.pendingSplitSlot = -1;
    }

    confirmSplit() {
        if (!this.pendingSplitItem || this.pendingSplitSlot === -1) return;

        const amount = parseInt(this.splitAmountInput.value);
        if (isNaN(amount) || amount < 1) return;

        if (window.game) {
            window.game.sendSplitStackMessage(this.pendingSplitSlot, amount);
        }

        this.hideSplitWindow();
    }

    // ================================================================
    // Shop Tab
    // ================================================================

    switchShopTab(tab) {
        if (!this.shopContentMain || !this.shopContentBuyback || !this.tabShopMain || !this.tabShopBuyback) {
            return;
        }

        this.tabShopMain.classList.toggle('is-active', tab === 'main');
        this.tabShopBuyback.classList.toggle('is-active', tab === 'buyback');

        if (tab === 'main') {
            this.shopContentMain.style.display = 'flex';
            this.shopContentBuyback.style.display = 'none';
        } else {
            this.shopContentMain.style.display = 'none';
            this.shopContentBuyback.style.display = 'flex';
        }
    }

    // ================================================================
    // Equip Slot
    // ================================================================

    updateEquipSlot(id, item, placeholder, serverSlotName) {
        const el = document.getElementById(id);
        if (!el) return;

        el._item = (item && item.id) ? item : null;
        el.innerHTML = '';

        // Clone to remove old event listeners
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);

        const slotEl = newEl;
        slotEl._item = (item && item.id) ? item : null;
        const slotId = serverSlotName || id.replace('slot-', '');

        if (item && item.id) {
            const iconPath = this._getItemIconPath(item);
            this._applyItemSlotVisual(slotEl, item, iconPath);

            this.setupItemDragAndDrop(slotEl, 'equipment', slotId, item);

            // Potency Indicator
            if (item.potency > 0) {
                const potencyDiv = document.createElement('div');
                potencyDiv.style.position = 'absolute';
                potencyDiv.style.top = '2px';
                potencyDiv.style.right = '2px';
                potencyDiv.style.color = '#00ff00';
                potencyDiv.style.fontWeight = 'bold';
                potencyDiv.style.fontSize = '12px';
                potencyDiv.style.textShadow = '1px 1px 0 #000';
                potencyDiv.textContent = `+${item.potency}`;
                slotEl.appendChild(potencyDiv);
            }

            // Click to unequip
            slotEl.onclick = (e) => {
                e.stopPropagation();
                if (this.onUnequipRequest) this.onUnequipRequest(slotId);
            };

            // Tooltip
            slotEl.addEventListener('mouseenter', () => {
                const rect = slotEl.getBoundingClientRect();
                this.showItemTooltip(item, rect.right + 10, rect.top);
            });
            slotEl.addEventListener('mouseleave', () => this.hideTooltips());
        } else {
            slotEl.textContent = placeholder;
            slotEl.style.color = '#666';
            slotEl.style.border = '1px solid #444';
            slotEl.style.borderColor = '#444';
            slotEl.style.boxShadow = 'none';
            slotEl.title = 'Empty Slot';
            slotEl.onclick = null;
            this.setupItemDragAndDrop(slotEl, 'equipment', slotId, null);
        }
    }

    // ================================================================
    // Inventory Grid
    // ================================================================

    updateInventory(player) {
        if (!player) return;

        if (this.goldDisplay) {
            this.goldDisplay.textContent = `GOLD: ${player.gold || 0}`;
        }
        if (this.inventoryGuidance) {
            this.inventoryGuidance.textContent = this._buildInventoryGuidance(player);
        }

        const slots = this.inventoryGrid.children;
        for (let i = 0; i < slots.length; i++) {
            const item = player.inventory[i];
            slots[i]._item = (item && item.id) ? item : null;
            slots[i].innerHTML = '';

            if (item && item.id) {
            const iconPath = this._getItemIconPath(item);
            const gemIndicatorStyle = this._getGemIndicatorStyle(item);

            let stackHtml = '';
            if (item.stack > 1) {
                if (gemIndicatorStyle) {
                    stackHtml = `<div style="position:absolute; bottom:2px; right:2px; min-width:12px; padding:0 3px; border-radius:9px; font-size:10px; color:${gemIndicatorStyle.color}; background:${gemIndicatorStyle.badgeBackground}; border:${gemIndicatorStyle.badgeBorder}; text-shadow:${gemIndicatorStyle.textShadow}; font-weight:bold; text-align:center;">${item.stack}</div>`;
                } else {
                    stackHtml = `<div style="position:absolute; bottom:2px; right:2px; font-size:10px; color:white; text-shadow:1px 1px 0 #000; font-weight:bold;">${item.stack}</div>`;
                }
            }

            let potencyHtml = '';
            if (item.potency > 0) {
                if (gemIndicatorStyle) {
                    potencyHtml = `<div style="position:absolute; top:2px; right:2px; min-width:16px; padding:0 3px; border-radius:9px; font-size:10px; color:${gemIndicatorStyle.color}; background:${gemIndicatorStyle.badgeBackground}; border:${gemIndicatorStyle.badgeBorder}; text-shadow:${gemIndicatorStyle.textShadow}; font-weight:bold; text-align:center;">+${item.potency}</div>`;
                } else {
                    potencyHtml = `<div style="position:absolute; top:2px; right:2px; font-size:10px; color:#00ff00; text-shadow:1px 1px 0 #000; font-weight:bold;">+${item.potency}</div>`;
                }
            }

            let socketHtml = '';
            if (item.sockets > 0) {
                let dots = '';
                for (let k = 0; k < item.sockets; k++) {
                    if (gemIndicatorStyle) {
                        dots += `<div style="width:4px; height:4px; border-radius:50%; background-color:${gemIndicatorStyle.color}; box-shadow:${gemIndicatorStyle.dotShadow}; border:1px solid rgba(255,255,255,0.5);"></div>`;
                    } else {
                        dots += `<div style="width:3px; height:3px; border-radius:50%; background-color:#00ffff; box-shadow:0 0 2px #00ffff;"></div>`;
                    }
                }
                socketHtml = `<div style="position:absolute; bottom:2px; left:2px; display:flex; gap:1px;">${dots}</div>`;
            }

                this._applyItemSlotVisual(slots[i], item, iconPath, `${stackHtml}${potencyHtml}${socketHtml}`);

                this.setupItemDragAndDrop(slots[i], 'inventory', i, item);

                // Click handler for equipping
                slots[i].onclick = (e) => {
                    e.stopPropagation();

                    // Shift+Click to Split Stack
                    if (e.shiftKey && item.stack > 1) {
                        this.showSplitWindow(item, i);
                        return;
                    }

                    // Prevent equipping non-equippable items
                    if (item.type === 'MATERIAL' || item.type === 'RELIC' || item.slot === 'material' || item.slot === 'relic') {
                        return;
                    }

                    if (this.isMobile) {
                        if (this.selectedSlot === i) {
                            if (player.level < item.level) return;
                            if (player.equipItem(item)) {
                                this.selectedSlot = -1;
                                this.hideTooltips();
                                this.updateInventory(player);
                                this._updateCharacterSheet(player);
                            }
                        } else {
                            this.selectedSlot = i;
                            const rect = slots[i].getBoundingClientRect();
                            let x = rect.right;
                            if (x + 220 > window.innerWidth) x = rect.left - 220;
                            this.showItemTooltip(item, x, rect.top);
                        }
                    } else {
                        // Check if Trading House is open
                        const trading = this.ctx.trading;
                        if (trading && trading.isOpen) {
                            if (trading.panelTradingList && trading.panelTradingList.style.display === 'none') {
                                trading.switchTab('list');
                            }
                            trading.selectItem(item, i);
                            return;
                        }

                        if (player.level < item.level) return;

                        player.inventory[i] = null;
                        if (player.equipItem(item)) {
                            this.selectedSlot = -1;
                            this.hideTooltips();
                            this.updateInventory(player);
                            this._updateCharacterSheet(player);
                        } else {
                            player.inventory[i] = item;
                        }
                    }
                };

                // Right-click to sell if shop is open, or stash deposit
                slots[i].oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.shopScreen.style.display === 'flex') {
                        this.sellItem(player, i);
                    } else if (this.stashScreen.style.display === 'flex') {
                        if (this.onStashDeposit) this.onStashDeposit(item.id);
                    }
                };
            } else {
                slots[i].textContent = '';
                slots[i].title = 'Empty';
                slots[i].style.border = '1px solid #444';
                slots[i].style.boxShadow = 'none';
                slots[i].style.color = '#ffffff';
                slots[i].style.backgroundColor = 'rgba(0,0,0,0.3)';
                slots[i].onclick = null;
                slots[i].oncontextmenu = null;
                this.setupItemDragAndDrop(slots[i], 'inventory', i, null);
            }
        }
    }

    // ================================================================
    // Stash
    // ================================================================

    updateStash(player) {
        if (!player) return;

        if (this.stashGrid.children.length === 0) {
            for (let i = 0; i < 100; i++) {
                const slot = document.createElement('div');
                slot.className = 'inv-slot';
                this.stashGrid.appendChild(slot);
            }
        }

        const slots = this.stashGrid.children;
        for (let i = 0; i < slots.length; i++) {
            const item = player.stash ? player.stash[i] : null;
            slots[i]._item = (item && item.id) ? item : null;
            slots[i].innerHTML = '';

            if (item && item.id) {
                const iconPath = this._getItemIconPath(item);
                const gemIndicatorStyle = this._getGemIndicatorStyle(item);

                let stackHtml = '';
                if (item.stack > 1) {
                    if (gemIndicatorStyle) {
                        stackHtml = `<div style="position:absolute; bottom:2px; right:2px; min-width:12px; padding:0 3px; border-radius:9px; font-size:10px; color:${gemIndicatorStyle.color}; background:${gemIndicatorStyle.badgeBackground}; border:${gemIndicatorStyle.badgeBorder}; text-shadow:${gemIndicatorStyle.textShadow}; font-weight:bold; text-align:center;">${item.stack}</div>`;
                    } else {
                        stackHtml = `<div style="position:absolute; bottom:2px; right:2px; font-size:10px; color:white; text-shadow:1px 1px 0 #000; font-weight:bold;">${item.stack}</div>`;
                    }
                }

                this._applyItemSlotVisual(slots[i], item, iconPath, stackHtml);

                // Right-click to withdraw
                slots[i].oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.onStashWithdraw) this.onStashWithdraw(item.id);
                };

                // Tooltip
                slots[i].onmousemove = (e) => {
                    this.showItemTooltip(item, e.clientX, e.clientY, e);
                };
                slots[i].onmouseleave = () => this.hideTooltips();
            } else {
                slots[i].textContent = '';
                slots[i].style.border = '1px solid #444';
                slots[i].style.boxShadow = 'none';
                slots[i].style.color = '#ffffff';
                slots[i].style.backgroundColor = 'rgba(0,0,0,0.3)';
                slots[i].oncontextmenu = null;
                slots[i].onmousemove = null;
            }
        }
    }

    // ================================================================
    // Buyback
    // ================================================================

    updateBuybackList(items) {
        if (!this.buybackGrid) return;
        this.buybackGrid.innerHTML = '';
        if (!items) return;

        const reversedItems = [...items].reverse();

        reversedItems.forEach(item => {
            if (!item || !item.id) return;
            const el = document.createElement('div');
            el.className = 'inv-slot';
            const iconPath = this._getItemIconPath(item);
            const gemIndicatorStyle = this._getGemIndicatorStyle(item);
            el.style.position = 'relative';
            el.style.cursor = 'pointer';

            this._applyItemSlotVisual(el, item, iconPath);

            el.title = `${item.name}\nBuyback Price: ${item.value * (item.stack || 1)}g`;

            if (item.stack > 1) {
                const stackCount = document.createElement('div');
                stackCount.className = 'item-stack';
                stackCount.innerText = item.stack;
                stackCount.style.position = 'absolute';
                stackCount.style.bottom = '2px';
                stackCount.style.right = '2px';
                stackCount.style.fontSize = '10px';
                if (gemIndicatorStyle) {
                    stackCount.style.minWidth = '12px';
                    stackCount.style.padding = '0 3px';
                    stackCount.style.borderRadius = '9px';
                    stackCount.style.background = gemIndicatorStyle.badgeBackground;
                    stackCount.style.border = gemIndicatorStyle.badgeBorder;
                    stackCount.style.color = gemIndicatorStyle.color;
                    stackCount.style.textShadow = gemIndicatorStyle.textShadow;
                    stackCount.style.textAlign = 'center';
                } else {
                    stackCount.style.color = 'white';
                    stackCount.style.textShadow = '1px 1px 0 #000';
                }
                stackCount.style.fontWeight = 'bold';
                el.appendChild(stackCount);
            }

            el.onclick = () => {
                if (this.onBuyback) this.onBuyback(item.id);
            };

            this.buybackGrid.appendChild(el);
        });
    }

    // ================================================================
    // Sell / Gamble
    // ================================================================

    sellItem(player, index) {
        if (this.onSellItem) {
            this.onSellItem(index);
        } else {
            // Fallback for local testing
            const item = player.inventory[index];
            if (!item) return;
            const value = Item.getValue(item);
            player.gold += value;
            player.inventory[index] = null;
            this.updateInventory(player);
        }
    }

    handleSellAll(rarityName) {
        if (this.onSellAll) this.onSellAll(rarityName);
    }

    setupShop() {
        const grid = document.getElementById('shop-grid');
        if (!grid) return;

        grid.innerHTML = '';

        const gambleOptions = [
            { name: 'Mystery Helm', slot: SLOTS.HEAD, icon: 'H' },
            { name: 'Mystery Chest', slot: SLOTS.CHEST, icon: 'C' },
            { name: 'Mystery Legs', slot: SLOTS.LEGS, icon: 'L' },
            { name: 'Mystery Boots', slot: SLOTS.FEET, icon: 'B' },
            { name: 'Mystery Gloves', slot: SLOTS.GLOVES, icon: 'G' },
            { name: 'Mystery Shoulders', slot: SLOTS.SHOULDERS, icon: 'S' },
            { name: 'Mystery Belt', slot: SLOTS.BELT, icon: 'Be' },
            { name: 'Mystery Ring', slot: SLOTS.RING, icon: 'Ri' },
            { name: 'Mystery Neck', slot: SLOTS.NECK, icon: 'N' },
            { name: 'Mystery Trinket', slot: SLOTS.TRINKET, icon: 'T' },
            { name: 'Mystery Weapon', slot: SLOTS.MAIN_HAND, icon: 'W' },
            { name: 'Mystery Offhand', slot: SLOTS.OFF_HAND, icon: 'O' }
        ];

        gambleOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'shop-item';
            btn.style.cssText = `
                background: #222;
                border: 1px solid #444;
                padding: 10px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
                user-select: none;
                -webkit-user-select: none;
                width: 100%;
                font-family: inherit;
                color: inherit;
            `;
            btn.innerHTML = `
                <div style="font-size: 24px; color: #ffd700; margin-bottom: 5px; pointer-events: none;">?</div>
                <div style="font-size: 12px; font-weight: bold; pointer-events: none;">${opt.name}</div>
                <div style="font-size: 10px; color: #aaa; pointer-events: none;">${opt.slot}</div>
            `;

            btn.onmouseover = () => {
                btn.style.background = '#333';
                btn.style.borderColor = '#ffd700';
            };
            btn.onmouseout = () => {
                btn.style.background = '#222';
                btn.style.borderColor = '#444';
            };

            btn.onclick = () => this.buyGambleItem(opt.slot);

            grid.appendChild(btn);
        });
    }

    buyGambleItem(slot) {
        const player = this._getLastPlayer();
        if (!player) return;

        let cost = Math.ceil(35 * player.level);
        if (player.gold < cost) {
            this._addChatMessage("System", `Not sufficient gold! Cost: ${cost}`);
            return;
        }

        if (this.onBuyGamble) {
            this.onBuyGamble(slot);
        } else {
            console.warn("onBuyGamble callback not defined");
        }
    }

    // ================================================================
    // Item Tooltips
    // ================================================================

    getItemTooltipText(item) {
        let text = `${item.name}\n${item.rarity.name} ${item.type}\nLevel ${item.level}\n\n`;
        if (item.stats) {
            for (const stat of this.getOrderedItemStatKeys(item.stats)) {
                text += `+${item.stats[stat]} ${this._formatStatName(stat)}\n`;
            }
        }
        return text;
    }

    formatSetBonus(bonus) {
        if (!bonus) return '';
        const parts = [];
        for (const key in bonus) {
            const val = bonus[key];
            if (typeof val === 'number' && val === 1) {
                parts.push(this._formatStatName(key));
            } else if (typeof val === 'number') {
                parts.push(`+${val}% ${this._formatStatName(key)}`);
            } else {
                parts.push(`${this._formatStatName(key)}: ${val}`);
            }
        }
        return parts.join(', ');
    }

    getOrderedItemStatKeys(stats) {
        if (!stats) return [];

        const preferredOrder = [
            'damage', 'defense', 'strength', 'dexterity',
            'intelligence', 'wisdom', 'vitality'
        ];

        const keys = Object.keys(stats);
        const ordered = [];
        for (const k of preferredOrder) {
            if (Object.prototype.hasOwnProperty.call(stats, k)) ordered.push(k);
        }
        const remaining = keys.filter(k => !preferredOrder.includes(k));
        remaining.sort((a, b) => String(a).localeCompare(String(b)));
        return ordered.concat(remaining);
    }

    showItemTooltip(item, x, y, event) {
        this.hoveredItem = item;
        this.lastMouseX = x;
        this.lastMouseY = y;

        const isGemItem = this._isGemItem(item);
        const gemQualityInfo = isGemItem ? this._getGemQualityInfo(item) : null;
        this.statTooltipTitle.textContent = item.name;
        this.statTooltipTitle.style.color = gemQualityInfo?.color || item.rarity.color;

        // Format slot name
        let slotName = item.slot;
        if (slotName === 'mainHand') slotName = 'Main Hand';
        else if (slotName === 'offHand') slotName = 'Off Hand';
        else slotName = slotName.charAt(0).toUpperCase() + slotName.slice(1);

        // Level Requirement Color
        let levelColor = '#aaa';
        const player = this._getLastPlayer();
        if (player && player.level < item.level) {
            levelColor = '#ff0000';
        }

        let desc = `<div style="color: #aaa; font-style: italic; margin-bottom: 5px;">${item.rarity.name} ${item.type} (${slotName}) - <span style="color: ${levelColor}">Lvl ${item.level}</span></div>`;
        if (isGemItem) desc += this._getGemTooltipHeader(item);

        if (item.stack > 1) {
            desc += `<div style="color: #fff; margin-bottom: 5px;">Stack Size: ${item.stack} / ${item.maxStack || 1000}</div>`;
        }

        if (item.stats) {
            for (const stat of this.getOrderedItemStatKeys(item.stats)) {
                const val = item.stats[stat];
                desc += `<div style="color: #fff;">+${val} ${this._formatStatName(stat)}</div>`;
            }
        }

        // Socketed Gems
        if (item.gems && item.gems.length > 0) {
            desc += `<div style="color: #888; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">Socketed Gems:</div>`;
            for (const gem of item.gems) {
                if (gem) {
                    desc += this._formatSocketedGemLine(gem);
                }
            }
        }

        // Available sockets
        if (item.sockets !== undefined && item.sockets > 0) {
            const usedSockets = item.gems ? item.gems.length : 0;
            const emptySockets = item.sockets - usedSockets;
            if (emptySockets > 0) {
                desc += `<div style="color: #666; margin-top: 3px;">◇ ${emptySockets} Empty Socket${emptySockets > 1 ? 's' : ''}</div>`;
            }
        }

        // Set Item Info
        if (item.setId && SET_DEFINITIONS[item.setId]) {
            const setDef = SET_DEFINITIONS[item.setId];
            desc += `<div style="color: #00ff00; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">`;
            desc += `<div style="font-weight: bold;">${setDef.name}</div>`;

            let equippedCount = 0;
            if (player && player.equipment) {
                for (const slot in player.equipment) {
                    const equipped = player.equipment[slot];
                    if (equipped && equipped.setId === item.setId) equippedCount++;
                }
            }

            const bonusLevels = [
                { pieces: 2, bonus: setDef.bonus2 },
                { pieces: 4, bonus: setDef.bonus4 },
                { pieces: 6, bonus: setDef.bonus6 }
            ];

            for (const bl of bonusLevels) {
                if (bl.bonus) {
                    const isActive = equippedCount >= bl.pieces;
                    const color = isActive ? '#00ff00' : '#555';
                    const bonusText = this.formatSetBonus(bl.bonus);
                    desc += `<div style="color: ${color};">(${bl.pieces}) ${bonusText}</div>`;
                }
            }

            desc += `<div style="color: #888; font-size: 0.9em; margin-top: 3px;">${equippedCount}/${setDef.slots.length} pieces</div>`;
            desc += `</div>`;
        }

        // Unique Effect
        if (item.uniqueEffect && UNIQUE_EFFECTS[item.uniqueEffect]) {
            const effect = UNIQUE_EFFECTS[item.uniqueEffect];
            desc += `<div style="color: ${effect.color}; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">`;
            desc += `<div style="font-weight: bold;">★ ${effect.name}</div>`;
            desc += `<div style="color: #ccc; font-style: italic;">${effect.description}</div>`;
            desc += `</div>`;
        }

        // Sell Price if Shop is Open
        if (this.shopScreen.style.display === 'flex') {
            const value = Item.getValue(item);
            desc += `<div style="color: #ffd700; margin-top: 10px; border-top: 1px solid #444; padding-top: 5px;">Sell Value: ${value} Gold</div>`;

            if (this.isMobile) {
                desc += `<button id="btn-tooltip-sell" style="width:100%; margin-top:10px; padding: 8px; background:#333; color:#ffd700; border:1px solid #ffd700; cursor:pointer; font-weight:bold;">SELL ITEM</button>`;
            }
        }

        const starterGuidance = this._buildStarterItemGuidance(item, player);
        if (starterGuidance) {
            desc += `<div style="color: #8fb7d9; margin-top: 10px; border-top: 1px solid #33485a; padding-top: 6px;">${starterGuidance}</div>`;
        }

        const compareHint = this._buildCompareHint(item, player);
        if (compareHint && !this.compareMode) {
            desc += `<div style="color: #c8d6e8; margin-top: 6px;">${compareHint}</div>`;
        }

        // Equip Button on Mobile
        if (this.isMobile) {
            desc += `<button id="btn-tooltip-equip" style="width:100%; margin-top:5px; padding: 8px; background:#222; color:#fff; border:1px solid #666; cursor:pointer;">EQUIP</button>`;
        }

        this.statTooltipDesc.innerHTML = desc;

        // Bind Button Events
        setTimeout(() => {
            const btnSell = document.getElementById('btn-tooltip-sell');
            if (btnSell) {
                btnSell.onclick = (e) => {
                    e.stopPropagation();
                    const p = this._getLastPlayer();
                    if (p) {
                        const index = p.inventory.indexOf(item);
                        if (index !== -1) {
                            this.sellItem(p, index);
                            this.selectedSlot = -1;
                            this.hideTooltips();
                        }
                    }
                };
            }

            const btnEquip = document.getElementById('btn-tooltip-equip');
            if (btnEquip) {
                btnEquip.onclick = (e) => {
                    e.stopPropagation();
                    const p = this._getLastPlayer();
                    if (p) {
                        if (p.level < item.level) return;
                        if (p.equipItem(item)) {
                            this.selectedSlot = -1;
                            this.hideTooltips();
                            this.updateInventory(p);
                            this._updateCharacterSheet(p);
                        }
                    }
                };
            }
        }, 0);

        this.statTooltip.style.display = 'block';
        this.statTooltip.style.left = `${x + 15}px`;
        this.statTooltip.style.top = `${y + 15}px`;

        // Ensure on screen
        const rect = this.statTooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.statTooltip.style.left = `${window.innerWidth - rect.width - 10}px`;
        }

        // Comparison Tooltip
        this.compareTooltip.style.display = 'none';

        if (this.compareMode && player) {
            const equippedItem = player.equipment[item.slot];

            if (equippedItem && equippedItem !== item) {
                const compareGemQuality = this._isGemItem(equippedItem) ? this._getGemQualityInfo(equippedItem) : null;
                this.compareTooltipTitle.textContent = equippedItem.name;
                this.compareTooltipTitle.style.color = compareGemQuality?.color || equippedItem.rarity.color;

                let compDesc = `<div style="color: #aaa; font-style: italic; margin-bottom: 5px;">${equippedItem.rarity.name} ${equippedItem.type} (${slotName}) - Lvl ${equippedItem.level}</div>`;
                if (this._isGemItem(equippedItem)) compDesc += this._getGemTooltipHeader(equippedItem);

                if (equippedItem.stats) {
                    for (const stat of this.getOrderedItemStatKeys(equippedItem.stats)) {
                        const val = equippedItem.stats[stat];
                        compDesc += `<div style="color: #fff;">+${val} ${this._formatStatName(stat)}</div>`;
                    }
                }

                if (equippedItem.gems && equippedItem.gems.length > 0) {
                    compDesc += `<div style="color: #888; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">Socketed Gems:</div>`;
                    for (const gem of equippedItem.gems) {
                        if (gem) {
                            compDesc += this._formatSocketedGemLine(gem);
                        }
                    }
                }

                if (equippedItem.setId && SET_DEFINITIONS[equippedItem.setId]) {
                    const setDef = SET_DEFINITIONS[equippedItem.setId];
                    compDesc += `<div style="color: #00ff00; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">`;
                    compDesc += `<div style="font-weight: bold;">${setDef.name}</div>`;
                    compDesc += `</div>`;
                }

                if (equippedItem.uniqueEffect && UNIQUE_EFFECTS[equippedItem.uniqueEffect]) {
                    const effect = UNIQUE_EFFECTS[equippedItem.uniqueEffect];
                    compDesc += `<div style="color: ${effect.color}; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">`;
                    compDesc += `<div style="font-weight: bold;">★ ${effect.name}</div>`;
                    compDesc += `</div>`;
                }

                this.compareTooltipDesc.innerHTML = compDesc;
                this.compareTooltip.style.display = 'block';

                const mainRect = this.statTooltip.getBoundingClientRect();
                this.compareTooltip.style.left = `${mainRect.right + 10}px`;
                this.compareTooltip.style.top = `${mainRect.top}px`;

                const compRect = this.compareTooltip.getBoundingClientRect();
                if (compRect.right > window.innerWidth) {
                    this.compareTooltip.style.left = `${mainRect.left - compRect.width - 10}px`;
                }
            }
        }
    }

    hideTooltips() {
        this.statTooltip.style.display = 'none';
        this.compareTooltip.style.display = 'none';
        this.hoveredItem = null;
    }

    // ================================================================
    // Drag & Drop (item-level, not hotbar)
    // ================================================================

    setupItemDragAndDrop(element, type, indexOrSlot, item) {
        if (!element) return;

        element.ondragover = (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        };
        element.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const raw = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
                if (!raw) return;
                const data = JSON.parse(raw);
                this.handleItemDrop(data, { type, id: indexOrSlot });
            } catch (err) {
                console.error('Drop error', err);
            }
        };

        element.draggable = !!item;
        element.ondragstart = null;
        element.ondragend = null;

        if (!item) return;

        element.ondragstart = (e) => {
            if (!e.dataTransfer) return;
            e.dataTransfer.setData('text/plain', JSON.stringify({ type, id: indexOrSlot }));
            e.dataTransfer.effectAllowed = 'move';
        };
    }

    handleItemDrop(source, target) {
        if (source.type === target.type && source.id === target.id) return;

        const player = this._getLastPlayer();
        if (!player) return;

        // Inventory -> Inventory (Move/Swap)
        if (source.type === 'inventory' && target.type === 'inventory') {
            if (window.game && window.game.socket && window.game.socket.readyState === WebSocket.OPEN) {
                window.game.socket.send(JSON.stringify({
                    type: 'inventory_move',
                    payload: { fromIndex: source.id, toIndex: target.id }
                }));
            }
        }
        // Inventory -> Equipment (Equip)
        else if (source.type === 'inventory' && target.type === 'equipment') {
            const item = player.inventory[source.id];
            if (item && window.game) {
                window.game.sendEquipMessage(item, target.id);
            }
        }
        // Equipment -> Inventory (Unequip)
        else if (source.type === 'equipment' && target.type === 'inventory') {
            if (window.game && window.game.socket && window.game.socket.readyState === WebSocket.OPEN) {
                window.game.socket.send(JSON.stringify({
                    type: 'unequip',
                    payload: { slot: source.id }
                }));
            }
        }
    }
}
