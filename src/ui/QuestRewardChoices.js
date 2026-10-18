const SLOT_NAMES = { mainHand: 'Main hand', offHand: 'Off hand', head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Boots', gloves: 'Gloves', shoulders: 'Shoulders', belt: 'Belt', ring: 'Ring', neck: 'Necklace', trinket: 'Trinket' };
const readable = value => String(value || '').replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
const COLORS = { Uncommon: '#71d98b', Rare: '#73b5ff', Legendary: '#ffb35c' };

function node(tag, text, className = '') {
    const result = document.createElement(tag);
    result.textContent = text;
    result.className = className;
    return result;
}

// Keep offers and selection mounted across frequent character/journal updates.
export function appendQuestRewardChoices(ui, quests, parent, surface) {
    if (!parent || ui.disposed) return;
    const pending = (quests || []).filter(q => q.completed && !q.claimedRewardId && q.rewardChoices?.length);
    if (!pending.length) return;
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
    const signature = JSON.stringify([pending, ui.pendingRewardClaim, ui.questActionError, pending.map(q => ui.rewardChoiceSelections.get(q.id))]);
    if (root.rewardSignature !== signature) {
        const focusedItem = root.contains(document.activeElement) ? document.activeElement.dataset.rewardItem : null;
        root.replaceChildren(node('h3', 'Choose your quest reward'), node('p', 'Pick ONE of six items for each reward. These rolls are saved. Make one free bag slot; claim here or in the Journal whenever you are ready.'));
        for (const quest of pending) {
            const group = node('fieldset', '');
            group.append(node('legend', quest.title || quest.id));
            const grid = node('div', '', 'quest-reward-choices__grid');
            const confirm = node('button', 'Choose an item first', 'menu-btn quest-reward-choices__confirm');
            confirm.type = 'button';
            confirm.dataset.rewardClaim = quest.id;
            const updateConfirm = () => {
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
                input.checked = ui.rewardChoiceSelections.get(quest.id) === item.id;
                input.disabled = Boolean(ui.pendingRewardClaim);
                input.addEventListener('change', () => { ui.rewardChoiceSelections.set(quest.id, item.id); updateConfirm(); });
                const copy = node('span', '', 'quest-reward-choice__copy');
                copy.append(node('strong', item.name), node('small', `${item.rarity} · Level ${item.level} · ${SLOT_NAMES[item.slot] || readable(item.slot)}`));
                for (const [stat, value] of Object.entries(item.stats || {})) copy.append(node('small', `${readable(stat)}: +${value}`));
                if (item.sockets) copy.append(node('small', `${item.sockets} sockets`));
                label.append(input, copy);
                grid.append(label);
            }
            confirm.onclick = () => ui.claimQuestItem(quest.id, ui.rewardChoiceSelections.get(quest.id));
            updateConfirm();
            group.append(grid, confirm);
            root.append(group);
        }
        if (ui.questActionError) {
            const error = node('p', ui.questActionError, 'quest-dialogue__error');
            error.setAttribute('role', 'alert');
            root.append(error);
        }
        root.rewardSignature = signature;
        parent.append(root);
        if (focusedItem) [...root.querySelectorAll('input')].find(input => input.value === focusedItem)?.focus({ preventScroll: true });
    } else parent.append(root);
}
