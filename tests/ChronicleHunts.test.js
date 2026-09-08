import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';
import { CHRONICLE_CHAPTER_COUNT } from '../src/core/ChronicleInvestigation.js';
import { getIlyraCompletionReply } from '../src/ui/QuestConversation.js';

test('all eight hunts share exact authored server/client content and count toward the Journal', () => {
    expect(chronicleHunts).toEqual(JSON.parse(fs.readFileSync('server/internal/game/content/chronicle-hunts.json', 'utf8')));
    expect(chronicleHunts).toHaveLength(8);
    expect(CHRONICLE_CHAPTER_COUNT).toBe(31);
    expect(() => execFileSync(process.execPath, ['scripts/generate-chronicle-hunts.mjs', '--check'])).not.toThrow();
});

test('first hunt sends new adventurers to the near roads without reducing the objective or reward budget', () => {
    const hunt = chronicleHunts.find(hunt => hunt.id === 'chronicle_earth_kept_watch');
    expect(hunt).toMatchObject({ minEnemyLevel: 3, count: 40, contentLevel: 10 });
    expect(hunt.acceptance).toContain('level 3 or higher');
    expect(hunt.acceptance).toContain('just beyond Lanternhold');
});

test.each(chronicleHunts)('$id has earned and retrospective replies and a correctly ordered invitation', hunt => {
    expect(getIlyraCompletionReply({id:hunt.id})).toBe(hunt.completion);
    expect(getIlyraCompletionReply({id:hunt.id,legacyOptional:true})).toBe(hunt.catchupCompletion);
    expect(getIlyraCompletionReply({id:hunt.previousQuestId})).toBe(hunt.handoff);
    if (hunt.previousQuestId.includes('chronicle_earth_keepers_house')) {
        expect(getIlyraCompletionReply({id:hunt.previousQuestId,legacyOptional:true})).not.toBe(hunt.handoff);
    }
});
