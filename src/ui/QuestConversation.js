export const ILYRA_REPLIES = [
    'Listen—the bell has lost a note. These echoes bear Malachar’s binding, a signature I hoped never to hear again. I once called him a fellow keeper. He learned the roads between the sanctums from our own maps. We will begin where his wound runs deepest: the Rootheart.',
    'There is rain inside this seed, and a forest older than language. I will keep these memories safe for Maelin’s Vigil. They are repair materials, not a cure by themselves. First you must reach the root-road beneath the Bastion; the Sentinel has forgotten whom it guards.',
    'The Sentinel’s oath is free, and Orun has shown us the raid-road. Do not mistake an open door for a healed crystal. Its inner sanctum is still occupied. We must uncover the other three roads before Maelin can carry out the four Vigils without the broken crystals tearing one another apart.',
    'The pearls are beginning to turn in my palm. Neris remembers every promise made beside water—including the oath Malachar broke. I will preserve their rhythm until Maelin can fit them into the Tidestar. Now we need the route-name Thalorath swallowed.',
    'You have given the Confluence its name again. Malachar thought a thing stripped of its name could be made his possession. Neris has answered him: memory can be wounded, but not owned. The second raid-road is ours. Fire is calling next.',
    'This ore warms the hand without burning it. That is the old compact: flame must serve a purpose beyond hunger. Maelin can forge it into a new circuit, but only within the Crucible. Infernax guards the furnace-key beneath his endless war.',
    'The furnace-key has gone quiet. Infernax called an endless battle victory; Malachar taught him that lie. We now have three paths to the crystal chambers. One remains above us, where Aeral’s wind repeats a single stolen moment.',
    'Each pinion holds a different thunderclap. The storm was never meant to speak with one voice. I will bind these fragments for Maelin, not imprison them. Break Zephyrion’s loop and let Aeral choose a direction again.',
    'All four raid-roads are open. Now comes the work no solitary spell can do. Maelin will align the facets while the Eidolons restore their memories. You must clear each occupying raid and defend every Vigil. Begin at the Rootheart; stone must carry the first returning note.',
    'Orun’s pulse has reached the roots beneath this tower. You and Maelin have truly restored the Rootheart—not merely driven away its captors. Its steady note will shelter the next repair. Take the Moon-Tide Pearls to the Confluence and give Neris her returning current.',
    'The wells have begun to sing again. Neris remembers the names of everyone who stood at the Vigil. Earth and Water can now hold the circuit while Maelin reforges the Ember Crown. Carry their patience into the Crucible; purposeful flame must not become vengeance.',
    'For the first time in years, this candle gives warmth without a shadow-flame. Pyralis is free to change instead of consume. Only the Skyglass remains. Protect Maelin in the Eyrie, and the wind will carry all four voices together.',
    'Four notes, each freely given. I can hear them without pain at last. Their resonance reveals the Umbral Nexus, but the Devourer is feeding on the chord. Silence it there, and I can hold the fourfold resonance steady long enough to open the Dark Realm portal.',
    'The portal is open. Before you go, know this: Malachar was not born a shadow. He chose command over covenant, one frightened decision at a time. He will offer that same bargain to you. Refuse it. Orun, Neris, Pyralis, and Aeral will each stand beside you when his court breaks into battle.',
    'The bells are ringing above the ground. Malachar is dead, but the answer to him is not another throne. It is the defenders who held Maelin’s circle, the four spirits who chose to help, and you, who returned when we asked. Rest now. Eidolon is still imperfect—and it is free.'
];

