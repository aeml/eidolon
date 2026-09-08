// Rune buttons toggle: clicking an already-equipped rune removes it. Persistent
// QA characters and retries must observe current state before ordinary input.
export async function selectPreparedRune(page, skills, { skill, id, name }) {
    if (await page.evaluate(skill => window.game.player.skillRunes?.[skill], skill) === id) return false;
    await skills.getByRole('button', { name: 'Runes', exact: true }).click();
    await skills.getByText(skill, { exact: true }).locator('..')
        .getByText(name, { exact: true }).click();
    return true;
}
