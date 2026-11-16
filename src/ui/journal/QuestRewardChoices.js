const SLOT_NAMES = { mainHand: 'Main hand', offHand: 'Off hand', head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Boots', gloves: 'Gloves', shoulders: 'Shoulders', belt: 'Belt', ring: 'Ring', neck: 'Necklace', trinket: 'Trinket' };
const readable = value => String(value || '').replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
const COLORS = { Uncommon: '#71d98b', Rare: '#73b5ff', Legendary: '#ffb35c' };

function node(tag, text, className = '') {
    const result = document.createElement(tag);
    result.textContent = text;
    result.className = className;
    return result;
}

function updateChoiceControls(ui) {
    for (const root of ui.rewardChoiceRoots.values()) {
        for (const update of root.rewardChoiceUpdates || []) update();
    }
}

// Keep offers and selection mounted across frequent character/journal updates.
export function appendQuestRewardChoices(ui, quests, parent, surface) {
    if (!parent || ui.disposed) return;
    const pending = (quests || []).filter(q => q.completed && !q.claimedRewardId && q.rewardChoices?.length);
    if (!pending.length) {
        ui.rewardChoiceRoots?.get(surface)?.remove();
        return;
    }
    ui.rewardChoiceSelections ||= new Map();
    ui.rewardChoiceRoots ||= new Map();
    let root = ui.rewardChoiceRoots.get(surface);
    if (!root) {
        root = node('section', '', 'quest-reward-choices');
        root.dataset.journalShared = 'true';
        root.setAttribute('aria-label', 'Unclaimed quest item rewards');
        root.addEventListener('keydown', event => {
            if ([' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.stopPropagation();
        });
        ui.rewardChoiceRoots.set(surface, root);
    }
    // Selection, claim status and unrelated quest progress update the existing
    // controls. Replacing a pressed button can discard its pointer release.
    const signature = JSON.stringify(pending.map(q => [q.id, q.title, q.rewardChoices]));
    if (root.rewardSignature !== signature) {
        const focused = root.contains(document.activeElement) ? {
            item: document.activeElement.dataset.rewardItem, claim: document.activeElement.dataset.rewardClaim
        } : null;
        root.replaceChildren(node('h3', 'Choose your quest reward'), node('p', 'Pick ONE of six items for each reward. These rolls are saved. Make one free bag slot; claim here or in the Journal whenever you are ready.'));
        root.rewardChoiceUpdates = [];
        for (const quest of pending) {
            const group = node('fieldset', '');
            group.append(node('legend', quest.title || quest.id));
            const grid = node('div', '', 'quest-reward-choices__grid');
            const confirm = node('button', 'Choose an item first', 'menu-btn quest-reward-choices__confirm');
            confirm.type = 'button';
            confirm.dataset.rewardClaim = quest.id;
            const inputs = [];
            const updateControls = () => {
                for (const input of inputs) {
                    input.checked = ui.rewardChoiceSelections.get(quest.id) === input.value;
                    input.disabled = Boolean(ui.pendingRewardClaim);
                }
                const item = quest.rewardChoices.find(item => item.id === ui.rewardChoiceSelections.get(quest.id));
                confirm.disabled = !item || Boolean(ui.pendingRewardClaim);
                confirm.textContent = ui.pendingRewardClaim?.questId === quest.id ? 'Saving reward…' : item ? `Claim ${item.name}` : 'Choose an item first';
            };
            for (const item of quest.rewardChoices) {
                const label = node('label', '', 'quest-reward-choice');
                label.style.setProperty('--reward-color', COLORS[item.rarity] || COLORS.Uncommon);
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `quest-reward-${surface}-${quest.id}`;
                input.value = item.id;
                input.dataset.rewardItem = item.id;
                inputs.push(input);
                input.addEventListener('change', () => {
                    if (ui.disposed || !root.isConnected || !root.contains(input)) return;
                    ui.rewardChoiceSelections.set(quest.id, item.id);
                    updateChoiceControls(ui);
                });
                const copy = node('span', '', 'quest-reward-choice__copy');
                copy.append(node('strong', item.name), node('small', `${item.rarity} · Level ${item.level} · ${SLOT_NAMES[item.slot] || readable(item.slot)}`));
                for (const [stat, value] of Object.entries(item.stats || {})) copy.append(node('small', `${readable(stat)}: +${value}`));
                if (item.sockets) copy.append(node('small', `${item.sockets} sockets`));
                label.append(input, copy);
                grid.append(label);
            }
            confirm.onclick = () => {
                if (!root.isConnected || !root.contains(confirm)) return;
                ui.claimQuestItem(quest.id, ui.rewardChoiceSelections.get(quest.id));
            };
            root.rewardChoiceUpdates.push(updateControls);
            updateControls();
            group.append(grid, confirm);
            root.append(group);
        }
        root.rewardSignature = signature;
        parent.append(root);
        if (focused?.item || focused?.claim) [...root.querySelectorAll('input, button')]
            .find(control => focused.item ? control.dataset.rewardItem === focused.item : control.dataset.rewardClaim === focused.claim)?.focus({ preventScroll: true });
    } else if (root.parentNode !== parent) parent.append(root);
    updateChoiceControls(ui);
    root.setAttribute('aria-busy', String(Boolean(ui.pendingRewardClaim)));
    let error = root.querySelector('.quest-dialogue__error');
    if (ui.questActionError) {
        if (!error) {
            error = node('p', '', 'quest-dialogue__error');
            error.setAttribute('role', 'alert');
            root.append(error);
        }
        error.textContent = ui.questActionError;
    } else error?.remove();
}
