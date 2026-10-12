import { chronicleExpeditions } from './chronicleExpeditions.generated.js';
import { chronicleInvestigations as regionalInvestigations } from './chronicleInvestigations.generated.js';
import { darkRealmChapters } from './darkRealmChronicle.generated.js';

export { darkRealmChapters };
export const chronicleInvestigations = [...regionalInvestigations, ...chronicleExpeditions.filter(q => q.type === 'INVESTIGATE').map(q => ({...q, summary: q.lore})), ...darkRealmChapters.filter(chapter => chapter.type === 'INVESTIGATE')];
export const darkRealmChaptersById = new Map(darkRealmChapters.map(chapter => [chapter.id, chapter]));
