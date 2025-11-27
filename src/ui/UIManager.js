export class UIManager {
    constructor() {
        this.hud = document.getElementById('player-hud');
        this.hpBar = document.getElementById('player-hp-bar');
        this.hpText = document.getElementById('player-hp-text');
        this.manaBar = document.getElementById('player-mana-bar');
        this.manaText = document.getElementById('player-mana-text');
        
        this.floatingBars = new Map(); // Entity ID -> DOM Element
        this.uiLayer = document.getElementById('ui-layer');

        // New UI Elements
        this.xpBar = document.getElementById('xp-bar-fill');
        this.xpText = document.getElementById('xp-text');
        this.characterSheet = document.getElementById('character-sheet');
        this.statsContent = document.getElementById('stats-content');
        this.inventoryScreen = document.getElementById('inventory-screen');
        this.inventoryGrid = document.getElementById('inventory-grid');
        this.goldDisplay = document.getElementById('gold-display');
        
        // Escape Menu & Help
        this.escMenu = document.getElementById('esc-menu');
        this.helpScreen = document.getElementById('help-screen');
        this.patchNotesScreen = document.getElementById('patch-notes-screen');
        
        this.btnResume = document.getElementById('btn-resume');
        this.btnHelp = document.getElementById('btn-help');
        this.btnPatchNotes = document.getElementById('btn-patch-notes');
        this.btnMenu = document.getElementById('btn-menu');
        this.btnCloseHelp = document.getElementById('btn-close-help');
        this.btnClosePatchNotes = document.getElementById('btn-close-patch-notes');
        this.btnRespawn = document.getElementById('btn-respawn');

        this.btnResume.addEventListener('click', () => this.toggleEscMenu());
        this.btnHelp.addEventListener('click', () => this.toggleHelp());
        this.btnPatchNotes.addEventListener('click', () => this.togglePatchNotes());
        this.btnMenu.addEventListener('click', () => location.reload());
        this.btnCloseHelp.addEventListener('click', () => this.toggleHelp());
        this.btnClosePatchNotes.addEventListener('click', (e) => {
            console.log("Close Patch Notes Button Clicked");
            this.togglePatchNotes();
            e.stopPropagation();
        });
        this.btnRespawn.addEventListener('click', () => {
            if (this.onRespawn) {
                this.onRespawn();
            }
            this.toggleEscMenu();
        });

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

        // Equipment Tooltips
        const equipSlots = document.querySelectorAll('.equip-slot');
        equipSlots.forEach(slot => {
            slot.addEventListener('mousemove', (e) => {
                if (slot._item) {
                    this.showItemTooltip(slot._item, e.clientX, e.clientY);
                } else {
                    this.statTooltip.style.display = 'none';
                }
            });
            slot.addEventListener('mouseleave', () => {
                this.statTooltip.style.display = 'none';
            });
        });

        // Inventory Tooltips (Delegation)
        this.inventoryGrid.addEventListener('mousemove', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (slot && slot._item) {
                this.showItemTooltip(slot._item, e.clientX, e.clientY);
            } else {
                this.statTooltip.style.display = 'none';
            }
        });
        this.inventoryGrid.addEventListener('mouseleave', () => {
            this.statTooltip.style.display = 'none';
        });

        // Make windows draggable and stop propagation
        this.setupWindow(this.characterSheet);
        this.setupWindow(this.inventoryScreen);
    }

    showHUD() {
        this.hud.style.display = 'block';
        this.abilityContainer.style.display = 'block';
    }

    updatePlayerStats(player) {
        if (!player) return;
        
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

    updateAbilityIcon(player) {
        if (!player) return;

        // Update Info (only needs to happen once really, but safe here)
        this.abilityName.textContent = player.abilityName;
        this.abilityDesc.textContent = player.abilityDescription;
        const cost = Math.floor(player.abilityManaCost * (1 - player.stats.manaCostReduction));
        this.abilityCost.textContent = `Mana: ${cost}`;

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

        const x = (pos.x * .5 + .5) * window.innerWidth;
        const y = (-(pos.y * .5) + .5) * window.innerHeight;

        bar.style.left = `${x}px`;
        bar.style.top = `${y}px`;
    }

    get isEscMenuOpen() {
        return this.escMenu.style.display === 'block';
    }

    toggleCharacterSheet() {
        const isHidden = this.characterSheet.style.display === 'none' || this.characterSheet.style.display === '';
        this.characterSheet.style.display = isHidden ? 'block' : 'none';
    }

    toggleInventory() {
        const isHidden = this.inventoryScreen.style.display === 'none' || this.inventoryScreen.style.display === '';
        this.inventoryScreen.style.display = isHidden ? 'block' : 'none';
    }

    toggleEscMenu() {
        const isHidden = this.escMenu.style.display === 'none' || this.escMenu.style.display === '';
        this.escMenu.style.display = isHidden ? 'block' : 'none';
        
        // If closing menu, also close help/patch notes if open
        if (!isHidden) {
            this.helpScreen.style.display = 'none';
            this.patchNotesScreen.style.display = 'none';
        }
    }

    toggleHelp() {
        const isHidden = this.helpScreen.style.display === 'none' || this.helpScreen.style.display === '';
        this.helpScreen.style.display = isHidden ? 'block' : 'none';
        if (!isHidden) this.patchNotesScreen.style.display = 'none'; // Close other windows
    }

    togglePatchNotes() {
        console.log("Toggling Patch Notes");
        const isHidden = this.patchNotesScreen.style.display === 'none' || this.patchNotesScreen.style.display === '';
        this.patchNotesScreen.style.display = isHidden ? 'flex' : 'none'; // Flex for layout
        if (isHidden) this.helpScreen.style.display = 'none'; // Close other windows
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

        // 2. Close Help/Patch Screens
        if (this.helpScreen.style.display === 'block') {
            this.helpScreen.style.display = 'none';
            closedSomething = true;
        }
        if (this.patchNotesScreen.style.display === 'flex') {
            this.patchNotesScreen.style.display = 'none';
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
        if (!player || this.characterSheet.style.display === 'none') return;
        
        this.lastPlayerRef = player; // Store reference for tooltips

        const btnStyle = player.statPoints > 0 ? 'display:inline-block; margin-left:5px; cursor:pointer;' : 'display:none;';

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
                <div style="color: #ffd700;"><strong>Points:</strong> ${player.statPoints}</div>
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
        this.updateEquipSlot('slot-chest', player.equipment.chest, 'CHEST');
        this.updateEquipSlot('slot-mainhand', player.equipment.mainHand, 'MAIN HAND');
        this.updateEquipSlot('slot-offhand', player.equipment.offHand, 'OFF HAND');
        this.updateEquipSlot('slot-legs', player.equipment.legs, 'LEGS');
        this.updateEquipSlot('slot-feet', player.equipment.feet, 'FEET');
    }

    updateEquipSlot(id, item, placeholder) {
        const el = document.getElementById(id);
        if (el) {
            el._item = item; // Store item for tooltip
            if (item) {
                el.textContent = item.name;
                el.style.color = item.rarity ? item.rarity.color : '#fff';
                el.style.borderColor = item.rarity ? item.rarity.color : '#ffd700';
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
        if (!player || this.inventoryScreen.style.display === 'none') return;

        // Update Gold
        if (this.goldDisplay) {
            this.goldDisplay.textContent = `GOLD: ${player.gold || 0}`;
        }

        const slots = this.inventoryGrid.children;
        for (let i = 0; i < slots.length; i++) {
            const item = player.inventory[i];
            slots[i]._item = item; // Store item for tooltip
            
            if (item) {
                // Show first letter or icon placeholder
                slots[i].textContent = item.name ? item.name.substring(0, 2) : '??';
                slots[i].style.color = item.rarity ? item.rarity.color : '#fff';
                slots[i].style.border = `1px solid ${item.rarity ? item.rarity.color : '#444'}`;
                // slots[i].title = this.getItemTooltipText(item); // Disable native tooltip
                slots[i].removeAttribute('title');
                slots[i].style.backgroundColor = '#222';
                
                // Add click handler for equipping (simple toggle for now)
                slots[i].onclick = (e) => {
                    e.stopPropagation();
                    if (player.equipItem(item)) {
                        player.inventory[i] = null; // Remove from inventory
                        this.updateInventory(player);
                        this.updateCharacterSheet(player);
                    }
                };
            } else {
                slots[i].textContent = '';
                slots[i].title = 'Empty';
                slots[i].style.border = '1px solid #444';
                slots[i].style.backgroundColor = 'rgba(0,0,0,0.3)';
                slots[i].onclick = null;
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
        
        // Drag Logic
        const header = element.querySelector('.window-header');
        if (!header) return;
        
        header.style.cursor = 'move';
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            // Neutralize transform if present (first drag)
            const style = window.getComputedStyle(element);
            if (style.transform !== 'none') {
                const rect = element.getBoundingClientRect();
                element.style.left = `${rect.left}px`;
                element.style.top = `${rect.top}px`;
                element.style.transform = 'none';
                element.style.margin = '0';
            }
            
            startLeft = parseFloat(element.style.left);
            startTop = parseFloat(element.style.top);
            
            e.preventDefault(); // Prevent selection
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = `${startLeft + dx}px`;
            element.style.top = `${startTop + dy}px`;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
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

    showItemTooltip(item, x, y) {
        this.statTooltipTitle.textContent = item.name;
        this.statTooltipTitle.style.color = item.rarity.color;
        
        let desc = `<div style="color: #aaa; font-style: italic; margin-bottom: 5px;">${item.rarity.name} ${item.type} - Lvl ${item.level}</div>`;
        
        for (const stat in item.stats) {
            const val = item.stats[stat];
            desc += `<div style="color: #fff;">+${val} ${stat.charAt(0).toUpperCase() + stat.slice(1)}</div>`;
        }
        
        this.statTooltipDesc.innerHTML = desc;
        
        this.statTooltip.style.display = 'block';
        this.statTooltip.style.left = `${x + 15}px`;
        this.statTooltip.style.top = `${y + 15}px`;
        
        // Ensure it stays on screen
        // We need to wait for render to get correct rect, but usually it's fine.
        // If it goes off screen, we can adjust.
        const rect = this.statTooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.statTooltip.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.statTooltip.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    }
}
