import { ItemGenerator, SLOTS, Item, BASE_ITEMS } from '../core/ItemSystem.js';
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
        this.patchNotesScreen = document.getElementById('patch-notes-screen');
        
        this.btnResume = document.getElementById('btn-resume');
        this.btnHelp = document.getElementById('btn-help');
        this.btnPatchNotes = document.getElementById('btn-patch-notes');
        this.btnReport = document.getElementById('btn-report');
        this.btnMenu = document.getElementById('btn-menu');
        this.btnCloseHelp = document.getElementById('btn-close-help');
        this.btnClosePatchNotes = document.getElementById('btn-close-patch-notes');
        this.btnRespawn = document.getElementById('btn-respawn');
        this.btnCloseShop = document.getElementById('btn-close-shop');
        this.btnCloseStash = document.getElementById('btn-close-stash');
        
        // Skill Tree UI
        this.skillTreeWindow = document.getElementById('skill-tree-window');
        this.skillTreeContent = document.getElementById('skill-tree-content');
        this.btnCloseSkillTree = document.getElementById('btn-close-skills');
        
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

        this.btnSellCommon = document.getElementById('btn-sell-common');
        this.btnSellUncommon = document.getElementById('btn-sell-uncommon');
        this.btnSellRare = document.getElementById('btn-sell-rare');

        if (this.btnResume) this.btnResume.addEventListener('click', () => this.toggleEscMenu());
        if (this.btnHelp) this.btnHelp.addEventListener('click', () => this.toggleHelp());
        if (this.btnPatchNotes) this.btnPatchNotes.addEventListener('click', () => this.togglePatchNotes());
        if (this.btnReport) this.btnReport.addEventListener('click', () => this.toggleReport());
        if (this.btnMenu) this.btnMenu.addEventListener('click', () => location.reload());
        if (this.btnCloseHelp) this.btnCloseHelp.addEventListener('click', () => this.toggleHelp());
        if (this.btnClosePatchNotes) this.btnClosePatchNotes.addEventListener('click', (e) => {
            console.log("Close Patch Notes Button Clicked");
            this.togglePatchNotes();
            e.stopPropagation();
        });
        if (this.btnCloseShop) this.btnCloseShop.addEventListener('click', () => this.toggleShop());
        if (this.btnCloseStash) this.btnCloseStash.addEventListener('click', () => this.toggleStash());
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
        this.btnMenuSkills = document.getElementById('btn-menu-skills');

        if (this.btnMenuMap) this.btnMenuMap.addEventListener('click', () => {
            if (this.onMapToggle) this.onMapToggle();
        });
        if (this.btnMenuSocial) this.btnMenuSocial.addEventListener('click', () => this.toggleSocial());
        if (this.btnMenuInventory) this.btnMenuInventory.addEventListener('click', () => this.toggleInventory());
        if (this.btnMenuCharacter) this.btnMenuCharacter.addEventListener('click', () => this.toggleCharacterSheet());
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
            this.hideDeathScreen();
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
        if (this.menuBar) this.menuBar.style.display = 'flex';
        
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
        return `assets/icons/${formattedClass}/${formattedName}.png`;
    }

    getItemIconPath(item) {
        if (!item) return null;
        
        if (item.icon) {
            return item.icon;
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
        return `assets/icons/equipment/${formattedName}.png`;
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

        entities.forEach(entity => {
            // Only show for enemies (not player) and if alive. Also skip entities without stats (like projectiles).
            if (entity.id.startsWith('player') || !entity.stats || entity.stats.hp <= 0) return;

            const isHovered = (hoveredEntity && hoveredEntity.id === entity.id);
            const shouldShow = isAltPressed || isHovered;

            if (shouldShow) {
                activeIds.add(entity.id);
                let bar = this.floatingBars.get(entity.id);
                
                // Create if missing
                if (!bar) {
                    bar = this.createFloatingBar();
                    this.floatingBars.set(entity.id, bar);
                    this.uiLayer.appendChild(bar);
                }

                // Update Position
                this.updateBarPosition(bar, entity, camera);
                
                // Update Fill
                const fill = bar.querySelector('.floating-fill');
                const pct = (entity.stats.hp / entity.stats.maxHp) * 100;
                fill.style.width = `${Math.max(0, pct)}%`;
                
                bar.style.display = 'block';
            }
        });

        // 2. Hide/Remove unused bars
        for (const [id, bar] of this.floatingBars) {
            if (!activeIds.has(id)) {
                bar.style.display = 'none';
                // Optional: Remove from DOM if we want to save memory, 
                // but keeping them pooled is better for performance if they reappear.
            }
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
            this.updateInventory(this.lastPlayerRef);
        }
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
        
        const treeData = CONSTANTS.SKILL_TREES[classType];
        if (!treeData) {
            this.skillTreeContent.innerHTML = `<div style="text-align:center; color:#aaa; margin-top:50px;">No skill tree data for ${classType}</div>`;
            return;
        }

        const player = this.lastPlayerRef;
        const selectedBranch = player ? (player.selectedBranch || "") : "";
        const unlockedSkills = player ? (player.unlockedSkills || []) : [];
        const playerLevel = player ? player.level : 1;

        this.skillTreeContent.innerHTML = '';
        
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
                
                const isUnlocked = skill && unlockedSkills.includes(skill.name);
                if (isUnlocked) {
                    node.classList.add('unlocked');
                    node.style.borderColor = '#00ff00';
                }

                const nodeTitle = document.createElement('div');
                nodeTitle.className = 'skill-node-title';
                nodeTitle.textContent = skill ? skill.name : `Tier ${i} ???`;
                
                const nodeDesc = document.createElement('div');
                nodeDesc.className = 'skill-node-desc';
                nodeDesc.textContent = skill ? skill.desc : 'Coming Soon...';
                
                const reqLevel = (i - 1) * 10;
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

                node.appendChild(nodeTitle);
                node.appendChild(nodeDesc);
                node.appendChild(levelReqDiv);

                branchDiv.appendChild(node);
            }
            
            container.appendChild(branchDiv);
        });
        
        this.skillTreeContent.appendChild(container);
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
        const hotbarSkills = player.unlockedSkills ? player.unlockedSkills.filter(s => s !== baseAbility) : [];

        // Slots 1-4 (Keys 1-4) are unlocked skills
        hotbarSkills.forEach((skillName, index) => {
            if (index < 4) {
                // Assign to Slot 0, 1, 2, 3 (Keys 1, 2, 3, 4)
                this.assignSkillToSlot(index, skillName);
            }
        });
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

            // Disable Left Click
            slot.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Do nothing
            });

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

        this.statTooltipTitle.textContent = skillName;
        this.statTooltipTitle.style.color = '#ffd700';
        this.statTooltipDesc.innerHTML = `<div style="color: #ccc;">${desc}</div>`;
        
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

            if (!q.accepted) {
                statusText = `<div style="color: #ffd700; font-weight: bold;">Daily: Kill ${q.maxCount} ${q.target}s</div>`;
                btnHtml = `<button class="menu-btn" style="margin-top: 5px; background: #4CAF50; border-color: #45a049;">Accept Quest</button>`;
            } else if (q.accepted && !q.completed && q.count >= q.maxCount) {
                // Ready to turn in (Client side check, server sets completed on turn in)
                // Wait, server sets Completed=true ONLY when PerformCompleteQuest is called.
                // So here q.completed is false, but count >= maxCount.
                statusText = `<div style="color: #4CAF50; font-weight: bold;">COMPLETE: Kill ${q.maxCount} ${q.target}s</div>`;
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

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #fff; font-weight: bold;">Kill ${q.target}s</span>
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
            this.patchNotesScreen.style.display = 'none';
            this.reportScreen.style.display = 'none';
        }
    }

    toggleHelp() {
        const isHidden = this.helpScreen.style.display === 'none' || this.helpScreen.style.display === '';
        this.helpScreen.style.display = isHidden ? 'block' : 'none';
        if (!isHidden) {
            this.patchNotesScreen.style.display = 'none'; // Close other windows
            this.reportScreen.style.display = 'none';
        }
    }
    togglePatchNotes() {
        console.log("Toggling Patch Notes");
        const isHidden = this.patchNotesScreen.style.display === 'none' || this.patchNotesScreen.style.display === '';
        this.patchNotesScreen.style.display = isHidden ? 'flex' : 'none'; // Flex for layout
        if (isHidden) {
            this.helpScreen.style.display = 'none'; // Close other windows
            this.reportScreen.style.display = 'none';
        }
    }

    toggleReport() {
        const isHidden = this.reportScreen.style.display === 'none' || this.reportScreen.style.display === '';
        this.reportScreen.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            this.helpScreen.style.display = 'none';
            this.patchNotesScreen.style.display = 'none';
        }
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
        if (this.reportScreen.style.display === 'block') {
            this.reportScreen.style.display = 'none';
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
            <div style="margin-bottom: 10px;">
                <div><strong>Level:</strong> ${player.level}</div>
                <div><strong>XP:</strong> ${player.xp} / ${player.xpToNextLevel}</div>
                ${showPoints ? `<div style="color: #ffd700;"><strong>Points:</strong> ${player.statPoints}</div>` : ''}
            </div>
            <div style="margin-bottom: 10px; border-top: 1px solid #444; padding-top: 5px;">
                <div><strong>HP:</strong> ${Math.ceil(player.stats.hp)} / ${player.stats.maxHp}</div>
                <div><strong>Mana:</strong> ${Math.ceil(player.stats.mana)} / ${player.stats.maxMana}</div>
            </div>
            <div style="margin-bottom: 10px; border-top: 1px solid #444; padding-top: 5px;">
                <div class="stat-row" data-stat-name="strength"><strong>STR:</strong> ${fmtStat('strength')} <button class="stat-btn" data-stat="strength" style="${btnStyle}">+</button></div>
                <div class="stat-row" data-stat-name="dexterity"><strong>DEX:</strong> ${fmtStat('dexterity')} <button class="stat-btn" data-stat="dexterity" style="${btnStyle}">+</button></div>
                <div class="stat-row" data-stat-name="intelligence"><strong>INT:</strong> ${fmtStat('intelligence')} <button class="stat-btn" data-stat="intelligence" style="${btnStyle}">+</button></div>
                <div class="stat-row" data-stat-name="vitality"><strong>VIT:</strong> ${fmtStat('vitality')} <button class="stat-btn" data-stat="vitality" style="${btnStyle}">+</button></div>
                <div class="stat-row" data-stat-name="wisdom"><strong>WIS:</strong> ${fmtStat('wisdom')} <button class="stat-btn" data-stat="wisdom" style="${btnStyle}">+</button></div>
            </div>
            <div style="border-top: 1px solid #444; padding-top: 5px;">
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
        this.updateEquipSlot('slot-mainhand', player.equipment.mainHand, 'MAIN HAND');
        this.updateEquipSlot('slot-offhand', player.equipment.offHand, 'OFF HAND');
        this.updateEquipSlot('slot-ring1', player.equipment.ring1, 'RING 1');
        this.updateEquipSlot('slot-ring2', player.equipment.ring2, 'RING 2');
        this.updateEquipSlot('slot-trinket1', player.equipment.trinket1, 'TRINKET 1');
        this.updateEquipSlot('slot-trinket2', player.equipment.trinket2, 'TRINKET 2');
    }

    updateEquipSlot(id, item, placeholder) {
        const el = document.getElementById(id);
        if (el) {
            el._item = item; // Store item for tooltip
            el.innerHTML = ''; // Clear text/children
            
            if (item) {
                const iconPath = this.getItemIconPath(item);
                const color = item.rarity ? item.rarity.color : '#ffffff';
                const isEidolic = item.rarity && item.rarity.name === 'Eidolic';
                
                if (isEidolic) {
                    el.innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>`;
                    el.style.border = `2px solid ${color}`;
                    el.style.boxShadow = `0 0 5px ${color}`;
                } else {
                    // Use multiply blend mode to tint the background
                    el.innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-color:${color}; background-blend-mode:multiply; background-size:contain; background-repeat:no-repeat; background-position:center;"></div>`;
                    el.style.border = `1px solid ${color}`;
                    el.style.boxShadow = 'none';
                }
                
                el.style.color = color;
                el.style.borderColor = color;
                // el.title = this.getItemTooltipText(item); // Disable native tooltip
                el.removeAttribute('title');
            } else {
                el.textContent = placeholder;
                el.style.color = '#666';
                el.style.borderColor = '#444';
                el.title = 'Empty Slot';
            }
        }
    }

    updateInventory(player) {
        if (!player) return;
        this.lastPlayerRef = player;

        // Update Gold
        if (this.goldDisplay) {
            this.goldDisplay.textContent = `GOLD: ${player.gold || 0}`;
        }

        const slots = this.inventoryGrid.children;
        for (let i = 0; i < slots.length; i++) {
            const item = player.inventory[i];
            slots[i]._item = item; // Store item for tooltip
            slots[i].innerHTML = ''; // Clear
            
            if (item) {
                const iconPath = this.getItemIconPath(item);
                const color = item.rarity ? item.rarity.color : '#ffffff';
                const isEidolic = item.rarity && item.rarity.name === 'Eidolic';
                
                let stackHtml = '';
                if (item.stack > 1) {
                    stackHtml = `<div style="position:absolute; bottom:2px; right:2px; font-size:10px; color:white; text-shadow:1px 1px 0 #000; font-weight:bold;">${item.stack}</div>`;
                }

                // For Eidolic, we do NOT tint the background, only the border.
                // For others, we use multiply blend mode.
                if (isEidolic) {
                    slots[i].innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>${stackHtml}`;
                    slots[i].style.border = `2px solid ${color}`; // Thicker border for Eidolic?
                    slots[i].style.boxShadow = `0 0 5px ${color}`; // Glow
                } else {
                    slots[i].innerHTML = `<div style="width:100%; height:100%; background-image:url('${iconPath}'); background-color:${color}; background-blend-mode:multiply; background-size:contain; background-repeat:no-repeat; background-position:center;"></div>${stackHtml}`;
                    slots[i].style.border = `1px solid ${color}`;
                    slots[i].style.boxShadow = 'none';
                }
                
                slots[i].style.color = color;
                // slots[i].title = this.getItemTooltipText(item); // Disable native tooltip
                slots[i].removeAttribute('title');
                slots[i].style.backgroundColor = '#222';
                
                // Add click handler for equipping (simple toggle for now)
                slots[i].onclick = (e) => {
                    e.stopPropagation();
                    
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
                        // Desktop: Instant Equip
                        if (player.level < item.level) {
                            console.log("Level too low to equip!");
                            return;
                        }
                        if (player.equipItem(item)) {
                            this.selectedSlot = -1;
                            this.hideTooltips();
                            this.updateInventory(player);
                            this.updateCharacterSheet(player);
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
                slots[i].style.backgroundColor = 'rgba(0,0,0,0.3)';
                slots[i].onclick = null;
                slots[i].oncontextmenu = null;
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
            slots[i]._item = item;
            slots[i].innerHTML = '';
            
            if (item) {
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
                slots[i].style.backgroundColor = 'rgba(0,0,0,0.3)';
                slots[i].oncontextmenu = null;
                slots[i].onmousemove = null;
            }
        }
    }

    getItemTooltipText(item) {
        let text = `${item.name}\n${item.rarity.name} ${item.type}\nLevel ${item.level}\n\n`;
        for (const stat in item.stats) {
            text += `+${item.stats[stat]} ${stat.charAt(0).toUpperCase() + stat.slice(1)}\n`;
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
        
        for (const stat in item.stats) {
            const val = item.stats[stat];
            desc += `<div style="color: #fff;">+${val} ${stat.charAt(0).toUpperCase() + stat.slice(1)}</div>`;
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
                
                for (const stat in equippedItem.stats) {
                    const val = equippedItem.stats[stat];
                    compDesc += `<div style="color: #fff;">+${val} ${stat.charAt(0).toUpperCase() + stat.slice(1)}</div>`;
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
            { name: 'Mystery Shoulders', slot: SLOTS.SHOULDERS, icon: 'S' },
            { name: 'Mystery Belt', slot: SLOTS.BELT, icon: 'Be' },
            { name: 'Mystery Ring', slot: SLOTS.RING, icon: 'Ri' },
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

}
