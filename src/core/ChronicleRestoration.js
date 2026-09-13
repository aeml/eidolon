// Personal receipts from the authoritative quest snapshot, not shared-world
// flags or new quests/rewards. Completion still requires the manual turn-in.
export const CHRONICLE_RESTORATIONS = Object.freeze({
    earth: {
        questId: 'chronicle_10_rootheart_raid', title: 'Rootheart · shelter without an oath',
        text: 'New leaves gather beside Mara’s planting table. The roots have not erased the cracks in her house; they hold the earth beneath every doorway, including the empty ones. Orun’s protection no longer asks who belongs to the keeper.\n\nIlyra records a distinction for the next generation of wardens: repair is not a return to a world in which nothing happened. The scar remains visible, and the shelter is shared. The Memory Seeds preserved two hands planting a tree. Neither hand has vanished from the new growth.'
    },
    water: {
        questId: 'chronicle_11_tidestar_raid', title: 'Tidestar · a name, not a debt',
        text: 'Clear ripples reach the shelter’s mooring posts. Clean crossing cloths dry beside the old flood mark, which the keepers have deliberately left in place. A safe landing must remember how high the water rose.\n\nThe bell’s echo no longer answers with thirteen identical voices. Each answer arrives in its own time. Dain’s ledger still carries the scratched-out oath, but beneath it the name Tovin stays written. Neris has restored a promise to a person, not a claim upon him.'
    },
    fire: {
        questId: 'chronicle_12_ember_crown_raid', title: 'Ember Crown · a hearth anyone may tend',
        text: 'A small fire warms the communal kiln. New pots stand beside Hessa’s unfinished work; none carries a ruler’s seal. The tools remain outside, where she left them. The warmth does not cease when its keeper turns away.\n\nPyralis’s restored covenant allows a flame to do its work and end. Ash can feed a seed instead of repeating the same unfinished instant. Ilyra leaves Hessa’s first signature in the account, beside the record of her refusal. A mistake is not an oath to make the same choice forever.'
    },
    air: {
        questId: 'chronicle_13_skyglass_raid', title: 'Skyglass · an interval left open',
        text: 'Fresh pennants stir beside Selen’s instruments. Their cloth never settles into quite the same fold twice. A red thread remains tied to the observatory rail: not a charm to command the weather, but a reminder to notice when a story repeats too perfectly.\n\nThe updraft answers other currents beyond its old cage. A sheltering wind may still change; a traveler may still choose another road. Ilyra records the silence between the Skyglass notes as carefully as their sound. Malachar heard an imperfection there. The covenant leaves room for an answer.'
    }
});

export function hasChronicleRestoration(quests, realm) {
    const receipt = CHRONICLE_RESTORATIONS[realm]?.questId;
    return Boolean(receipt && quests?.some(quest => quest.id === receipt && quest.completed === true));
}