export function renderQuestConversation(ui, quests) {
    const story = ui.questKind === 'story';
    const speaker = story ? 'Archmage Ilyra' : 'Quest Giver';
    ui.questWindow?.classList.toggle('is-story', story);
    const heading = ui.questWindow?.querySelector('.window-header > span');
    if (heading) heading.textContent = story ? 'ARCHMAGE ILYRA · THE FOURFOLD CHRONICLE' : 'QUEST GIVER · DAILY CONTRACTS';
    ui.clearElement(ui.questList);
    const text = (tag, content, className = '') => {
        const element = document.createElement(tag);
        element.textContent = content;
        element.className = className;
        return element;
    };
    const button = (label, action, className = 'menu-btn') => {
        const element = text('button', label, className);
        element.type = 'button';
        element.addEventListener('click', action);
        return element;
    };
    const redraw = () => { ui.questWindowSignature = ''; ui.updateQuestWindow(quests); };
    const intro = text('p', story
        ? '“The crystals cannot heal themselves. Let me guide you, and together we will save Eidolon.”'
        : '“Lanternhold needs steady hands. Choose your contracts, then return to me when the work is done.”', 'quest-conversation__intro');
    ui.questList.appendChild(intro);
    if (ui.completedDialogue) {
        const quest = ui.completedDialogue;
        const response = text('section', '', 'quest-dialogue');
        response.setAttribute('aria-live', 'polite');
        response.append(text('div', 'QUEST COMPLETE', 'quest-dialogue__eyebrow'), text('h3', ui.getQuestTitle(quest)));
        response.append(text('p', story ? ILYRA_REPLIES[(quest.chapter || 1) - 1] : '“Good work. Fewer dangers on the road means more people make it home tonight. Your reward is earned; speak to me again when you are ready for another contract.”', 'quest-dialogue__speech'));
        response.append(text('p', `Reward received · ${ui.getQuestRewardLabel(quest, { claimed: true })}`, 'quest-dialogue__reward'));
        response.append(button(story ? 'Continue conversation' : 'Browse contracts', () => {
            ui.completedDialogue = null;
            ui.selectedQuestId = null;
            redraw();
        }));
        ui.questList.appendChild(response);
        return;
    }
    const offered = (quests || []).filter((quest) =>
        (quest.category === 'chronicle' || Boolean(quest.id?.startsWith('chronicle_'))) === story && !quest.completed);
    const selected = offered.find((quest) => quest.id === ui.selectedQuestId) || (story ? offered[0] : null);
    if (!selected) {
        if (!offered.length) ui.questList.appendChild(text('p', story ? '“The four crystals sing freely. You will always be welcome here, friend of Eidolon.”' : 'No contracts remain today. New contracts arrive at the daily reset.', 'quest-dialogue__speech'));
        offered.forEach((quest) => {
            const ready = quest.accepted && quest.count >= quest.maxCount;
            const status = ready ? '?' : quest.accepted ? '·' : '!';
            const row = button('', () => { ui.selectedQuestId = quest.id; redraw(); }, 'quest-contract');
            row.append(text('span', status, 'quest-contract__marker'), text('span', ui.getQuestTitle(quest)), text('small', ready ? 'Ready to complete' : quest.accepted ? `${quest.count} / ${quest.maxCount}` : 'Available'));
            ui.questList.appendChild(row);
        });
        return;
    }
    const ready = selected.accepted && selected.maxCount > 0 && selected.count >= selected.maxCount;
    const detail = text('section', '', 'quest-dialogue');
    detail.append(text('div', story ? `CHAPTER ${selected.chapter} · ${speaker}` : 'DAILY CONTRACT', 'quest-dialogue__eyebrow'));
    detail.append(text('h3', ui.getQuestTitle(selected)));
    detail.append(text('p', selected.description || 'Help keep the roads around Eidolon safe.', 'quest-dialogue__speech'));
    if (story && selected.lore) {
        const lore = text('details', '', 'quest-dialogue__lore');
        lore.append(text('summary', 'Ask Ilyra about the history'), text('p', selected.lore));
        detail.appendChild(lore);
    }
    detail.append(text('p', ui.getQuestObjective(selected), 'quest-dialogue__objective'));
    detail.append(text('p', `${selected.count || 0} / ${selected.maxCount} · Reward: ${ui.getQuestRewardLabel(selected)}`, 'quest-dialogue__reward'));
    detail.append(text('p', 'At level 100, XP becomes Resonance XP. Any XP left over when you reach the cap also goes into Resonance.', 'quest-dialogue__status'));
    if (!selected.accepted || ready) {
        const action = button(ready ? 'Complete Quest' : 'Accept Quest', () => {
            ui.pendingQuestAction = { quest: { ...selected, rewardLabelAtTurnIn: ui.getQuestRewardLabel(selected) }, complete: ready };
            action.disabled = true;
            action.textContent = 'Waiting for reply…';
            if (ready) ui.onCompleteQuest?.(selected.id);
            else ui.onAcceptQuest?.(selected.id);
        });
        action.disabled = Boolean(ui.pendingQuestAction);
        detail.appendChild(action);
    } else detail.append(text('p', `Return to ${speaker} when your objectives are ready. Rewards are granted only when you click Complete Quest.`, 'quest-dialogue__status'));
    if (ui.questActionError) detail.append(text('p', ui.questActionError, 'quest-dialogue__status'));
    if (!story) detail.append(button('Back to contracts', () => { ui.selectedQuestId = null; redraw(); }));
    ui.questList.appendChild(detail);
}
