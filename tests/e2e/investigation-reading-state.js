// A normal combat click can reach the evidence prop after its foreground enemy
// dies. Do not issue world movement underneath the resulting lore window.
// The caller still verifies the exact entry, server credit and manual turn-in.
export async function resumeInvestigationReading(page, evidence, inspect) {
    if (await evidence.isVisible() && await evidence.getAttribute('open') !== null) {
        return 'already-open';
    }
    const journal = page.locator('#quest-journal');
    if (await journal.isVisible()) {
        await page.locator('#btn-close-journal').click();
    }
    await inspect();
    return 'inspected';
}
