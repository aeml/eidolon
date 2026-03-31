import { BASE_ITEMS, RARITY } from '../core/ItemSystem.js';
import { CONSTANTS } from '../core/Constants.js';
import { ForgeUI } from './ForgeUI.js';
import { SkillTreeUI } from './SkillTreeUI.js';
import { TradingUI } from './TradingUI.js';
import { QuestUI } from './QuestUI.js';
import { SocialUI } from './SocialUI.js';
import { InventoryUI } from './InventoryUI.js';

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
        this.combatIntentPanel = document.getElementById('combat-intent-panel');
        this.combatIntentName = document.getElementById('combat-intent-name');
        this.combatIntentMeta = document.getElementById('combat-intent-meta');
        this.combatIntentStatus = document.getElementById('combat-intent-status');
        this.combatIntentPreviewBasic = document.getElementById('combat-intent-preview-basic');
        this.combatIntentPreviewAbility = document.getElementById('combat-intent-preview-ability');
        this.combatIntentPreviewAbilityLabel = document.getElementById('combat-intent-preview-ability-label');
        this.lastCombatIntentSignature = '';

        // New UI Elements
        this.xpBar = document.getElementById('xp-bar-fill');
        this.xpText = document.getElementById('xp-text');
        this.characterSheet = document.getElementById('character-sheet');
        this.statsContent = document.getElementById('stats-content');

        // Quest UI (extracted module)
        this.quest = new QuestUI({
            getLastPlayer: () => this.lastPlayerRef,
        });

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

        // Skill Tree UI (extracted module)
        this.skillTree = new SkillTreeUI({
            getLastPlayer: () => this.lastPlayerRef,
            sendRespec: (type) => {
                if (window.game && window.game.socket) {
                    window.game.socket.send(JSON.stringify({
                        type: 'respec',
                        payload: { respecType: type }
                    }));
                }
            }
        });

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
        this.autoLootToggle = document.getElementById('auto-loot-enabled');

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
        this.onAutoLootChange = null;
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

        const storedAutoLoot = localStorage.getItem('eidolon.autoLootEnabled');
        this.autoLootEnabled = storedAutoLoot === null ? false : storedAutoLoot === 'true';
        if (this.autoLootToggle) {
            this.autoLootToggle.checked = this.autoLootEnabled;
            this.autoLootToggle.addEventListener('change', () => {
                this.setAutoLootEnabled(this.autoLootToggle.checked);
            });
        }
        // Shop/Stash close buttons are handled inside InventoryUI
        
        // Forge UI — delegated to ForgeUI module
        this.forge = new ForgeUI({
            getItemIconPath: (item) => this.getItemIconPath(item),
            formatStatName: (key) => this.formatStatName(key),
            getLastPlayer: () => this.lastPlayerRef,
            inventoryScreen: document.getElementById('inventory-screen'),
        });

        // Trading House UI — delegated to TradingUI module
        this.trading = new TradingUI({
            getLastPlayer: () => this.lastPlayerRef,
            getItemIconPath: (item) => this.getItemIconPath(item),
            getRarityColor: (rarity) => this.getRarityColor(rarity),
            showItemTooltip: (item, x, y) => this.inventory.showItemTooltip(item, x, y),
            hideTooltips: () => this.inventory.hideTooltips(),
            addChatMessage: (sender, msg) => this.addChatMessage(sender, msg),
        });

        // Inventory UI (extracted module) — handles inventory grid, equip slots,
        // shop/gamble, stash, item tooltips, drag-and-drop, split-stack, buyback, sell
        this.inventory = new InventoryUI({
            isMobile: this.isMobile,
            getLastPlayer: () => this.lastPlayerRef,
            getItemIconPath: (item) => this.getItemIconPath(item),
            formatStatName: (key) => this.formatStatName(key),
            getRarityColor: (rarity) => this.getRarityColor(rarity),
            addChatMessage: (sender, msg) => this.addChatMessage(sender, msg),
            updateCharacterSheet: (player) => this.updateCharacterSheet(player),
            trading: this.trading,
        });

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

        // Social UI (extracted module) — must come before setupWindow block
        this.social = new SocialUI({
            getLastPlayer: () => this.lastPlayerRef,
            addChatMessage: (sender, msg) => this.addChatMessage(sender, msg),
        });
        this.createDeathScreen();

        // Setup Windows (Drag & Click Blocking)
        this.setupWindow(this.characterSheet);
        this.setupWindow(this.inventory.inventoryScreen);
        this.setupWindow(this.inventory.shopScreen);
        this.setupWindow(this.inventory.stashScreen);
        this.setupWindow(this.forge.forgeScreen);
        this.setupWindow(this.trading.tradingHouseScreen);
        this.setupWindow(this.quest.questWindow);
        this.setupWindow(this.quest.questJournal);
        this.setupWindow(this.helpScreen);
        this.setupWindow(this.patchNotesScreen);
        this.setupWindow(this.reportScreen);
        this.setupWindow(this.social.socialWindow);
        this.setupWindow(this.skillTree.skillTreeWindow);
        this.setupWindow(this.abilitiesMenu);

        if (this.social.partyPanel) this.setupWindow(this.social.partyPanel);

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
        
        this.onStatUpgrade = null;
        this.onRespawn = null;
        this.onChatSend = null;
        this.onReportSubmit = null;
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

    handleSellAll(rarityName) { this.inventory.handleSellAll(rarityName); }

    addChatMessage(sender, message) {
        if (!this.chatBox) return;
        this.chatBox.style.display = 'flex';
        const div = document.createElement('div');
        div.style.marginBottom = '4px';
        div.innerHTML = `<strong style="color: #ffd700;">${sender}:</strong> <span style="color: #fff;">${message}</span>`;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showLootPickupToast(message, options = {}) {
        if (!message) return;
        const sender = options.sender || 'Loot';
        this.addChatMessage(sender, message);
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

        const gemIconPath = this.getGemIconPath(item);
        if (gemIconPath) {
            return gemIconPath;
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

    getGemIconPath(item) {
        if (!item) return null;

        const gemType = item.gemType || (item.type === 'GEM' || item.type === 'Gem' ? item.name.split(' ').slice(-1)[0] : null);
        const gemQuality = item.gemQuality || (item.type === 'GEM' || item.type === 'Gem' ? item.name.split(' ')[0] : null);
        if (!gemType) return null;

        const formattedGemType = gemType.toLowerCase().replace(/[^a-z]/g, '');
        const formattedGemQuality = gemQuality ? gemQuality.toLowerCase().replace(/[^a-z]/g, '') : '';
        if (!formattedGemType) return null;
        if (formattedGemQuality) {
            return this.resolveAssetUrl(`assets/icons/gems/${formattedGemQuality}_${formattedGemType}.svg`);
        }

        return this.resolveAssetUrl(`assets/icons/gems/${formattedGemType}.svg`);
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

    get isInventoryOpen() { return this.inventory.isInventoryOpen; }

    get isCharacterSheetOpen() {
        return this.characterSheet.style.display === 'block';
    }

    get isShopOpen() { return this.inventory.isShopOpen; }
    get isStashOpen() { return this.inventory.isStashOpen; }

    toggleCharacterSheet() {
        const isHidden = this.characterSheet.style.display === 'none' || this.characterSheet.style.display === '';
        this.characterSheet.style.display = isHidden ? 'block' : 'none';
        
        if (isHidden && this.lastPlayerRef) {
            this.updateCharacterSheet(this.lastPlayerRef);
        }
    }

    // --- Inventory delegates (InventoryUI module) ---
    toggleInventory() { this.inventory.toggleInventory(); }
    showSplitWindow(item, slotIndex) { this.inventory.showSplitWindow(item, slotIndex); }
    hideSplitWindow() { this.inventory.hideSplitWindow(); }
    confirmSplit() { this.inventory.confirmSplit(); }
    toggleStash() { this.inventory.toggleStash(); }

    toggleForge() { this.forge.toggle(); }
    switchForgeTab(tab) { this.forge.switchForgeTab(tab); }
    switchGemSubTab(tab) { this.forge.switchGemSubTab(tab); }
    updateForgeUI(player) { this.forge.updateForgeUI(player); }
    updateForgeInfo(item) { this.forge.updateForgeInfo(item); }
    handleForgeUpgrade(amount) { this.forge.handleForgeUpgrade(amount); }
    updateForgePotencyUI(player) { this.forge.updateForgePotencyUI(player); }
    updateForgePotencyInfo(item) { this.forge.updateForgePotencyInfo(item); }
    handleForgePotency() { this.forge.handleForgePotency(); }
    updateForgeSocketUI(player) { this.forge.updateForgeSocketUI(player); }
    updateForgeSocketInfo(item) { this.forge.updateForgeSocketInfo(item); }
    handleForgeSocket() { this.forge.handleForgeSocket(); }
    updateForgeGemsUI(player) { this.forge.updateForgeGemsUI(player); }
    updateForgeGemInfo(item, player) { this.forge.updateForgeGemInfo(item, player); }
    handleForgeInsertGem() { this.forge.handleForgeInsertGem(); }
    updateGemCombineUI(player) { this.forge.updateGemCombineUI(player); }
    updateGemCombineSlots(player) { this.forge.updateGemCombineSlots(player); }
    handleForgeCombineGem() { this.forge.handleForgeCombineGem(); }
    updateGemRemoveUI(player) { this.forge.updateGemRemoveUI(player); }
    updateGemRemoveInfo(item, player) { this.forge.updateGemRemoveInfo(item, player); }
    handleForgeRemoveGem() { this.forge.handleForgeRemoveGem(); }

    // --- Trading House delegates (TradingUI module) ---
    toggleTradingHouse() { this.trading.toggle(); }
    switchTradingTab(tab) { this.trading.switchTab(tab); }
    handleTradingSearch() { this.trading.handleSearch(); }
    handleTradingCreate() { this.trading.handleCreate(); }
    updateTradingInventory(player) { this.trading.updateInventory(player); }
    selectTradingItem(item, slotIndex) { this.trading.selectItem(item, slotIndex); }
    renderAuctionList(auctions) { this.trading.renderAuctionList(auctions); }
    renderMyAuctions(auctions) { this.trading.renderMyAuctions(auctions); }

    // --- Quest delegates (QuestUI module) ---
    toggleQuestWindow() { this.quest.toggleQuestWindow(); }
    toggleJournal() { this.quest.toggleJournal(); }
    updateQuestWindow(quests) { this.quest.updateQuestWindow(quests); }
    updateJournal(quests) { this.quest.updateJournal(quests); }

    toggleSkillTree() {
        this.skillTree.toggle();
    }

    renderSkillTree(classType) {
        this.skillTree.renderSkillTree(classType);
    }

    createSkillTreeTabs(classType) {
        return this.skillTree.createSkillTreeTabs(classType);
    }

    renderActiveSkillTree(classType) {
        this.skillTree.renderActiveSkillTree(classType);
    }

    renderTalentTree(classType) {
        this.skillTree.renderTalentTree(classType);
    }

    renderRunesTab(classType) {
        this.skillTree.renderRunesTab(classType);
    }

    renderCombosTab(classType) {
        this.skillTree.renderCombosTab(classType);
    }

    showComboNotification(comboName, comboId) {
        this.skillTree.showComboNotification(comboName, comboId);
    }

    updateHotbar(player) {
        if (!player) return;

        // Ensure lastPlayerRef is set so assignSkillToSlot can resolve icon paths
        this.lastPlayerRef = player;

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

    setAutoLootEnabled(enabled) {
        const nextValue = Boolean(enabled);
        this.autoLootEnabled = nextValue;
        localStorage.setItem('eidolon.autoLootEnabled', String(nextValue));
        if (this.autoLootToggle) {
            this.autoLootToggle.checked = nextValue;
        }
        if (this.onAutoLootChange) {
            this.onAutoLootChange(nextValue);
        }
    }

    getAutoLootEnabled() {
        return Boolean(this.autoLootEnabled);
    }

    toggleShop() { this.inventory.toggleShop(); }
    switchShopTab(tab) { this.inventory.switchShopTab(tab); }
    updateBuybackList(items) { this.inventory.updateBuybackList(items); }

    handleEscape() {
        let closedSomething = false;

        // 1. Close Gameplay Windows
        if (this.characterSheet.style.display === 'block') {
            this.characterSheet.style.display = 'none';
            closedSomething = true;
        }
        if (this.inventory.inventoryScreen.style.display === 'block') {
            this.inventory.inventoryScreen.style.display = 'none';
            closedSomething = true;
        }
        
        // Check World Map (accessed via DOM directly as UIManager doesn't own the class instance)
        const worldMap = document.getElementById('world-map');
        if (worldMap && (worldMap.style.display === 'flex' || worldMap.style.display === 'block')) {
            worldMap.style.display = 'none';
            closedSomething = true;
        }

        // Close Shop
        if (this.inventory.shopScreen.style.display === 'flex') {
            this.inventory.shopScreen.style.display = 'none';
            closedSomething = true;
        }

        // Close Stash
        if (this.inventory.stashScreen.style.display === 'flex') {
            this.inventory.stashScreen.style.display = 'none';
            closedSomething = true;
        }

        // Close Trading House
        if (this.trading.isOpen) {
            this.trading.close();
            closedSomething = true;
        }

        // Close Forge
        if (this.forge.isOpen) {
            this.forge.close();
            closedSomething = true;
        }

        // Close Quest Window (NPC)
        if (this.quest.isQuestWindowOpen) {
            this.quest.closeQuestWindow();
            closedSomething = true;
        }

        // Close Quest Journal
        if (this.quest.isJournalOpen) {
            this.quest.closeJournal();
            closedSomething = true;
        }

        // Close Skill Tree
        if (this.skillTree.isOpen) {
            this.skillTree.close();
            closedSomething = true;
        }

        // Close Abilities Menu
        if (this.abilitiesMenu.style.display === 'flex') {
            this.abilitiesMenu.style.display = 'none';
            closedSomething = true;
        }

        // Close Social
        if (this.social.isOpen) {
            this.social.close();
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

        this.inventory.updateEquipSlot('slot-head', player.equipment.head, 'HEAD');
        this.inventory.updateEquipSlot('slot-shoulders', player.equipment.shoulders, 'SHOULDERS');
        this.inventory.updateEquipSlot('slot-chest', player.equipment.chest, 'CHEST');
        this.inventory.updateEquipSlot('slot-belt', player.equipment.belt, 'BELT');
        this.inventory.updateEquipSlot('slot-legs', player.equipment.legs, 'LEGS');
        this.inventory.updateEquipSlot('slot-feet', player.equipment.feet, 'FEET');
        this.inventory.updateEquipSlot('slot-gloves', player.equipment.gloves, 'GLOVES');
        this.inventory.updateEquipSlot('slot-neck', player.equipment.neck, 'NECK');
        this.inventory.updateEquipSlot('slot-mainhand', player.equipment.mainHand, 'MAIN HAND', 'mainHand');
        this.inventory.updateEquipSlot('slot-offhand', player.equipment.offHand, 'OFF HAND', 'offHand');
        this.inventory.updateEquipSlot('slot-ring1', player.equipment.ring1, 'RING 1');
        this.inventory.updateEquipSlot('slot-ring2', player.equipment.ring2, 'RING 2');
        this.inventory.updateEquipSlot('slot-trinket1', player.equipment.trinket1, 'TRINKET 1');
        this.inventory.updateEquipSlot('slot-trinket2', player.equipment.trinket2, 'TRINKET 2');
    }

    updateEquipSlot(id, item, placeholder, serverSlotName) { this.inventory.updateEquipSlot(id, item, placeholder, serverSlotName); }

    updateInventory(player) { this.inventory.updateInventory(player); }

    updateStash(player) { this.inventory.updateStash(player); }

    getItemTooltipText(item) { return this.inventory.getItemTooltipText(item); }


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
            // .mobile-mode is kept in sync with viewport width via matchMedia
            // listener in main.js, so checking the class is sufficient.
            const isMobile = document.body.classList.contains('mobile-mode');
            
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
    
    formatSetBonus(bonus) { return this.inventory.formatSetBonus(bonus); }
    getOrderedItemStatKeys(stats) { return this.inventory.getOrderedItemStatKeys(stats); }
    showItemTooltip(item, x, y, event) { this.inventory.showItemTooltip(item, x, y, event); }
    sellItem(player, index) { this.inventory.sellItem(player, index); }
    setupShop() { this.inventory.setupShop(); }
    buyGambleItem(slot) { this.inventory.buyGambleItem(slot); }
    hideTooltips() { this.inventory.hideTooltips(); }

    // --- Social delegates (SocialUI module) ---
    /** @returns {Object|null} current party data (used by WorldMap / Minimap) */
    get partyData() { return this.social.partyData; }
    toggleSocial(show) { this.social.toggleSocial(show); }
    updateSocialList(players) { this.social.updateSocialList(players); }
    updateParty(partyData) { this.social.updateParty(partyData); }
    showPartyRequest(inviterName) { this.social.showPartyRequest(inviterName); }
    hidePartyRequest() { this.social.hidePartyRequest(); }

    setupItemDragAndDrop(element, type, indexOrSlot, item) { this.inventory.setupItemDragAndDrop(element, type, indexOrSlot, item); }
    handleItemDrop(source, target) { this.inventory.handleItemDrop(source, target); }

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
        this.skillTree.showRespecMenu();
    }

}
