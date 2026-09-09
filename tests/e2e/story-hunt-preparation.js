import { returnToTown } from './helpers.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { prepareEarnedClass } from './fresh-ready-route.js';
import { equipEarnedEmptySlots } from './earned-equipment.js';

// A milestone can be earned far outside town. The guide helper approaches a
// nearby town NPC; it is not a cross-realm travel or recall helper.
export async function prepareStoryHuntBuild(page, credentials, current, label) {
    if (current.level < 10) {
        await equipEarnedEmptySlots(page);
        return;
    }
    await returnToTown(page);
    await openDungeonGuide(page);
    await prepareEarnedClass(page, credentials, { label, statBudget: current.statPoints });
    await page.locator('#btn-close-dungeon-menu').click();
}
