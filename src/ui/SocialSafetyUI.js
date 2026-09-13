// Shared actions use the existing persisted block/ignore commands and report form.
export function socialSafetyActions(username, context, action) {
    const panel = document.createElement('details');
    panel.className = 'social-safety';
    const summary = document.createElement('summary');
    summary.textContent = 'Player safety';
    summary.setAttribute('aria-label', `Player safety for ${username}`);
    panel.append(summary);
    for (const [kind, label] of [['block', 'Block player'], ['ignore', 'Ignore chat'], ['report', 'Report player']]) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label;
        button.onclick = () => {
            if (kind !== 'report' && button.dataset.confirm !== 'true') {
                button.dataset.confirm = 'true'; button.textContent = `Confirm: ${label}`;
                return;
            }
            action(kind, username, context);
            button.dataset.confirm = 'false'; button.textContent = label;
            panel.open = false;
        };
        panel.append(button);
    }
    return panel;
}

export function socialSafetySettings(action) {
    const panel = document.createElement('details'); panel.className = 'social-safety social-safety--settings';
    panel.innerHTML = '<summary>Safety &amp; blocked players</summary><p>Block limits contact and group recruitment. Ignore filters chat and recruitment. Neither removes someone from a shared guild or public world. Changes are saved; look for server confirmation in chat. Use the controls below to undo them by player name. Reports go to the moderation queue and do not automatically punish anyone.</p>';
    const form = document.createElement('form');
    const label = document.createElement('label'); label.textContent = 'Player name';
    const name = document.createElement('input'); name.required = true; name.maxLength = 32; label.append(name);
    const operation = document.createElement('select'); operation.setAttribute('aria-label', 'Safety action');
    for (const [value, text] of [['unblock', 'Unblock player'], ['unignore', 'Stop ignoring chat']]) operation.add(new Option(text, value));
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Apply';
    form.append(label, operation, submit);
    form.onsubmit = event => { event.preventDefault(); if (name.value.trim()) action(operation.value, name.value.trim(), 'Social safety settings'); };
    panel.append(form);
    return panel;
}
