import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';
import { CHRONICLE_CHAPTER_COUNT } from '../src/core/ChronicleInvestigation.js';
import { getIlyraCompletionReply } from '../src/ui/QuestConversation.js';

test('all hunts share authored server/client content and count toward the Journal', () => {
    const primary = JSON.parse(fs.readFileSync('server/internal/game/content/chronicle-hunts.json', 'utf8'));
    const expeditions = JSON.parse(fs.readFileSync('server/internal/game/content/chronicle-expeditions.json', 'utf8'));
    expect(chronicleHunts).toEqual([...primary.map(hunt => ({...hunt, beforeQuestId: expeditions.find(q => q.previousQuestId === hunt.id)?.id || hunt.beforeQuestId})),
        ...expeditions.filter(q => q.type === 'KILL').map(({type: _type, rewardGold: _gold, ...hunt}) => hunt)]);
    expect(chronicleHunts).toHaveLength(31);
    expect(CHRONICLE_CHAPTER_COUNT).toBe(117);
    expect(() => execFileSync(process.execPath, ['scripts/generate-chronicle-hunts.mjs', '--check'])).not.toThrow();
});

test('first hunt sends new adventurers to the near roads with a paced objective and proportional reward', () => {
    const hunt = chronicleHunts.find(hunt => hunt.id === 'chronicle_earth_kept_watch');
    expect(hunt).toMatchObject({ minEnemyLevel: 3, count: 18, contentLevel: 10 });
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
