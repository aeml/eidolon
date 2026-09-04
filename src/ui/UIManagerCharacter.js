import { installPrototypeMethods } from '../core/PrototypeInstaller.js';

class UIManagerCharacterMethods {
    updateXP(player) {
        if (!player) return;
        const signature = this.serializeXP(player);
        if (signature === this.lastXpSignature) {
            return;
        }
        this.lastXpSignature = signature;
        const pct = (player.xp / player.xpToNextLevel) * 100;
        this.xpBar.style.width = `${Math.max(0, pct)}%`;
        this.xpText.textContent = `LVL ${player.level}`;
    }

    serializeXP(player) {
        return [
            player?.level ?? 0,
            player?.xp ?? 0,
            player?.xpToNextLevel ?? 0,
            player?.resonanceLevel ?? 0,
            player?.resonanceXP ?? 0,
            player?.resonancePoints ?? 0
        ].join('|');
    }

    updateCharacterSheet(player) {
        if (!player) return;

        this.lastPlayerRef = player; // Store reference for tooltips

        // Only update DOM if visible to save performance
        if (this.characterSheet.style.display === 'none') return;

        const signature = this.serializeCharacterSheet(player);
        if (signature === this.lastCharacterSheetSignature) {
            return;
        }
        this.lastCharacterSheetSignature = signature;

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

        const resonanceRanks = player.resonanceRanks || {};
        const resonance = player.level >= 100 || player.resonanceUnlocked ? `
            <div class="resonance-panel" aria-label="Endgame Resonance progression">
                <strong>Resonance ${player.resonanceLevel || 0}</strong>
                <div>${player.resonanceXP || 0} / ${player.resonanceXPToNext || 5000000} resonance XP · ${player.resonancePoints || 0} unspent</div>
                <div class="resonance-traits">
                    ${[['power', 'Power', '+1% damage'], ['ward', 'Ward', '+1% health and armor'], ['fortune', 'Fortune', '+1% gold and XP']].map(([trait, label, detail]) => `
                        <button type="button" class="resonance-btn" data-resonance-trait="${trait}" ${(player.resonancePoints || 0) <= 0 || (resonanceRanks[trait] || 0) >= 50 ? 'disabled' : ''}>
                            ${label} ${resonanceRanks[trait] || 0}/50 <span>${detail}</span>
                        </button>`).join('')}
                </div>
            </div>` : '';

        this.statsContent.innerHTML = `
            <div style="margin-bottom: 5px;">
                <div><strong>Level:</strong> ${player.level}</div>
                <div style="font-size: 0.8rem; color: #aaa;"><strong>XP:</strong> ${player.xp} / ${player.xpToNextLevel}</div>
                ${showPoints ? `<div style="color: #ffd700;"><strong>Points:</strong> ${player.statPoints}</div>` : ''}
            </div>
            ${resonance}
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

    serializeCharacterSheet(player) {
        const stats = player?.stats || {};
        const baseStats = player?.baseStats || {};
        const equipment = player?.equipment || {};
        const equipmentSlots = [
            'head',
            'shoulders',
            'chest',
            'belt',
            'legs',
            'feet',
            'gloves',
            'neck',
            'mainHand',
            'offHand',
            'ring1',
            'ring2',
            'trinket1',
            'trinket2'
        ];

        return [
            player?.level ?? 0,
            player?.xp ?? 0,
            player?.xpToNextLevel ?? 0,
            player?.isMultiplayer ? 'mp' : 'sp',
            player?.statPoints ?? 0,
            Math.ceil(stats.hp ?? 0),
            stats.maxHp ?? 0,
            Math.ceil(stats.mana ?? 0),
            stats.maxMana ?? 0,
            stats.strength ?? 0,
            stats.dexterity ?? 0,
            stats.intelligence ?? 0,
            stats.vitality ?? 0,
            stats.wisdom ?? 0,
            stats.damage ?? 0,
            stats.defense ?? 0,
            baseStats.strength ?? '',
            baseStats.dexterity ?? '',
            baseStats.intelligence ?? '',
            baseStats.vitality ?? '',
            baseStats.wisdom ?? '',
            ...equipmentSlots.map((slot) => this.serializeEquipmentForCharacterSheet(equipment[slot]))
        ].join('|');
    }

    serializeEquipmentForCharacterSheet(item) {
        if (!item || !item.id) return 'empty';

        const rarity = typeof item.rarity === 'string'
            ? item.rarity
            : (item.rarity?.name || item.rarity?.key || '');
        const socketSummary = Array.isArray(item.sockets)
            ? item.sockets.map((socket) => socket?.id || socket?.name || 'empty').join(',')
            : '';

        return [
            item.id,
            item.name || '',
            item.type || '',
            rarity,
            item.potency ?? 0,
            item.socketCount ?? '',
            socketSummary
        ].join(':');
    }

    updateEquipSlot(id, item, placeholder, serverSlotName) { this.inventory.updateEquipSlot(id, item, placeholder, serverSlotName); }

    updateInventory(player) { this.inventory.updateInventory(player); }

    updateStash(player) { this.inventory.updateStash(player); }

    getItemTooltipText(item) { return this.inventory.getItemTooltipText(item); }


    setupWindow(element) {
        if (!element) return;

        // Stop clicks from reaching the game
        element.addEventListener('mousedown', (e) => e.stopPropagation());
        element.addEventListener('click', (e) => e.stopPropagation()); // Also stop click events
        element.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });

        // Drag Logic
        const header = element.querySelector('.window-header');
        if (!header) return;

        const isCloseControl = (target) => {
            if (!target || !(target instanceof Element)) return false;
            return Boolean(target.closest('.close-btn, [data-window-close], #btn-close-abilities, #btn-close-skills, #btn-close-split, #btn-close-stash, #btn-close-forge, #btn-close-trading-house, #btn-close-quest, #btn-close-journal'));
        };

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
            element.dataset.draggedWindow = 'true';
            element.style.position = 'fixed';
            element.style.margin = '0';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
            element.style.transform = 'none';

            const newLeft = rect.left;
            const newTop = rect.top;

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

            const rect = element.getBoundingClientRect();
            const margin = 12;
            const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
            const maxY = Math.max(margin, window.innerHeight - rect.height - margin);

            if (newTop < margin) newTop = margin;
            if (newTop > maxY) newTop = maxY;
            if (newLeft < margin) newLeft = margin;
            if (newLeft > maxX) newLeft = maxX;

            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
        };

        const endDrag = () => {
            isDragging = false;
        };

        // Mouse Events
        header.addEventListener('mousedown', (e) => {
            if (isCloseControl(e.target)) {
                return;
            }
            startDrag(e.clientX, e.clientY);
            e.preventDefault(); // Prevent selection
        });

        window.addEventListener('mousemove', (e) => {
            moveDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', endDrag);

        // Touch Events
        header.addEventListener('touchstart', (e) => {
            // Allow close controls and buttons to work without triggering drag
            if (isCloseControl(e.target) || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
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
        this.setTooltipDescription([desc]);

        this.statTooltip.style.display = 'block';
        this.statTooltip.style.left = `${x + 15}px`;
        this.statTooltip.style.top = `${y + 15}px`;
        this.clampTooltipToViewport(this.statTooltip);
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
}

export function installUIManagerCharacter(targetClass) {
    installPrototypeMethods(targetClass, UIManagerCharacterMethods);
}
