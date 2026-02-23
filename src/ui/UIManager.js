import { ItemGenerator, SLOTS, Item, BASE_ITEMS, RARITY, SET_DEFINITIONS, UNIQUE_EFFECTS, GEM_TYPES, GEM_QUALITIES, getGemStats } from '../core/ItemSystem.js';
import { CONSTANTS } from '../core/Constants.js';

export class UIManager {
    constructor(isMobile = false) {
        this.isMobile = isMobile;
        this.hud = document.getElementById('player-hud');
        this.hpBar = document.getElementById('player-hp-bar');
        this.hpText = document.getElementById('player-hp-text');
        this.manaBar = document.getElementById('player-mana-bar');
        this.manaText = document.getElementById('player-mana-text');
        
        this.floatingBars = new Map(); // Entity ID -> DOM Element
        this.uiLayer = document.getElementById('ui-layer');
        this.gameTimer = document.getElementById('game-timer');

        // New UI Elements
        this.xpBar = document.getElementById('xp-bar-fill');
        this.xpText = document.getElementById('xp-text');
        this.characterSheet = document.getElementById('character-sheet');
        this.statsContent = document.getElementById('stats-content');
        this.inventoryScreen = document.getElementById('inventory-screen');
        this.inventoryGrid = document.getElementById('inventory-grid');
        this.goldDisplay = document.getElementById('gold-display');
        this.shopScreen = document.getElementById('shop-screen');
        this.shopGambleTitle = document.getElementById('shop-gamble-title');
        this.stashScreen = document.getElementById('stash-screen');
        this.stashGrid = document.getElementById('stash-grid');

        // Quest UI
        this.questWindow = document.getElementById('quest-window');
        this.questList = document.getElementById('quest-list');
        this.questJournal = document.getElementById('quest-journal');
        this.journalList = document.getElementById('journal-list');
        this.btnCloseQuest = document.getElementById('btn-close-quest');
        this.btnCloseJournal = document.getElementById('btn-close-journal');

        // Escape Menu & Help
        this.escMenu = document.getElementById('esc-menu');
        this.helpScreen = document.getElementById('help-screen');
        this.settingsScreen = document.getElementById('settings-screen');
        this.patchNotesScreen = document.getElementById('patch-notes-screen');

        this.btnResume = document.getElementById('btn-resume');
        this.btnHelp = document.getElementById('btn-help');
        this.btnSettings = document.getElementById('btn-settings');
        this.btnPatchNotes = document.getElementById('btn-patch-notes');
        this.btnReport = document.getElementById('btn-report');
        this.btnMenu = document.getElementById('btn-menu');
        this.btnCloseHelp = document.getElementById('btn-close-help');
        this.btnCloseSettings = document.getElementById('btn-close-settings');
        this.btnClosePatchNotes = document.getElementById('btn-close-patch-notes');
        this.btnRespawn = document.getElementById('btn-respawn');
        this.btnCloseShop = document.getElementById('btn-close-shop');
        this.btnCloseStash = document.getElementById('btn-close-stash');

        // Shop Tabs
        this.tabShopMain = document.getElementById('tab-shop-main');
        this.tabShopBuyback = document.getElementById('tab-shop-buyback');
        this.shopContentMain = document.getElementById('shop-content-main');
        this.shopContentBuyback = document.getElementById('shop-content-buyback');
        this.buybackGrid = document.getElementById('buyback-grid');

        if (this.tabShopMain) this.tabShopMain.addEventListener('click', () => this.switchShopTab('main'));
        if (this.tabShopBuyback) this.tabShopBuyback.addEventListener('click', () => this.switchShopTab('buyback'));

        // Skill Tree UI
        this.skillTreeWindow = document.getElementById('skill-tree-window');
        this.skillTreeContent = document.getElementById('skill-tree-content');
        this.btnCloseSkillTree = document.getElementById('btn-close-skills');

        // Skill Tree Tabs
        this.skillTreeMode = 'skills'; // 'skills' | 'talents'
        
        if (this.btnCloseSkillTree) this.btnCloseSkillTree.addEventListener('click', () => this.toggleSkillTree());

        // Abilities Menu UI
        this.abilitiesMenu = document.getElementById('abilities-menu');
        this.abilitiesContent = document.getElementById('abilities-content');
        this.btnCloseAbilities = document.getElementById('btn-close-abilities');
        if (this.btnCloseAbilities) this.btnCloseAbilities.addEventListener('click', () => this.toggleAbilitiesMenu());

        // Hotbar UI
        this.hotbarContainer = document.getElementById('hotbar-container');
        this.hotbarSlots = Array.from(document.querySelectorAll('.hotbar-slot'));
        
        // Drag and Drop State
        this.draggedAbility = null;
        
        this.setupDragAndDrop();

        this.reportScreen = document.getElementById('report-screen');
        this.btnCancelReport = document.getElementById('btn-cancel-report');
        this.btnSubmitReport = document.getElementById('btn-submit-report');
        this.reportType = document.getElementById('report-type');
        this.reportText = document.getElementById('report-text');
        this.graphicsQualitySelect = document.getElementById('graphics-quality');
        this.graphicsBrightnessSlider = document.getElementById('graphics-brightness');
        this.graphicsBrightnessValue = document.getElementById('graphics-brightness-value');

        this.btnSellCommon = document.getElementById('btn-sell-common');
        this.btnSellUncommon = document.getElementById('btn-sell-uncommon');
        this.btnSellRare = document.getElementById('btn-sell-rare');

        if (this.btnResume) this.btnResume.addEventListener('click', () => this.toggleEscMenu());
        if (this.btnHelp) this.btnHelp.addEventListener('click', () => this.toggleHelp());
        if (this.btnSettings) this.btnSettings.addEventListener('click', () => this.toggleSettings());
        if (this.btnPatchNotes) this.btnPatchNotes.addEventListener('click', () => this.togglePatchNotes());
        if (this.btnReport) this.btnReport.addEventListener('click', () => this.toggleReport());
        if (this.btnMenu) this.btnMenu.addEventListener('click', () => location.reload());
        if (this.btnCloseHelp) this.btnCloseHelp.addEventListener('click', () => this.toggleHelp());
        if (this.btnCloseSettings) this.btnCloseSettings.addEventListener('click', () => this.toggleSettings());
        if (this.btnClosePatchNotes) this.btnClosePatchNotes.addEventListener('click', (e) => {
            console.log("Close Patch Notes Button Clicked");
            this.togglePatchNotes();
            e.stopPropagation();
        });

        this.onGraphicsQualityChange = null;
        this.onBrightnessChange = null;
        this.graphicsQuality = localStorage.getItem('eidolon.graphicsQuality') || 'high';
        if (this.graphicsQualitySelect) {
            this.graphicsQualitySelect.value = this.graphicsQuality;
            this.graphicsQualitySelect.addEventListener('change', () => {
                const nextQuality = this.graphicsQualitySelect.value;
                this.setGraphicsQuality(nextQuality);
            });
        }

        const storedBrightness = Number(localStorage.getItem('eidolon.graphicsBrightness'));
        this.graphicsBrightness = Number.isFinite(storedBrightness) ? Math.max(0, Math.min(100, storedBrightness)) : 50;
        if (this.graphicsBrightnessSlider) {
            this.graphicsBrightnessSlider.value = String(this.graphicsBrightness);
            this.graphicsBrightnessSlider.addEventListener('input', () => {
                this.setBrightnessLevel(Number(this.graphicsBrightnessSlider.value));
            });
        }
        this.updateBrightnessLabel();
        if (this.btnCloseShop) this.btnCloseShop.addEventListener('click', () => this.toggleShop());
        if (this.btnCloseStash) this.btnCloseStash.addEventListener('click', () => this.toggleStash());
        
        // Forge UI
        this.forgeScreen = document.getElementById('forge-screen');
        this.tradingHouseScreen = document.getElementById('trading-house-screen');
        this.btnCloseTradingHouse = document.getElementById('btn-close-trading-house');
        
        // Trading House UI Elements
        this.tabTradingBid = document.getElementById('tab-trading-bid');
        this.tabTradingList = document.getElementById('tab-trading-list');
        this.tabTradingMy = document.getElementById('tab-trading-my');
        this.panelTradingBid = document.getElementById('trading-panel-bid');
        this.panelTradingList = document.getElementById('trading-panel-list');
        this.panelTradingMy = document.getElementById('trading-panel-my');
        
        this.tradingSearchInput = document.getElementById('trading-search-input');
        this.btnTradingSearch = document.getElementById('btn-trading-search');
        this.tradingListContainer = document.getElementById('trading-list-container');
        
        this.tradingSellSlot = document.getElementById('trading-sell-slot');
        this.tradingInputBid = document.getElementById('trading-input-bid');
        this.tradingInputBuyout = document.getElementById('trading-input-buyout');
        this.tradingInputDuration = document.getElementById('trading-input-duration');
        this.btnTradingCreate = document.getElementById('btn-trading-create');
        this.tradingInventoryList = document.getElementById('trading-inventory-list');
        
        this.tradingMyList = document.getElementById('trading-my-list');
        
        this.selectedTradingItem = null; // Item selected to sell

        this.forgeEquipmentList = document.getElementById('forge-equipment-list');
        this.forgeUpgradeInfo = document.getElementById('forge-upgrade-info');
        this.forgeSelectedItemName = document.getElementById('forge-selected-item-name');
        this.forgeCostValue = document.getElementById('forge-cost-value');
        this.forgeUpgradeStats = document.getElementById('forge-upgrade-stats');
        this.btnForgeUpgrade = document.getElementById('btn-forge-upgrade');
        this.btnForgeUpgrade1 = document.getElementById('btn-forge-upgrade-1');
        this.btnForgeUpgrade10 = document.getElementById('btn-forge-upgrade-10');
        this.btnCloseForge = document.getElementById('btn-close-forge');

        // Forge Potency UI
        this.forgePotencyList = document.getElementById('forge-potency-list');
        this.forgePotencyInfo = document.getElementById('forge-potency-info');

        // Split Stack UI
        this.splitStackWindow = document.getElementById('split-stack-window');
        this.btnCloseSplit = document.getElementById('btn-close-split');
        this.splitItemName = document.getElementById('split-item-name');
        this.splitAmountRange = document.getElementById('split-amount-range');
        this.splitAmountInput = document.getElementById('split-amount-input');
        this.btnConfirmSplit = document.getElementById('btn-confirm-split');
        this.btnCancelSplit = document.getElementById('btn-cancel-split');

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
        this.forgePotencyItemName = document.getElementById('forge-potency-item-name');
        this.forgePotencyStats = document.getElementById('forge-potency-stats');
        this.forgePotencyCostValue = document.getElementById('forge-potency-cost-value');
        this.btnForgePotency = document.getElementById('btn-forge-potency');

        // Forge Tabs
        this.tabForgeUpgrade = document.getElementById('tab-forge-upgrade');
        this.tabForgePotency = document.getElementById('tab-forge-potency');
        this.tabForgeSocket = document.getElementById('tab-forge-socket');
        this.tabForgeGems = document.getElementById('tab-forge-gems');
        this.forgePanelUpgrade = document.getElementById('forge-panel-upgrade');
        this.forgePanelPotency = document.getElementById('forge-panel-potency');
        this.forgePanelSocket = document.getElementById('forge-panel-socket');
        this.forgePanelGems = document.getElementById('forge-panel-gems');

        if (this.tabForgeUpgrade) this.tabForgeUpgrade.addEventListener('click', () => this.switchForgeTab('upgrade'));
        if (this.tabForgePotency) this.tabForgePotency.addEventListener('click', () => this.switchForgeTab('potency'));
        if (this.tabForgeSocket) this.tabForgeSocket.addEventListener('click', () => this.switchForgeTab('socket'));
        if (this.tabForgeGems) this.tabForgeGems.addEventListener('click', () => this.switchForgeTab('gems'));

        // Forge Socket UI
        this.forgeSocketList = document.getElementById('forge-socket-list');
        this.forgeSocketInfo = document.getElementById('forge-socket-info');
        this.forgeSocketItemName = document.getElementById('forge-socket-item-name');
        this.forgeSocketStats = document.getElementById('forge-socket-stats');
        this.forgeSocketCostHearts = document.getElementById('forge-socket-cost-hearts');
        this.forgeSocketCostShards = document.getElementById('forge-socket-cost-shards');
        this.btnForgeSocket = document.getElementById('btn-forge-socket');

        if (this.btnForgeSocket) this.btnForgeSocket.addEventListener('click', () => this.handleForgeSocket());
        this.selectedForgeSocketSlot = null;
        
        // Forge Gems UI
        this.forgeGemEquipment = document.getElementById('forge-gem-equipment');
        this.forgeGemInventory = document.getElementById('forge-gem-inventory');
        this.forgeGemInfo = document.getElementById('forge-gem-info');
        this.forgeGemEquipName = document.getElementById('forge-gem-equip-name');
        this.forgeGemSocketSlots = document.getElementById('forge-gem-socket-slots');
        this.forgeGemSelectedName = document.getElementById('forge-gem-selected-name');
        this.forgeGemPreview = document.getElementById('forge-gem-preview');
        this.btnForgeInsertGem = document.getElementById('btn-forge-insert-gem');
        
        if (this.btnForgeInsertGem) this.btnForgeInsertGem.addEventListener('click', () => this.handleForgeInsertGem());
        this.selectedGemEquipSlot = null;
        this.selectedGemSocketIndex = null;
        this.selectedGemInvIndex = null;
        
        // Gem sub-tabs
        this.tabGemInsert = document.getElementById('tab-gem-insert');
        this.tabGemCombine = document.getElementById('tab-gem-combine');
        this.tabGemRemove = document.getElementById('tab-gem-remove');
        this.gemPanelInsert = document.getElementById('gem-panel-insert');
        this.gemPanelCombine = document.getElementById('gem-panel-combine');
        this.gemPanelRemove = document.getElementById('gem-panel-remove');
        
        if (this.tabGemInsert) this.tabGemInsert.addEventListener('click', () => this.switchGemSubTab('insert'));
        if (this.tabGemCombine) this.tabGemCombine.addEventListener('click', () => this.switchGemSubTab('combine'));
        if (this.tabGemRemove) this.tabGemRemove.addEventListener('click', () => this.switchGemSubTab('remove'));
        
        // Gem combine UI
        this.forgeGemCombineInventory = document.getElementById('forge-gem-combine-inventory');
        this.forgeGemCombineSlots = document.getElementById('forge-gem-combine-slots');
        this.forgeGemCombineResult = document.getElementById('forge-gem-combine-result');
        this.forgeGemCombinePreview = document.getElementById('forge-gem-combine-preview');
        this.btnForgeCombineGem = document.getElementById('btn-forge-combine-gem');
        
        if (this.btnForgeCombineGem) this.btnForgeCombineGem.addEventListener('click', () => this.handleForgeCombineGem());
        this.selectedCombineGemIndices = []; // Array of up to 3 inventory indices
        
        // Gem remove UI
        this.forgeGemRemoveEquipment = document.getElementById('forge-gem-remove-equipment');
        this.forgeGemRemoveInfo = document.getElementById('forge-gem-remove-info');
        this.forgeGemRemoveEquipName = document.getElementById('forge-gem-remove-equip-name');
        this.forgeGemRemoveSlots = document.getElementById('forge-gem-remove-slots');
        this.forgeGemRemovePreview = document.getElementById('forge-gem-remove-preview');
        this.btnForgeRemoveGem = document.getElementById('btn-forge-remove-gem');
        
        if (this.btnForgeRemoveGem) this.btnForgeRemoveGem.addEventListener('click', () => this.handleForgeRemoveGem());
        this.selectedRemoveEquipSlot = null;
        this.selectedRemoveSocketIndex = null;
        
        this.currentGemSubTab = 'insert';

        if (this.btnCloseForge) this.btnCloseForge.addEventListener('click', () => this.toggleForge());
        if (this.btnCloseTradingHouse) this.btnCloseTradingHouse.addEventListener('click', () => this.toggleTradingHouse());

        // Trading House Listeners
        if (this.tabTradingBid) this.tabTradingBid.addEventListener('click', () => this.switchTradingTab('bid'));
        if (this.tabTradingList) this.tabTradingList.addEventListener('click', () => this.switchTradingTab('list'));
        if (this.tabTradingMy) this.tabTradingMy.addEventListener('click', () => this.switchTradingTab('my'));
        
        if (this.btnTradingSearch) this.btnTradingSearch.addEventListener('click', () => this.handleTradingSearch());
        if (this.btnTradingCreate) this.btnTradingCreate.addEventListener('click', () => this.handleTradingCreate());

        if (this.btnForgeUpgrade) this.btnForgeUpgrade.addEventListener('click', () => this.handleForgeUpgrade(1)); // Fallback
        if (this.btnForgeUpgrade1) this.btnForgeUpgrade1.addEventListener('click', () => this.handleForgeUpgrade(1));
        if (this.btnForgeUpgrade10) this.btnForgeUpgrade10.addEventListener('click', () => this.handleForgeUpgrade(10));
        if (this.btnForgePotency) this.btnForgePotency.addEventListener('click', () => this.handleForgePotency());
        
        this.selectedForgeSlot = null;
        this.selectedForgePotencySlot = null;

        if (this.btnCloseQuest) this.btnCloseQuest.addEventListener('click', () => this.toggleQuestWindow());
        if (this.btnCloseJournal) this.btnCloseJournal.addEventListener('click', () => this.toggleJournal());
        if (this.btnRespawn) this.btnRespawn.addEventListener('click', () => {
            if (this.onRespawn) {
                this.onRespawn();
            }
            this.toggleEscMenu();
        });

        if (this.btnCancelReport) this.btnCancelReport.addEventListener('click', () => this.toggleReport());
        if (this.btnSubmitReport) this.btnSubmitReport.addEventListener('click', () => {
            const type = this.reportType.value;
            const text = this.reportText.value.trim();
            if (text && this.onReportSubmit) {
                this.onReportSubmit(type, text);
                this.reportText.value = ''; // Clear
                this.toggleReport();
                this.addChatMessage("System", "Report submitted successfully!");
            }
        });

        if (this.btnSellCommon) this.btnSellCommon.addEventListener('click', () => this.handleSellAll('Common'));
        if (this.btnSellUncommon) this.btnSellUncommon.addEventListener('click', () => this.handleSellAll('Uncommon'));
        if (this.btnSellRare) this.btnSellRare.addEventListener('click', () => this.handleSellAll('Rare'));

        this.setupShop();
        this.createSocialWindow();
        this.createDeathScreen();

        // Setup Windows (Drag & Click Blocking)
        this.setupWindow(this.characterSheet);
        this.setupWindow(this.inventoryScreen);
        this.setupWindow(this.shopScreen);
        this.setupWindow(this.stashScreen);
        this.setupWindow(this.forgeScreen);
        this.setupWindow(this.questWindow);
        this.setupWindow(this.questJournal);
        this.setupWindow(this.helpScreen);
        this.setupWindow(this.patchNotesScreen);
        this.setupWindow(this.reportScreen);
        this.setupWindow(this.socialWindow);
        this.setupWindow(this.skillTreeWindow);
        this.setupWindow(this.abilitiesMenu);

        // Party UI
        this.partyPanel = document.getElementById('party-panel');
        this.partyList = document.getElementById('party-list');
        this.partyInviteInput = document.getElementById('party-invite-input');
        this.btnInviteParty = document.getElementById('btn-invite-party');
        this.btnLeaveParty = document.getElementById('btn-leave-party');
        this.partyRequestModal = document.getElementById('party-request-modal');
        this.partyInviterName = document.getElementById('party-inviter-name');
        this.btnAcceptParty = document.getElementById('btn-accept-party');
        this.btnDeclineParty = document.getElementById('btn-decline-party');

        if (this.btnInviteParty) this.btnInviteParty.addEventListener('click', () => {
            const name = this.partyInviteInput.value.trim();
            if (name && this.onPartyInvite) {
                this.onPartyInvite(name);
                this.partyInviteInput.value = '';
            }
        });

        if (this.btnLeaveParty) this.btnLeaveParty.addEventListener('click', () => {
            if (this.onPartyLeave) this.onPartyLeave();
        });

        if (this.btnAcceptParty) this.btnAcceptParty.addEventListener('click', () => {
            if (this.onPartyResponse) this.onPartyResponse(this.currentInviter, true);
            this.hidePartyRequest();
        });

        if (this.btnDeclineParty) this.btnDeclineParty.addEventListener('click', () => {
            if (this.onPartyResponse) this.onPartyResponse(this.currentInviter, false);
            this.hidePartyRequest();
        });
        
        if (this.partyPanel) this.setupWindow(this.partyPanel);

        // Ability UI
        this.abilityContainer = document.getElementById('ability-container');
        this.abilityIcon = document.getElementById('ability-icon');
        this.abilityCooldown = document.getElementById('ability-cooldown');
        this.abilityTooltip = document.getElementById('ability-tooltip');
        this.abilityName = document.getElementById('ability-name');
        this.abilityDesc = document.getElementById('ability-desc');
        this.abilityCost = document.getElementById('ability-cost');

        // Tooltip Events
        this.abilityContainer.addEventListener('mouseenter', () => {
            this.abilityTooltip.style.display = 'block';
        });
        this.abilityContainer.addEventListener('mouseleave', () => {
            this.abilityTooltip.style.display = 'none';
        });

        // Stat Tooltip
        this.statTooltip = document.getElementById('stat-tooltip');
        this.statTooltipTitle = document.getElementById('stat-tooltip-title');
        this.statTooltipDesc = document.getElementById('stat-tooltip-desc');

        // Compare Tooltip
        this.compareTooltip = document.getElementById('compare-tooltip');
        this.compareTooltipTitle = document.getElementById('compare-tooltip-title');
        this.compareTooltipDesc = document.getElementById('compare-tooltip-desc');

        // Menu Bar Buttons
        this.menuBar = document.getElementById('menu-bar');
        this.btnMenuMap = document.getElementById('btn-menu-map');
        this.btnMenuSocial = document.getElementById('btn-menu-social');
        this.btnMenuInventory = document.getElementById('btn-menu-inventory');
        this.btnMenuCharacter = document.getElementById('btn-menu-character');
        this.btnMenuQuest = document.getElementById('btn-menu-quest');
        this.btnMenuSkills = document.getElementById('btn-menu-skills');

        if (this.btnMenuMap) this.btnMenuMap.addEventListener('click', () => {
            if (this.onMapToggle) this.onMapToggle();
        });
        if (this.btnMenuSocial) this.btnMenuSocial.addEventListener('click', () => this.toggleSocial());
        if (this.btnMenuInventory) this.btnMenuInventory.addEventListener('click', () => this.toggleInventory());
        if (this.btnMenuCharacter) this.btnMenuCharacter.addEventListener('click', () => this.toggleCharacterSheet());
        if (this.btnMenuQuest) this.btnMenuQuest.addEventListener('click', () => this.toggleJournal());
        if (this.btnMenuSkills) this.btnMenuSkills.addEventListener('click', () => this.toggleSkillTree());

        // Event Delegation for Stat Buttons & Tooltips
        this.statsContent.addEventListener('click', (e) => {
            if (e.target.classList.contains('stat-btn')) {
                const stat = e.target.dataset.stat;
                console.log(`Stat button clicked: ${stat}`); // Debug log
                if (this.onStatUpgrade) {
                    this.onStatUpgrade(stat);
                }
            }
        });

        this.statsContent.addEventListener('mousemove', (e) => {
            const row = e.target.closest('.stat-row');
            if (row && row.dataset.statName) {
                this.showStatTooltip(row.dataset.statName, e.clientX, e.clientY);
            } else {
                this.statTooltip.style.display = 'none';
            }
        });

        this.statsContent.addEventListener('mouseleave', () => {
            this.statTooltip.style.display = 'none';
        });

        // Inventory Tooltips
        this.inventoryGrid.addEventListener('mousemove', (e) => {
            if (this.selectedSlot !== -1) return; // Don't override selection with hover
            const slot = e.target.closest('.inv-slot');
            if (slot && slot._item) {
                this.showItemTooltip(slot._item, e.clientX, e.clientY, e);
            } else {
                this.hideTooltips();
            }
        });
        
        this.inventoryGrid.addEventListener('mouseleave', () => {
            if (this.selectedSlot === -1) { // Only hide if nothing selected (allows moving mouse to tooltip)
                this.hideTooltips();
            }
        });

        // Equipment Tooltips
        const equipContainer = this.characterSheet.querySelector('.equipment-slots');
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

        // Compare Mode Toggle
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

        // Chat UI
        this.chatBox = document.getElementById('chat-box');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        
        if (this.chatInput) {
            this.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const msg = this.chatInput.value.trim();
                    if (msg && this.onChatSend) {
                        this.onChatSend(msg);
                        this.chatInput.value = '';
                    }
                    this.chatInput.blur(); // Unfocus after sending
                    // Keep chat open but maybe fade out later? For now keep it.
                }
            });
        }

        // Global Enter to open chat
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (this.chatInput && document.activeElement !== this.chatInput) {
                    e.preventDefault(); // Prevent other actions
                    this.toggleChat(true);
                    this.chatInput.focus();
                }
            }
        });

        this.isHelpOpen = false;
        // this.isShopOpen is a getter now
        
        this.onStatUpgrade = null;
        this.onRespawn = null;
        this.onChatSend = null;
        this.onSellItem = null;
        this.onSellAll = null;
        this.onReportSubmit = null;
        
        this.selectedSlot = -1; // Track selected inventory slot
        this.statTooltip.style.pointerEvents = 'auto'; // Allow clicking buttons in tooltip
        
        // Close tooltip/selection when clicking outside
        window.addEventListener('click', (e) => {
            if (this.selectedSlot !== -1 && !e.target.closest('#stat-tooltip') && !e.target.closest('.inv-slot')) {
                this.selectedSlot = -1;
                this.hideTooltips();
            }
        });
    }

    resolveAssetUrl(path) {
        if (!path) return null;

        // Already absolute or special schemes
        if (/^(https?:|data:|blob:)/i.test(path)) return path;

        // Root-relative
        if (path.startsWith('/')) {
            return new URL(path, window.location.origin).toString();
        }

        // Most of our asset paths are workspace-root relative like `assets/...`.
        // Resolve them relative to this module location so they keep working
        // even if the document is served from a sub-path.
        return new URL(`../../${path}`, import.meta.url).toString();
    }

    createDeathScreen() {
        const div = document.createElement('div');
        div.id = 'death-screen';
        div.style.display = 'none';
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = '0';
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        div.style.zIndex = '2000';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.color = '#ff0000';
        div.style.fontFamily = 'Arial, sans-serif';
        
        div.innerHTML = `
            <h1 style="font-size: 72px; margin-bottom: 20px; text-shadow: 0 0 10px #000;">YOU DIED</h1>
            <button id="btn-death-respawn" style="
                padding: 15px 40px; 
                font-size: 24px; 
                background: #333; 
                color: white; 
                border: 2px solid #666; 
                cursor: pointer;
                transition: all 0.2s;
            ">Respawn in Town</button>
        `;
        
        document.body.appendChild(div);
        
        const btn = document.getElementById('btn-death-respawn');
        btn.onmouseover = () => {
            btn.style.background = '#444';
            btn.style.borderColor = '#fff';
        };
        btn.onmouseout = () => {
            btn.style.background = '#333';
            btn.style.borderColor = '#666';
        };
        btn.onclick = () => {
            if (this.onRespawn) {
                this.onRespawn();
            }
        };
        
        this.deathScreen = div;
    }

    showDeathScreen() {
        if (this.deathScreen) {
            this.deathScreen.style.display = 'flex';
        }
    }

    hideDeathScreen() {
        if (this.deathScreen) {
            this.deathScreen.style.display = 'none';
        }
    }

    handleSellAll(rarityName) {
        if (this.onSellAll) {
            this.onSellAll(rarityName);
        }
    }

    addChatMessage(sender, message) {
        if (!this.chatBox) return;
        this.chatBox.style.display = 'flex';
        const div = document.createElement('div');
        div.style.marginBottom = '4px';
        div.innerHTML = `<strong style="color: #ffd700;">${sender}:</strong> <span style="color: #fff;">${message}</span>`;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    toggleChat(show) {
        if (this.chatBox) {
            this.chatBox.style.display = show ? 'flex' : 'none';
        }
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

    updateTimer(seconds) {
        if (!this.gameTimer) return;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        this.gameTimer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    updatePlayerStats(player) {
        if (!player) return;
        this.lastPlayerRef = player;
        
        const hpPct = (player.stats.hp / player.stats.maxHp) * 100;
        this.hpBar.style.width = `${Math.max(0, hpPct)}%`;
        this.hpText.textContent = `${Math.ceil(player.stats.hp)} / ${player.stats.maxHp}`;

        // Assuming mana exists, if not default to 100%
        const mana = player.stats.mana || 100;
        const maxMana = player.stats.maxMana || 100;
        const manaPct = (mana / maxMana) * 100;
        this.manaBar.style.width = `${Math.max(0, manaPct)}%`;
        this.manaText.textContent = `${Math.floor(mana)} / ${maxMana}`;

        // Update Ability UI
        this.updateAbilityIcon(player);
    }

    getSkillIconPath(skillName, classType) {
        if (!skillName || !classType) return null;
        // Remove special characters like & and replace spaces with underscores
        // Also remove apostrophes (both straight and curly)
        const formattedName = skillName.toLowerCase()
            .replace(/ & /g, '_')
            .replace(/['’]/g, '')
            .replace(/ /g, '_');
        const formattedClass = classType.toLowerCase();
        return this.resolveAssetUrl(`assets/icons/${formattedClass}/${formattedName}.png`);
    }

    getItemIconPath(item) {
        if (!item) return null;
        
        if (item.icon) {
            return this.resolveAssetUrl(item.icon);
        }

        // Specific overrides for known items that might be missing icons
        if (item.name === 'Shard' || item.name === 'Eidolon Shard') {
            return this.resolveAssetUrl('assets/items/eidolon_shard/eidolon_shard.png');
        }
        if (item.name === 'Heart' || item.name === 'Eidolon Heart') {
            return this.resolveAssetUrl('assets/items/eidolon_heart/eidolon_heart.png');
        }
        
        let nameToUse = item.baseName;
        
        // Fallback: If baseName is missing (e.g. existing items), try to find it in BASE_ITEMS
        if (!nameToUse) {
            // Check if the item name contains any of the known base names
            // Sort by length descending to match "Plate Mail" before "Plate" if that were a case
            const sortedBaseItems = BASE_ITEMS.sort((a, b) => b.name.length - a.name.length);
            
            for (const baseItem of sortedBaseItems) {
                if (item.name.includes(baseItem.name)) {
                    nameToUse = baseItem.name;
                    break;
                }
            }
            
            // If still not found, fallback to full name (might fail for prefixed items but best effort)
            if (!nameToUse) nameToUse = item.name;
        }

        const formattedName = nameToUse.toLowerCase()
            .replace(/['’]/g, '')
            .replace(/ /g, '_');
        return this.resolveAssetUrl(`assets/icons/equipment/${formattedName}.png`);
    }

    getRarityColor(rarity) {
        if (!rarity) return '#ffffff';
        if (typeof rarity === 'string') {
            const key = rarity.toUpperCase();
            if (RARITY[key]) return RARITY[key].color;
            for (const k in RARITY) {
                if (RARITY[k].name === rarity) return RARITY[k].color;
            }
            return '#ffffff';
        }
        return rarity.color || '#ffffff';
    }

    updateAbilityIcon(player) {
        if (!player) return;

        // Update Info (only needs to happen once really, but safe here)
        this.abilityName.textContent = player.abilityName;
        this.abilityDesc.textContent = player.abilityDescription;
        const cost = Math.floor(player.abilityManaCost * (1 - player.stats.manaCostReduction));
        this.abilityCost.textContent = `Mana: ${cost}`;

        // Update Icon
        const classType = player.subType || player.meshType;
        const iconPath = this.getSkillIconPath(player.abilityName, classType);
        
        if (iconPath) {
            this.abilityIcon.style.backgroundImage = `url('${iconPath}')`;
            this.abilityIcon.textContent = '';
        } else {
            this.abilityIcon.style.backgroundImage = 'none';
            // Placeholder icon
            this.abilityIcon.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23444" stroke="%23888" stroke-width="5"/><text x="50" y="55" font-size="40" text-anchor="middle" fill="white" font-family="sans-serif">${player.abilityName.substring(0, 1)}</text></svg>')`;
        }

        // Update Cooldown
        if (player.abilityCooldown > 0) {
            this.abilityCooldown.style.display = 'flex';
            this.abilityCooldown.textContent = Math.ceil(player.abilityCooldown);
        } else {
            this.abilityCooldown.style.display = 'none';
        }
    }

    updateEnemyBars(entities, camera, hoveredEntity, isAltPressed) {
        // 1. Identify which entities need bars
        const activeIds = new Set();
        
        // Performance: Pre-calculate camera frustum for culling
        // and cache viewport dimensions
        const halfWidth = window.innerWidth * 0.5;
        const halfHeight = window.innerHeight * 0.5;
        const cullMargin = 100; // Pixels outside viewport to still render

        // Use indexed loop for slight performance gain
        const entitiesLen = entities.length;
        for (let i = 0; i < entitiesLen; i++) {
            const entity = entities[i];
            
            // Only show for enemies (not player) and if alive. Also skip entities without stats (like projectiles).
            if (entity.id.startsWith('player') || !entity.stats || entity.stats.hp <= 0) continue;
            if (!entity.mesh) continue; // Skip entities without mesh (can't position bar)

            const isHovered = (hoveredEntity && hoveredEntity.id === entity.id);
            const shouldShow = isAltPressed || isHovered;

            if (shouldShow) {
                // Frustum culling: Skip entities that are off-screen
                // Get position above head and project to screen
                const pos = entity.position.clone();
                pos.y += 2.5;
                pos.project(camera);
                
                // Check if on screen (with margin)
                const screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
                const screenY = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
                
                if (screenX < -cullMargin || screenX > window.innerWidth + cullMargin ||
                    screenY < -cullMargin || screenY > window.innerHeight + cullMargin ||
                    pos.z > 1) { // Behind camera
                    continue;
                }
                
                activeIds.add(entity.id);
                let bar = this.floatingBars.get(entity.id);
                
                // Create if missing or get from pool
                if (!bar) {
                    bar = this._getPooledBar() || this.createFloatingBar();
                    this.floatingBars.set(entity.id, bar);
                    if (!bar.parentNode) {
                        this.uiLayer.appendChild(bar);
                    }
                }

                // Update Position directly (already computed above)
                bar.style.left = `${screenX}px`;
                bar.style.top = `${screenY}px`;
                bar.style.transform = 'translate(-50%, -50%)';
                
                // Update Fill
                const fill = bar.querySelector('.floating-fill');
                const pct = (entity.stats.hp / entity.stats.maxHp) * 100;
                fill.style.width = `${Math.max(0, pct)}%`;
                
                bar.style.display = 'block';
            }
        }

        // 2. Hide unused bars and return to pool
        for (const [id, bar] of this.floatingBars) {
            if (!activeIds.has(id)) {
                bar.style.display = 'none';
                // Pool for reuse instead of keeping in DOM hidden
                this._returnBarToPool(bar);
                this.floatingBars.delete(id);
            }
        }
    }
    
    // DOM element pooling for health bars
    _getPooledBar() {
        if (!this._barPool) this._barPool = [];
        return this._barPool.pop();
    }
    
    _returnBarToPool(bar) {
        if (!this._barPool) this._barPool = [];
        if (this._barPool.length < 50) { // Limit pool size
            this._barPool.push(bar);
        } else if (bar.parentNode) {
            bar.parentNode.removeChild(bar);
        }
    }

    createFloatingBar() {
        const div = document.createElement('div');
        div.className = 'floating-bar';
        const fill = document.createElement('div');
        fill.className = 'floating-fill';
        div.appendChild(fill);
        return div;
    }

    updateBarPosition(bar, entity, camera) {
        if (!entity.mesh) return;

        // Get position above head
        const pos = entity.position.clone();
        pos.y += 2.5; // Height offset

        // Project to 2D screen space
        pos.project(camera);

        // Convert NDC to pixel coordinates
        // NDC: [-1, 1] -> Screen: [0, width]
        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        // NDC Y is up, Screen Y is down
        const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

        // Center the bar horizontally
        bar.style.left = `${x}px`;
        bar.style.top = `${y}px`;
        bar.style.transform = 'translate(-50%, -50%)'; // Center anchor point
    }

    get isEscMenuOpen() {
        return this.escMenu.style.display === 'block';
    }

    get isPatchNotesOpen() {
        return this.patchNotesScreen.style.display === 'flex';
    }

    get isInventoryOpen() {
        return this.inventoryScreen.style.display === 'block';
    }

    get isCharacterSheetOpen() {
        return this.characterSheet.style.display === 'block';
    }

    get isShopOpen() {
        return this.shopScreen.style.display === 'flex';
    }

    get isStashOpen() {
        return this.stashScreen.style.display === 'flex';
    }

    toggleCharacterSheet() {
        const isHidden = this.characterSheet.style.display === 'none' || this.characterSheet.style.display === '';
        this.characterSheet.style.display = isHidden ? 'block' : 'none';
        
        if (isHidden && this.lastPlayerRef) {
            this.updateCharacterSheet(this.lastPlayerRef);
        }
    }

    toggleInventory() {
        const isHidden = this.inventoryScreen.style.display === 'none' || this.inventoryScreen.style.display === '';
        this.inventoryScreen.style.display = isHidden ? 'block' : 'none';
        
        if (isHidden && this.lastPlayerRef) {
            console.log("UIManager: Opening inventory, refreshing...");
            this.updateInventory(this.lastPlayerRef);
        }
    }

    showSplitWindow(item, slotIndex) {
        if (!this.splitStackWindow) return;
        
        this.pendingSplitItem = item;
        this.pendingSplitSlot = slotIndex;
        
        this.splitItemName.textContent = item.name;
        
        // Allow splitting 1 to stack-1
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
        if (this.splitStackWindow) {
            this.splitStackWindow.style.display = 'none';
        }
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

    toggleStash() {
        const isHidden = this.stashScreen.style.display === 'none' || this.stashScreen.style.display === '';
        this.stashScreen.style.display = isHidden ? 'flex' : 'none';
        
        if (isHidden) {
            this.inventoryScreen.style.display = 'block'; // Open inventory too
            if (this.lastPlayerRef) {
                this.updateInventory(this.lastPlayerRef);
                this.updateStash(this.lastPlayerRef);
            }
        }
    }

    toggleForge() {
        const isHidden = this.forgeScreen.style.display === 'none' || this.forgeScreen.style.display === '';
        this.forgeScreen.style.display = isHidden ? 'flex' : 'none';
        
        if (isHidden) {
            this.inventoryScreen.style.display = 'block'; // Open inventory too
            this.switchForgeTab('upgrade'); // Default to upgrade tab
            if (this.lastPlayerRef) {
                this.updateForgeUI(this.lastPlayerRef);
                this.updateForgePotencyUI(this.lastPlayerRef);
                this.updateForgeSocketUI(this.lastPlayerRef);
                this.updateForgeGemsUI(this.lastPlayerRef);
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

    toggleTradingHouse() {
        if (this.tradingHouseScreen) {
            const isHidden = this.tradingHouseScreen.style.display === 'none' || this.tradingHouseScreen.style.display === '';
            this.tradingHouseScreen.style.display = isHidden ? 'flex' : 'none';
            
            if (isHidden) {
                this.switchTradingTab('bid'); // Default to bid tab
                if (this.lastPlayerRef) {
                    // Initial search or load?
                    this.handleTradingSearch(); // Load initial list
                }
            } else {
                this.selectedTradingItem = null;
            }
        }
    }

    switchTradingTab(tab) {
        // Reset styles
        if (this.tabTradingBid) this.tabTradingBid.style.background = '#111';
        if (this.tabTradingList) this.tabTradingList.style.background = '#111';
        if (this.tabTradingMy) this.tabTradingMy.style.background = '#111';
        
        // Reset Panels
        if (this.panelTradingBid) this.panelTradingBid.style.display = 'none';
        if (this.panelTradingList) this.panelTradingList.style.display = 'none';
        if (this.panelTradingMy) this.panelTradingMy.style.display = 'none';
        
        // Activate
        if (tab === 'bid') {
            if (this.tabTradingBid) this.tabTradingBid.style.background = '#333';
            if (this.panelTradingBid) this.panelTradingBid.style.display = 'flex';
            this.handleTradingSearch();
        } else if (tab === 'list') {
            if (this.tabTradingList) this.tabTradingList.style.background = '#333';
            if (this.panelTradingList) this.panelTradingList.style.display = 'flex';
            if (this.lastPlayerRef) {
                this.updateTradingInventory(this.lastPlayerRef);
            }
        } else if (tab === 'my') {
            if (this.tabTradingMy) this.tabTradingMy.style.background = '#333';
            if (this.panelTradingMy) this.panelTradingMy.style.display = 'flex';
            // Request my auctions
            if (this.onTradingMyAuctions) this.onTradingMyAuctions();
        }
    }

    handleTradingSearch() {
        const query = this.tradingSearchInput ? this.tradingSearchInput.value : '';
        if (this.onTradingSearch) {
            this.onTradingSearch(query);
        }
    }

    handleTradingCreate() {
        if (!this.selectedTradingItem) {
            this.addChatMessage("System", "Select an item to sell first.");
            return;
        }
        
        const bid = parseInt(this.tradingInputBid.value);
        const buyout = parseInt(this.tradingInputBuyout.value);
        const duration = parseInt(this.tradingInputDuration.value);
        
        if (isNaN(bid) || isNaN(buyout) || bid <= 0 || buyout <= 0) {
            this.addChatMessage("System", "Invalid price.");
            return;
        }
        
        if (buyout < bid) {
            this.addChatMessage("System", "Buyout cannot be less than starting bid.");
            return;
        }

        if (this.onTradingCreate) {
            this.onTradingCreate(this.selectedTradingItem.slot, bid, buyout, duration);
            // Reset selection
            this.selectedTradingItem = null;
            this.tradingSellSlot.innerHTML = '<span style="font-size: 30px; color: #444;">+</span>';
            this.tradingSellSlot.style.backgroundImage = 'none';
            this.switchTradingTab('my'); // Switch to my auctions to see it
        }
    }

    updateTradingInventory(player) {
        if (!this.tradingInventoryList) return;
        this.tradingInventoryList.innerHTML = '';
        
        player.inventory.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'inv-slot';
            el.style.width = '40px';
            el.style.height = '40px';
            
            if (item && item.id) {
                el.style.cursor = 'pointer';
                
                const iconPath = this.getItemIconPath(item);
                el.style.backgroundImage = `url('${iconPath}')`;
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';
                
                // Rarity Border
                if (item.rarity) {
                    const color = this.getRarityColor(item.rarity);
                    el.style.border = `1px solid ${color}`;
                    el.style.boxShadow = `inset 0 0 5px ${color}40`;
                } else {
                    el.style.border = '1px solid #666';
                }

                el.onclick = () => this.selectTradingItem(item, index);
                
                // Tooltip
                el.onmouseenter = (e) => this.showItemTooltip(item, e.clientX, e.clientY);
                el.onmouseleave = () => this.hideTooltips();
            } else {
                el.style.border = '1px solid #444';
            }
            
            this.tradingInventoryList.appendChild(el);
        });
    }

    selectTradingItem(item, slotIndex) {
        this.selectedTradingItem = { ...item, slot: slotIndex };
        
        // Update Sell Slot Visual
        const iconPath = this.getItemIconPath(item);
        this.tradingSellSlot.innerHTML = '';
        this.tradingSellSlot.style.backgroundImage = `url('${iconPath}')`;
        this.tradingSellSlot.style.backgroundSize = 'contain';
        this.tradingSellSlot.style.backgroundRepeat = 'no-repeat';
        this.tradingSellSlot.style.backgroundPosition = 'center';
        
        if (item.rarity) {
            const color = this.getRarityColor(item.rarity);
            this.tradingSellSlot.style.border = `2px solid ${color}`;
        }
    }

    renderAuctionList(auctions) {
        if (!this.tradingListContainer) return;
        this.tradingListContainer.innerHTML = '';
        
        if (!auctions || auctions.length === 0) {
            this.tradingListContainer.innerHTML = '<div style="padding: 10px; color: #888; text-align: center;">No auctions found.</div>';
            return;
        }

        auctions.forEach(auction => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr';
            row.style.padding = '5px';
            row.style.borderBottom = '1px solid #444';
            row.style.alignItems = 'center';
            row.style.fontSize = '12px';
            
            // Item Name (with color)
            const nameSpan = document.createElement('span');
            nameSpan.textContent = auction.item.name;
            nameSpan.style.color = this.getRarityColor(auction.item.rarity);
            nameSpan.style.cursor = 'pointer';
            nameSpan.onmouseenter = (e) => this.showItemTooltip(auction.item, e.clientX, e.clientY);
            nameSpan.onmouseleave = () => this.hideTooltips();
            row.appendChild(nameSpan);
            
            // Seller
            const sellerSpan = document.createElement('span');
            sellerSpan.textContent = auction.sellerName;
            sellerSpan.style.color = '#aaa';
            row.appendChild(sellerSpan);
            
            // Price
            const priceSpan = document.createElement('span');
            priceSpan.innerHTML = `<span style="color: #ffd700;">${auction.currentBid}</span> / <span style="color: #ffd700;">${auction.buyoutPrice}</span>`;
            row.appendChild(priceSpan);
            
            // Action
            const actionDiv = document.createElement('div');
            actionDiv.style.display = 'flex';
            actionDiv.style.gap = '5px';
            
            const btnBid = document.createElement('button');
            btnBid.textContent = 'Bid';
            btnBid.className = 'btn-menu';
            btnBid.style.fontSize = '10px';
            btnBid.style.padding = '2px 5px';
            btnBid.onclick = () => {
                let minBid = auction.currentBid + Math.ceil(auction.currentBid * 0.05);
                if (minBid < auction.currentBid + 1) minBid = auction.currentBid + 1;
                // If no bids yet, start at currentBid (starting bid)
                if (!auction.bidderId) minBid = auction.currentBid;

                const amount = prompt(`Enter bid amount (Minimum: ${minBid})`, minBid);
                if (amount !== null) {
                    const val = parseInt(amount);
                    if (!isNaN(val)) {
                        if (this.onTradingBid) this.onTradingBid(auction.id, val);
                    }
                }
            };
            actionDiv.appendChild(btnBid);

            const btnBuy = document.createElement('button');
            btnBuy.textContent = 'Buyout';
            btnBuy.className = 'btn-menu';
            btnBuy.style.fontSize = '10px';
            btnBuy.style.padding = '2px 5px';
            btnBuy.onclick = () => {
                if (this.onTradingBuyout) this.onTradingBuyout(auction.id);
            };
            actionDiv.appendChild(btnBuy);
            
            row.appendChild(actionDiv);
            this.tradingListContainer.appendChild(row);
        });
    }

    renderMyAuctions(auctions) {
        if (!this.tradingMyList) return;
        this.tradingMyList.innerHTML = '';
        
        if (!auctions || auctions.length === 0) {
            this.tradingMyList.innerHTML = '<div style="padding: 10px; color: #888; text-align: center;">You have no active auctions.</div>';
            return;
        }

        auctions.forEach(auction => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr';
            row.style.padding = '5px';
            row.style.borderBottom = '1px solid #444';
            row.style.alignItems = 'center';
            row.style.fontSize = '12px';
            
            // Item Name
            const nameSpan = document.createElement('span');
            nameSpan.textContent = auction.item.name;
            nameSpan.style.color = this.getRarityColor(auction.item.rarity);
            row.appendChild(nameSpan);
            
            // Status
            const statusSpan = document.createElement('span');
            statusSpan.textContent = auction.status; // ACTIVE, SOLD, EXPIRED
            statusSpan.style.color = auction.status === 'SOLD' ? '#0f0' : (auction.status === 'EXPIRED' ? '#f00' : '#fff');
            row.appendChild(statusSpan);
            
            // Price
            const priceSpan = document.createElement('span');
            priceSpan.innerHTML = `<span style="color: #ffd700;">${auction.currentBid}</span>`;
            row.appendChild(priceSpan);
            
            // Action
            const actionDiv = document.createElement('div');
            
            if (auction.status === 'SOLD') {
                const btnCollect = document.createElement('button');
                btnCollect.textContent = 'Collect Gold';
                btnCollect.className = 'btn-menu';
                btnCollect.style.fontSize = '10px';
                btnCollect.style.padding = '2px 5px';
                btnCollect.onclick = () => {
                    if (this.onTradingCollect) this.onTradingCollect(auction.id);
                };
                actionDiv.appendChild(btnCollect);
            } else if (auction.status === 'EXPIRED' || auction.status === 'CANCELLED') {
                const btnReclaim = document.createElement('button');
                btnReclaim.textContent = 'Reclaim Item';
                btnReclaim.className = 'btn-menu';
                btnReclaim.style.fontSize = '10px';
                btnReclaim.style.padding = '2px 5px';
                btnReclaim.onclick = () => {
                    if (this.onTradingCollect) this.onTradingCollect(auction.id);
                };
                actionDiv.appendChild(btnReclaim);
            } else {
                const btnCancel = document.createElement('button');
                btnCancel.textContent = 'Cancel';
                btnCancel.className = 'btn-menu';
                btnCancel.style.fontSize = '10px';
                btnCancel.style.padding = '2px 5px';
                btnCancel.style.background = '#500';
                btnCancel.onclick = () => {
                    if (this.onTradingCancel) this.onTradingCancel(auction.id);
                };
                actionDiv.appendChild(btnCancel);
            }
            
            row.appendChild(actionDiv);
            this.tradingMyList.appendChild(row);
        });
    }

    switchForgeTab(tab) {
        // Reset styles
        if (this.tabForgeUpgrade) this.tabForgeUpgrade.style.background = '#111';
        if (this.tabForgePotency) this.tabForgePotency.style.background = '#111';
        if (this.tabForgeSocket) this.tabForgeSocket.style.background = '#111';
        if (this.tabForgeGems) this.tabForgeGems.style.background = '#111';
        
        if (this.forgePanelUpgrade) this.forgePanelUpgrade.style.display = 'none';
        if (this.forgePanelPotency) this.forgePanelPotency.style.display = 'none';
        if (this.forgePanelSocket) this.forgePanelSocket.style.display = 'none';
        if (this.forgePanelGems) this.forgePanelGems.style.display = 'none';

        if (tab === 'upgrade') {
            if (this.tabForgeUpgrade) this.tabForgeUpgrade.style.background = '#333';
            if (this.forgePanelUpgrade) this.forgePanelUpgrade.style.display = 'flex';
        } else if (tab === 'potency') {
            if (this.tabForgePotency) this.tabForgePotency.style.background = '#333';
            if (this.forgePanelPotency) this.forgePanelPotency.style.display = 'flex';
        } else if (tab === 'socket') {
            if (this.tabForgeSocket) this.tabForgeSocket.style.background = '#333';
            if (this.forgePanelSocket) this.forgePanelSocket.style.display = 'flex';
        } else if (tab === 'gems') {
            if (this.tabForgeGems) this.tabForgeGems.style.background = '#333';
            if (this.forgePanelGems) this.forgePanelGems.style.display = 'flex';
            if (this.lastPlayerRef) this.updateForgeGemsUI(this.lastPlayerRef);
        }
    }

    updateForgeUI(player) {
        if (!this.forgeEquipmentList) return;
        
        const slots = ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'ring1', 'ring2', 'trinket1', 'trinket2', 'neck'];
        
        // Map existing children
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
                    
                    // Level Indicator
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

                // Update Visuals
                const iconPath = this.getItemIconPath(item);
                // Only update background if changed to avoid flickering
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

                // Update Level Indicator
                const levelDiv = el.querySelector('.level-indicator');
                if (levelDiv) levelDiv.textContent = `Lvl ${item.level}`;

                // Highlight
                if (this.selectedForgeSlot === slot) {
                    el.style.boxShadow = '0 0 10px #ffd700';
                    el.style.borderColor = '#ffd700';
                } else {
                    el.style.boxShadow = 'none';
                    el.style.border = el.dataset.originalBorder;
                }

                // Update Handler (Use onclick to replace previous)
                el.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedForgeSlot = slot;
                    this.updateForgeInfo(item);
                    
                    // Update highlights
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
        
        // Calculate Per-Level Cost
        let perLevelCost = 0;
        if (item.level < 90) {
            const tier = Math.floor(item.level / 10);
            const baseTierCost = Math.pow(2, tier);
            perLevelCost = Math.floor(baseTierCost / 100);
            if (perLevelCost < 1) perLevelCost = 1;
        } else {
            perLevelCost = 2;
        }

        // Option 1: +1 Level
        const cost1 = perLevelCost;
        const targetLevel1 = item.level + 1;
        
        // Option 2: +10 Levels
        let cost10 = perLevelCost * 10;
        let targetLevel10 = item.level + 10;
        if (targetLevel10 > 100) {
            targetLevel10 = 100;
            const actualLevels = targetLevel10 - item.level;
            cost10 = perLevelCost * actualLevels;
        }

        // Display Cost (Show +1 cost by default or range?)
        // Let's show "Cost per level: X" or just update buttons to show cost?
        // The UI has a single cost display. Let's update it to show "1 Level: X | 10 Levels: Y"
        if (this.forgeCostValue) {
            if (item.level >= 100) {
                this.forgeCostValue.textContent = "MAX";
            } else {
                this.forgeCostValue.textContent = `${cost1} (1 Lvl) / ${cost10} (10 Lvl)`;
            }
        }

        // Update Buttons
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

        // Stat Preview (Show +1 by default)
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
        if (this.onForgeUpgrade) {
            this.onForgeUpgrade(this.selectedForgeSlot, amount);
        }
    }

    updateForgePotencyUI(player) {
        if (!this.forgePotencyList) return;
        
        const slots = ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'ring1', 'ring2', 'trinket1', 'trinket2', 'neck'];
        
        // Map existing children
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
                    
                    // Potency Indicator
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

                // Update Visuals
                const iconPath = this.getItemIconPath(item);
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

                // Update Potency Indicator
                const potencyDiv = el.querySelector('.potency-indicator');
                if (potencyDiv) {
                    if (item.potency > 0) {
                        potencyDiv.style.display = 'block';
                        potencyDiv.textContent = `+${item.potency}`;
                    } else {
                        potencyDiv.style.display = 'none';
                    }
                }

                // Highlight
                if (this.selectedForgePotencySlot === slot) {
                    el.style.boxShadow = '0 0 10px #ff4444';
                    el.style.borderColor = '#ff4444';
                } else {
                    el.style.boxShadow = 'none';
                    el.style.border = el.dataset.originalBorder;
                }

                // Update Handler
                el.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedForgePotencySlot = slot;
                    this.updateForgePotencyInfo(item);
                    
                    // Update highlights
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

    updateForgePotencyInfo(item) {
        if (!item) return;
        this.forgePotencyInfo.style.display = 'flex';
        if (this.forgePotencyItemName) {
            this.forgePotencyItemName.textContent = item.name;
            this.forgePotencyItemName.style.color = item.rarity ? item.rarity.color : 'white';
        }
        
        // Calculate Cost
        const currentPotency = item.potency || 0;
        if (currentPotency >= 20) {
            if (this.forgePotencyCostValue) this.forgePotencyCostValue.textContent = "MAX";
            if (this.btnForgePotency) this.btnForgePotency.disabled = true;
            if (this.forgePotencyStats) this.forgePotencyStats.innerHTML = '';
            return;
        }

        const cost = Math.pow(2, currentPotency);
        
        if (this.forgePotencyCostValue) this.forgePotencyCostValue.textContent = cost;
        if (this.btnForgePotency) {
            this.btnForgePotency.disabled = false;
            this.btnForgePotency.textContent = `Empower to +${currentPotency + 1}`;
        }

        // Stat Preview
        if (this.forgePotencyStats) {
            let statsHtml = '<div style="margin-top: 10px; font-size: 12px;">';
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
            statsHtml += '</div>';
            this.forgePotencyStats.innerHTML = statsHtml;
        }
    }

    handleForgePotency() {
        if (!this.selectedForgePotencySlot) return;
        if (this.onForgePotency) {
            this.onForgePotency(this.selectedForgePotencySlot);
        }
    }

    updateForgeSocketUI(player) {
        if (!this.forgeSocketList) return;
        
        const slots = ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'ring1', 'ring2', 'trinket1', 'trinket2', 'neck'];
        
        // Map existing children
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
                    
                    // Socket Indicator
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

                // Update Visuals
                const iconPath = this.getItemIconPath(item);
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

                // Update Socket Indicator
                const socketDiv = el.querySelector('.socket-indicator');
                if (socketDiv) {
                    socketDiv.innerHTML = ''; // Clear dots
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

                // Highlight
                if (this.selectedForgeSocketSlot === slot) {
                    el.style.boxShadow = '0 0 10px #00ffff';
                    el.style.borderColor = '#00ffff';
                } else {
                    el.style.boxShadow = 'none';
                    el.style.border = el.dataset.originalBorder;
                }

                // Update Handler
                el.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedForgeSocketSlot = slot;
                    this.updateForgeSocketInfo(item);
                    
                    // Update highlights
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

    updateForgeSocketInfo(item) {
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
        
        if (this.forgeSocketCostHearts) this.forgeSocketCostHearts.textContent = heartCost;
        if (this.forgeSocketCostShards) this.forgeSocketCostShards.textContent = shardCost;
        if (this.btnForgeSocket) {
            this.btnForgeSocket.disabled = false;
            this.btnForgeSocket.textContent = `Add Socket (${currentSockets + 1}/4)`;
        }

        // Stat Preview
        if (this.forgeSocketStats) {
            let statsHtml = '<div style="margin-top: 10px; font-size: 12px;">';
            statsHtml += `<div style="color: #aaa; margin-bottom: 5px;">Sockets: ${currentSockets} <span style="color: #0f0;">-> ${currentSockets + 1}</span></div>`;
            statsHtml += '</div>';
            this.forgeSocketStats.innerHTML = statsHtml;
        }
    }

    handleForgeSocket() {
        if (!this.selectedForgeSocketSlot) return;
        if (this.onForgeSocket) {
            this.onForgeSocket(this.selectedForgeSocketSlot);
        }
    }
    
    updateForgeGemsUI(player) {
        if (!this.forgeGemEquipment || !this.forgeGemInventory) return;
        
        // Clear existing content
        this.forgeGemEquipment.innerHTML = '';
        this.forgeGemInventory.innerHTML = '';
        
        const slots = ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'ring1', 'ring2', 'trinket1', 'trinket2', 'neck'];
        
        // Show equipment with sockets
        slots.forEach(slot => {
            const item = player.equipment ? player.equipment[slot] : null;
            if (item && item.sockets && item.sockets > 0) {
                const el = document.createElement('div');
                el.className = 'inv-slot';
                el.style.position = 'relative';
                el.style.cursor = 'pointer';
                el.style.width = '48px';
                el.style.height = '48px';
                
                const iconPath = this.getItemIconPath(item);
                el.style.backgroundImage = `url('${iconPath}')`;
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';
                
                const color = item.rarity ? item.rarity.color : '#ffffff';
                el.style.border = `1px solid ${color}`;
                
                // Socket indicator
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
                        // Filled socket - show gem color
                        const gem = item.gems[i];
                        const gemType = GEM_TYPES[gem.type];
                        dot.style.backgroundColor = gemType ? gemType.color : '#ff00ff';
                        dot.style.boxShadow = `0 0 3px ${gemType ? gemType.color : '#ff00ff'}`;
                    } else {
                        // Empty socket
                        dot.style.backgroundColor = '#333';
                        dot.style.border = '1px solid #666';
                    }
                    socketDiv.appendChild(dot);
                }
                el.appendChild(socketDiv);
                
                // Highlight selected
                if (this.selectedGemEquipSlot === slot) {
                    el.style.boxShadow = '0 0 10px #ff00ff';
                    el.style.borderColor = '#ff00ff';
                }
                
                el.onclick = () => {
                    this.selectedGemEquipSlot = slot;
                    this.selectedGemSocketIndex = null; // Reset socket selection
                    this.updateForgeGemsUI(player);
                    this.updateForgeGemInfo(item, player);
                };
                
                el.title = `${item.name} (${usedSockets}/${item.sockets} gems)`;
                this.forgeGemEquipment.appendChild(el);
            }
        });
        
        // Show gems in inventory
        if (player.inventory) {
            player.inventory.forEach((item, index) => {
                if (item && item.type === 'Gem') {
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
                    
                    // Gem icon (diamond shape)
                    el.innerHTML = `<div style="color: ${gemColor}; font-size: 24px; text-shadow: 0 0 5px ${gemColor};">◆</div>`;
                    
                    // Highlight selected
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
        
        // Show message if no gems
        if (this.forgeGemInventory.children.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '10px';
            msg.style.textAlign = 'center';
            msg.style.gridColumn = '1 / -1';
            msg.textContent = 'No gems in inventory';
            this.forgeGemInventory.appendChild(msg);
        }
        
        // Show message if no socketed equipment
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
        
        // Get selected equipment item
        const equipItem = item || (this.selectedGemEquipSlot && player.equipment ? player.equipment[this.selectedGemEquipSlot] : null);
        
        // Get selected gem from inventory
        const gemItem = this.selectedGemInvIndex !== null && player.inventory ? player.inventory[this.selectedGemInvIndex] : null;
        
        if (!equipItem || !this.selectedGemEquipSlot) {
            this.forgeGemInfo.style.display = 'none';
            return;
        }
        
        this.forgeGemInfo.style.display = 'flex';
        
        // Update equipment name
        if (this.forgeGemEquipName) {
            this.forgeGemEquipName.textContent = equipItem.name;
            this.forgeGemEquipName.style.color = equipItem.rarity ? equipItem.rarity.color : '#fff';
        }
        
        // Update socket slots display
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
                    // Filled socket
                    const gem = equipItem.gems[i];
                    const gemType = GEM_TYPES[gem.type];
                    const gemColor = gemType ? gemType.color : '#ff00ff';
                    socketEl.style.backgroundColor = '#222';
                    socketEl.style.border = `2px solid ${gemColor}`;
                    socketEl.innerHTML = `<span style="color: ${gemColor};">◆</span>`;
                    socketEl.title = `${gem.quality || ''} ${gemType ? gemType.name : 'Gem'} (filled)`;
                } else {
                    // Empty socket
                    socketEl.style.backgroundColor = '#111';
                    socketEl.style.border = '2px dashed #444';
                    socketEl.title = 'Empty socket';
                    
                    // Highlight if this is the selected socket for insertion
                    if (this.selectedGemSocketIndex === i) {
                        socketEl.style.borderColor = '#ff00ff';
                        socketEl.style.boxShadow = '0 0 5px #ff00ff';
                    }
                    
                    // Click to select this socket
                    socketEl.onclick = () => {
                        this.selectedGemSocketIndex = i;
                        this.updateForgeGemInfo(equipItem, player);
                    };
                }
                
                this.forgeGemSocketSlots.appendChild(socketEl);
            }
        }
        
        // Update selected gem name
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
        
        // Update preview
        if (this.forgeGemPreview) {
            if (gemItem) {
                const gemStats = getGemStats(gemItem.gemType, gemItem.gemQuality);
                let preview = 'Stats: ';
                for (const stat in gemStats) {
                    preview += `+${gemStats[stat]} ${this.formatStatName(stat)} `;
                }
                this.forgeGemPreview.textContent = preview;
            } else {
                this.forgeGemPreview.textContent = '';
            }
        }
        
        // Enable/disable insert button
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
        
        // Reset selection
        this.selectedGemInvIndex = null;
        this.selectedGemSocketIndex = null;
        
        // Refresh UI
        if (this.lastPlayerRef) {
            this.updateForgeGemsUI(this.lastPlayerRef);
            this.updateForgeGemInfo(null, this.lastPlayerRef);
        }
    }
    
    switchGemSubTab(tab) {
        this.currentGemSubTab = tab;
        
        // Update tab buttons
        if (this.tabGemInsert) this.tabGemInsert.style.background = tab === 'insert' ? '#333' : '#111';
        if (this.tabGemCombine) this.tabGemCombine.style.background = tab === 'combine' ? '#333' : '#111';
        if (this.tabGemRemove) this.tabGemRemove.style.background = tab === 'remove' ? '#333' : '#111';
        
        // Update panels
        if (this.gemPanelInsert) this.gemPanelInsert.style.display = tab === 'insert' ? 'flex' : 'none';
        if (this.gemPanelCombine) this.gemPanelCombine.style.display = tab === 'combine' ? 'flex' : 'none';
        if (this.gemPanelRemove) this.gemPanelRemove.style.display = tab === 'remove' ? 'flex' : 'none';
        
        // Reset selections
        this.selectedCombineGemIndices = [];
        this.selectedRemoveEquipSlot = null;
        this.selectedRemoveSocketIndex = null;
        
        // Update UI for current tab
        if (this.lastPlayerRef) {
            if (tab === 'combine') {
                this.updateGemCombineUI(this.lastPlayerRef);
            } else if (tab === 'remove') {
                this.updateGemRemoveUI(this.lastPlayerRef);
            }
        }
    }
    
    updateGemCombineUI(player) {
        if (!this.forgeGemCombineInventory) return;
        
        this.forgeGemCombineInventory.innerHTML = '';
        
        // Group gems by type and quality
        const gemGroups = {};
        if (player.inventory) {
            player.inventory.forEach((item, index) => {
                if (item && item.type === 'Gem') {
                    const key = `${item.gemType}-${item.gemQuality}`;
                    if (!gemGroups[key]) {
                        gemGroups[key] = [];
                    }
                    gemGroups[key].push({ item, index });
                }
            });
        }
        
        // Show all gems, grouped
        if (player.inventory) {
            player.inventory.forEach((item, index) => {
                if (item && item.type === 'Gem') {
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
                    
                    // Gem icon
                    el.innerHTML = `<div style="color: ${gemColor}; font-size: 20px; text-shadow: 0 0 5px ${gemColor};">◆</div>`;
                    
                    // Check if selected
                    const isSelected = this.selectedCombineGemIndices.includes(index);
                    if (isSelected) {
                        el.style.boxShadow = '0 0 10px #ff00ff';
                        el.style.borderColor = '#ff00ff';
                        // Show selection number
                        const num = this.selectedCombineGemIndices.indexOf(index) + 1;
                        el.innerHTML += `<div style="position: absolute; top: 2px; right: 2px; color: #ff00ff; font-size: 10px; font-weight: bold;">${num}</div>`;
                    }
                    
                    // Check if gem can be combined (same type/quality as first selected)
                    let canSelect = true;
                    if (this.selectedCombineGemIndices.length > 0 && !isSelected) {
                        const firstGem = player.inventory[this.selectedCombineGemIndices[0]];
                        if (firstGem.gemType !== item.gemType || firstGem.gemQuality !== item.gemQuality) {
                            canSelect = false;
                            el.style.opacity = '0.4';
                        }
                    }
                    
                    // Check if already at max quality
                    if (item.gemQuality === 'Radiant') {
                        el.style.opacity = '0.4';
                        canSelect = false;
                    }
                    
                    el.onclick = () => {
                        if (!canSelect && !isSelected) return;
                        
                        if (isSelected) {
                            // Deselect
                            this.selectedCombineGemIndices = this.selectedCombineGemIndices.filter(i => i !== index);
                        } else if (this.selectedCombineGemIndices.length < 3) {
                            // Select
                            this.selectedCombineGemIndices.push(index);
                        }
                        
                        this.updateGemCombineUI(player);
                    };
                    
                    el.title = `${gemQuality ? gemQuality.name : ''} ${gemType ? gemType.name : 'Gem'}`;
                    this.forgeGemCombineInventory.appendChild(el);
                }
            });
        }
        
        // Show message if no gems
        if (this.forgeGemCombineInventory.children.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '10px';
            msg.style.textAlign = 'center';
            msg.style.gridColumn = '1 / -1';
            msg.textContent = 'No gems in inventory';
            this.forgeGemCombineInventory.appendChild(msg);
        }
        
        // Update combine slots display
        this.updateGemCombineSlots(player);
    }
    
    updateGemCombineSlots(player) {
        if (!this.forgeGemCombineSlots || !this.forgeGemCombineResult) return;
        
        // Update the 3 combine slots
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
        
        // Update result preview
        if (this.selectedCombineGemIndices.length === 3) {
            const firstGem = player.inventory[this.selectedCombineGemIndices[0]];
            const gemType = GEM_TYPES[firstGem.gemType];
            const gemColor = gemType ? gemType.color : '#ff00ff';
            
            // Get next quality
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
        
        // Enable/disable combine button
        if (this.btnForgeCombineGem) {
            this.btnForgeCombineGem.disabled = this.selectedCombineGemIndices.length !== 3;
        }
    }
    
    handleForgeCombineGem() {
        if (this.selectedCombineGemIndices.length !== 3) return;
        
        if (this.onForgeCombineGem) {
            this.onForgeCombineGem(this.selectedCombineGemIndices);
        }
        
        // Reset selection
        this.selectedCombineGemIndices = [];
        
        // Refresh UI
        if (this.lastPlayerRef) {
            this.updateGemCombineUI(this.lastPlayerRef);
        }
    }
    
    updateGemRemoveUI(player) {
        if (!this.forgeGemRemoveEquipment) return;
        
        this.forgeGemRemoveEquipment.innerHTML = '';
        
        const slots = ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'ring1', 'ring2', 'trinket1', 'trinket2', 'neck'];
        
        // Show equipment with socketed gems
        slots.forEach(slot => {
            const item = player.equipment ? player.equipment[slot] : null;
            if (item && item.gems && item.gems.length > 0) {
                const el = document.createElement('div');
                el.className = 'inv-slot';
                el.style.position = 'relative';
                el.style.cursor = 'pointer';
                el.style.width = '48px';
                el.style.height = '48px';
                
                const iconPath = this.getItemIconPath(item);
                el.style.backgroundImage = `url('${iconPath}')`;
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';
                
                const color = item.rarity ? item.rarity.color : '#ffffff';
                el.style.border = `1px solid ${color}`;
                
                // Socket indicator
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
                
                // Highlight selected
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
        
        // Show message if no equipment with gems
        if (this.forgeGemRemoveEquipment.children.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.padding = '10px';
            msg.style.textAlign = 'center';
            msg.style.gridColumn = '1 / -1';
            msg.textContent = 'No equipment with socketed gems';
            this.forgeGemRemoveEquipment.appendChild(msg);
        }
        
        // Update info panel
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
        
        // Update equipment name
        if (this.forgeGemRemoveEquipName) {
            this.forgeGemRemoveEquipName.textContent = item.name;
            this.forgeGemRemoveEquipName.style.color = item.rarity ? item.rarity.color : '#fff';
        }
        
        // Update gem slots display
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
                
                // Highlight if selected
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
        
        // Update preview
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
        
        // Enable/disable remove button
        if (this.btnForgeRemoveGem) {
            this.btnForgeRemoveGem.disabled = this.selectedRemoveSocketIndex === null;
        }
    }
    
    handleForgeRemoveGem() {
        if (!this.selectedRemoveEquipSlot || this.selectedRemoveSocketIndex === null) return;
        
        if (this.onForgeRemoveGem) {
            this.onForgeRemoveGem(this.selectedRemoveEquipSlot, this.selectedRemoveSocketIndex);
        }
        
        // Reset selection
        this.selectedRemoveSocketIndex = null;
        
        // Refresh UI
        if (this.lastPlayerRef) {
            this.updateGemRemoveUI(this.lastPlayerRef);
        }
    }

    toggleQuestWindow() {
        const isHidden = this.questWindow.style.display === 'none' || this.questWindow.style.display === '';
        this.questWindow.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && this.lastPlayerRef && this.lastPlayerRef.quests) {
            this.updateQuestWindow(this.lastPlayerRef.quests);
        }
    }

    toggleJournal() {
        const isHidden = this.questJournal.style.display === 'none' || this.questJournal.style.display === '';
        this.questJournal.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && this.lastPlayerRef && this.lastPlayerRef.quests) {
            this.updateJournal(this.lastPlayerRef.quests);
        }
    }

    toggleSkillTree() {
        const isHidden = this.skillTreeWindow.style.display === 'none' || this.skillTreeWindow.style.display === '';
        this.skillTreeWindow.style.display = isHidden ? 'flex' : 'none';
        
        if (isHidden && this.lastPlayerRef) {
            let classType = this.lastPlayerRef.subType || this.lastPlayerRef.meshType;
            // Fallback if subType is not set (e.g. local player before first server update)
            if (!classType && this.lastPlayerRef.constructor) {
                 // Check if it's an instance of a class
                 const name = this.lastPlayerRef.constructor.name;
                 if (['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(name)) {
                     classType = name;
                 }
            }
            
            this.renderSkillTree(classType);
        }
    }

    renderSkillTree(classType) {
        if (!classType) return;

        // Tabs at top
        this.skillTreeContent.innerHTML = '';
        this.skillTreeContent.appendChild(this.createSkillTreeTabs(classType));

        if (this.skillTreeMode === 'talents') {
            this.renderTalentTree(classType);
            return;
        }

        if (this.skillTreeMode === 'runes') {
            this.renderRunesTab(classType);
            return;
        }

        if (this.skillTreeMode === 'combos') {
            this.renderCombosTab(classType);
            return;
        }

        this.renderActiveSkillTree(classType);
    }

    createSkillTreeTabs(classType) {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.justifyContent = 'center';
        wrap.style.gap = '8px';
        wrap.style.margin = '4px 0 10px 0';

        const makeBtn = (label, mode) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.style.padding = '6px 10px';
            b.style.cursor = 'pointer';
            b.style.border = '1px solid #666';
            b.style.background = (this.skillTreeMode === mode) ? 'rgba(50,50,50,0.9)' : 'rgba(0,0,0,0.6)';
            b.style.color = (this.skillTreeMode === mode) ? '#ffd700' : '#eee';
            b.onclick = () => {
                this.skillTreeMode = mode;
                this.renderSkillTree(classType);
            };
            return b;
        };

        wrap.appendChild(makeBtn('Skills', 'skills'));
        wrap.appendChild(makeBtn('Talents', 'talents'));
        wrap.appendChild(makeBtn('Runes', 'runes'));
        wrap.appendChild(makeBtn('Combos', 'combos'));
        return wrap;
    }

    renderActiveSkillTree(classType) {
        const treeData = CONSTANTS.SKILL_TREES[classType];
        if (!treeData) {
            const empty = document.createElement('div');
            empty.style.textAlign = 'center';
            empty.style.color = '#aaa';
            empty.style.marginTop = '50px';
            empty.textContent = `No skill tree data for ${classType}`;
            this.skillTreeContent.appendChild(empty);
            return;
        }

        const player = this.lastPlayerRef;
        const selectedBranch = player ? (player.selectedBranch || "") : "";
        const unlockedSkills = player ? (player.unlockedSkills || []) : [];
        const playerLevel = player ? player.level : 1;

        const header = document.createElement('h2');
        header.style.textAlign = 'center';
        header.style.color = '#ffd700';
        header.style.margin = '5px 0';
        header.textContent = `${classType} Skill Tree`;
        this.skillTreeContent.appendChild(header);

        // Tier 1 (Starting Skill)
        if (treeData.Tier1) {
            const t1Container = document.createElement('div');
            t1Container.className = 'skill-tier-1-container';
            t1Container.innerHTML = `
                <div class="skill-tier-label">Tier 1 (Starting Skill)</div>
                <div class="skill-node unlocked" style="cursor: default; border-color: #00ff00;">
                    <div class="skill-node-title">${treeData.Tier1.name}</div>
                    <div class="skill-node-desc">${treeData.Tier1.desc}</div>
                </div>
            `;
            this.skillTreeContent.appendChild(t1Container);
        }

        const container = document.createElement('div');
        container.className = 'skill-branches-container';

        const branches = ['A', 'B', 'C'];
        branches.forEach(branchKey => {
            const branchData = treeData[`Branch${branchKey}`];
            if (!branchData) return;

            const isBranchSelected = selectedBranch === branchKey;
            const branchDiv = document.createElement('div');
            branchDiv.className = 'skill-branch';

            const title = document.createElement('div');
            title.className = 'skill-branch-title';
            title.textContent = branchData.name;

            if (isBranchSelected) {
                title.style.color = "#00ff00";
                title.textContent += " (Active)";
            } else {
                const selectBtn = document.createElement('button');
                selectBtn.textContent = "Select Spec";
                selectBtn.style.marginLeft = "10px";
                selectBtn.onclick = () => {
                    if (this.onSelectBranch) {
                        this.onSelectBranch(branchKey);
                    }
                };
                title.appendChild(selectBtn);
            }
            branchDiv.appendChild(title);

            // Add 4 tiers (Tier 2 to 5)
            for (let i = 2; i <= 5; i++) {
                const tierKey = `Tier${i}`;
                const skill = branchData[tierKey];
                const node = document.createElement('div');
                node.className = 'skill-node';

                const reqLevel = (i - 1) * 10;
                const isUnlocked = skill && unlockedSkills.includes(skill.name);
                const canUnlock = !isUnlocked && skill && playerLevel >= reqLevel && (player && (player.skillPoints || 0) > 0);

                if (isUnlocked) {
                    node.classList.add('unlocked');
                    node.style.borderColor = '#00ff00';
                } else if (!canUnlock) {
                    node.style.opacity = '0.7';
                    node.style.cursor = 'default';
                }

                if (canUnlock) {
                    node.onclick = () => {
                        if (this.onUnlockSkill) this.onUnlockSkill(skill.name);
                    };
                }

                const nodeTitle = document.createElement('div');
                nodeTitle.className = 'skill-node-title';
                nodeTitle.textContent = skill ? skill.name : `Tier ${i} ???`;

                const nodeDesc = document.createElement('div');
                nodeDesc.className = 'skill-node-desc';
                nodeDesc.textContent = skill ? skill.desc : 'Coming Soon...';

                const levelReqDiv = document.createElement('div');
                levelReqDiv.style.fontSize = '10px';
                levelReqDiv.style.marginTop = '4px';
                if (isUnlocked) {
                    levelReqDiv.style.color = '#00ff00';
                    levelReqDiv.textContent = 'Unlocked';
                } else {
                    levelReqDiv.style.color = '#aaa';
                    levelReqDiv.textContent = `Unlocks at Level ${reqLevel}`;
                }

                const pointsDiv = document.createElement('div');
                pointsDiv.style.fontSize = '10px';
                pointsDiv.style.marginTop = '2px';
                pointsDiv.style.color = canUnlock ? '#ffd700' : '#666';
                pointsDiv.textContent = canUnlock ? 'Tap to unlock (cost: 1 point)' : '';

                node.appendChild(nodeTitle);
                node.appendChild(nodeDesc);
                node.appendChild(levelReqDiv);
                if (pointsDiv.textContent) node.appendChild(pointsDiv);

                branchDiv.appendChild(node);
            }

            container.appendChild(branchDiv);
        });

        this.skillTreeContent.appendChild(container);
    }

    renderTalentTree(classType) {
        const talents = (CONSTANTS.PASSIVE_TALENTS && CONSTANTS.PASSIVE_TALENTS[classType]) ? CONSTANTS.PASSIVE_TALENTS[classType] : null;
        const player = this.lastPlayerRef;
        const ranks = player ? (player.talentRanks || {}) : {};
        const totalPoints = player ? Math.floor((player.level || 0) / 5) : 0;
        let spentPoints = 0;
        if (ranks) {
            for (const tid in ranks) {
                const v = ranks[tid] | 0;
                if (v > 0) spentPoints += v;
            }
        }
        const points = Math.max(0, totalPoints - spentPoints);

        // Filter talents to the player's current spec/branch.
        // We keep generic talents (not tied to a specific skill) visible for all specs.
        let visibleTalents = talents;
        try {
            const branch = player ? player.selectedBranch : null;
            const skillTree = (CONSTANTS.SKILL_TREES && CONSTANTS.SKILL_TREES[classType]) ? CONSTANTS.SKILL_TREES[classType] : null;
            const branchKey = (typeof branch === 'string' && ['A', 'B', 'C'].includes(branch)) ? `Branch${branch}` : null;
            if (branchKey && skillTree && talents) {
                const relevantSkills = new Set();
                if (skillTree.Tier1 && skillTree.Tier1.name) relevantSkills.add(skillTree.Tier1.name);
                const b = skillTree[branchKey];
                if (b) {
                    for (const k of ['Tier2', 'Tier3', 'Tier4', 'Tier5']) {
                        if (b[k] && b[k].name) relevantSkills.add(b[k].name);
                    }
                }

                const isSkillTalent = (t) => typeof t.name === 'string' && (t.name.endsWith(' - Mastery') || t.name.endsWith(' - Technique'));
                const skillNameForTalent = (t) => {
                    if (!t || typeof t.name !== 'string') return '';
                    const idx = t.name.lastIndexOf(' - ');
                    return idx >= 0 ? t.name.slice(0, idx) : '';
                };

                visibleTalents = talents.filter((t) => {
                    // Strict mode: when a spec is selected, only show talents that map to
                    // the active branch's skills (Mastery/Technique).
                    if (!isSkillTalent(t)) return false;
                    const skillName = skillNameForTalent(t);
                    return relevantSkills.has(skillName);
                });
            }
        } catch (e) {
            visibleTalents = talents;
        }

        const resetWrap = document.createElement('div');
        resetWrap.style.display = 'flex';
        resetWrap.style.justifyContent = 'center';
        resetWrap.style.margin = '6px 0 10px 0';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'ui-button';
        resetBtn.textContent = 'Reset Talents';
        resetBtn.onclick = () => {
            // Optimistic UI update; server remains authoritative.
            if (this.lastPlayerRef) {
                this.lastPlayerRef.talentRanks = {};
            }
            this.renderSkillTree(classType);
            if (this.onResetTalents) this.onResetTalents();
        };
        resetWrap.appendChild(resetBtn);

        const header = document.createElement('h2');
        header.style.textAlign = 'center';
        header.style.color = '#ffd700';
        header.style.margin = '5px 0';
        header.textContent = `${classType} Talents`;
        this.skillTreeContent.appendChild(header);

        const sub = document.createElement('div');
        sub.style.textAlign = 'center';
        sub.style.fontSize = '12px';
        sub.style.color = '#aaa';
        sub.style.marginBottom = '10px';
        sub.textContent = `Talent Points: ${points} available / ${totalPoints} total (Spent: ${spentPoints})`;
        this.skillTreeContent.appendChild(sub);

        this.skillTreeContent.appendChild(resetWrap);

        if (!visibleTalents) {
            const empty = document.createElement('div');
            empty.style.textAlign = 'center';
            empty.style.color = '#aaa';
            empty.style.marginTop = '50px';
            empty.textContent = `No talent data for ${classType}`;
            this.skillTreeContent.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '10px';

        for (const t of visibleTalents) {
            const maxRank = t.maxRank || 1;
            const currentRank = (ranks && typeof ranks[t.id] === 'number') ? ranks[t.id] : 0;
            const isUnlocked = currentRank > 0;
            const canRankUp = points > 0 && currentRank < maxRank;

            const node = document.createElement('div');
            node.className = 'skill-node';

            if (isUnlocked) {
                node.classList.add('unlocked');
                node.style.borderColor = '#00ff00';
            } else if (!canRankUp) {
                node.style.opacity = '0.75';
                node.style.cursor = 'default';
            }

            if (canRankUp) {
                node.onclick = () => {
                    // Optimistic UI update; server remains authoritative.
                    if (this.lastPlayerRef) {
                        if (!this.lastPlayerRef.talentRanks) this.lastPlayerRef.talentRanks = {};
                        const prev = this.lastPlayerRef.talentRanks[t.id] | 0;
                        this.lastPlayerRef.talentRanks[t.id] = prev + 1;
                    }
                    this.renderSkillTree(classType);
                    if (this.onUnlockTalent) this.onUnlockTalent(t.id);
                };
            }

            const title = document.createElement('div');
            title.className = 'skill-node-title';
            title.textContent = `${t.name}`;

            const desc = document.createElement('div');
            desc.className = 'skill-node-desc';
            desc.textContent = t.desc;

            const status = document.createElement('div');
            status.style.fontSize = '10px';
            status.style.marginTop = '4px';
            status.style.color = isUnlocked ? '#00ff00' : (canRankUp ? '#ffd700' : '#666');
            const statusSuffix = (currentRank >= maxRank)
                ? '(Max rank)'
                : (canRankUp ? '(Tap to rank up: 1 point)' : (isUnlocked ? '(No points)' : '(Locked)'));
            status.textContent = `Rank: ${Math.max(0, currentRank)}/${maxRank} ${statusSuffix}`;

            node.appendChild(title);
            node.appendChild(desc);
            node.appendChild(status);
            list.appendChild(node);
        }

        this.skillTreeContent.appendChild(list);
    }

    // ================================================================
    // SKILL RUNES TAB
    // ================================================================
    renderRunesTab(classType) {
        const player = this.lastPlayerRef;
        const playerLevel = player ? player.level : 1;
        const unlockedSkills = player ? (player.unlockedSkills || []) : [];
        const equippedRunes = player ? (player.skillRunes || {}) : {};

        // Get skill tree data to find all skills for this class
        const treeData = CONSTANTS.SKILL_TREES[classType];
        if (!treeData) {
            const empty = document.createElement('div');
            empty.style.textAlign = 'center';
            empty.style.color = '#aaa';
            empty.style.marginTop = '50px';
            empty.textContent = `No skill data for ${classType}`;
            this.skillTreeContent.appendChild(empty);
            return;
        }

        const header = document.createElement('h2');
        header.style.textAlign = 'center';
        header.style.color = '#ffd700';
        header.style.margin = '5px 0';
        header.textContent = `${classType} Skill Runes`;
        this.skillTreeContent.appendChild(header);

        const sub = document.createElement('div');
        sub.style.textAlign = 'center';
        sub.style.fontSize = '12px';
        sub.style.color = '#aaa';
        sub.style.marginBottom = '10px';
        sub.textContent = `Runes unlock at levels 50, 70, and 90. Each skill can have one rune equipped.`;
        this.skillTreeContent.appendChild(sub);

        // Gather all skills from the tree
        const allSkills = [];
        if (treeData.Tier1) allSkills.push(treeData.Tier1.name);
        for (const branchKey of ['BranchA', 'BranchB', 'BranchC']) {
            const branch = treeData[branchKey];
            if (branch) {
                for (let i = 2; i <= 5; i++) {
                    const tier = branch[`Tier${i}`];
                    if (tier && tier.name && !allSkills.includes(tier.name)) {
                        allSkills.push(tier.name);
                    }
                }
            }
        }

        // Get rune definitions from Constants (we'll define them there)
        const runeData = CONSTANTS.SKILL_RUNES ? CONSTANTS.SKILL_RUNES[classType] : null;

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '12px';

        for (const skillName of allSkills) {
            // Only show skills that have runes defined
            const skillRunes = runeData ? runeData.filter(r => r.skill === skillName) : [];
            if (skillRunes.length === 0) continue;

            const isUnlocked = unlockedSkills.includes(skillName) || skillName === treeData.Tier1?.name;
            const equippedRuneId = equippedRunes[skillName] || '';

            const skillCard = document.createElement('div');
            skillCard.style.background = 'rgba(30, 30, 30, 0.9)';
            skillCard.style.border = '1px solid #444';
            skillCard.style.borderRadius = '6px';
            skillCard.style.padding = '10px';
            skillCard.style.opacity = isUnlocked ? '1' : '0.5';

            const skillTitle = document.createElement('div');
            skillTitle.style.fontSize = '14px';
            skillTitle.style.fontWeight = 'bold';
            skillTitle.style.color = isUnlocked ? '#ffd700' : '#888';
            skillTitle.style.marginBottom = '8px';
            skillTitle.textContent = skillName + (isUnlocked ? '' : ' (Skill Locked)');
            skillCard.appendChild(skillTitle);

            const runesContainer = document.createElement('div');
            runesContainer.style.display = 'flex';
            runesContainer.style.gap = '8px';
            runesContainer.style.flexWrap = 'wrap';

            for (const rune of skillRunes) {
                const canEquip = isUnlocked && playerLevel >= rune.unlockLevel;
                const isEquipped = equippedRuneId === rune.id;

                const runeBtn = document.createElement('div');
                runeBtn.style.flex = '1';
                runeBtn.style.minWidth = '120px';
                runeBtn.style.padding = '8px';
                runeBtn.style.background = isEquipped ? 'rgba(0, 128, 0, 0.4)' : 'rgba(50, 50, 50, 0.8)';
                runeBtn.style.border = isEquipped ? '2px solid #00ff00' : '1px solid #666';
                runeBtn.style.borderRadius = '4px';
                runeBtn.style.cursor = canEquip ? 'pointer' : 'default';
                runeBtn.style.opacity = canEquip ? '1' : '0.6';

                const runeName = document.createElement('div');
                runeName.style.fontSize = '12px';
                runeName.style.fontWeight = 'bold';
                runeName.style.color = isEquipped ? '#00ff00' : (canEquip ? '#fff' : '#888');
                runeName.textContent = rune.name;

                const runeLevel = document.createElement('div');
                runeLevel.style.fontSize = '10px';
                runeLevel.style.color = playerLevel >= rune.unlockLevel ? '#888' : '#ff6666';
                runeLevel.textContent = `Level ${rune.unlockLevel}`;

                const runeDesc = document.createElement('div');
                runeDesc.style.fontSize = '10px';
                runeDesc.style.color = '#aaa';
                runeDesc.style.marginTop = '4px';
                runeDesc.textContent = rune.description;

                runeBtn.appendChild(runeName);
                runeBtn.appendChild(runeLevel);
                runeBtn.appendChild(runeDesc);

                if (canEquip) {
                    runeBtn.addEventListener('click', () => {
                        // Toggle: if already equipped, unequip; otherwise equip
                        const newRuneId = isEquipped ? '' : rune.id;
                        if (this.onSelectRune) {
                            this.onSelectRune(skillName, newRuneId);
                        }
                        // Optimistic UI update
                        if (player) {
                            if (!player.skillRunes) player.skillRunes = {};
                            if (newRuneId) {
                                player.skillRunes[skillName] = newRuneId;
                            } else {
                                delete player.skillRunes[skillName];
                            }
                        }
                        this.renderSkillTree(classType);
                    });
                    runeBtn.addEventListener('mouseenter', () => {
                        runeBtn.style.background = isEquipped ? 'rgba(0, 150, 0, 0.5)' : 'rgba(70, 70, 70, 0.9)';
                    });
                    runeBtn.addEventListener('mouseleave', () => {
                        runeBtn.style.background = isEquipped ? 'rgba(0, 128, 0, 0.4)' : 'rgba(50, 50, 50, 0.8)';
                    });
                }

                runesContainer.appendChild(runeBtn);
            }

            skillCard.appendChild(runesContainer);
            list.appendChild(skillCard);
        }

        if (list.children.length === 0) {
            const empty = document.createElement('div');
            empty.style.textAlign = 'center';
            empty.style.color = '#aaa';
            empty.style.marginTop = '20px';
            empty.textContent = 'No runes available for this class yet.';
            this.skillTreeContent.appendChild(empty);
            return;
        }

        this.skillTreeContent.appendChild(list);
    }

    renderCombosTab(classType) {
        const combos = CONSTANTS.SKILL_COMBOS[classType];
        
        const header = document.createElement('h2');
        header.style.textAlign = 'center';
        header.style.color = '#ffd700';
        header.style.margin = '5px 0 15px 0';
        header.textContent = `${classType} Combos`;
        this.skillTreeContent.appendChild(header);

        const instructions = document.createElement('div');
        instructions.style.textAlign = 'center';
        instructions.style.color = '#aaa';
        instructions.style.marginBottom = '15px';
        instructions.style.fontSize = '12px';
        instructions.innerHTML = 'Use skills in sequence within <span style="color: #ffd700;">3 seconds</span> to trigger combo effects.';
        this.skillTreeContent.appendChild(instructions);

        if (!combos || combos.length === 0) {
            const empty = document.createElement('div');
            empty.style.textAlign = 'center';
            empty.style.color = '#aaa';
            empty.style.marginTop = '20px';
            empty.textContent = 'No combos available for this class yet.';
            this.skillTreeContent.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '12px';
        list.style.padding = '0 10px';

        for (const combo of combos) {
            const comboCard = document.createElement('div');
            comboCard.style.background = 'rgba(30, 30, 30, 0.9)';
            comboCard.style.border = '2px solid #555';
            comboCard.style.borderRadius = '8px';
            comboCard.style.padding = '12px';
            comboCard.style.transition = 'border-color 0.2s';

            comboCard.addEventListener('mouseenter', () => {
                comboCard.style.borderColor = '#ffd700';
            });
            comboCard.addEventListener('mouseleave', () => {
                comboCard.style.borderColor = '#555';
            });

            // Combo name
            const nameDiv = document.createElement('div');
            nameDiv.style.color = '#ffd700';
            nameDiv.style.fontWeight = 'bold';
            nameDiv.style.fontSize = '14px';
            nameDiv.style.marginBottom = '8px';
            nameDiv.textContent = combo.name;
            comboCard.appendChild(nameDiv);

            // Skill sequence
            const sequenceDiv = document.createElement('div');
            sequenceDiv.style.display = 'flex';
            sequenceDiv.style.alignItems = 'center';
            sequenceDiv.style.gap = '8px';
            sequenceDiv.style.marginBottom = '8px';

            const firstSkill = document.createElement('span');
            firstSkill.style.background = 'rgba(60, 60, 60, 0.8)';
            firstSkill.style.padding = '4px 8px';
            firstSkill.style.borderRadius = '4px';
            firstSkill.style.color = '#88ccff';
            firstSkill.style.fontSize = '12px';
            firstSkill.textContent = combo.firstSkill;

            const arrow = document.createElement('span');
            arrow.style.color = '#ffd700';
            arrow.style.fontSize = '16px';
            arrow.textContent = '→';

            const secondSkill = document.createElement('span');
            secondSkill.style.background = 'rgba(60, 60, 60, 0.8)';
            secondSkill.style.padding = '4px 8px';
            secondSkill.style.borderRadius = '4px';
            secondSkill.style.color = '#ffcc88';
            secondSkill.style.fontSize = '12px';
            secondSkill.textContent = combo.secondSkill;

            sequenceDiv.appendChild(firstSkill);
            sequenceDiv.appendChild(arrow);
            sequenceDiv.appendChild(secondSkill);
            comboCard.appendChild(sequenceDiv);

            // Effect description
            const descDiv = document.createElement('div');
            descDiv.style.color = '#00ff00';
            descDiv.style.fontSize = '12px';
            descDiv.style.fontStyle = 'italic';
            descDiv.textContent = combo.description;
            comboCard.appendChild(descDiv);

            list.appendChild(comboCard);
        }

        this.skillTreeContent.appendChild(list);
    }

    showComboNotification(comboName, comboId) {
        // Create a centered screen notification for combo triggers
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '30%';
        notification.style.left = '50%';
        notification.style.transform = 'translate(-50%, -50%)';
        notification.style.background = 'linear-gradient(135deg, rgba(40, 40, 40, 0.95), rgba(20, 20, 20, 0.95))';
        notification.style.border = '3px solid #ffd700';
        notification.style.borderRadius = '12px';
        notification.style.padding = '20px 40px';
        notification.style.zIndex = '10000';
        notification.style.textAlign = 'center';
        notification.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.5)';
        notification.style.animation = 'comboNotificationPulse 0.5s ease-out';

        // Add combo label
        const label = document.createElement('div');
        label.style.color = '#ffd700';
        label.style.fontSize = '12px';
        label.style.textTransform = 'uppercase';
        label.style.letterSpacing = '3px';
        label.style.marginBottom = '8px';
        label.textContent = 'COMBO!';

        // Add combo name
        const name = document.createElement('div');
        name.style.color = '#ffffff';
        name.style.fontSize = '24px';
        name.style.fontWeight = 'bold';
        name.style.textShadow = '0 0 10px #ffd700';
        name.textContent = comboName;

        notification.appendChild(label);
        notification.appendChild(name);
        document.body.appendChild(notification);

        // Add animation keyframes if not already added
        if (!document.getElementById('combo-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'combo-notification-styles';
            style.textContent = `
                @keyframes comboNotificationPulse {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    50% { transform: translate(-50%, -50%) scale(1.1); }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
                @keyframes comboNotificationFadeOut {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        // Remove after 1.5 seconds with fade animation
        setTimeout(() => {
            notification.style.animation = 'comboNotificationFadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 1500);
    }

    updateHotbar(player) {
        if (!player) return;

        // Slot 0 (Key 1) is always Tier 1 skill (Base Ability)
        // User requested NOT to put Tier 1 on hotbar as it is already Right Click.
        // So we skip Tier 1 assignment to Slot 0.
        // Instead, we will fill slots 1-4 with unlocked skills (Tier 2+).
        
        // Clear slots first to avoid duplicates or stale icons
        this.hotbarSlots.forEach((_, index) => {
            this.assignSkillToSlot(index, null);
        });

        // Filter out the base ability (Right Click) from the hotbar
        const baseAbility = player.abilityName;
        const unlocked = player.unlockedSkills ? player.unlockedSkills.filter(s => s !== baseAbility) : [];

        // Spec-based 4-slot hotbar: Tier 2-5 of selected branch.
        // If spec isn't selected (or tree data missing), fallback to unlocked order.
        const classType = player.subType || player.meshType;
        const treeData = classType ? CONSTANTS.SKILL_TREES[classType] : null;
        const branchKey = player.selectedBranch;

        let ordered = [];
        if (treeData && branchKey && treeData[branchKey]) {
            for (let i = 2; i <= 5; i++) {
                const tier = treeData[branchKey][`Tier${i}`];
                if (tier && tier.name) ordered.push(tier.name);
            }

            const unlockedSet = new Set(unlocked);
            ordered = ordered.filter(n => unlockedSet.has(n));
        }

        if (ordered.length === 0) ordered = unlocked;

        for (let i = 0; i < 4; i++) {
            const skillName = ordered[i];
            if (skillName) this.assignSkillToSlot(i, skillName);
        }
    }

    toggleAbilitiesMenu() {
        // Deprecated / Removed
        console.log("Abilities menu is deprecated.");
    }

    renderAbilitiesMenu(classType) {
        // Deprecated / Removed
    }

    setupDragAndDrop() {
        this.hotbarSlots.forEach((slot, index) => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow drop
                e.dataTransfer.dropEffect = 'copy';
                slot.style.borderColor = '#fff';
            });

            slot.addEventListener('dragleave', (e) => {
                slot.style.borderColor = '#444';
            });

            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.style.borderColor = '#444';
                const skillName = e.dataTransfer.getData('text/plain');
                
                if (skillName) {
                    this.assignSkillToSlot(index, skillName);
                }
            });
            
            // Disable context menu (Right Click)
            slot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Do nothing
            });

            // Desktop: hotbar is keyboard-triggered. Mobile: hotbar is tap-to-cast.
            slot.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.isMobile) {
                    const icon = slot.querySelector('.hotbar-icon');
                    const skillName = icon && icon.dataset ? icon.dataset.skill : null;
                    if (skillName && this.onHotbarCast) this.onHotbarCast(index);
                }
            });

            slot.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.isMobile) {
                    const icon = slot.querySelector('.hotbar-icon');
                    const skillName = icon && icon.dataset ? icon.dataset.skill : null;
                    if (skillName && this.onHotbarCast) this.onHotbarCast(index);
                }
            }, { passive: false });

            // Tooltip
            slot.addEventListener('mouseenter', (e) => {
                const icon = slot.querySelector('.hotbar-icon');
                if (icon && icon.dataset.skill) {
                    const rect = slot.getBoundingClientRect();
                    this.showSkillTooltip(icon.dataset.skill, rect.left, rect.top - 10);
                }
            });

            slot.addEventListener('mouseleave', () => {
                this.hideTooltips();
            });
        });
    }

    showSkillTooltip(skillName, x, y) {
        if (!this.lastPlayerRef) return;
        
        const classType = this.lastPlayerRef.subType || this.lastPlayerRef.meshType;
        if (!classType) return;

        const treeData = CONSTANTS.SKILL_TREES[classType];
        if (!treeData) return;

        // Find skill description
        let desc = "No description available.";
        
        // Check Tier 1
        if (treeData.Tier1 && treeData.Tier1.name === skillName) {
            desc = treeData.Tier1.desc;
        } else {
            // Check Branches
            ['BranchA', 'BranchB', 'BranchC'].forEach(branch => {
                if (treeData[branch]) {
                    for (let i = 2; i <= 5; i++) {
                        const tier = treeData[branch][`Tier${i}`];
                        if (tier && tier.name === skillName) {
                            desc = tier.desc;
                        }
                    }
                }
            });
        }

        const classAbilityConfig = CONSTANTS.ABILITY_CONFIG ? CONSTANTS.ABILITY_CONFIG[classType] : null;
        const defaultAbilityConfig = classAbilityConfig ? classAbilityConfig.default : null;
        const skillAbilityConfig = (classAbilityConfig && classAbilityConfig.skills) ? classAbilityConfig.skills[skillName] : null;

        const mana = (skillAbilityConfig && typeof skillAbilityConfig.mana === 'number')
            ? skillAbilityConfig.mana
            : (defaultAbilityConfig && typeof defaultAbilityConfig.mana === 'number')
                ? defaultAbilityConfig.mana
                : null;
        const cooldown = (skillAbilityConfig && typeof skillAbilityConfig.cooldown === 'number')
            ? skillAbilityConfig.cooldown
            : (defaultAbilityConfig && typeof defaultAbilityConfig.cooldown === 'number')
                ? defaultAbilityConfig.cooldown
                : null;
        const range = (skillAbilityConfig && typeof skillAbilityConfig.range === 'number')
            ? skillAbilityConfig.range
            : (defaultAbilityConfig && typeof defaultAbilityConfig.range === 'number')
                ? defaultAbilityConfig.range
                : null;

        const details = [];
        if (typeof mana === 'number') details.push(`Mana: ${mana}`);
        if (typeof cooldown === 'number') details.push(`CD: ${cooldown.toFixed(1)}s`);
        if (typeof range === 'number') details.push(`Range: ${range.toFixed(1)}`);
        const detailHtml = details.length > 0
            ? `<div style="color: #9aa0a6; margin-top: 6px; font-size: 12px;">${details.join(' | ')}</div>`
            : '';

        this.statTooltipTitle.textContent = skillName;
        this.statTooltipTitle.style.color = '#ffd700';
        this.statTooltipDesc.innerHTML = `<div style="color: #ccc;">${desc}</div>${detailHtml}`;
        
        this.statTooltip.style.display = 'block';
        this.statTooltip.style.left = `${x}px`;
        this.statTooltip.style.top = `${y - this.statTooltip.offsetHeight}px`; // Show above
        
        // Adjust if off screen
        const rect = this.statTooltip.getBoundingClientRect();
        if (rect.top < 0) {
            this.statTooltip.style.top = `${y + 50}px`; // Show below if no space above
        }
    }

    assignSkillToSlot(slotIndex, skillName) {
        const slot = this.hotbarSlots[slotIndex];
        const icon = slot.querySelector('.hotbar-icon');
        
        // Create or get cooldown overlay
        let cooldownOverlay = slot.querySelector('.cooldown-overlay');
        if (!cooldownOverlay) {
            cooldownOverlay = document.createElement('div');
            cooldownOverlay.className = 'cooldown-overlay';
            cooldownOverlay.style.position = 'absolute';
            cooldownOverlay.style.top = '0';
            cooldownOverlay.style.left = '0';
            cooldownOverlay.style.width = '100%';
            cooldownOverlay.style.height = '100%';
            cooldownOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            cooldownOverlay.style.display = 'none';
            cooldownOverlay.style.justifyContent = 'center';
            cooldownOverlay.style.alignItems = 'center';
            cooldownOverlay.style.color = 'white';
            cooldownOverlay.style.fontSize = '14px';
            cooldownOverlay.style.fontWeight = 'bold';
            cooldownOverlay.style.pointerEvents = 'none'; // Click through
            slot.appendChild(cooldownOverlay);
        }

        if (skillName) {
            let iconPath = null;
            if (this.lastPlayerRef) {
                 const classType = this.lastPlayerRef.subType || this.lastPlayerRef.meshType;
                 iconPath = this.getSkillIconPath(skillName, classType);
            }

            if (iconPath) {
                icon.style.backgroundImage = `url('${iconPath}')`;
                icon.style.backgroundSize = 'cover';
                icon.textContent = '';
            } else {
                icon.style.backgroundImage = 'none';
                icon.textContent = skillName.substring(0, 2); // Placeholder icon
            }

            icon.style.display = 'flex';
            icon.style.alignItems = 'center';
            icon.style.justifyContent = 'center';
            icon.style.color = '#ffd700';
            icon.style.fontWeight = 'bold';
            // icon.title = skillName; // Removed to prevent native tooltip
            icon.dataset.skill = skillName; // Use data attribute
        } else {
            icon.style.backgroundImage = 'none';
            icon.textContent = '';
            // icon.title = '';
            delete icon.dataset.skill;
            cooldownOverlay.style.display = 'none';
        }

        // Notify GameEngine
        if (this.onHotbarAssign) {
            this.onHotbarAssign(slotIndex, skillName);
        }
    }

    updateHotbarCooldowns(player) {
        if (!player || !player.hotbar) return;

        this.hotbarSlots.forEach((slot, index) => {
            const skillName = player.hotbar[index];
            const overlay = slot.querySelector('.cooldown-overlay');
            
            if (skillName && overlay) {
                // Check cooldown for this specific skill
                let cd = 0;
                if (player.cooldowns && player.cooldowns[skillName] > 0) {
                    cd = player.cooldowns[skillName];
                } else if (skillName === player.abilityName && player.abilityCooldown > 0) {
                    // Fallback for base ability if not in map
                    cd = player.abilityCooldown;
                }

                if (cd > 0) {
                    overlay.style.display = 'flex';
                    overlay.textContent = Math.ceil(cd);
                } else {
                    overlay.style.display = 'none';
                }
            } else if (overlay) {
                overlay.style.display = 'none';
            }
        });
    }

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

    updateQuestWindow(quests) {
        this.questList.innerHTML = '';
        if (!quests) return;

        quests.forEach(q => {
            // Show if:
            // 1. Not accepted (Available)
            // 2. Accepted AND Completed (Ready to Turn In)
            // Hide if Accepted and Not Completed (In Progress - check Journal)
            
            if (q.accepted && !q.completed && q.count < q.maxCount) return; 
            if (q.completed && q.accepted) {
                 // Ready to turn in
            } else if (q.accepted && q.completed) {
                // Already turned in? Wait, my logic in server sets Completed=true.
                // I need a way to know if reward is claimed?
                // Server logic: PerformCompleteQuest sets Completed=true and gives XP.
                // So if Completed=true, it's done.
                // I should probably filter out completed quests from the "Available" list unless I want to show history.
                // Let's hide completed quests.
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
                // Ready to turn in (Client side check, server sets completed on turn in)
                // Wait, server sets Completed=true ONLY when PerformCompleteQuest is called.
                // So here q.completed is false, but count >= maxCount.
                statusText = `<div style="color: #4CAF50; font-weight: bold;">COMPLETE: Kill ${q.maxCount} ${targetLabel}</div>`;
                btnHtml = `<button class="menu-btn" style="margin-top: 5px; background: #FFD700; color: #000; border-color: #FFA000;">Claim Reward</button>`;
            } else {
                return; // Should be covered by top check
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

    updateJournal(quests) {
        this.journalList.innerHTML = '';

        // Add Reset Time Info
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
            if (!q.accepted) return; // Only show accepted

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
                // Auto-complete or button? Let's add a button to claim if we want, or just show completed.
                // Requirement was "quest journal... lists the quest and your progress".
                // Usually you turn in at NPC.
                // Let's assume turn in at NPC for now, but maybe add a "Claim" button here for convenience?
                // User said "Quest Window... offer daily quest".
                // Let's stick to NPC interaction for turn-in.
                // But wait, if I close the quest window, how do I turn it in?
                // I should add "Turn In" button to the Quest Window (NPC) if completed.
            }

            this.journalList.appendChild(div);
        });

        if (!hasActive) {
            this.journalList.innerHTML = '<div style="color: #888; text-align: center; margin-top: 20px;">No active quests.</div>';
        }
    }

    toggleEscMenu() {
        const isHidden = this.escMenu.style.display === 'none' || this.escMenu.style.display === '';
        this.escMenu.style.display = isHidden ? 'block' : 'none';
        
        // If closing menu, also close help/patch notes if open
        if (!isHidden) {
            this.helpScreen.style.display = 'none';
            if (this.settingsScreen) this.settingsScreen.style.display = 'none';
            this.patchNotesScreen.style.display = 'none';
            this.reportScreen.style.display = 'none';
        }
    }

    toggleHelp() {
        const isHidden = this.helpScreen.style.display === 'none' || this.helpScreen.style.display === '';
        this.helpScreen.style.display = isHidden ? 'block' : 'none';
        if (!isHidden) {
            if (this.settingsScreen) this.settingsScreen.style.display = 'none';
            this.patchNotesScreen.style.display = 'none'; // Close other windows
            this.reportScreen.style.display = 'none';
        }
    }

    toggleSettings() {
        if (!this.settingsScreen) return;
        const isHidden = this.settingsScreen.style.display === 'none' || this.settingsScreen.style.display === '';
        this.settingsScreen.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            this.helpScreen.style.display = 'none';
            this.patchNotesScreen.style.display = 'none';
            this.reportScreen.style.display = 'none';
        }
    }

    togglePatchNotes() {
        console.log("Toggling Patch Notes");
        const isHidden = this.patchNotesScreen.style.display === 'none' || this.patchNotesScreen.style.display === '';
        this.patchNotesScreen.style.display = isHidden ? 'flex' : 'none'; // Flex for layout
        if (isHidden) {
            this.helpScreen.style.display = 'none'; // Close other windows
            if (this.settingsScreen) this.settingsScreen.style.display = 'none';
            this.reportScreen.style.display = 'none';
        }
    }

    toggleReport() {
        const isHidden = this.reportScreen.style.display === 'none' || this.reportScreen.style.display === '';
        this.reportScreen.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            this.helpScreen.style.display = 'none';
            if (this.settingsScreen) this.settingsScreen.style.display = 'none';
            this.patchNotesScreen.style.display = 'none';
        }
    }

    setGraphicsQuality(quality) {
        const valid = quality === 'low' || quality === 'medium' || quality === 'high';
        const nextQuality = valid ? quality : 'high';
        this.graphicsQuality = nextQuality;
        localStorage.setItem('eidolon.graphicsQuality', nextQuality);
        if (this.graphicsQualitySelect && this.graphicsQualitySelect.value !== nextQuality) {
            this.graphicsQualitySelect.value = nextQuality;
        }
        if (this.onGraphicsQualityChange) {
            const applyResult = this.onGraphicsQualityChange(nextQuality);
            if (applyResult && applyResult.reloadRequired) {
                const shouldReload = window.confirm('Some graphics features need a reload to fully apply. Reload now?');
                if (shouldReload) {
                    window.location.reload();
                }
            }
        }
    }

    getGraphicsQuality() {
        return this.graphicsQuality || 'high';
    }

    updateBrightnessLabel() {
        if (this.graphicsBrightnessValue) {
            this.graphicsBrightnessValue.textContent = `${Math.round(this.graphicsBrightness)}%`;
        }
    }

    setBrightnessLevel(level) {
        const numericLevel = Number.isFinite(level) ? level : 100;
        const clamped = Math.max(0, Math.min(100, numericLevel));
        this.graphicsBrightness = clamped;
        localStorage.setItem('eidolon.graphicsBrightness', String(clamped));
        if (this.graphicsBrightnessSlider && Number(this.graphicsBrightnessSlider.value) !== clamped) {
            this.graphicsBrightnessSlider.value = String(clamped);
        }
        this.updateBrightnessLabel();
        if (this.onBrightnessChange) {
            this.onBrightnessChange(clamped);
        }
    }

    getBrightnessLevel() {
        return this.graphicsBrightness;
    }

    toggleShop() {
        const isHidden = this.shopScreen.style.display === 'none' || this.shopScreen.style.display === '';
        this.shopScreen.style.display = isHidden ? 'flex' : 'none';
        
        // Open inventory when shop opens
        if (isHidden) {
            this.inventoryScreen.style.display = 'block';
            if (this.lastPlayerRef) {
                this.updateInventory(this.lastPlayerRef);

                // Update Gamble Cost Title
                if (this.shopGambleTitle) {
                    const cost = Math.ceil(34.68 * this.lastPlayerRef.level);
                    this.shopGambleTitle.textContent = `MYSTERY BOXES (${cost}g)`;
                }
            }
        }
    }

    switchShopTab(tab) {
        if (tab === 'main') {
            this.shopContentMain.style.display = 'flex';
            this.shopContentBuyback.style.display = 'none';
            this.tabShopMain.style.background = '#333';
            this.tabShopBuyback.style.background = '#111';
        } else {
            this.shopContentMain.style.display = 'none';
            this.shopContentBuyback.style.display = 'flex';
            this.tabShopMain.style.background = '#111';
            this.tabShopBuyback.style.background = '#333';
        }
    }

    updateBuybackList(items) {
        if (!this.buybackGrid) return;
        this.buybackGrid.innerHTML = '';
        if (!items) return;

        // Reverse order to show newest first
        const reversedItems = [...items].reverse();

        reversedItems.forEach(item => {
            if (!item || !item.id) return;
            const el = document.createElement('div');
            el.className = 'inv-slot';
            const iconPath = this.getItemIconPath(item);
            el.style.backgroundImage = `url('${iconPath}')`;
            el.style.backgroundSize = 'contain';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.backgroundPosition = 'center';
            const color = item.rarity ? item.rarity.color : '#ffffff';
            el.style.border = `1px solid ${color}`;
            el.style.position = 'relative';
            el.style.cursor = 'pointer';
            
            // Tooltip
            el.title = `${item.name}\nBuyback Price: ${item.value * (item.stack || 1)}g`;

            if (item.stack > 1) {
                const stackCount = document.createElement('div');
                stackCount.className = 'item-stack';
                stackCount.innerText = item.stack;
                stackCount.style.position = 'absolute';
                stackCount.style.bottom = '2px';
                stackCount.style.right = '2px';
                stackCount.style.fontSize = '10px';
                stackCount.style.color = 'white';
                stackCount.style.textShadow = '1px 1px 0 #000';
                stackCount.style.fontWeight = 'bold';
                el.appendChild(stackCount);
            }

            el.onclick = () => {
                if (this.onBuyback) {
                    this.onBuyback(item.id);
                }
            };

            this.buybackGrid.appendChild(el);
        });
    }

    handleEscape() {
        let closedSomething = false;

        // 1. Close Gameplay Windows
        if (this.characterSheet.style.display === 'block') {
            this.characterSheet.style.display = 'none';
            closedSomething = true;
        }
        if (this.inventoryScreen.style.display === 'block') {
            this.inventoryScreen.style.display = 'none';
            closedSomething = true;
        }
        
        // Check World Map (accessed via DOM directly as UIManager doesn't own the class instance)
        const worldMap = document.getElementById('world-map');
        if (worldMap && (worldMap.style.display === 'flex' || worldMap.style.display === 'block')) {
            worldMap.style.display = 'none';
            closedSomething = true;
        }

        // Close Shop
        if (this.shopScreen.style.display === 'flex') {
            this.shopScreen.style.display = 'none';
            closedSomething = true;
        }

        // Close Stash
        if (this.stashScreen.style.display === 'flex') {
            this.stashScreen.style.display = 'none';
            closedSomething = true;
        }

        // Close Trading House
        if (this.tradingHouseScreen && this.tradingHouseScreen.style.display === 'flex') {
            this.tradingHouseScreen.style.display = 'none';
            closedSomething = true;
        }

        // Close Forge
        if (this.forgeScreen.style.display === 'flex') {
            this.forgeScreen.style.display = 'none';
            closedSomething = true;
        }

        // Close Trading House
        if (this.tradingHouseScreen.style.display === 'flex') {
            this.tradingHouseScreen.style.display = 'none';
            closedSomething = true;
        }

        // Close Quest Window (NPC)
        if (this.questWindow.style.display === 'flex') {
            this.questWindow.style.display = 'none';
            closedSomething = true;
        }

        // Close Quest Journal
        if (this.questJournal.style.display === 'flex') {
            this.questJournal.style.display = 'none';
            closedSomething = true;
        }

        // Close Skill Tree
        if (this.skillTreeWindow.style.display === 'flex') {
            this.skillTreeWindow.style.display = 'none';
            closedSomething = true;
        }

        // Close Abilities Menu
        if (this.abilitiesMenu.style.display === 'flex') {
            this.abilitiesMenu.style.display = 'none';
            closedSomething = true;
        }

        // Close Social
        if (this.socialWindow.style.display === 'block') {
            this.socialWindow.style.display = 'none';
            closedSomething = true;
        }

        // 2. Close Help/Patch Screens
        if (this.patchNotesScreen.style.display === 'flex') {
            this.patchNotesScreen.style.display = 'none';
            closedSomething = true;
        }
        if (this.settingsScreen && this.settingsScreen.style.display === 'block') {
            this.settingsScreen.style.display = 'none';
            closedSomething = true;
        }
        if (this.reportScreen.style.display === 'block') {
            this.reportScreen.style.display = 'none';
            closedSomething = true;
        }
        if (this.helpScreen.style.display === 'flex') {
            this.helpScreen.style.display = 'none';
            closedSomething = true;
        }

        // 3. If nothing was closed, Toggle ESC Menu
        // (If ESC menu is already open, this will close it. If closed, it will open it.)
        if (!closedSomething) {
            this.toggleEscMenu();
        }
    }

    updateXP(player) {
        if (!player) return;
        const pct = (player.xp / player.xpToNextLevel) * 100;
        this.xpBar.style.width = `${Math.max(0, pct)}%`;
        this.xpText.textContent = `LVL ${player.level}`;
    }

    updateCharacterSheet(player) {
        if (!player) return;
        
        this.lastPlayerRef = player; // Store reference for tooltips

        // Only update DOM if visible to save performance
        if (this.characterSheet.style.display === 'none') return;

        const showPoints = !player.isMultiplayer;
        const btnStyle = (player.statPoints > 0 && showPoints) ? 'display:inline-block; margin-left:5px; cursor:pointer;' : 'display:none;';

        // Helper to format stat with bonus
        const fmtStat = (statName) => {
            const total = player.stats[statName];
            const base = player.baseStats ? player.baseStats[statName] : total; // Fallback if baseStats missing
            const bonus = total - base;
            if (bonus > 0) {
                return `${total} <span style="color:#0f0; font-size:0.9em;">(+${bonus})</span>`;
            }
            return total;
        };

        this.statsContent.innerHTML = `
            <div style="margin-bottom: 5px;">
                <div><strong>Level:</strong> ${player.level}</div>
                <div style="font-size: 0.8rem; color: #aaa;"><strong>XP:</strong> ${player.xp} / ${player.xpToNextLevel}</div>
                ${showPoints ? `<div style="color: #ffd700;"><strong>Points:</strong> ${player.statPoints}</div>` : ''}
            </div>
            <div style="margin-bottom: 5px; border-top: 1px solid #444; padding-top: 2px;">
                <div style="color: #ff4444;"><strong>HP:</strong> ${Math.ceil(player.stats.hp)} / ${player.stats.maxHp}</div>
                <div style="color: #4444ff;"><strong>Mana:</strong> ${Math.ceil(player.stats.mana)} / ${player.stats.maxMana}</div>
            </div>
            <div style="margin-bottom: 5px; border-top: 1px solid #444; padding-top: 2px;">
                <div class="stat-row" data-stat-name="strength"><strong>STR:</strong> ${fmtStat('strength')} <button class="stat-btn" data-stat="strength" style="${btnStyle}">+</button></div>
                <div class="stat-row" data-stat-name="dexterity"><strong>DEX:</strong> ${fmtStat('dexterity')} <button class="stat-btn" data-stat="dexterity" style="${btnStyle}">+</button></div>
                <div class="stat-row" data-stat-name="intelligence"><strong>INT:</strong> ${fmtStat('intelligence')} <button class="stat-btn" data-stat="intelligence" style="${btnStyle}">+</button></div>
                <div class="stat-row" data-stat-name="vitality"><strong>VIT:</strong> ${fmtStat('vitality')} <button class="stat-btn" data-stat="vitality" style="${btnStyle}">+</button></div>
                <div class="stat-row" data-stat-name="wisdom"><strong>WIS:</strong> ${fmtStat('wisdom')} <button class="stat-btn" data-stat="wisdom" style="${btnStyle}">+</button></div>
            </div>
            <div style="border-top: 1px solid #444; padding-top: 2px;">
                <div><strong>DMG:</strong> ${player.stats.damage}</div>
                <div><strong>DEF:</strong> ${player.stats.defense}</div>
            </div>
        `;

        this.updateEquipSlot('slot-head', player.equipment.head, 'HEAD');
        this.updateEquipSlot('slot-shoulders', player.equipment.shoulders, 'SHOULDERS');
        this.updateEquipSlot('slot-chest', player.equipment.chest, 'CHEST');
        this.updateEquipSlot('slot-belt', player.equipment.belt, 'BELT');
        this.updateEquipSlot('slot-legs', player.equipment.legs, 'LEGS');
        this.updateEquipSlot('slot-feet', player.equipment.feet, 'FEET');
        this.updateEquipSlot('slot-gloves', player.equipment.gloves, 'GLOVES');
        this.updateEquipSlot('slot-neck', player.equipment.neck, 'NECK');
        this.updateEquipSlot('slot-mainhand', player.equipment.mainHand, 'MAIN HAND', 'mainHand');
        this.updateEquipSlot('slot-offhand', player.equipment.offHand, 'OFF HAND', 'offHand');
        this.updateEquipSlot('slot-ring1', player.equipment.ring1, 'RING 1');
        this.updateEquipSlot('slot-ring2', player.equipment.ring2, 'RING 2');
        this.updateEquipSlot('slot-trinket1', player.equipment.trinket1, 'TRINKET 1');
        this.updateEquipSlot('slot-trinket2', player.equipment.trinket2, 'TRINKET 2');
    }

    updateEquipSlot(id, item, placeholder, serverSlotName) {
        const el = document.getElementById(id);
        if (el) {
            el._item = (item && item.id) ? item : null; // Store item for tooltip
            el.innerHTML = ''; // Clear text/children
            
            // Remove old event listeners (by cloning and replacing)
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            
            // Re-assign to new element
            const slotEl = newEl;
            slotEl._item = (item && item.id) ? item : null; // Re-attach item data

            const slotId = serverSlotName || id.replace('slot-', '');

            if (item && item.id) {
                const iconPath = this.getItemIconPath(item);
                const color = item.rarity ? item.rarity.color : '#ffffff';
                const isEidolic = item.rarity && item.rarity.name === 'Eidolic';
                
                if (isEidolic) {
                    slotEl.innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>`;
                    slotEl.style.border = `2px solid ${color}`;
                    slotEl.style.boxShadow = `0 0 5px ${color}`;
                } else {
                    // Use multiply blend mode to tint the background
                    slotEl.innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-color:${color}; background-blend-mode:multiply; background-size:contain; background-repeat:no-repeat; background-position:center;"></div>`;
                    slotEl.style.border = `1px solid ${color}`;
                    slotEl.style.boxShadow = 'none';
                }
                
                slotEl.style.color = color;
                slotEl.style.borderColor = color;
                // slotEl.title = this.getItemTooltipText(item); // Disable native tooltip
                slotEl.removeAttribute('title');
                
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

                // Add click handler for unequipping
                slotEl.onclick = (e) => {
                    e.stopPropagation();
                    if (this.onUnequipRequest) {
                        this.onUnequipRequest(slotId);
                    }
                };

                // Tooltip handlers
                slotEl.addEventListener('mouseenter', (e) => {
                    const rect = slotEl.getBoundingClientRect();
                    this.showItemTooltip(item, rect.right + 10, rect.top);
                });
                slotEl.addEventListener('mouseleave', () => {
                    this.hideTooltips();
                });

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
    }

    updateInventory(player) {
        if (!player) return;
        this.lastPlayerRef = player;
        // console.log("UIManager: Updating inventory UI. Items:", player.inventory.length);

        // Update Gold
        if (this.goldDisplay) {
            this.goldDisplay.textContent = `GOLD: ${player.gold || 0}`;
        }

        const slots = this.inventoryGrid.children;
        for (let i = 0; i < slots.length; i++) {
            const item = player.inventory[i];
            slots[i]._item = (item && item.id) ? item : null; // Store item for tooltip
            slots[i].innerHTML = ''; // Clear
            
            if (item && item.id) {
                const iconPath = this.getItemIconPath(item);
                const color = item.rarity ? item.rarity.color : '#ffffff';
                const isEidolic = item.rarity && item.rarity.name === 'Eidolic';
                
                let stackHtml = '';
                if (item.stack > 1) {
                    stackHtml = `<div style="position:absolute; bottom:2px; right:2px; font-size:10px; color:white; text-shadow:1px 1px 0 #000; font-weight:bold;">${item.stack}</div>`;
                }

                let potencyHtml = '';
                if (item.potency > 0) {
                    potencyHtml = `<div style="position:absolute; top:2px; right:2px; font-size:10px; color:#00ff00; text-shadow:1px 1px 0 #000; font-weight:bold;">+${item.potency}</div>`;
                }

                let socketHtml = '';
                if (item.sockets > 0) {
                    let dots = '';
                    for(let k=0; k<item.sockets; k++) {
                        dots += `<div style="width:3px; height:3px; border-radius:50%; background-color:#00ffff; box-shadow:0 0 2px #00ffff;"></div>`;
                    }
                    socketHtml = `<div style="position:absolute; bottom:2px; left:2px; display:flex; gap:1px;">${dots}</div>`;
                }

                // For Eidolic, we do NOT tint the background, only the border.
                // For others, we use multiply blend mode.
                if (isEidolic) {
                    slots[i].innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>${stackHtml}${potencyHtml}${socketHtml}`;
                    slots[i].style.border = `2px solid ${color}`; // Thicker border for Eidolic?
                    slots[i].style.boxShadow = `0 0 5px ${color}`; // Glow
                } else {
                    slots[i].innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-color:${color}; background-blend-mode:multiply; background-size:contain; background-repeat:no-repeat; background-position:center;"></div>${stackHtml}${potencyHtml}${socketHtml}`;
                    slots[i].style.border = `1px solid ${color}`;
                    slots[i].style.boxShadow = 'none';
                }
                
                slots[i].style.color = color;
                // slots[i].title = this.getItemTooltipText(item); // Disable native tooltip
                slots[i].removeAttribute('title');
                slots[i].style.backgroundColor = '#222';
                
                this.setupItemDragAndDrop(slots[i], 'inventory', i, item);

                // Add click handler for equipping (simple toggle for now)
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

                    // Mobile/Desktop Selection Logic
                    if (this.isMobile) {
                        if (this.selectedSlot === i) {
                            // Already selected -> Equip
                            if (player.level < item.level) {
                                console.log("Level too low to equip!");
                                return;
                            }
                            if (player.equipItem(item)) {
                                this.selectedSlot = -1; // Reset
                                this.hideTooltips();
                                this.updateInventory(player);
                                this.updateCharacterSheet(player);
                            }
                        } else {
                            // Select it
                            this.selectedSlot = i;
                            const rect = slots[i].getBoundingClientRect();
                            // Show tooltip to the right or left depending on screen position
                            let x = rect.right;
                            if (x + 220 > window.innerWidth) x = rect.left - 220;
                            this.showItemTooltip(item, x, rect.top);
                        }
                    } else {
                        // Check if Trading House is open
                        if (this.tradingHouseScreen && this.tradingHouseScreen.style.display === 'flex') {
                            // Switch to List tab if not active
                            if (this.panelTradingList.style.display === 'none') {
                                this.switchTradingTab('list');
                            }
                            this.selectTradingItem(item, i);
                            return;
                        }

                        // Desktop: Instant Equip
                        if (player.level < item.level) {
                            console.log("Level too low to equip!");
                            return;
                        }

                        // Remove from inventory temporarily to allow swapping
                        player.inventory[i] = null;

                        if (player.equipItem(item)) {
                            this.selectedSlot = -1;
                            this.hideTooltips();
                            this.updateInventory(player);
                            this.updateCharacterSheet(player);
                        } else {
                            // Failed to equip, put it back
                            player.inventory[i] = item;
                        }
                    }
                };

                // Right-click to sell if shop is open
                slots[i].oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.shopScreen.style.display === 'flex') {
                        this.sellItem(player, i);
                    } else if (this.stashScreen.style.display === 'flex') {
                        if (this.onStashDeposit) {
                            this.onStashDeposit(item.id);
                        }
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

    updateStash(player) {
        if (!player) return;
        this.lastPlayerRef = player;
        
        // Ensure grid has 100 slots
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
                const iconPath = this.getItemIconPath(item);
                const color = item.rarity ? item.rarity.color : '#ffffff';
                const isEidolic = item.rarity && item.rarity.name === 'Eidolic';
                
                let stackHtml = '';
                if (item.stack > 1) {
                    stackHtml = `<div style="position:absolute; bottom:2px; right:2px; font-size:10px; color:white; text-shadow:1px 1px 0 #000; font-weight:bold;">${item.stack}</div>`;
                }

                if (isEidolic) {
                    slots[i].innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>${stackHtml}`;
                    slots[i].style.border = `2px solid ${color}`;
                    slots[i].style.boxShadow = `0 0 5px ${color}`;
                } else {
                    slots[i].innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-color:${color}; background-blend-mode:multiply; background-size:contain; background-repeat:no-repeat; background-position:center;"></div>${stackHtml}`;
                    slots[i].style.border = `1px solid ${color}`;
                    slots[i].style.boxShadow = 'none';
                }
                
                slots[i].style.color = color;
                slots[i].style.backgroundColor = '#222';
                
                // Right-click to withdraw
                slots[i].oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.onStashWithdraw) {
                        this.onStashWithdraw(item.id);
                    }
                };
                
                // Tooltip
                slots[i].onmousemove = (e) => {
                    this.showItemTooltip(item, e.clientX, e.clientY, e);
                };
                slots[i].onmouseleave = () => {
                    this.hideTooltips();
                };
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

    getItemTooltipText(item) {
        let text = `${item.name}\n${item.rarity.name} ${item.type}\nLevel ${item.level}\n\n`;
        if (item.stats) {
            for (const stat of this.getOrderedItemStatKeys(item.stats)) {
                text += `+${item.stats[stat]} ${this.formatStatName(stat)}\n`;
            }
        }
        return text;
    }

    setupWindow(element) {
        // Stop clicks from reaching the game
        element.addEventListener('mousedown', (e) => e.stopPropagation());
        element.addEventListener('click', (e) => e.stopPropagation()); // Also stop click events
        element.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });

        // Drag Logic
        const header = element.querySelector('.window-header');
        if (!header) return;
        
        header.style.cursor = 'move';
        header.style.touchAction = 'none'; // Prevent browser handling (scrolling/swiping)
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        const startDrag = (clientX, clientY) => {
            isDragging = true;
            startX = clientX;
            startY = clientY;

            // 1. Capture current visual position (viewport coordinates)
            const rect = element.getBoundingClientRect();
            
            // 2. Reset positioning properties to prepare for absolute positioning
            element.style.position = 'absolute';
            element.style.margin = '0';
            element.style.right = 'auto';
            element.style.bottom = 'auto';

            // Check for mobile scale
            // We assume mobile if width < 800 OR if we detect a scale transform
            // But simpler is to just check window width as per CSS media query
            const isMobile = window.innerWidth <= 800 || document.body.classList.contains('mobile-mode');
            
            if (isMobile) {
                // Preserve scale but move origin to top-left for easy dragging
                element.style.transformOrigin = 'top left';
                element.style.transform = 'scale(0.5)';
            } else {
                element.style.transform = 'none';
            }
            
            // 3. Calculate position relative to the offset parent
            let parentX = 0;
            let parentY = 0;
            const op = element.offsetParent;
            
            if (op) {
                const opRect = op.getBoundingClientRect();
                parentX = opRect.left + (op.clientLeft || 0);
                parentY = opRect.top + (op.clientTop || 0);
            }
            
            // 4. Set the new left/top to match the visual position
            const newLeft = rect.left - parentX;
            const newTop = rect.top - parentY;
            
            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
            
            startLeft = newLeft;
            startTop = newTop;
        };

        const moveDrag = (clientX, clientY) => {
            if (!isDragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            // Bounds check
            const headerRect = header.getBoundingClientRect();
            const maxX = window.innerWidth - 50; 
            const maxY = window.innerHeight - headerRect.height;

            if (newTop < 0) newTop = 0;
            if (newTop > maxY) newTop = maxY;
            if (newLeft < -headerRect.width + 50) newLeft = -headerRect.width + 50;
            if (newLeft > maxX) newLeft = maxX;

            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
        };

        const endDrag = () => {
            isDragging = false;
        };

        // Mouse Events
        header.addEventListener('mousedown', (e) => {
            startDrag(e.clientX, e.clientY);
            e.preventDefault(); // Prevent selection
        });

        window.addEventListener('mousemove', (e) => {
            moveDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', endDrag);

        // Touch Events
        header.addEventListener('touchstart', (e) => {
            // Allow buttons to work
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }

            if (e.touches.length === 1) {
                startDrag(e.touches[0].clientX, e.touches[0].clientY);
                e.preventDefault(); // Prevent scrolling
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                moveDrag(e.touches[0].clientX, e.touches[0].clientY);
                e.preventDefault(); // Prevent scrolling
            }
        }, { passive: false });

        window.addEventListener('touchend', endDrag);
    }

    showStatTooltip(statName, x, y) {
        // Reset title color
        this.statTooltipTitle.style.color = '#ffd700';

        // Determine text based on player class and stat
        // We need access to player. Since we don't store player in UIManager, we might need to pass it or store it.
        // Actually, updatePlayerStats is called every frame with player. Let's store a reference.
        // Or better, just assume we can access it via gameEngine if we had it, but we don't.
        // Let's store the last player object in updatePlayerStats or updateCharacterSheet.
        
        if (!this.lastPlayerRef) return;
        const player = this.lastPlayerRef;
        const className = player.constructor.name; // Fighter, Rogue, etc.
        const manaStat = player.manaStatName || 'intelligence';

        let title = statName.toUpperCase();
        let desc = "";

        switch (statName) {
            case 'strength':
                desc = "Increases Physical Damage (+2 per point).";
                if (className === 'Fighter') desc += " Increases Charge ability damage.";
                break;
            case 'dexterity':
                desc = "Increases Movement Speed (+1.2 per point) and Attack Speed (+0.2% per point).";
                if (className === 'Rogue') desc += " Increases Dagger ability damage.";
                break;
            case 'vitality':
                desc = "Increases Max HP (+10 per point) and HP Regeneration (+0.1 per point).";
                break;
            case 'intelligence':
                desc = "Increases Max Mana (+10 per point) and Cooldown Reduction (+0.5% per point, max 50%).";
                if (className === 'Wizard') desc += " Increases Fireball ability damage.";
                break;
            case 'wisdom':
                desc = "Increases Mana Regeneration (+0.1 per point) and Cast Speed (+0.2% per point).";
                if (className === 'Cleric') desc += " Increases Spirit ability damage.";
                break;
        }

        this.statTooltipTitle.textContent = title;
        this.statTooltipDesc.innerHTML = desc; // Use innerHTML to be consistent
        
        this.statTooltip.style.display = 'block';
        this.statTooltip.style.left = `${x + 15}px`;
        this.statTooltip.style.top = `${y + 15}px`;
    }

    formatStatName(statKey) {
        if (!statKey) return '';
        const spaced = String(statKey).replace(/([A-Z])/g, ' $1');
        return spaced
            .split(' ')
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
    
    formatSetBonus(bonus) {
        if (!bonus) return '';
        const parts = [];
        for (const key in bonus) {
            const val = bonus[key];
            // Handle special set bonuses (non-stat bonuses)
            if (typeof val === 'number' && val === 1) {
                // Boolean special effect
                parts.push(this.formatStatName(key));
            } else if (typeof val === 'number') {
                // Stat bonus with value
                parts.push(`+${val}% ${this.formatStatName(key)}`);
            } else {
                parts.push(`${this.formatStatName(key)}: ${val}`);
            }
        }
        return parts.join(', ');
    }

    getOrderedItemStatKeys(stats) {
        if (!stats) return [];

        // Render item stats in a stable order to prevent tooltip lines from "moving around"
        // when incoming item payloads reconstruct the stats object with different key orders.
        const preferredOrder = [
            'damage',
            'defense',
            'strength',
            'dexterity',
            'intelligence',
            'wisdom',
            'vitality'
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
        // Store hover state for toggle update
        this.hoveredItem = item;
        this.lastMouseX = x;
        this.lastMouseY = y;

        this.statTooltipTitle.textContent = item.name;
        this.statTooltipTitle.style.color = item.rarity.color;
        
        // Format slot name
        let slotName = item.slot;
        if (slotName === 'mainHand') slotName = 'Main Hand';
        else if (slotName === 'offHand') slotName = 'Off Hand';
        else slotName = slotName.charAt(0).toUpperCase() + slotName.slice(1);

        // Level Requirement Color
        let levelColor = '#aaa';
        if (this.lastPlayerRef && this.lastPlayerRef.level < item.level) {
            levelColor = '#ff0000';
        }

        let desc = `<div style="color: #aaa; font-style: italic; margin-bottom: 5px;">${item.rarity.name} ${item.type} (${slotName}) - <span style="color: ${levelColor}">Lvl ${item.level}</span></div>`;
        
        if (item.stack > 1) {
            desc += `<div style="color: #fff; margin-bottom: 5px;">Stack Size: ${item.stack} / ${item.maxStack || 1000}</div>`;
        }
        
        if (item.stats) {
            for (const stat of this.getOrderedItemStatKeys(item.stats)) {
                const val = item.stats[stat];
                desc += `<div style="color: #fff;">+${val} ${this.formatStatName(stat)}</div>`;
            }
        }
        
        // Show Socketed Gems
        if (item.gems && item.gems.length > 0) {
            desc += `<div style="color: #888; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">Socketed Gems:</div>`;
            for (const gem of item.gems) {
                if (gem) {
                    const gemType = GEM_TYPES[gem.type] || { name: gem.type, color: '#fff' };
                    const gemQuality = GEM_QUALITIES[gem.quality] || { name: gem.quality };
                    desc += `<div style="color: ${gemType.color};">◆ ${gemQuality.name} ${gemType.name}</div>`;
                }
            }
        }
        
        // Show available sockets
        if (item.sockets !== undefined && item.sockets > 0) {
            const usedSockets = item.gems ? item.gems.length : 0;
            const emptySockets = item.sockets - usedSockets;
            if (emptySockets > 0) {
                desc += `<div style="color: #666; margin-top: 3px;">◇ ${emptySockets} Empty Socket${emptySockets > 1 ? 's' : ''}</div>`;
            }
        }
        
        // Show Set Item Info
        if (item.setId && SET_DEFINITIONS[item.setId]) {
            const setDef = SET_DEFINITIONS[item.setId];
            desc += `<div style="color: #00ff00; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">`;
            desc += `<div style="font-weight: bold;">${setDef.name}</div>`;
            
            // Count equipped pieces if player is available
            let equippedCount = 0;
            if (this.lastPlayerRef && this.lastPlayerRef.equipment) {
                for (const slot in this.lastPlayerRef.equipment) {
                    const equipped = this.lastPlayerRef.equipment[slot];
                    if (equipped && equipped.setId === item.setId) {
                        equippedCount++;
                    }
                }
            }
            
            // Show set bonuses with active highlighting
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
        
        // Show Unique Effect
        if (item.uniqueEffect && UNIQUE_EFFECTS[item.uniqueEffect]) {
            const effect = UNIQUE_EFFECTS[item.uniqueEffect];
            desc += `<div style="color: ${effect.color}; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">`;
            desc += `<div style="font-weight: bold;">★ ${effect.name}</div>`;
            desc += `<div style="color: #ccc; font-style: italic;">${effect.description}</div>`;
            desc += `</div>`;
        }

        // Show Sell Price if Shop is Open
        if (this.shopScreen.style.display === 'flex') {
            const value = Item.getValue(item);
            desc += `<div style="color: #ffd700; margin-top: 10px; border-top: 1px solid #444; padding-top: 5px;">Sell Value: ${value} Gold</div>`;
            
            // Add Sell Button ONLY on Mobile
            if (this.isMobile) {
                desc += `<button id="btn-tooltip-sell" style="width:100%; margin-top:10px; padding: 8px; background:#333; color:#ffd700; border:1px solid #ffd700; cursor:pointer; font-weight:bold;">SELL ITEM</button>`;
            }
        }
        
        // Add Equip Button ONLY on Mobile
        if (this.isMobile) {
            desc += `<button id="btn-tooltip-equip" style="width:100%; margin-top:5px; padding: 8px; background:#222; color:#fff; border:1px solid #666; cursor:pointer;">EQUIP</button>`;
        }
        
        this.statTooltipDesc.innerHTML = desc;
        
        // Bind Button Events
        setTimeout(() => { // Timeout to ensure DOM is updated
            const btnSell = document.getElementById('btn-tooltip-sell');
            if (btnSell) {
                btnSell.onclick = (e) => {
                    e.stopPropagation();
                    // Use captured item/index if possible, or fallback to selectedSlot
                    // Since we are in showItemTooltip, we know 'item'. We need index for sellItem.
                    // We can find index from inventory.
                    if (this.lastPlayerRef) {
                        const index = this.lastPlayerRef.inventory.indexOf(item);
                        if (index !== -1) {
                            this.sellItem(this.lastPlayerRef, index);
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
                    if (this.lastPlayerRef) {
                        // Use the item passed to showItemTooltip directly
                        if (this.lastPlayerRef.level < item.level) {
                            console.log("Level too low!");
                            return;
                        }
                        if (this.lastPlayerRef.equipItem(item)) {
                            this.selectedSlot = -1;
                            this.hideTooltips();
                            this.updateInventory(this.lastPlayerRef);
                            this.updateCharacterSheet(this.lastPlayerRef);
                        }
                    }
                };
            }
        }, 0);
        
        this.statTooltip.style.display = 'block';
        this.statTooltip.style.left = `${x + 15}px`;
        this.statTooltip.style.top = `${y + 15}px`;
        
        // Ensure it stays on screen
        const rect = this.statTooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.statTooltip.style.left = `${window.innerWidth - rect.width - 10}px`;
        }

        // Comparison Tooltip Logic
        this.compareTooltip.style.display = 'none'; // Default to hidden
        
        // Check compareMode OR shiftKey (support both just in case, but user asked for toggle)
        // Actually user said "shift just toggles on compare", so we rely on this.compareMode
        if (this.compareMode && this.lastPlayerRef) {
            const equippedItem = this.lastPlayerRef.equipment[item.slot];
            
            // Only show if there is an equipped item and it's not the same item we are hovering
            if (equippedItem && equippedItem !== item) {
                this.compareTooltipTitle.textContent = equippedItem.name;
                this.compareTooltipTitle.style.color = equippedItem.rarity.color;
                
                let compDesc = `<div style="color: #aaa; font-style: italic; margin-bottom: 5px;">${equippedItem.rarity.name} ${equippedItem.type} (${slotName}) - Lvl ${equippedItem.level}</div>`;
                
                if (equippedItem.stats) {
                    for (const stat of this.getOrderedItemStatKeys(equippedItem.stats)) {
                        const val = equippedItem.stats[stat];
                        compDesc += `<div style="color: #fff;">+${val} ${this.formatStatName(stat)}</div>`;
                    }
                }
                
                // Show Socketed Gems in comparison
                if (equippedItem.gems && equippedItem.gems.length > 0) {
                    compDesc += `<div style="color: #888; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">Socketed Gems:</div>`;
                    for (const gem of equippedItem.gems) {
                        if (gem) {
                            const gemType = GEM_TYPES[gem.type] || { name: gem.type, color: '#fff' };
                            const gemQuality = GEM_QUALITIES[gem.quality] || { name: gem.quality };
                            compDesc += `<div style="color: ${gemType.color};">◆ ${gemQuality.name} ${gemType.name}</div>`;
                        }
                    }
                }
                
                // Show Set Item Info in comparison
                if (equippedItem.setId && SET_DEFINITIONS[equippedItem.setId]) {
                    const setDef = SET_DEFINITIONS[equippedItem.setId];
                    compDesc += `<div style="color: #00ff00; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">`;
                    compDesc += `<div style="font-weight: bold;">${setDef.name}</div>`;
                    compDesc += `</div>`;
                }
                
                // Show Unique Effect in comparison
                if (equippedItem.uniqueEffect && UNIQUE_EFFECTS[equippedItem.uniqueEffect]) {
                    const effect = UNIQUE_EFFECTS[equippedItem.uniqueEffect];
                    compDesc += `<div style="color: ${effect.color}; margin-top: 8px; border-top: 1px solid #333; padding-top: 5px;">`;
                    compDesc += `<div style="font-weight: bold;">★ ${effect.name}</div>`;
                    compDesc += `</div>`;
                }
                
                this.compareTooltipDesc.innerHTML = compDesc;
                
                this.compareTooltip.style.display = 'block';
                
                // Position logic
                const mainRect = this.statTooltip.getBoundingClientRect();
                this.compareTooltip.style.left = `${mainRect.right + 10}px`;
                this.compareTooltip.style.top = `${mainRect.top}px`;
                
                const compRect = this.compareTooltip.getBoundingClientRect();
                if (compRect.right > window.innerWidth) {
                    // Move to left of main tooltip
                    this.compareTooltip.style.left = `${mainRect.left - compRect.width - 10}px`;
                }
            }
        }
    }

    sellItem(player, index) {
        if (this.onSellItem) {
            this.onSellItem(index);
        } else {
            // Fallback for local testing if engine not hooked up
            const item = player.inventory[index];
            if (!item) return;

            const value = Item.getValue(item);
            
            player.gold += value;
            player.inventory[index] = null;
            
            console.log(`Sold ${item.name} for ${value} gold.`);
            
            this.updateInventory(player);
        }
    }

    setupShop() {
        const grid = document.getElementById('shop-grid');
        if (!grid) return;
        
        grid.innerHTML = ''; // Clear existing

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
        if (!this.lastPlayerRef) return;

        let cost = Math.ceil(35 * this.lastPlayerRef.level);

        if (this.lastPlayerRef.gold < cost) {
            this.addChatMessage("System", `Not sufficient gold! Cost: ${cost}`);
            return;
        }

        if (this.onBuyGamble) {
            this.onBuyGamble(slot);
        } else {
            console.warn("onBuyGamble callback not defined");
        }
    }

    hideTooltips() {
        this.statTooltip.style.display = 'none';
        this.compareTooltip.style.display = 'none';
        this.hoveredItem = null;
    }

    createSocialWindow() {
        const div = document.createElement('div');
        div.id = 'social-window';
        div.className = 'window'; // Add window class for styling/scaling
        div.style.display = 'none';
        div.style.position = 'absolute';
        div.style.top = '50%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.width = '400px';
        div.style.height = '500px';
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        div.style.border = '2px solid #444';
        div.style.color = 'white';
        div.style.padding = '20px';
        div.style.zIndex = '1000';
        div.style.fontFamily = 'Arial, sans-serif';
        
        div.innerHTML = `
            <div class="window-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #666; padding-bottom:10px;">
                <h2 style="margin:0;">Social</h2>
                <button id="close-social" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">X</button>
            </div>
            <div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; font-weight:bold; margin-bottom:10px; color:#aaa;">
                <span>Name</span>
                <span>Class</span>
                <span>Level</span>
                <span>Action</span>
            </div>
            <div id="social-list" style="overflow-y:auto; height:380px;">
                <!-- Players go here -->
            </div>
        `;
        
        document.body.appendChild(div);
        
        document.getElementById('close-social').onclick = () => this.toggleSocial(false);
        this.socialWindow = div;
        this.socialList = document.getElementById('social-list');
    }

    toggleSocial(show) {
        if (show === undefined) {
            show = this.socialWindow.style.display === 'none';
        }
        this.socialWindow.style.display = show ? 'block' : 'none';
        
        // Also toggle Party Panel if opening Social, or ensure it's visible if in party
        if (show) {
            // Trigger refresh callback if needed, or GameEngine handles it
            if (this.onSocialOpen) this.onSocialOpen();
            
            // Show Party Panel alongside Social Window for easy access
            if (this.partyPanel) {
                this.partyPanel.style.display = 'block';
            }
        } else {
            // Closing social
            // Only hide party panel if NOT in a party
            if (this.partyPanel && !this.inParty) {
                this.partyPanel.style.display = 'none';
            }
        }
    }

    updateSocialList(players) {
        this.socialList.innerHTML = '';
        players.forEach(p => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr'; // Added column for Invite
            row.style.padding = '5px 0';
            row.style.borderBottom = '1px solid #333';
            
            // Use lastPlayerRef to check self name if available, otherwise just white
            const isSelf = this.lastPlayerRef && this.lastPlayerRef.name === p.name;

            row.innerHTML = `
                <span style="color:${isSelf ? '#4CAF50' : 'white'}">${p.name}</span>
                <span style="color:#aaa">${p.class}</span>
                <span style="color:#FFD700">${p.level}</span>
                ${!isSelf ? `<button class="btn-invite" data-name="${p.name}" style="background:#2e7d32; border:none; color:white; cursor:pointer; font-size:10px; padding:2px 5px;">INVITE</button>` : '<span></span>'}
            `;
            this.socialList.appendChild(row);
        });

        // Add event listeners to invite buttons
        const inviteBtns = this.socialList.querySelectorAll('.btn-invite');
        inviteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.getAttribute('data-name');
                if (this.onPartyInvite) {
                    this.onPartyInvite(name);
                    this.addChatMessage("System", `Invited ${name} to party.`);
                }
            });
        });
    }

    updateParty(partyData) {
        this.partyData = partyData; // Store for WorldMap access
        if (!this.partyPanel || !this.partyList) return;

        const inParty = !!(partyData && partyData.partyId);
        this.inParty = inParty;

        if (!inParty) {
            // Not in party
            if (this.socialWindow.style.display === 'none') {
                 this.partyPanel.style.display = 'none';
            } else {
                 // Keep it open if social window is open, so they can see the invite box
                 this.partyPanel.style.display = 'block';
            }
            this.partyList.innerHTML = '<div style="color:#aaa; font-style:italic; padding:5px;">No party. Invite someone!</div>';
            return;
        }

        this.partyPanel.style.display = 'block';
        this.partyList.innerHTML = '';

        const members = partyData.members || [];
        const leaderId = partyData.leaderId;
        const myId = this.lastPlayerRef ? this.lastPlayerRef.id : null;
        const amILeader = myId === leaderId;

        members.forEach(member => {
            const div = document.createElement('div');
            div.className = 'party-member';
            
            const hpPercent = (member.hp / member.maxHp) * 100;
            const isLeader = member.isLeader;
            const isMe = member.id === myId;

            let actionsHtml = '';
            if (amILeader && !isMe) {
                actionsHtml = `
                    <div class="party-actions">
                        <button class="party-btn" onclick="window.game.kickPartyMember('${member.id}')" title="Kick">K</button>
                        <button class="party-btn" onclick="window.game.promotePartyMember('${member.id}')" title="Promote">P</button>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="party-member-info">
                    <div class="party-name">
                        ${isLeader ? '<span class="party-leader-icon">★</span>' : ''}
                        ${member.name} <span style="color: #aaa; font-size: 10px;">(Lvl ${member.level} ${member.class})</span>
                    </div>
                    <div class="party-hp-bar">
                        <div class="party-hp-fill" style="width: ${hpPercent}%"></div>
                    </div>
                </div>
                ${actionsHtml}
            `;
            this.partyList.appendChild(div);
        });
    }

    showPartyRequest(inviterName) {
        if (!this.partyRequestModal) return;
        this.currentInviter = inviterName;
        if (this.partyInviterName) this.partyInviterName.textContent = inviterName;
        this.partyRequestModal.style.display = 'block';
    }

    hidePartyRequest() {
        if (!this.partyRequestModal) return;
        this.partyRequestModal.style.display = 'none';
        this.currentInviter = null;
    }

    setupItemDragAndDrop(element, type, indexOrSlot, item) {
        if (!element) return;

        // Always allow dropping onto this slot (even if empty)
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

        // Source behavior (only if this slot has an item)
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
        console.log("handleItemDrop", source, target);
        if (source.type === target.type && source.id === target.id) return;

        const player = this.lastPlayerRef;
        if (!player) return;

        // Inventory -> Inventory (Move/Swap)
        if (source.type === 'inventory' && target.type === 'inventory') {
            if (window.game && window.game.socket && window.game.socket.readyState === WebSocket.OPEN) {
                window.game.socket.send(JSON.stringify({
                    type: 'inventory_move',
                    payload: {
                        fromIndex: source.id,
                        toIndex: target.id
                    }
                }));
            }
        } 
        // Inventory -> Equipment (Equip)
        else if (source.type === 'inventory' && target.type === 'equipment') {
            const item = player.inventory[source.id];
            if (item) {
                if (window.game) {
                    // Map slot name to internal slot ID if needed, but usually they match or are handled
                    // target.id is passed as 'head', 'ring1' etc from updateEquipSlot
                    window.game.sendEquipMessage(item, target.id);
                }
            }
        }
        // Equipment -> Inventory (Unequip)
        else if (source.type === 'equipment' && target.type === 'inventory') {
            if (window.game && window.game.socket && window.game.socket.readyState === WebSocket.OPEN) {
                window.game.socket.send(JSON.stringify({
                    type: 'unequip',
                    payload: {
                        slot: source.id
                    }
                }));
            }
        }
    }

    showDungeonMenu(data) {
        console.log("Showing Dungeon Menu:", data);
        // Remove existing if any
        const existing = document.getElementById('dungeon-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'dungeon-menu';
        menu.style.position = 'absolute';
        menu.style.top = '50%';
        menu.style.left = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
        menu.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        menu.style.border = '2px solid #444';
        menu.style.padding = '20px';
        menu.style.color = '#fff';
        menu.style.zIndex = '1000';
        menu.style.textAlign = 'center';
        menu.style.minWidth = '400px';

        const title = document.createElement('h2');
        title.innerText = 'Dungeon Portal';
        title.style.marginTop = '0';
        menu.appendChild(title);

        if (data.hasInstance && data.timeLeft > 0) {
            const timer = document.createElement('p');
            timer.innerText = `Instance resets in: ${Math.ceil(data.timeLeft)}s`;
            timer.style.color = '#ffaa00';
            menu.appendChild(timer);
        } else if (data.hasInstance) {
            const status = document.createElement('p');
            status.innerText = 'Instance Active';
            status.style.color = '#00ff00';
            menu.appendChild(status);
        } else {
            const status = document.createElement('p');
            status.innerText = 'No Active Instance';
            status.style.color = '#aaa';
            menu.appendChild(status);
        }

        // Dungeon Selection
        const dungeonInfo = {
            verdant_bastion_catacombs: { name: 'Verdant Bastion Catacombs', baseLevel: 30, color: '#4a4' },
            molten_core: { name: 'Molten Core', baseLevel: 70, color: '#f64' },
            tempest_spire: { name: 'Tempest Spire', baseLevel: 70, color: '#6af' },
            abyssal_well: { name: 'Abyssal Well', baseLevel: 60, color: '#4ad' }
        };

        const lockedDungeonType = data && data.dungeonType && dungeonInfo[data.dungeonType]
            ? data.dungeonType
            : null;

        if (lockedDungeonType) {
            title.innerText = dungeonInfo[lockedDungeonType].name;
        }

        const difficultyInfo = {
            normal: { name: 'Normal', color: '#aaa', hp: '1x', dmg: '1x', loot: '1x', levelAdd: 0 },
            heroic: { name: 'Heroic', color: '#ff0', hp: '2x', dmg: '1.5x', loot: '2x', levelAdd: 20 },
            mythic: { name: 'Mythic', color: '#f60', hp: '4x', dmg: '2.5x', loot: '4x', levelAdd: 40 }
        };

        // Dungeon Type Label
        const dungeonLabel = document.createElement('label');
        dungeonLabel.innerText = lockedDungeonType ? 'Dungeon:' : 'Select Dungeon:';
        dungeonLabel.style.display = 'block';
        dungeonLabel.style.marginTop = '15px';
        dungeonLabel.style.fontWeight = 'bold';
        menu.appendChild(dungeonLabel);

        // Dungeon Type Dropdown
        const dungeonSelect = document.createElement('select');
        dungeonSelect.id = 'dungeon-type-select';
        dungeonSelect.style.margin = '5px';
        dungeonSelect.style.padding = '8px';
        dungeonSelect.style.fontSize = '14px';
        dungeonSelect.style.backgroundColor = '#222';
        dungeonSelect.style.color = '#fff';
        dungeonSelect.style.border = '1px solid #555';
        dungeonSelect.style.cursor = 'pointer';
        dungeonSelect.style.width = '250px';

        const availableDungeons = lockedDungeonType
            ? { [lockedDungeonType]: dungeonInfo[lockedDungeonType] }
            : dungeonInfo;

        for (const [key, info] of Object.entries(availableDungeons)) {
            const option = document.createElement('option');
            option.value = key;
            option.innerText = `${info.name} (Lv ${info.baseLevel}+)`;
            option.style.color = info.color;
            dungeonSelect.appendChild(option);
        }
        if (lockedDungeonType) {
            dungeonSelect.value = lockedDungeonType;
            dungeonSelect.disabled = true;
            dungeonSelect.style.cursor = 'default';
            dungeonSelect.style.opacity = '0.8';
        }
        menu.appendChild(dungeonSelect);

        // Difficulty Label
        const diffLabel = document.createElement('label');
        diffLabel.innerText = 'Select Difficulty:';
        diffLabel.style.display = 'block';
        diffLabel.style.marginTop = '15px';
        diffLabel.style.fontWeight = 'bold';
        menu.appendChild(diffLabel);

        // Difficulty Buttons Container
        const diffContainer = document.createElement('div');
        diffContainer.style.display = 'flex';
        diffContainer.style.justifyContent = 'center';
        diffContainer.style.gap = '10px';
        diffContainer.style.margin = '10px 0';

        let selectedDifficulty = 'normal';

        for (const [key, info] of Object.entries(difficultyInfo)) {
            const btn = document.createElement('button');
            btn.id = `diff-btn-${key}`;
            btn.innerText = info.name;
            btn.style.padding = '8px 16px';
            btn.style.cursor = 'pointer';
            btn.style.backgroundColor = key === 'normal' ? info.color : '#333';
            btn.style.color = key === 'normal' ? '#000' : info.color;
            btn.style.border = `2px solid ${info.color}`;
            btn.style.fontWeight = 'bold';
            btn.style.transition = 'all 0.2s';

            btn.onclick = () => {
                selectedDifficulty = key;
                // Update button styles
                for (const [k, i] of Object.entries(difficultyInfo)) {
                    const b = document.getElementById(`diff-btn-${k}`);
                    if (b) {
                        b.style.backgroundColor = k === key ? i.color : '#333';
                        b.style.color = k === key ? '#000' : i.color;
                    }
                }
                // Update info display
                updateDifficultyInfo();
            };
            diffContainer.appendChild(btn);
        }
        menu.appendChild(diffContainer);

        // Difficulty Info Display
        const diffInfoBox = document.createElement('div');
        diffInfoBox.id = 'difficulty-info-box';
        diffInfoBox.style.backgroundColor = '#1a1a1a';
        diffInfoBox.style.border = '1px solid #444';
        diffInfoBox.style.padding = '10px';
        diffInfoBox.style.margin = '10px 0';
        diffInfoBox.style.borderRadius = '4px';
        diffInfoBox.style.fontSize = '12px';
        diffInfoBox.style.textAlign = 'left';
        menu.appendChild(diffInfoBox);

        const updateDifficultyInfo = () => {
            const dungeonKey = dungeonSelect.value;
            const dungeon = dungeonInfo[dungeonKey];
            const diff = difficultyInfo[selectedDifficulty];
            const reqLevel = dungeon.baseLevel + diff.levelAdd;

            diffInfoBox.innerHTML = `
                <div style="color: ${diff.color}; font-weight: bold; font-size: 14px; margin-bottom: 8px;">${diff.name} Mode</div>
                <div><span style="color: #888;">Required Level:</span> <span style="color: #fff;">${reqLevel}</span></div>
                <div><span style="color: #888;">Enemy HP:</span> <span style="color: #f66;">${diff.hp}</span></div>
                <div><span style="color: #888;">Enemy Damage:</span> <span style="color: #f66;">${diff.dmg}</span></div>
                <div><span style="color: #888;">Loot & XP:</span> <span style="color: #6f6;">${diff.loot}</span></div>
                ${selectedDifficulty === 'heroic' ? '<div style="color: #ff0; margin-top: 5px;">+ Rare Gems & Better Drops</div>' : ''}
                ${selectedDifficulty === 'mythic' ? '<div style="color: #f60; margin-top: 5px;">+ Unique Items & Titles</div>' : ''}
            `;
        };

        dungeonSelect.onchange = updateDifficultyInfo;
        updateDifficultyInfo(); // Initial update

        // Enter Button
        const enterBtn = document.createElement('button');
        enterBtn.innerText = 'Enter Dungeon';
        enterBtn.style.margin = '10px';
        enterBtn.style.padding = '12px 30px';
        enterBtn.style.cursor = 'pointer';
        enterBtn.style.backgroundColor = '#2a6';
        enterBtn.style.color = '#fff';
        enterBtn.style.border = 'none';
        enterBtn.style.fontWeight = 'bold';
        enterBtn.style.fontSize = '16px';
        enterBtn.onclick = () => {
            if (window.game && window.game.socket) {
                window.game.socket.send(JSON.stringify({
                    type: 'enter_dungeon',
                    payload: { 
                        dungeonType: dungeonSelect.value,
                        difficulty: selectedDifficulty
                    }
                }));
            }
            menu.remove();
        };
        menu.appendChild(enterBtn);

        // Reset Button (Leader Only)
        if (data.isLeader) {
            const resetBtn = document.createElement('button');
            resetBtn.innerText = 'Reset Instance';
            resetBtn.style.margin = '10px';
            resetBtn.style.padding = '10px 20px';
            resetBtn.style.cursor = 'pointer';
            resetBtn.style.backgroundColor = '#800';
            resetBtn.style.color = '#fff';
            resetBtn.style.border = 'none';
            resetBtn.onclick = () => {
                if (window.game && window.game.socket) {
                    window.game.socket.send(JSON.stringify({
                        type: 'reset_dungeon',
                        payload: {}
                    }));
                }
                menu.remove();
            };
            menu.appendChild(resetBtn);
        }

        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'Close';
        closeBtn.style.margin = '10px';
        closeBtn.style.padding = '5px 10px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.backgroundColor = '#444';
        closeBtn.style.color = '#fff';
        closeBtn.style.border = 'none';
        closeBtn.onclick = () => menu.remove();
        menu.appendChild(closeBtn);

        document.body.appendChild(menu);
    }

    showRespecMenu() {
        // Remove existing if any
        const existing = document.getElementById('respec-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'respec-menu';
        menu.style.position = 'absolute';
        menu.style.top = '50%';
        menu.style.left = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
        menu.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        menu.style.border = '2px solid #6a4';
        menu.style.padding = '20px';
        menu.style.color = '#fff';
        menu.style.zIndex = '1000';
        menu.style.textAlign = 'center';
        menu.style.minWidth = '350px';
        menu.style.borderRadius = '8px';

        const title = document.createElement('h2');
        title.innerText = 'Talent Master';
        title.style.marginTop = '0';
        title.style.color = '#6a4';
        menu.appendChild(title);

        const desc = document.createElement('p');
        desc.innerText = 'Reset your talents or skills for a gold fee based on your level.';
        desc.style.color = '#aaa';
        desc.style.fontSize = '12px';
        desc.style.marginBottom = '15px';
        menu.appendChild(desc);

        // Get player level and gold for cost calculation
        const player = window.game?.player;
        const playerLevel = player?.level || 1;
        const playerGold = player?.gold || 0;

        // Cost formula: level * 100 for talents, level * 50 for skills, level * 125 for both
        const talentCost = playerLevel * 100;
        const skillCost = playerLevel * 50;
        const bothCost = playerLevel * 125;

        // Helper to create respec button
        const createRespecButton = (label, type, cost, color) => {
            const container = document.createElement('div');
            container.style.margin = '10px 0';
            container.style.padding = '10px';
            container.style.backgroundColor = '#1a1a1a';
            container.style.border = `1px solid ${color}`;
            container.style.borderRadius = '4px';

            const btn = document.createElement('button');
            btn.innerText = label;
            btn.style.width = '100%';
            btn.style.padding = '10px';
            btn.style.cursor = playerGold >= cost ? 'pointer' : 'not-allowed';
            btn.style.backgroundColor = playerGold >= cost ? color : '#333';
            btn.style.color = playerGold >= cost ? '#000' : '#666';
            btn.style.border = 'none';
            btn.style.fontWeight = 'bold';
            btn.style.fontSize = '14px';
            btn.style.borderRadius = '4px';
            btn.disabled = playerGold < cost;

            btn.onclick = () => {
                if (playerGold < cost) return;
                if (window.game && window.game.socket) {
                    window.game.socket.send(JSON.stringify({
                        type: 'respec',
                        payload: { respecType: type }
                    }));
                }
                menu.remove();
            };
            container.appendChild(btn);

            const costText = document.createElement('div');
            costText.style.marginTop = '5px';
            costText.style.fontSize = '12px';
            costText.style.color = playerGold >= cost ? '#fc0' : '#f44';
            costText.innerText = `Cost: ${cost.toLocaleString()} gold`;
            container.appendChild(costText);

            return container;
        };

        // Respec Talents Button
        menu.appendChild(createRespecButton('Reset Talents', 'talents', talentCost, '#6af'));
        
        // Respec Skills Button  
        menu.appendChild(createRespecButton('Reset Skills', 'skills', skillCost, '#f6a'));
        
        // Respec Both Button
        menu.appendChild(createRespecButton('Reset Both', 'both', bothCost, '#6a4'));

        // Player Gold Display
        const goldDisplay = document.createElement('div');
        goldDisplay.style.marginTop = '15px';
        goldDisplay.style.padding = '8px';
        goldDisplay.style.backgroundColor = '#222';
        goldDisplay.style.borderRadius = '4px';
        goldDisplay.innerHTML = `<span style="color: #888;">Your Gold:</span> <span style="color: #fc0; font-weight: bold;">${playerGold.toLocaleString()}</span>`;
        menu.appendChild(goldDisplay);

        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'Close';
        closeBtn.style.marginTop = '15px';
        closeBtn.style.padding = '8px 20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.backgroundColor = '#444';
        closeBtn.style.color = '#fff';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '4px';
        closeBtn.onclick = () => menu.remove();
        menu.appendChild(closeBtn);

        document.body.appendChild(menu);
    }

}
