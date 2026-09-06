import { RARITY } from '../core/ItemSystem.js';
import { CONSTANTS } from '../core/Constants.js';
import { ForgeUI } from './ForgeUI.js';
import { SkillTreeUI } from './SkillTreeUI.js';
import { TradingUI } from './TradingUI.js';
import { QuestUI } from './QuestUI.js';
import { SocialUI } from './SocialUI.js';
import { InventoryUI } from './InventoryUI.js';
import { CharacterPreview } from './CharacterPreview.js';
import { ChatUI } from './ChatUI.js';
import { DirectTradeUI } from './DirectTradeUI.js';
import { PvPUI } from './PvPUI.js';
import { AssetCacheManager } from '../assets/AssetCacheManager.js';
import { AudioManager } from '../audio/AudioManager.js';
import { getProceduralAbilityIcon, getProceduralItemIcon } from '../art/ProceduralIcons.js';
import { installUIManagerFeedback } from './UIManagerFeedback.js';
import { installUIManagerWindows } from './UIManagerWindows.js';
import { installUIManagerSettings } from './UIManagerSettings.js';
import { installUIManagerCharacter } from './UIManagerCharacter.js';
import { installUIManagerDungeon } from './UIManagerDungeon.js';

export class UIManager {
    constructor(isMobile = false, options = {}) {
        this.isMobile = isMobile;
        this.audioManager = options.audioManager || new AudioManager();
        this.hud = document.getElementById('player-hud');
        this.hpBar = document.getElementById('player-hp-bar');
        this.hpText = document.getElementById('player-hp-text');
        this.manaBar = document.getElementById('player-mana-bar');
        this.manaText = document.getElementById('player-mana-text');

        this.floatingBars = new Map(); // Entity ID -> DOM Element
        this.uiLayer = document.getElementById('ui-layer');
        this.gameTimer = document.getElementById('game-timer');
        this.connIndicator = document.getElementById('conn-indicator');
        this.combatIntentPanel = document.getElementById('combat-intent-panel');
        this.combatIntentName = document.getElementById('combat-intent-name');
        this.combatIntentMeta = document.getElementById('combat-intent-meta');
        this.combatIntentStatus = document.getElementById('combat-intent-status');
        this.combatIntentPreviewBasic = document.getElementById('combat-intent-preview-basic');
        this.combatIntentPreviewAbility = document.getElementById('combat-intent-preview-ability');
        this.combatIntentPreviewAbilityLabel = document.getElementById('combat-intent-preview-ability-label');
        this.dungeonEntranceHint = document.getElementById('dungeon-entrance-hint');
        this.dungeonEntranceHintName = document.getElementById('dungeon-entrance-hint-name');
        this.dungeonEntranceHintStatus = document.getElementById('dungeon-entrance-hint-status');
        this.dungeonEntranceHintPrompt = document.getElementById('dungeon-entrance-hint-prompt');
        this.lastCombatIntentSignature = '';
        this.lastDungeonEntranceHintSignature = '';
        this.lastPlayerStatsSignature = '';
        this.lastXpSignature = '';
        this.lastHotbarCooldownSignature = '';
        this.lastCharacterSheetSignature = '';
        this.serverEpochSeconds = 0;

        // New UI Elements
        this.xpBar = document.getElementById('xp-bar-fill');
        this.xpText = document.getElementById('xp-text');
        this.characterSheet = document.getElementById('character-sheet');
        this.statsContent = document.getElementById('stats-content');
        const previewHost = document.getElementById('character-preview');
        this.characterPreview = previewHost ? new CharacterPreview(previewHost) : null;

        // Quest UI (extracted module)
        this.quest = new QuestUI({
            getLastPlayer: () => this.lastPlayerRef,
            getDungeonRoomSummary: () => window.game?.getDungeonRoomSummary?.() || null,
            getCurrentInstanceId: () => window.game?.currentInstanceId || null,
            getCurrentInstanceType: () => window.game?.currentInstanceType || null,
            getOnboardingRecoveryContext: () => window.game?.getOnboardingRecoveryContext?.() || null,
            getServerEpochSeconds: () => this.serverEpochSeconds,
            closePrimaryHudMenus: (options) => this.closePrimaryHudMenus(options),
            toggleManagedWindow: (id, options) => this.toggleManagedWindow(id, options),
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
        this.btnCloseHelpHeader = document.getElementById('btn-close-help-header');
        this.btnCloseSettings = document.getElementById('btn-close-settings');
        this.btnCloseSettingsHeader = document.getElementById('btn-close-settings-header');
        this.btnClosePatchNotes = document.getElementById('btn-close-patch-notes');
        this.btnClosePatchNotesHeader = document.getElementById('btn-close-patch-notes-header');
        this.btnCloseReportHeader = document.getElementById('btn-close-report-header');
        this.btnCloseCharacter = document.getElementById('btn-close-character');
        this.btnRespawn = document.getElementById('btn-respawn');
        this.btnRecall = document.getElementById('btn-recall');

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
            },
            toggleManagedWindow: (id, options) => this.toggleManagedWindow(id, options),
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
        this.uiScaleSlider = document.getElementById('ui-scale');
        this.uiScaleValue = document.getElementById('ui-scale-value');
        this.controlHintLevelSelect = document.getElementById('control-hint-level');
        this.keyboardReferenceGuide = document.getElementById('help-keyboard-reference');
        this.autoLootToggle = document.getElementById('auto-loot-enabled');
        this.audioEnabledToggle = document.getElementById('audio-enabled');
        this.audioVolumeSlider = document.getElementById('audio-volume');
        this.audioVolumeValue = document.getElementById('audio-volume-value');
        this.audioDetailSelect = document.getElementById('audio-detail-level');
        this.cameraShakeToggle = document.getElementById('camera-shake-enabled');
        this.fullscreenToggle = document.getElementById('fullscreen-enabled');
        this.btnDownloadCoreAssets = document.getElementById('btn-download-core-assets');
        this.btnDownloadDungeonAssets = document.getElementById('btn-download-dungeon-assets');
        this.btnDownloadEnvironmentAssets = document.getElementById('btn-download-environment-assets');
        this.btnDownloadRecommendedAssets = document.getElementById('btn-download-recommended-assets');
        this.btnRefreshOutdatedAssets = document.getElementById('btn-refresh-outdated-assets');
        this.btnUpdateCachedAssets = document.getElementById('btn-update-cached-assets');
        this.btnClearCachedAssets = document.getElementById('btn-clear-cached-assets');
        this.assetDownloadStatus = document.getElementById('asset-download-status');
        this.assetDownloadProgress = document.getElementById('asset-download-progress');
        this.assetDownloadProgressBar = document.getElementById('asset-download-progress-bar');
        this.assetCacheStateDetail = document.getElementById('asset-cache-state-detail');
        this.assetLastSyncedVersion = document.getElementById('asset-last-synced-version');
        this.assetPackCoreBadge = document.getElementById('asset-pack-core-badge');
        this.assetPackCoreStatus = document.getElementById('asset-pack-core-status');
        this.assetPackCoreSize = document.getElementById('asset-pack-core-size');
        this.assetPackCoreVersion = document.getElementById('asset-pack-core-version');
        this.assetPackDungeonBadge = document.getElementById('asset-pack-dungeon-badge');
        this.assetPackDungeonStatus = document.getElementById('asset-pack-dungeon-status');
        this.assetPackDungeonSize = document.getElementById('asset-pack-dungeon-size');
        this.assetPackDungeonVersion = document.getElementById('asset-pack-dungeon-version');
        this.assetPackEnvironmentBadge = document.getElementById('asset-pack-environment-badge');
        this.assetPackEnvironmentStatus = document.getElementById('asset-pack-environment-status');
        this.assetPackEnvironmentSize = document.getElementById('asset-pack-environment-size');
        this.assetPackEnvironmentVersion = document.getElementById('asset-pack-environment-version');

        if (this.btnResume) this.btnResume.addEventListener('click', () => this.toggleEscMenu());
        for (const [id, open] of [
            ['btn-phone-skills', () => this.toggleSkillTree()],
            ['btn-phone-abilities', () => this.toggleAbilitiesMenu()]
        ]) {
            document.getElementById(id)?.addEventListener('click', () => {
                if (this.escMenu?.style.display !== 'none') this.toggleEscMenu();
                open();
            });
        }
        if (this.btnHelp) this.btnHelp.addEventListener('click', () => this.toggleHelp());
        if (this.btnSettings) this.btnSettings.addEventListener('click', () => this.toggleSettings());
        if (this.btnPatchNotes) this.btnPatchNotes.addEventListener('click', () => this.togglePatchNotes());
        if (this.btnReport) this.btnReport.addEventListener('click', () => this.toggleReport());
        if (this.btnMenu) this.btnMenu.addEventListener('click', () => location.reload());
        if (this.btnCloseHelp) this.btnCloseHelp.addEventListener('click', () => this.toggleHelp());
        if (this.btnCloseHelpHeader) this.btnCloseHelpHeader.addEventListener('click', () => this.toggleHelp());
        if (this.btnCloseSettings) this.btnCloseSettings.addEventListener('click', () => this.toggleSettings());
        if (this.btnCloseSettingsHeader) this.btnCloseSettingsHeader.addEventListener('click', () => this.toggleSettings());
        if (this.btnClosePatchNotes) this.btnClosePatchNotes.addEventListener('click', () => this.togglePatchNotes());
        if (this.btnClosePatchNotesHeader) this.btnClosePatchNotesHeader.addEventListener('click', () => this.togglePatchNotes());
        if (this.btnCloseReportHeader) this.btnCloseReportHeader.addEventListener('click', () => this.toggleReport());
        if (this.btnCloseCharacter) this.btnCloseCharacter.addEventListener('click', () => this.toggleCharacterSheet());

        this.onGraphicsQualityChange = null;
        this.onBrightnessChange = null;
        this.onUiScaleChange = null;
        this.onControlHintLevelChange = null;
        this.onAutoLootChange = null;
        this.onAudioEnabledChange = null;
        this.onAudioVolumeChange = null;
        this.onAudioDetailLevelChange = null;
        this.onCameraShakeChange = null;
        this.onFullscreenChange = null;
        this.onEscMenuChange = null;
        this.onEscMenuClosedByEscape = null;
        this.onAssetDownloadRequest = null;
        this.onAssetCacheClearRequest = null;
        this.assetCacheManager = new AssetCacheManager();
        this.assetLastSyncedVersionValue = localStorage.getItem('eidolon.assetLastSyncedVersion') || null;
        this.assetPackStatuses = {
            'core-models': 'cached',
            'dungeon-models': 'cached',
            'environment-textures': 'cached'
        };
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

        const storedUiScaleValue = localStorage.getItem('eidolon.uiScale');
        const storedUiScale = Number(storedUiScaleValue);
        this.uiScale = storedUiScaleValue !== null && Number.isFinite(storedUiScale)
            ? Math.max(85, Math.min(125, storedUiScale))
            : 100;
        if (this.uiScaleSlider) {
            this.uiScaleSlider.value = String(this.uiScale);
            this.uiScaleSlider.addEventListener('input', () => {
                this.setUiScale(Number(this.uiScaleSlider.value));
            });
        }
        this.applyUiScale();
        this.updateUiScaleLabel();

        this.controlHintLevel = this.normalizeControlHintLevel(localStorage.getItem('eidolon.controlHintLevel'));
        if (this.controlHintLevelSelect) {
            this.controlHintLevelSelect.value = this.controlHintLevel;
            this.controlHintLevelSelect.addEventListener('change', () => {
                this.setControlHintLevel(this.controlHintLevelSelect.value);
            });
        }
        this.applyControlHintLevel();

        const storedAutoLoot = localStorage.getItem('eidolon.autoLootEnabled');
        this.autoLootEnabled = storedAutoLoot === null ? false : storedAutoLoot === 'true';
        if (this.autoLootToggle) {
            this.autoLootToggle.checked = this.autoLootEnabled;
            this.autoLootToggle.addEventListener('change', () => {
                this.setAutoLootEnabled(this.autoLootToggle.checked);
            });
        }

        const audioSettings = this.audioManager.getSettings();
        this.audioEnabled = audioSettings.enabled;
        this.audioVolume = Math.round(audioSettings.volume * 100);
        this.audioDetailLevel = audioSettings.detailLevel || 'full';
        if (this.audioEnabledToggle) {
            this.audioEnabledToggle.checked = this.audioEnabled;
            this.audioEnabledToggle.addEventListener('change', () => {
                this.setAudioEnabled(this.audioEnabledToggle.checked);
            });
        }
        if (this.audioVolumeSlider) {
            this.audioVolumeSlider.value = String(this.audioVolume);
            this.audioVolumeSlider.addEventListener('input', () => {
                this.setAudioVolume(Number(this.audioVolumeSlider.value));
            });
        }
        if (this.audioDetailSelect) {
            this.audioDetailSelect.value = this.audioDetailLevel;
            this.audioDetailSelect.addEventListener('change', () => {
                this.setAudioDetailLevel(this.audioDetailSelect.value);
            });
        }
        this.updateAudioVolumeLabel();

        const storedCameraShake = localStorage.getItem('eidolon.cameraShakeEnabled');
        this.cameraShakeEnabled = storedCameraShake === null ? false : storedCameraShake === 'true';
        if (this.cameraShakeToggle) {
            this.cameraShakeToggle.checked = this.cameraShakeEnabled;
            this.cameraShakeToggle.addEventListener('change', () => {
                this.setCameraShakeEnabled(this.cameraShakeToggle.checked);
            });
        }

        // Friend-online toast setting (0.38.3) — defaults to enabled.
        const storedFriendToast = localStorage.getItem('eidolon.friendOnlineToast');
        this.friendOnlineToastEnabled = storedFriendToast === null ? true : storedFriendToast === 'true';
        // Rate-limit map: username → timestamp of last toast shown.
        this._friendToastLastShown = new Map();
        const storedFullscreen = localStorage.getItem('eidolon.fullscreenEnabled');
        this.fullscreenEnabled = storedFullscreen === null ? false : storedFullscreen === 'true';
        if (this.fullscreenToggle) {
            this.fullscreenToggle.checked = this.fullscreenEnabled;
            this.fullscreenToggle.addEventListener('change', () => {
                this.setFullscreenEnabled(this.fullscreenToggle.checked);
            });
        }
        if (this.btnDownloadCoreAssets) {
            this.btnDownloadCoreAssets.disabled = true;
            this.btnDownloadCoreAssets.textContent = 'Built In';
        }
        if (this.btnDownloadDungeonAssets) {
            this.btnDownloadDungeonAssets.disabled = true;
            this.btnDownloadDungeonAssets.textContent = 'Built In';
        }
        if (this.btnDownloadEnvironmentAssets) {
            this.btnDownloadEnvironmentAssets.disabled = true;
            this.btnDownloadEnvironmentAssets.textContent = 'Built In';
        }
        if (this.btnDownloadRecommendedAssets) {
            this.btnDownloadRecommendedAssets.disabled = true;
            this.btnDownloadRecommendedAssets.textContent = 'All Art Built In';
        }
        if (this.btnRefreshOutdatedAssets) {
            this.btnRefreshOutdatedAssets.addEventListener('click', () => {
                void this.refreshOutdatedAssets();
            });
        }
        if (this.btnUpdateCachedAssets) {
            this.btnUpdateCachedAssets.addEventListener('click', () => {
                void this.updateCachedAssets();
            });
        }
        if (this.btnClearCachedAssets) {
            this.btnClearCachedAssets.addEventListener('click', () => {
                void this.clearCachedAssets();
            });
        }
        this.renderAssetPackEstimates();
        this.renderLastSyncedVersion();
        this.updateAssetDownloadProgress({ completed: 0, total: 0, percent: 0 });
        this.refreshAssetDownloadStatus();
        void this.refreshAssetCacheState();
        // Shop/Stash close buttons are handled inside InventoryUI
        
        // Forge UI — delegated to ForgeUI module
        this.forge = new ForgeUI({
            getItemIconPath: (item) => this.getItemIconPath(item),
            formatStatName: (key) => this.formatStatName(key),
            getLastPlayer: () => this.lastPlayerRef,
            showRespecMenu: () => this.showRespecMenu(),
            inventoryScreen: document.getElementById('inventory-screen'),
            toggleManagedWindow: (id, options) => this.toggleManagedWindow(id, options),
        });

        // Trading House UI — delegated to TradingUI module
        this.trading = new TradingUI({
            getLastPlayer: () => this.lastPlayerRef,
            getItemIconPath: (item) => this.getItemIconPath(item),
            getRarityColor: (rarity) => this.getRarityColor(rarity),
            showItemTooltip: (item, x, y) => this.inventory.showItemTooltip(item, x, y),
            hideTooltips: () => this.inventory.hideTooltips(),
            addChatMessage: (sender, msg) => this.addGameMessage(sender, msg),
            toggleManagedWindow: (id, options) => this.toggleManagedWindow(id, options),
        });

		this.directTrade = new DirectTradeUI({
			getLastPlayer: () => this.lastPlayerRef,
			addGameMessage: (sender, message) => this.addGameMessage(sender, message),
		});

        // Inventory UI (extracted module) — handles inventory grid, equip slots,
        // shop/gamble, stash, item tooltips, drag-and-drop, split-stack, buyback, sell
        this.inventory = new InventoryUI({
            isMobile: this.isMobile,
            getLastPlayer: () => this.lastPlayerRef,
            getItemIconPath: (item) => this.getItemIconPath(item),
            formatStatName: (key) => this.formatStatName(key),
            getRarityColor: (rarity) => this.getRarityColor(rarity),
            addChatMessage: (sender, msg) => this.addGameMessage(sender, msg),
            updateCharacterSheet: (player) => this.updateCharacterSheet(player),
            closePrimaryHudMenus: (options) => this.closePrimaryHudMenus(options),
            toggleManagedWindow: (id, options) => this.toggleManagedWindow(id, options),
            closeManagedGroup: (group, options) => this.closeManagedGroup(group, options),
            clampTooltipToViewport: (element) => this.clampTooltipToViewport(element),
            trading: this.trading,
        });

        if (this.btnRecall) this.btnRecall.addEventListener('click', () => {
            this.onRecall?.();
            this.toggleEscMenu();
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
            }
        });

        // Social UI (extracted module) — must come before setupWindow block
        this.social = new SocialUI({
            getLastPlayer: () => this.lastPlayerRef,
            addChatMessage: (sender, msg) => this.addChatMessage(sender, msg),
            closePrimaryHudMenus: (options) => this.closePrimaryHudMenus(options),
            openManagedWindow: (id, options) => this.openManagedWindow(id, options),
            toggleManagedWindow: (id, options) => this.toggleManagedWindow(id, options),
            closeManagedWindow: (id) => this.closeManagedWindow(id),
        });
        this.pvp = new PvPUI({
            openManagedWindow: (id) => this.openManagedWindow(id),
            closeManagedWindow: (id) => this.closeManagedWindow(id),
        });
        this.createDeathScreen();

        // Setup Windows (Drag & Click Blocking)
        this.setupWindow(this.characterSheet);
        this.setupWindow(this.inventory.inventoryScreen);
        this.setupWindow(this.inventory.shopScreen);
        this.setupWindow(this.inventory.stashScreen);
        this.setupWindow(this.forge.forgeScreen);
        this.setupWindow(this.trading.tradingHouseScreen);
		this.setupWindow(this.directTrade.window);
        this.setupWindow(this.pvp.window);
        this.setupWindow(this.quest.questWindow);
        this.setupWindow(this.quest.questJournal);
        this.setupWindow(this.helpScreen);
        this.setupWindow(this.settingsScreen);
        this.setupWindow(this.patchNotesScreen);
        this.setupWindow(this.reportScreen);
        this.setupWindow(this.social.socialWindow);
        this.setupWindow(this.skillTree.skillTreeWindow);
        this.setupWindow(this.abilitiesMenu);

        if (this.social.partyPanel) this.setupWindow(this.social.partyPanel);
        this.registerWindowLayouts();
        window.addEventListener('resize', () => this.reflowVisibleWindows());
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.reflowVisibleWindows());
        }

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
        this.btnMenuPvP = document.getElementById('btn-menu-pvp');
        this.btnMenuInventory = document.getElementById('btn-menu-inventory');
        this.btnMenuCharacter = document.getElementById('btn-menu-character');
        this.btnMenuQuest = document.getElementById('btn-menu-quest');
        this.btnMenuSkills = document.getElementById('btn-menu-skills');

        if (this.btnMenuMap) this.btnMenuMap.addEventListener('click', () => this.toggleWorldMap());
        if (this.btnMenuSocial) this.btnMenuSocial.addEventListener('click', () => this.toggleSocial());
        if (this.btnMenuPvP) this.btnMenuPvP.addEventListener('click', () => this.pvp.toggle());
        if (this.btnMenuInventory) this.btnMenuInventory.addEventListener('click', () => this.toggleInventory());
        if (this.btnMenuCharacter) this.btnMenuCharacter.addEventListener('click', () => this.toggleCharacterSheet());
        if (this.btnMenuQuest) this.btnMenuQuest.addEventListener('click', () => this.toggleJournal());
        if (this.btnMenuSkills) this.btnMenuSkills.addEventListener('click', () => this.toggleSkillTree());
        const btnCloseWorldMap = document.getElementById('btn-close-world-map');
        if (btnCloseWorldMap) btnCloseWorldMap.addEventListener('click', () => this.toggleWorldMap());
        this.setupAudioInteractionCues();

        // Event Delegation for Stat Buttons & Tooltips
        this.statsContent.addEventListener('click', (e) => {
            if (e.target.classList.contains('stat-btn')) {
                const stat = e.target.dataset.stat;
                if (this.onStatUpgrade) {
                    this.onStatUpgrade(stat);
                }
            }
			const resonanceButton = e.target.closest?.('[data-resonance-trait]');
			if (resonanceButton && !resonanceButton.disabled) {
				this.onResonanceSpend?.(resonanceButton.dataset.resonanceTrait);
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
        this.chat = new ChatUI({
            onSend: (message) => this.onChatSend?.(message)
        });
        this.chatBox = this.chat.chatBox;
        this.chatMessages = this.chat.messages;
        this.chatInput = this.chat.input;

        // Global Enter to open chat
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Let native controls handle activation/submission before the
                // gameplay shortcut. Otherwise Enter steals focus from menus.
                if (!this.chatInput?.isConnected || e.defaultPrevented || document.activeElement?.closest('button, input, textarea, select, a[href], [contenteditable]:not([contenteditable="false"])')) return;
                if (this.chatInput && document.activeElement !== this.chatInput) {
                    e.preventDefault(); // Prevent other actions
                    this.chat.focusChatInput();
                }
            }
        });

        this.isHelpOpen = false;
        
        this.onStatUpgrade = null;
        this.onResonanceSpend = null;
        this.onRespawn = null;
        this.onRecall = null;
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

    updatePlayerStats(player) {
        if (!player) return;
        this.lastPlayerRef = player;
        const signature = this.serializePlayerStats(player);
        if (signature === this.lastPlayerStatsSignature) {
            return;
        }
        this.lastPlayerStatsSignature = signature;
        
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

    serializePlayerStats(player) {
        const stats = player?.stats || {};
        return [
            Math.ceil(stats.hp ?? 0),
            stats.maxHp ?? 0,
            Math.floor(stats.mana ?? 0),
            stats.maxMana ?? 0,
            player?.abilityName || '',
            player?.abilityDescription || '',
            player?.abilityCooldown > 0 ? Math.ceil(player.abilityCooldown) : 0,
            player?.abilityManaCost ?? 0,
            stats.manaCostReduction ?? 0,
            player?.subType || player?.meshType || ''
        ].join('|');
    }

    getSkillIconPath(skillName, classType) {
        if (!skillName || !classType) return null;
        return getProceduralAbilityIcon(classType, skillName);
    }

    getItemIconPath(item) {
        return getProceduralItemIcon(item);
    }

    getGemIconPath(item) {
        return getProceduralItemIcon(item);
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
    toggleQuestWindow(kind) { this.quest.toggleQuestWindow(kind); }
    toggleJournal() { this.quest.toggleJournal(); }
    updateQuestWindow(quests) { this.quest.updateQuestWindow(quests); }
    updateJournal(quests) { this.quest.updateJournal(quests); }

    toggleSkillTree() {
        const isOpening = !this.skillTree.isOpen;
        if (isOpening && !this.windowLayouts) {
            this.closePrimaryHudMenus({ except: 'skills' });
        }
        this.skillTree.toggle();
    }

    toggleWorldMap() {
        const worldMap = document.getElementById('world-map');
        if (!worldMap || !this.onMapToggle) {
            return;
        }

        const isOpening = worldMap.style.display === 'none' || worldMap.style.display === '';
        if (isOpening) {
            if (this.windowLayouts) {
                this.closeManagedGroup('primary', { except: 'map' });
            } else {
                this.closePrimaryHudMenus({ except: 'map' });
            }
        }
        this.onMapToggle();
        this.reflowVisibleWindows();
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
        if (!this.abilitiesMenu) {
            return;
        }

        const isHidden = this.abilitiesMenu.style.display === 'none' || this.abilitiesMenu.style.display === '';
        this.toggleManagedWindow('abilities');

        if (isHidden && this.lastPlayerRef) {
            const classType = this.lastPlayerRef.subType || this.lastPlayerRef.meshType;
            if (classType) {
                this.renderAbilitiesMenu(classType);
            }
        }
    }

    renderAbilitiesMenu(classType) {
        void classType;
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
        this.statTooltipTitle.textContent = skillName;
        this.statTooltipTitle.style.color = '#ffd700';
        this.setTooltipDescription([desc], details.join(' | '));
        
        this.statTooltip.style.display = 'block';
        this.statTooltip.style.left = `${x}px`;
        this.statTooltip.style.top = `${y - this.statTooltip.offsetHeight}px`; // Show above
        
        // Adjust if off screen
        const rect = this.statTooltip.getBoundingClientRect();
        if (rect.top < 0) {
            this.statTooltip.style.top = `${y + 50}px`; // Show below if no space above
        }
        this.clampTooltipToViewport(this.statTooltip);
    }

    clampTooltipToViewport(element, margin = 10) {
        if (!element || element.style.display === 'none') return;
        const rect = element.getBoundingClientRect();
        let left = rect.left;
        let top = rect.top;

        if (rect.right > window.innerWidth - margin) {
            left = window.innerWidth - rect.width - margin;
        }
        if (rect.bottom > window.innerHeight - margin) {
            top = window.innerHeight - rect.height - margin;
        }
        if (left < margin) left = margin;
        if (top < margin) top = margin;

        element.style.left = `${Math.round(left)}px`;
        element.style.top = `${Math.round(top)}px`;
    }

    assignSkillToSlot(slotIndex, skillName) {
        const slot = this.hotbarSlots[slotIndex];
        const icon = slot.querySelector('.hotbar-icon');
        this.lastHotbarCooldownSignature = '';
        
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

        const signature = this.serializeHotbarCooldowns(player);
        if (signature === this.lastHotbarCooldownSignature) {
            return;
        }
        this.lastHotbarCooldownSignature = signature;

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

    serializeHotbarCooldowns(player) {
        return this.hotbarSlots.map((_, index) => {
            const skillName = player?.hotbar?.[index] || '';
            if (!skillName) {
                return `${index}:empty`;
            }

            let cooldown = 0;
            if (player.cooldowns && player.cooldowns[skillName] > 0) {
                cooldown = player.cooldowns[skillName];
            } else if (skillName === player.abilityName && player.abilityCooldown > 0) {
                cooldown = player.abilityCooldown;
            }

            return `${index}:${skillName}:${cooldown > 0 ? Math.ceil(cooldown) : 0}`;
        }).join('|');
    }

    toggleShop() { this.inventory.toggleShop(); }
    switchShopTab(tab) { this.inventory.switchShopTab(tab); }
    updateBuybackList(items) { this.inventory.updateBuybackList(items); }

    handleEscape() {
        // The topmost generated dialog owns Escape; closing it must not also
        // open the pause menu underneath or dismiss other gameplay windows.
        const dungeonDialog = document.getElementById('dungeon-menu-backdrop');
        if (typeof dungeonDialog?.__closeMenu === 'function') {
            dungeonDialog.__closeMenu();
            return;
        }
        let closedSomething = false;

        // Chat is a permanent gameplay surface. Escape may release keyboard
        // focus, but it must never dismiss the transcript.
        this.chatInput?.blur();

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

        if (this.inventory.splitStackWindow?.style.display === 'block') {
            this.inventory.hideSplitWindow();
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
        if (this.closeOpenStaticModal()) {
            closedSomething = true;
        }

        // 3. If nothing was closed, Toggle ESC Menu
        // (If ESC menu is already open, this will close it. If closed, it will open it.)
        if (!closedSomething) {
            this.toggleEscMenu();
        }
    }

    toggleSocial(show) { this.social.toggleSocial(show); }
    updateSocialList(players) { this.social.updateSocialList(players); }
    updateParty(partyData) { this.social.updateParty(partyData); }
    showPartyRequest(inviterName) { this.social.showPartyRequest(inviterName); }
    hidePartyRequest() { this.social.hidePartyRequest(); }

    setupItemDragAndDrop(element, type, indexOrSlot, item) { this.inventory.setupItemDragAndDrop(element, type, indexOrSlot, item); }
    handleItemDrop(source, target) { this.inventory.handleItemDrop(source, target); }


}

installUIManagerFeedback(UIManager);
installUIManagerWindows(UIManager);
installUIManagerSettings(UIManager);
installUIManagerCharacter(UIManager);
installUIManagerDungeon(UIManager);
