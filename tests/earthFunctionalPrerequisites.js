import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';

// The prepared functional route must traverse the same inserted chapters as a
// new player. This is orchestration only: the callback must earn each hunt.
export async function earnEarthHuntsBefore(nextChapter, earnHunt) {
    for (const hunt of chronicleHunts.filter(hunt => hunt.realm === 'earth' && hunt.beforeQuestId === nextChapter)) {
        await earnHunt(hunt);
    }
}
