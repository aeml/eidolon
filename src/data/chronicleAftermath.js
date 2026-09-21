// Read-only story, unlocked by the existing authoritative completion receipt.
// No new quest, reward, currency, save field or access gate is introduced.
export function hasCompletedDarkKing(quests = []) {
    return quests.some(quest => quest.id === 'chronicle_15_dark_king' && quest.completed === true);
}

export const CHRONICLE_AFTERMATH = {
    title: 'A Letter Without a Throne',
    introduction: `Ilyra has cleared the war maps from her desk. In their place lies an envelope, held flat beneath an ordinary cup.

“Selen found this in the courier satchel recovered from Malachar’s court. No royal seal. No command. The folds contain a little soil, a ring of dried salt, a scorch mark and a blue thread. Four roads carried it, though none of our surviving ledgers records the journey.”

She turns the envelope over. Where an address should be, someone has written: To whoever is willing to answer.

“The letter inside is shorter.” Ilyra lets you read it yourself.

Does your road reach anyone who has stopped being useful?

There is no signature. Below the question, a space has been left for a reply.`,
    topics: [
        {
            id: 'survivors', question: 'What happens to the people beyond the shore?',
            answer: `“The thirty-first cup is still on the table. This morning its owner asked for a second helping. Nobody amended the manifest.”

Ilyra unfolds a message written in several hands.

“Dain has offered crossings, not evacuation orders. Tovin wants to travel with his sister before deciding where to live. The archive’s witnesses are keeping their disagreements beside one another; Hessa sent fresh paper rather than an official account. Maelin is teaching the foundry workers how to tend a light that does not burn a prisoner’s memories.

“Some people in the City Without Tomorrow opened their doors. Some kept them closed for another day. Both choices were possible. That is not the end of their troubles, and we must not call it that. But the bells no longer make the decision for them.”`
        },
        {
            id: 'king', question: 'Is this another message from Malachar?',
            answer: `“Malachar is dead. Do not let an unanswered question take that victory from you.”

Ilyra rests a hand on the empty place where his map once lay.

“Some of his commands still echo along the elemental roads. The disturbances are wounds we must tend, not proof that he survived. This letter is different. The ink asks something of its reader without binding the answer. His court kept petitions; perhaps someone hid one before its words could be corrected. Perhaps it never belonged to his court at all.

“I will not call uncertainty an enemy simply because I once failed to recognize a friend as one.”`
        },
        {
            id: 'sender', question: 'Can the crystals tell us who sent it?',
            answer: `“Orun remembers a doorstep. Neris remembers a hand pulling back from cold water. Pyralis remembers a fire allowed to go out. Aeral remembers the pause before someone spoke. They are not coordinates, and I will not force them into a map.”

She smiles, a little ruefully.

“There are still four crystals, four voices freely joined. We did not discover a hidden master behind their covenant. We discovered how much a keeper’s account can leave out. Somewhere a person asked whether a road was still theirs when they had nothing left to offer it.

“The mystery is not whether we can command that person to appear. It is whether we can make an honest reply.”`
        },
        {
            id: 'answer', question: 'What answer will you send?',
            answer: `“Not one bearing only my name. I have asked Selen to examine the thread. Mara is deciding where a visitor might sleep. Dain wants the paper kept dry; Hessa has opinions about the cup I am using as a weight. Already the answer is becoming less like a proclamation.”

Ilyra leaves the blank space untouched.

“Speak with Mara and Selen in the southern plaza if you wish. Help quiet the roads when an echo troubles them. Travel with your friends, return to a craft, or rest. No new war begins tonight, and no daily tally will decide whether you have done enough.

“When we find a way to send this, I want to be able to write: Yes. There is a place for you here. And I want it to be true.”`
        }
    ]
};

export const AFTERMATH_WITNESS_TOPICS = {
    'chronicle-witness-mara': [{
        id: 'unaddressed_guest', requiresDarkKing: true,
        question: 'Ilyra says you are making room for the letter’s sender.',
        answer: `“For a guest. We do not know whether it will be that particular person.” Mara folds a clean blanket without hurrying.

“Ilyra asked what I would promise someone who had nothing useful to give us. I told her to stop making the invitation sound like a test. A person may be tired. They may be old, or frightened, or simply unwilling to spend every day proving they deserve the next one.

“There is a chair beside the kettle. Sometimes it holds mending. We can move the mending. That part of the answer does not require a wizard.”`
    }],
    'chronicle-witness-selen': [{
        id: 'unaddressed_thread', requiresDarkKing: true,
        question: 'What did you learn from the blue thread in Ilyra’s letter?',
        answer: `Selen holds the blue strand beside the red one on her wrist. They turn in different directions although the same breeze touches both.

“I can tell you what I observed. I cannot yet tell you what it means. The blue strand moves during the interval between the Skyglass’s notes. Not before the sound. Not after. In the place we used to mark as silence.”

She closes her notebook, leaving a finger between the pages.

“I have not drawn a fifth road on the chart. That would make a lovely story and a poor measurement. I have left a space for the next observation. If someone is waiting at the other end, I would rather arrive with a question than another king’s certainty.”`
    }]
};
