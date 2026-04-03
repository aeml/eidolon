import { CONSTANTS } from '../core/Constants.js';

/**
 * Skill Tree UI module — handles skill trees, talents, runes, combos, and respec.
 *
 * Extracted from UIManager to keep each UI domain independently readable.
 * The parent UIManager passes shared helpers via the `ctx` object.
 */
export class SkillTreeUI {
    /**
     * @param {Object} ctx
     * @param {Function} ctx.getLastPlayer  – returns current player ref
     * @param {Function} ctx.sendRespec     – sends respec message (type: string) to server
     */
    constructor(ctx) {
        this.ctx = ctx;

        // --- DOM refs ---
        this.skillTreeWindow = document.getElementById('skill-tree-window');
        this.skillTreeContent = document.getElementById('skill-tree-content');
        this.btnCloseSkillTree = document.getElementById('btn-close-skills');

        // --- State ---
        this.skillTreeMode = 'skills'; // 'skills' | 'talents' | 'runes' | 'combos'

        // --- Callbacks (set by GameEngine) ---
        this.onSelectBranch = null;
        this.onUnlockSkill = null;
        this.onUnlockTalent = null;
        this.onResetTalents = null;
        this.onSelectRune = null;

        // --- Event listeners ---
        if (this.btnCloseSkillTree) {
            this.btnCloseSkillTree.addEventListener('click', () => this.toggle());
        }
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    /** Whether the skill tree window is currently visible. */
    get isOpen() {
        return this.skillTreeWindow &&
               this.skillTreeWindow.style.display === 'flex';
    }

    /** Toggle skill tree window open/closed. */
    toggle() {
        const isHidden = this.skillTreeWindow.style.display === 'none' || this.skillTreeWindow.style.display === '';
        this.skillTreeWindow.style.display = isHidden ? 'flex' : 'none';

        if (isHidden) {
            const player = this.ctx.getLastPlayer();
            if (player) {
                let classType = player.subType || player.meshType;
                if (!classType && player.constructor) {
                    const name = player.constructor.name;
                    if (['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(name)) {
                        classType = name;
                    }
                }
                this.renderSkillTree(classType);
            }
        }
    }

    /** Close the skill tree window if open. */
    close() {
        if (this.skillTreeWindow) {
            this.skillTreeWindow.style.display = 'none';
        }
    }

    // ================================================================
    // SKILL TREE RENDERING
    // ================================================================

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

        const player = this.ctx.getLastPlayer();
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

    // ================================================================
    // TALENT TREE
    // ================================================================

    renderTalentTree(classType) {
        const talents = (CONSTANTS.PASSIVE_TALENTS && CONSTANTS.PASSIVE_TALENTS[classType]) ? CONSTANTS.PASSIVE_TALENTS[classType] : null;
        const player = this.ctx.getLastPlayer();
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
            const p = this.ctx.getLastPlayer();
            if (p) {
                p.talentRanks = {};
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
                    const p = this.ctx.getLastPlayer();
                    if (p) {
                        if (!p.talentRanks) p.talentRanks = {};
                        const prev = p.talentRanks[t.id] | 0;
                        p.talentRanks[t.id] = prev + 1;
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
        const player = this.ctx.getLastPlayer();
        const playerLevel = player ? player.level : 1;
        const unlockedSkills = player ? (player.unlockedSkills || []) : [];
        const equippedRunes = player ? (player.skillRunes || {}) : {};

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

        const runeData = CONSTANTS.SKILL_RUNES ? CONSTANTS.SKILL_RUNES[classType] : null;

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '12px';

        for (const skillName of allSkills) {
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

    // ================================================================
    // COMBOS TAB
    // ================================================================

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
            arrow.textContent = '\u2192';

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

    // ================================================================
    // COMBO NOTIFICATION
    // ================================================================

    showComboNotification(comboName, comboId) {
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

        const label = document.createElement('div');
        label.style.color = '#ffd700';
        label.style.fontSize = '12px';
        label.style.textTransform = 'uppercase';
        label.style.letterSpacing = '3px';
        label.style.marginBottom = '8px';
        label.textContent = 'COMBO!';

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

        setTimeout(() => {
            notification.style.animation = 'comboNotificationFadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 1500);
    }

    // ================================================================
    // RESPEC MENU
    // ================================================================

    showRespecMenu() {
        // Remove existing if any
        const existing = document.getElementById('respec-menu');
        if (existing) existing.remove();
        const existingBackdrop = document.getElementById('respec-menu-backdrop');
        if (existingBackdrop) existingBackdrop.remove();

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
            menu.remove();
            backdrop.remove();
        };

        const backdrop = document.createElement('div');
        backdrop.id = 'respec-menu-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.background = 'rgba(3, 5, 10, 0.72)';
        backdrop.style.backdropFilter = 'blur(8px)';
        backdrop.style.webkitBackdropFilter = 'blur(8px)';
        backdrop.style.zIndex = '1090';
        backdrop.style.pointerEvents = 'auto';
        backdrop.addEventListener('click', removeMenu);
        window.addEventListener('keydown', handleMenuEscape);

        const menu = document.createElement('div');
        menu.id = 'respec-menu';
        menu.style.position = 'fixed';
        menu.style.top = '50%';
        menu.style.left = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
        menu.style.background = 'linear-gradient(180deg, rgba(23, 30, 24, 0.96) 0%, rgba(12, 18, 14, 0.98) 100%)';
        menu.style.border = '1px solid rgba(106, 170, 68, 0.7)';
        menu.style.padding = '20px';
        menu.style.color = '#fff';
        menu.style.zIndex = '1100';
        menu.style.textAlign = 'center';
        menu.style.minWidth = '350px';
        menu.style.maxWidth = 'min(92vw, 460px)';
        menu.style.borderRadius = '16px';
        menu.style.boxShadow = '0 28px 80px rgba(0, 0, 0, 0.55)';
        menu.style.userSelect = 'none';
        menu.style.pointerEvents = 'auto';
        menu.addEventListener('click', (e) => e.stopPropagation());

        const header = document.createElement('div');
        header.className = 'window-header';
        header.style.marginBottom = '18px';

        const title = document.createElement('h2');
        title.innerText = 'Talent Master';
        title.style.margin = '0';
        title.style.color = '#6a4';

        const closeBtn = document.createElement('button');
        closeBtn.id = 'btn-close-respec-menu';
        closeBtn.className = 'close-btn';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close respec menu');
        closeBtn.innerText = '×';
        closeBtn.onclick = removeMenu;

        header.appendChild(title);
        header.appendChild(closeBtn);
        menu.appendChild(header);

        const desc = document.createElement('p');
        desc.innerText = 'Reset your talents or skills for a gold fee based on your level.';
        desc.style.color = '#aaa';
        desc.style.fontSize = '12px';
        desc.style.marginBottom = '15px';
        menu.appendChild(desc);

        const player = this.ctx.getLastPlayer();
        const playerLevel = player?.level || 1;
        const playerGold = player?.gold || 0;

        const talentCost = playerLevel * 100;
        const skillCost = playerLevel * 50;
        const bothCost = playerLevel * 125;

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
                if (this.ctx.sendRespec) {
                    this.ctx.sendRespec(type);
                }
                removeMenu();
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

        menu.appendChild(createRespecButton('Reset Talents', 'talents', talentCost, '#6af'));
        menu.appendChild(createRespecButton('Reset Skills', 'skills', skillCost, '#f6a'));
        menu.appendChild(createRespecButton('Reset Both', 'both', bothCost, '#6a4'));

        const goldDisplay = document.createElement('div');
        goldDisplay.style.marginTop = '15px';
        goldDisplay.style.padding = '8px';
        goldDisplay.style.backgroundColor = '#222';
        goldDisplay.style.borderRadius = '4px';
        goldDisplay.innerHTML = `<span style="color: #888;">Your Gold:</span> <span style="color: #fc0; font-weight: bold;">${playerGold.toLocaleString()}</span>`;
        menu.appendChild(goldDisplay);

        const footerCloseBtn = document.createElement('button');
        footerCloseBtn.innerText = 'Close';
        footerCloseBtn.className = 'menu-btn';
        footerCloseBtn.type = 'button';
        footerCloseBtn.style.marginTop = '15px';
        footerCloseBtn.onclick = removeMenu;
        menu.appendChild(footerCloseBtn);

        document.body.appendChild(backdrop);
        document.body.appendChild(menu);
    }
}
