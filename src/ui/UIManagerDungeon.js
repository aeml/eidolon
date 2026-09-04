import {
    DUNGEON_RUN_LEVEL_BANDS,
    availableDungeonRunLevelsForPlayer,
    isEndgameDifficultyUnlocked
} from '../data/dungeonProgression.js';
import { installPrototypeMethods } from '../core/PrototypeInstaller.js';

class UIManagerDungeonMethods {
    showDungeonMenu(data) {
        const existingBackdrop = document.getElementById('dungeon-menu-backdrop');
        if (existingBackdrop && typeof existingBackdrop.__closeMenu === 'function') {
            existingBackdrop.__closeMenu();
        } else {
            const existing = document.getElementById('dungeon-menu');
            if (existing) existing.remove();
            if (existingBackdrop) existingBackdrop.remove();
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'dungeon-menu-backdrop';
        backdrop.className = 'generated-menu-backdrop';

        const menu = document.createElement('div');
        menu.id = 'dungeon-menu';
        menu.className = 'generated-menu generated-menu--dungeon';
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-modal', 'true');
        menu.setAttribute('aria-labelledby', 'dungeon-menu-title');
        menu.addEventListener('click', (e) => e.stopPropagation());

        let isMenuClosed = false;
        const handleMenuEscape = (event) => {
            if (event.key === 'Escape') {
                removeMenu();
            }
        };
        const removeMenu = () => {
            if (isMenuClosed) {
                return;
            }
            isMenuClosed = true;
            window.removeEventListener('keydown', handleMenuEscape);
            delete backdrop.__closeMenu;
            menu.remove();
            backdrop.remove();
        };

        backdrop.__closeMenu = removeMenu;
        backdrop.addEventListener('click', removeMenu);
        window.addEventListener('keydown', handleMenuEscape);

        const header = document.createElement('div');
        header.className = 'window-header';
        header.style.marginBottom = '18px';

        const title = document.createElement('h2');
        title.id = 'dungeon-menu-title';
        title.innerText = 'Dungeon Portal';
        title.style.margin = '0';
        title.style.fontSize = '1.5rem';

        const closeBtn = document.createElement('button');
        closeBtn.id = 'btn-close-dungeon-menu';
        closeBtn.className = 'close-btn';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close dungeon menu');
        closeBtn.innerText = '×';
        closeBtn.onclick = removeMenu;

        header.appendChild(title);
        header.appendChild(closeBtn);
        menu.appendChild(header);

        const partyStateBox = document.createElement('div');
        partyStateBox.id = 'dungeon-party-state-box';
        partyStateBox.style.background = 'rgba(17, 21, 28, 0.9)';
        partyStateBox.style.border = '1px solid rgba(120, 142, 172, 0.28)';
        partyStateBox.style.borderRadius = '8px';
        partyStateBox.style.padding = '10px 12px';
        partyStateBox.style.marginBottom = '14px';
        partyStateBox.style.textAlign = 'left';
        partyStateBox.style.fontSize = '12px';

        if (data.hasInstance && data.timeLeft > 0) {
            partyStateBox.innerHTML = `
                <div style="color: #ffaa00; font-weight: bold;">Party instance idle — reset window open</div>
                <div style="color: #d7dfef; margin-top: 4px; line-height: 1.5;">Your party already owns a dungeon instance. If everyone left, it will collapse in ${Math.ceil(data.timeLeft)}s unless the party goes back in.</div>
                <div style="color: ${data.isLeader ? '#ffd36f' : '#8ea8d1'}; margin-top: 4px; line-height: 1.5;">${data.isLeader ? 'You are the party leader, so you can continue it or reset it for a fresh run.' : 'Only the party leader can reset it. Non-leaders can still re-enter the current party run.'}</div>
            `;
        } else if (data.hasInstance) {
            partyStateBox.innerHTML = `
                <div style="color: #7cf0a5; font-weight: bold;">Party instance active</div>
                <div style="color: #d7dfef; margin-top: 4px; line-height: 1.5;">Your party already has a live dungeon run. Entering here continues that same instance instead of creating a new one.</div>
                <div style="color: ${data.isLeader ? '#ffd36f' : '#8ea8d1'}; margin-top: 4px; line-height: 1.5;">${data.isLeader ? 'You are the party leader, so you can keep the run going or reset it when the group wants a fresh start.' : 'Reset control stays with the party leader. Non-leaders can only continue the current party instance.'}</div>
            `;
        } else {
            partyStateBox.innerHTML = `
                <div style="color: #aaa; font-weight: bold;">No active party instance</div>
                <div style="color: #d7dfef; margin-top: 4px; line-height: 1.5;">Entering now starts a fresh dungeon run for your current party.</div>
                <div style="color: ${data.isLeader ? '#ffd36f' : '#8ea8d1'}; margin-top: 4px; line-height: 1.5;">${data.isLeader ? 'As party leader, your dungeon choice and reset actions define the run for the group.' : 'If you want a different dungeon or a reset, ask the party leader to drive it.'}</div>
            `;
        }
        menu.appendChild(partyStateBox);

        // Dungeon Selection
        const dungeonInfo = {
            verdant_bastion_catacombs: { name: 'Verdant Bastion Catacombs', baseLevel: 30, color: '#4a4' },
            molten_core: { name: 'Molten Core', baseLevel: 70, color: '#f64' },
            tempest_spire: { name: 'Tempest Spire', baseLevel: 70, color: '#6af' },
            abyssal_well: { name: 'Abyssal Well', baseLevel: 60, color: '#4ad' },
            umbral_nexus: { name: 'Umbral Nexus', baseLevel: 100, color: '#c066ff' }
        };

        const lockedDungeonType = data && data.dungeonType && dungeonInfo[data.dungeonType]
            ? data.dungeonType
            : null;

        if (lockedDungeonType) {
            title.innerText = dungeonInfo[lockedDungeonType].name;
        }

        const difficultyInfo = {
            normal: {
                name: 'Normal',
                color: '#aaa',
                hp: '1x',
                dmg: '1x',
                loot: '1x',
                identity: 'Baseline route for learning layouts, boss kits, and room pacing.',
                rewardNote: 'Boss rewards stay on the standard gold, XP, and heart line.'
            },
            heroic: {
                name: 'Heroic',
                color: '#ff0',
                hp: '2x',
                dmg: '1.5x',
                loot: '2x',
                identity: 'Endgame pressure spike with heavier boss stat checks and a cleaner gem chase.',
                rewardNote: 'Bosses guarantee one bonus gem drop on top of the normal payout.'
            },
            mythic: {
                name: 'Mythic',
                color: '#f60',
                hp: '4x',
                dmg: '2.5x',
                loot: '4x',
                identity: 'Capstone push where bosses hit hardest and every kill pays out build-defining loot.',
                rewardNote: 'Bosses guarantee one bonus gem and one unique-effect item.'
            }
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
        dungeonSelect.className = 'generated-menu__select';
        dungeonSelect.style.margin = '5px';
        dungeonSelect.style.padding = '8px';
        dungeonSelect.style.fontSize = '14px';
        dungeonSelect.style.backgroundColor = '#222';
        dungeonSelect.style.color = '#fff';
        dungeonSelect.style.border = '1px solid #555';
        dungeonSelect.style.cursor = 'pointer';
        dungeonSelect.style.userSelect = 'text';
        dungeonSelect.style.webkitUserSelect = 'text';

        const playerLevel = Number(data.playerLevel) || 0;
        const availableDungeons = lockedDungeonType
            ? { [lockedDungeonType]: dungeonInfo[lockedDungeonType] }
            : Object.fromEntries(Object.entries(dungeonInfo).filter(([key]) => key !== 'umbral_nexus' || (playerLevel >= 100 && data.crystalsRestored)));

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

        const availableRunLevels = Array.isArray(data.availableRunLevels) && data.availableRunLevels.length > 0
            ? data.availableRunLevels
            : availableDungeonRunLevelsForPlayer(playerLevel);
        const endgameUnlocked = isEndgameDifficultyUnlocked(playerLevel);

        const runLevelLabel = document.createElement('label');
        runLevelLabel.innerText = 'Select Run Level:';
        runLevelLabel.style.display = 'block';
        runLevelLabel.style.marginTop = '15px';
        runLevelLabel.style.fontWeight = 'bold';
        menu.appendChild(runLevelLabel);

        const runLevelSelect = document.createElement('select');
        runLevelSelect.id = 'dungeon-run-level-select';
        runLevelSelect.className = 'generated-menu__select';
        runLevelSelect.style.margin = '5px';
        runLevelSelect.style.padding = '8px';
        runLevelSelect.style.fontSize = '14px';
        runLevelSelect.style.backgroundColor = '#222';
        runLevelSelect.style.color = '#fff';
        runLevelSelect.style.border = '1px solid #555';
        runLevelSelect.style.cursor = 'pointer';
        runLevelSelect.style.userSelect = 'text';
        runLevelSelect.style.webkitUserSelect = 'text';
        for (const runLevel of availableRunLevels.length > 0 ? availableRunLevels : DUNGEON_RUN_LEVEL_BANDS) {
            const option = document.createElement('option');
            option.value = String(runLevel);
            option.innerText = `Level ${runLevel}`;
            runLevelSelect.appendChild(option);
        }
        menu.appendChild(runLevelSelect);

        const unlockNote = document.createElement('div');
        unlockNote.style.marginTop = '10px';
        unlockNote.style.fontSize = '12px';
        unlockNote.style.color = '#aab6c8';
        unlockNote.textContent = endgameUnlocked
            ? `All run levels unlocked. Heroic and Mythic are now available at level ${data.endgameDifficultyUnlockLevel || 100}.`
            : `All dungeons unlock at level ${data.dungeonUnlockLevel || 30}. Heroic and Mythic unlock at level ${data.endgameDifficultyUnlockLevel || 100}.`;
        menu.appendChild(unlockNote);

        // Difficulty Label
        const diffLabel = document.createElement('label');
        diffLabel.innerText = 'Select Difficulty:';
        diffLabel.style.display = 'block';
        diffLabel.style.marginTop = '15px';
        diffLabel.style.fontWeight = 'bold';
        menu.appendChild(diffLabel);

        // Difficulty Buttons Container
        const diffContainer = document.createElement('div');
        diffContainer.className = 'generated-menu__choice-row';

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
            if (key !== 'normal' && !endgameUnlocked) {
                btn.disabled = true;
                btn.style.opacity = '0.45';
                btn.style.cursor = 'not-allowed';
                btn.title = `Unlocks at level ${data.endgameDifficultyUnlockLevel || 100}`;
            }

            btn.onclick = () => {
                if (btn.disabled) {
                    return;
                }
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

        const rewardLadderBox = document.createElement('div');
        rewardLadderBox.id = 'dungeon-reward-ladder-box';
        rewardLadderBox.style.backgroundColor = '#15181d';
        rewardLadderBox.style.border = '1px solid #353c47';
        rewardLadderBox.style.padding = '12px';
        rewardLadderBox.style.margin = '10px 0 4px 0';
        rewardLadderBox.style.borderRadius = '4px';
        rewardLadderBox.style.fontSize = '12px';
        rewardLadderBox.style.textAlign = 'left';
        menu.appendChild(rewardLadderBox);

        const updateDifficultyInfo = () => {
            const dungeonKey = dungeonSelect.value;
            const dungeon = dungeonInfo[dungeonKey];
            const diff = difficultyInfo[selectedDifficulty];
            const selectedRunLevel = Number(runLevelSelect.value) || availableRunLevels[0] || 30;
            const dailyQuestEntries = this.getDungeonDailyQuestEntries(dungeonKey, selectedDifficulty, data.quests);
            const ladderRows = dailyQuestEntries.length > 0
                ? dailyQuestEntries.map((entry) => `
                    <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 6px; align-items: baseline;">
                        <span style="color: ${entry.complete ? '#7cf0a5' : '#d7dfef'};">${entry.label}</span>
                        <span style="color: ${entry.complete ? '#7cf0a5' : '#ffd36f'}; white-space: nowrap;">${entry.progressText} • ${entry.rewardXP.toLocaleString()} XP</span>
                    </div>
                `).join('')
                : '<div style="color: #8ea8d1; margin-top: 6px;">Accept dungeon dailies at the Quest Giver to turn repeated clears into a live XP ladder.</div>';

            diffInfoBox.innerHTML = `
                <div style="color: ${diff.color}; font-weight: bold; font-size: 14px; margin-bottom: 8px;">${diff.name} Mode</div>
                <div><span style="color: #888;">Dungeon:</span> <span style="color: #fff;">${dungeon.name}</span></div>
                <div><span style="color: #888;">Run Level:</span> <span style="color: #fff;">${selectedRunLevel}</span></div>
                <div><span style="color: #888;">Enemy HP:</span> <span style="color: #f66;">${diff.hp}</span></div>
                <div><span style="color: #888;">Enemy Damage:</span> <span style="color: #f66;">${diff.dmg}</span></div>
                <div><span style="color: #888;">Loot & XP:</span> <span style="color: #6f6;">${diff.loot}</span></div>
                <div style="color: #d7dfef; margin-top: 6px; line-height: 1.5;">${diff.identity}</div>
                <div style="color: ${diff.color}; margin-top: 5px; line-height: 1.5;">${diff.rewardNote}</div>
                <div style="color: #8ea8d1; margin-top: 6px;">All dungeons unlock at level ${data.dungeonUnlockLevel || 30}. Heroic and Mythic unlock at level ${data.endgameDifficultyUnlockLevel || 100}.</div>
            `;

            rewardLadderBox.innerHTML = `
                <div style="color: #ffd700; font-size: 11px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase;">Repeat-Run Ladder</div>
                <div style="color: #d7dfef; margin-top: 6px; line-height: 1.5;">This route feeds the daily dungeon boss ladder, so reruns keep paying XP even after a clean clear.</div>
                ${ladderRows}
            `;
        };

        dungeonSelect.onchange = updateDifficultyInfo;
        runLevelSelect.onchange = updateDifficultyInfo;
        updateDifficultyInfo(); // Initial update

        // Enter Button
        const actions = document.createElement('div');
        actions.className = 'generated-menu__actions';

        const enterBtn = document.createElement('button');
        enterBtn.id = 'btn-enter-dungeon';
        enterBtn.innerText = data.hasInstance ? 'Continue Party Run' : 'Start Party Run';
        enterBtn.className = 'menu-btn';
        enterBtn.type = 'button';
        enterBtn.style.minWidth = '160px';
        enterBtn.style.padding = '12px 30px';
        enterBtn.style.backgroundColor = '#2a6';
        enterBtn.style.color = '#fff';
        enterBtn.style.border = '1px solid rgba(126, 247, 182, 0.45)';
        enterBtn.style.fontWeight = 'bold';
        enterBtn.style.fontSize = '16px';
        enterBtn.style.boxShadow = '0 10px 24px rgba(12, 38, 24, 0.35)';
        enterBtn.onclick = () => {
            if (window.game && window.game.socket) {
                window.game.socket.send(JSON.stringify({
                    type: 'enter_dungeon',
                    payload: {
                        dungeonType: dungeonSelect.value,
                        difficulty: selectedDifficulty,
                        runLevel: Number(runLevelSelect.value) || availableRunLevels[0] || 30
                    }
                }));
            }
            removeMenu();
        };
        actions.appendChild(enterBtn);

        const elementalRaids = [
            { type: 'earth_crystal_raid', name: 'Rootheart Sanctum', element: 'Earth', level: 30, chapter: 3 },
            { type: 'water_crystal_raid', name: 'Tidestar Confluence', element: 'Water', level: 60, chapter: 5 },
            { type: 'fire_crystal_raid', name: 'Ember Crown Crucible', element: 'Fire', level: 70, chapter: 7 },
            { type: 'air_crystal_raid', name: 'Skyglass Eyrie', element: 'Air', level: 70, chapter: 9 }
        ];
        elementalRaids.forEach((raid) => {
            const unlocked = Boolean(data.elementalRaidAccess?.[raid.type]);
            if (playerLevel < raid.level && !unlocked) return;
            const raidBox = document.createElement('section');
            raidBox.className = 'dungeon-raid-card elemental-raid-card';
            raidBox.dataset.raidType = raid.type;
            raidBox.innerHTML = unlocked
                ? `<strong>${raid.element} Crystal Raid · ${raid.name}</strong><span>5–10 players · clear the assault, then defend Maelin through 3 repair waves</span>`
                : `<strong>${raid.element} Crystal Raid · Sealed</strong><span>Complete Chronicle chapter ${raid.chapter} by clearing this realm’s dungeon to reveal ${raid.name}.</span>`;
            const formRaid = document.createElement('button');
            formRaid.type = 'button';
            formRaid.className = 'menu-btn';
            formRaid.textContent = 'Form Elemental Raid';
            formRaid.disabled = !data.isLeader || !unlocked;
            formRaid.onclick = () => window.game?.network?.send?.('raid_convert', { raidType: raid.type });
            const enterRaid = document.createElement('button');
            enterRaid.type = 'button';
            enterRaid.className = 'menu-btn';
            enterRaid.textContent = `Enter ${raid.name}`;
            enterRaid.disabled = !data.isLeader || !unlocked;
            enterRaid.onclick = () => {
                window.game?.network?.send?.('raid_enter', { raidType: raid.type });
                removeMenu();
            };
            raidBox.append(formRaid, enterRaid);
            menu.appendChild(raidBox);
        });

        if (playerLevel >= 100 && !data.crystalsRestored) {
            const storyGate = document.createElement('section');
            storyGate.className = 'dungeon-raid-card';
            storyGate.innerHTML = '<strong>Umbral Nexus · Sealed</strong><span>Complete all four elemental raids and their defended crystal-repair Vigils through Chronicle chapter 13.</span>';
            menu.appendChild(storyGate);
        }

        if (playerLevel >= 100) {
            const raidBox = document.createElement('section');
            raidBox.className = 'dungeon-raid-card';
            raidBox.innerHTML = data.darkRealmOpen
                ? '<strong>Dark Realm Raid · Malachar, the Dark King</strong><span>5–10 players · level 100 · Mythic · four Eidolon phases · weekly personal cache</span>'
                : '<strong>Dark Realm Raid · Portal Dormant</strong><span>After all four crystal raids, defeat the Eidolon Devourer in Chronicle chapter 14 to stabilize the portal.</span>';
            const formRaid = document.createElement('button');
            formRaid.type = 'button';
            formRaid.className = 'menu-btn';
            formRaid.textContent = 'Form Dark Realm Raid';
            formRaid.disabled = !data.isLeader || !data.darkRealmOpen;
            formRaid.onclick = () => window.game?.network?.send?.('raid_convert', { raidType: 'weekly_raid' });
            const enterRaid = document.createElement('button');
            enterRaid.type = 'button';
            enterRaid.className = 'menu-btn';
            enterRaid.textContent = 'Enter Dark Realm Raid';
            enterRaid.disabled = !data.isLeader || !data.darkRealmOpen;
            enterRaid.onclick = () => {
                window.game?.network?.send?.('raid_enter', { raidType: 'weekly_raid' });
                removeMenu();
            };
            raidBox.append(formRaid, enterRaid);
            menu.appendChild(raidBox);
        }

        // Reset Button (Leader Only)
        if (data.isLeader) {
            const resetBtn = document.createElement('button');
            resetBtn.id = 'btn-reset-dungeon';
            resetBtn.innerText = 'Reset Party Instance';
            resetBtn.className = 'menu-btn';
            resetBtn.type = 'button';
            resetBtn.style.minWidth = '160px';
            resetBtn.style.padding = '12px 24px';
            resetBtn.style.backgroundColor = '#800';
            resetBtn.style.color = '#fff';
            resetBtn.style.border = '1px solid rgba(255, 138, 138, 0.35)';
            resetBtn.style.boxShadow = '0 10px 24px rgba(48, 10, 10, 0.3)';
            resetBtn.onclick = () => {
                if (window.game && window.game.socket) {
                    window.game.socket.send(JSON.stringify({
                        type: 'reset_dungeon',
                        payload: {}
                    }));
                }
                removeMenu();
            };
            actions.appendChild(resetBtn);
        }

        const footerCloseBtn = document.createElement('button');
        footerCloseBtn.id = 'btn-close-dungeon-menu-footer';
        footerCloseBtn.innerText = 'Close';
        footerCloseBtn.className = 'menu-btn';
        footerCloseBtn.type = 'button';
        footerCloseBtn.style.minWidth = '120px';
        footerCloseBtn.onclick = removeMenu;
        actions.appendChild(footerCloseBtn);
        menu.appendChild(actions);

        document.body.appendChild(backdrop);
        document.body.appendChild(menu);
        closeBtn.focus();
    }

    showRespecMenu() {
        this.skillTree.showRespecMenu();
    }
}

export function installUIManagerDungeon(targetClass) {
    installPrototypeMethods(targetClass, UIManagerDungeonMethods);
}
