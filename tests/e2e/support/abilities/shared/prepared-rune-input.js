// Rune buttons toggle: clicking an already-equipped rune removes it. Persistent
// QA characters and retries must observe current state before ordinary input.
export async function selectPreparedRune(page, skills, { skill, id, name }) {
    if (await page.evaluate(skill => window.game.player.skillRunes?.[skill], skill) === id) return false;
    await skills.getByRole('button', { name: 'Runes', exact: true }).click();
    await skills.getByText(skill, { exact: true }).locator('..')
        .getByText(name, { exact: true }).click();
    return true;
}

// Base-cast coverage must actually equip the base spell. Click the selected
// rune to remove it, then let the caller wait for the normal server ack.
export async function clearPreparedRune(page, skills, skill, variants) {
    const read = () => page.evaluate(name => window.game.player.skillRunes?.[name] || '', skill);
    let current = await read();
    if (!current) return false;
    const resolve = id => {
        const rune = variants.find(entry => entry.id === id);
        if (!rune) throw new Error(`Unknown equipped rune ${skill}/${id}; refusing to guess a removal control`);
        return rune;
    };
    resolve(current);
    await skills.getByRole('button', { name: 'Runes', exact: true }).click();
    // A state update may arrive while opening the tab. Never accidentally
    // equip a previously removed rune or toggle a different selection.
    current = await read();
    if (!current) return false;
    const rune = resolve(current);
    await skills.getByText(skill, { exact: true }).locator('..')
        .getByText(rune.name, { exact: true }).click();
    return true;
}
