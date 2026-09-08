import { CONSTANTS } from '../src/core/Constants.js';

// Prepared functional fixture only. Plan ordinary purchases from an existing
// point budget; never reset a build or manufacture points to complete this plan.
export function preparedWizardTraining({ talentPoints, talentRanks = {} }) {
    if (!Number.isInteger(talentPoints) || talentPoints < 0) throw new Error('Invalid talent point budget');
    let remaining = talentPoints;
    return ['WIZ_01', 'WIZ_27', 'WIZ_02'].map(id => {
        const talent = CONSTANTS.PASSIVE_TALENTS.Wizard.find(talent => talent.id === id);
        const initialRank = talentRanks[id] ?? 0;
        if (!talent || !Number.isInteger(initialRank) || initialRank < 0 || initialRank > talent.maxRank) {
            throw new Error(`Invalid prepared talent ${id}`);
        }
        const purchases = Math.min(remaining, talent.maxRank - initialRank);
        remaining -= purchases;
        return { id, name: talent.name, initialRank, purchases };
    });
}
