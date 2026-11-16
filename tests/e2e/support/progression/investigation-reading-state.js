// A normal combat click can reach the evidence prop after its foreground enemy
// dies. Do not issue world movement underneath the resulting lore window.
// The caller still verifies the exact entry, server credit and manual turn-in.
export async function investigationReadingOpen(evidence) {
    return await evidence.isVisible() && await evidence.getAttribute('open') !== null;
}

// An ordinary earlier prop click can be acknowledged while travel is pending.
// Reading that exact entry supersedes the approach, not the quest assertions.
export async function approachInvestigationReading(evidence, move) {
    if (await investigationReadingOpen(evidence)) return 'already-open';
    try { await move(); } catch (error) {
        if (!await investigationReadingOpen(evidence)) throw error;
        return 'already-open';
    }
    return await investigationReadingOpen(evidence) ? 'already-open' : 'approached';
}

export async function resumeInvestigationReading(page, evidence, inspect) {
    if (await investigationReadingOpen(evidence)) {
        return 'already-open';
    }
    const journal = page.locator('#quest-journal');
    if (await journal.isVisible()) {
        await page.locator('#btn-close-journal').click();
    }
    return await inspect() === 'already-open' ? 'already-open' : 'inspected';
}
