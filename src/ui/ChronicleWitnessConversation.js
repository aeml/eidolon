import { CHRONICLE_WITNESSES } from '../data/chronicleWitnesses.js';
import { getRecordedChronicleDiscoveries } from '../core/ChronicleInvestigation.js';
import { hasChronicleRestoration } from '../core/ChronicleRestoration.js';

export function getWitnessConversation(id, quests = []) {
    const witness = CHRONICLE_WITNESSES.find(value => value.id === id);
    if (!witness) return null;
    const recorded = new Set(quests.flatMap(getRecordedChronicleDiscoveries).map(site => site.id));
    const restored = hasChronicleRestoration(quests, witness.realm);
    return { ...witness, topics: witness.topics.filter(topic =>
        (!topic.requiresDiscovery || recorded.has(topic.requiresDiscovery)) && (!topic.restored || restored)) };
}

export function renderWitnessConversation(ui, quests) {
    const witness = getWitnessConversation(ui.witnessId, quests || []);
    const player = ui.ctx.getLastPlayer?.();
    if (!witness || !player || player.id !== ui.witnessPlayerId || player.state === 'DEAD') {
        ui.closeQuestWindow();
        ui.questList.replaceChildren();
        return;
    }
    const signature = JSON.stringify([witness.id, player.id, witness.topics.map(topic => topic.id)]);
    if (signature === ui.witnessSignature) return;
    ui.witnessSignature = signature;
    const open = new Set([...ui.questList.querySelectorAll('details[open]')].map(topic => topic.dataset.witnessTopic));
    const scroll = ui.questList.scrollTop;
    ui.questList.replaceChildren();
    ui.questActions?.replaceChildren();
    ui.questWindow.classList.add('is-story');
    const heading = ui.questWindow.querySelector('.window-header > span');
    if (heading) heading.textContent = `${witness.name.toUpperCase()} · VOICES OF THE COVENANT`;
    const intro = document.createElement('p');
    intro.className = 'quest-conversation__intro';
    intro.textContent = witness.introduction;
    ui.questList.append(intro);
    for (const topic of witness.topics) {
        const record = document.createElement('details');
        record.className = 'quest-dialogue quest-dialogue__lore';
        record.dataset.witnessTopic = topic.id;
        record.open = open.has(topic.id);
        const question = document.createElement('summary');
        question.textContent = topic.question;
        record.append(question);
        for (const paragraph of topic.answer.split(/\n\s*\n/)) {
            const speech = document.createElement('p');
            speech.className = 'quest-dialogue__speech';
            speech.textContent = paragraph;
            record.append(speech);
        }
        ui.questList.append(record);
    }
    const hint = document.createElement('p');
    hint.textContent = 'Optional conversation · More to discuss as you record field evidence and restore the crystals. Ilyra remains your story quest giver.';
    ui.questList.append(hint);
    ui.questList.scrollTop = scroll;
}
