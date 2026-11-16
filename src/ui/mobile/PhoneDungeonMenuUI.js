// Keep the existing server-owned choices and handlers; only compose the phone
// reading surface and add a deliberate confirmation before an existing reset.
export class PhoneDungeonMenuUI {
    constructor(menu, { actions, partyStateBox, diffInfoBox, rewardLadderBox, hasInstance }) {
        this.footer = document.createElement('footer');
        this.footer.className = 'phone-adventure-actions';
        this.summary = document.createElement('p');
        this.summary.className = 'phone-adventure-summary';
        this.summary.setAttribute('aria-live', 'polite');
        this.footer.append(this.summary, actions);
        menu.append(this.footer);
        actions.querySelector('#btn-close-dungeon-menu-footer')?.remove();
        const enter = actions.querySelector('#btn-enter-dungeon');
        enter.textContent = hasInstance ? 'Continue run' : 'Start run';
        const reset = actions.querySelector('#btn-reset-dungeon');
        if (!hasInstance) reset?.remove();
        else if (reset) {
            reset.textContent = 'Reset…';
            const sendReset = reset.onclick;
            const confirmation = document.createElement('div');
            confirmation.id = 'phone-dungeon-reset-confirm';
            confirmation.hidden = true;
            const warning = document.createElement('p');
            warning.textContent = 'Reset this party run? Its progress will be lost. Everyone must return to Lanternhold first.';
            const cancel = document.createElement('button');
            cancel.id = 'btn-cancel-dungeon-reset'; cancel.type = 'button';
            cancel.className = 'menu-btn'; cancel.textContent = 'Keep run';
            const confirm = document.createElement('button');
            confirm.id = 'btn-confirm-dungeon-reset'; confirm.type = 'button';
            confirm.className = 'menu-btn'; confirm.textContent = 'Reset run';
            const restore = () => { confirmation.hidden = true; actions.hidden = false; this.summary.hidden = false; };
            cancel.onclick = () => { restore(); reset.focus(); };
            confirm.onclick = sendReset;
            reset.onclick = () => {
                actions.hidden = true; this.summary.hidden = true; confirmation.hidden = false;
                cancel.focus();
            };
            confirmation.append(warning, cancel, confirm);
            this.footer.append(confirmation);
            this.cancelReset = restore;
        }
        for (const [node, label] of [
            [partyStateBox, partyStateBox.firstElementChild?.textContent || 'Party run status'],
            [diffInfoBox, 'Difficulty & rewards'],
            [rewardLadderBox, 'Daily quest rewards']
        ]) {
            const details = document.createElement('details');
            details.className = 'phone-adventure-details';
            const summary = document.createElement('summary'); summary.textContent = label;
            node.before(details); details.append(summary, node);
        }
    }

    updateSummary(text) { this.summary.textContent = text; }
    showTab(index) {
        this.cancelReset?.();
        this.footer.hidden = index !== 0;
    }
}
