// Optional, read-only voices. World positions are checked against the server
// spawn catalog; discoveries unlock discussion, never rewards or quest credit.
export const DARK_REALM_WITNESSES = [
    {
        id: 'dark-witness-maelin', name: 'Artificer Maelin', model: 'DwarfSalesman', x: 39988, z: 40800,
        introduction: 'Maelin steadies a trembling lantern with a folded scrap of copper. “Four crystals, four different answers. Keeping them in agreement is not the same as making them sound alike.”',
        topics: [
            { id: 'camp', question: 'How does the foothold keep us safe?', answer: '“The restored crystals recognize the promises we kept at their shrines. These lamps carry a little of that recognition here. Rest inside their circle when you need health and mana; the warmth will follow you for a while when you leave.\n\n“Ilyra holds the way home. Recall will take you to Lanternhold, and the guide can send you back. Nobody is required to prove their courage by staying wounded.”' },
            { id: 'shackles', requiresDiscovery: 'dark_earth_conduit', question: 'The burden engine removed the offer of help.', answer: '“That is the cruel part. It did not need to invent devotion. It took a decent thing and cut away every chance to put it down.\n\n“When we repaired the crystals, you defended me, but I did not repair them alone. The keepers taught me where to listen. The people who brought tools mattered too. We must restore that part of the memory—not find someone stronger to carry the same burden.”' },
            { id: 'after', requiresDarkKing: true, question: 'Can the lanterns come down now?', answer: '“Not tonight. Winning does not mend a roof or teach a frightened child to sleep through a bell. We will keep a light here until the people who use it tell us they no longer need it.\n\n“Then we will pack it away. A shelter ought to know how to end.”' }
        ]
    },
    {
        id: 'dark-witness-ren', name: 'Scout Ren', model: 'DungeonNPC', x: 40000, z: 40814,
        introduction: 'Ren pins four scraps of differently colored cloth to a hand-drawn map. One corner is deliberately left blank. “A route back is part of every route out.”',
        topics: [
            { id: 'roads', question: 'What lies beyond the camp?', answer: '“North is the shore. West of that, the archive; south from the archive, the foundry. The city lies east of the foundry, with another road back toward the shore.\n\n“I mark what I have seen, not what the royal signs insist is there. Keep your map open when choosing a route, close it before a patrol reaches you, and return to the lanterns before you run dry.”' },
            { id: 'signal', requiresDiscovery: 'dark_expedition_signal', question: 'Someone rewrote the expedition signal.', answer: '“I tied that red cloth there myself. I remember being cold and annoyed that I could not undo the knot with gloves on.\n\n“The corrected signal says nobody left. It cannot explain the knot. Keep small, ordinary details. They are harder to replace than a grand account that only one person is allowed to tell.”' },
            { id: 'after', requiresDarkKing: true, question: 'What goes in the blank part of the map?', answer: '“Someone else’s route. There are people here who know paths we never found. I want to ask them where they would like a road, before we announce where it belongs.”' }
        ]
    },
    {
        id: 'dark-witness-elin', name: 'Captain Elin', model: 'RespecNPC', x: 39900, z: 40548,
        introduction: 'The captain dries a passenger list against her coat. She looks past you to the ferry before speaking. “If you have come for a head count, count the cups.”',
        topics: [
            { id: 'boat', question: 'Why stay beside the ferry?', answer: '“People may come back looking for the place they last understood. I want someone to be here when they do.\n\n“I can see your camp’s lanterns. When the collectors let the others through, I will follow. Until then, this is still a landing, whatever the signs call it.”' },
            { id: 'manifest', requiresDiscovery: 'dark_ferry_manifest', question: 'You made room for an unregistered passenger.', answer: '“I moved a sack of flour. That was the whole miracle. A boy needed a seat, and a sack did not.\n\n“The clerk wanted a rule I could quote. I told him to carry the flour himself if it mattered that much. I was angry, not fearless. Please do not write the fear out when you tell it.”' },
            { id: 'after', requiresDarkKing: true, question: 'Where will the next crossing go?', answer: '“I have asked. Three want Lanternhold, two want to look for family, and one wants a day in which nobody asks. We will begin with those answers. There is no royal timetable left to keep.”' }
        ]
    },
    {
        id: 'dark-witness-oss', name: 'Clerk Oss', model: 'QuestNPC', x: 39200, z: 40548,
        introduction: 'Oss has turned his official badge face down. His pencil keeps tracing a square in the dust. “There used to be a column here. I cannot remember its heading.”',
        topics: [
            { id: 'work', question: 'Did you keep these records?', answer: '“I checked the totals. I told myself someone else checked the names. When a page came back blank, I stamped it again.\n\n“I did not think I was hurting anyone. That is an account of what I believed, not a request to be forgiven.”' },
            { id: 'mother', requiresDiscovery: 'dark_perfect_ledger', question: 'Was the question about your mother yours?', answer: '“Yes. I recognized my own handwriting before I recognized what I had asked. She made terrible tea. She would insist you take a second cup.\n\n“I have no form that can bring her back. But I can stop telling other people that a missing form makes their loss impossible.”' },
            { id: 'after', requiresDarkKing: true, question: 'What should become of the archive?', answer: '“Do not give it to me. Let the people named inside decide who may read it. I will carry boxes, and answer questions about what I did. Neither task requires a badge.”' }
        ]
    },
    {
        id: 'dark-witness-vara', name: 'Furnace Tender Vara', model: 'DwarfSalesman', x: 39180, z: 39568,
        introduction: 'Vara sits beside an unused pair of tongs, flexing each finger in turn. “I keep reaching for them before I decide to. Give me a moment.”',
        topics: [
            { id: 'shift', question: 'When did your last shift end?', answer: '“We stopped asking it that way. We asked whether the next furnace had enough fuel. There was always a next furnace.\n\n“The overseer knew all our families’ names. At first I thought that meant he cared. Later he used a different name whenever someone tried to sit down.”' },
            { id: 'finished', requiresDiscovery: 'dark_fire_conduit', question: 'The forge has no command for finished.', answer: '“My first teacher put a chipped bowl on the shelf. I wanted to grind the rim again. She filled it with stew and handed it to me.\n\n“Useful things leave the workshop. A blade that must be perfected forever never belongs to the person who needs it. I want to make a bowl again.”' },
            { id: 'after', requiresDarkKing: true, question: 'Will you help rebuild?', answer: '“Some days. Other days I will not. If that answer is allowed, then yes, this really is a different place.”' }
        ]
    },
    {
        id: 'dark-witness-oren', name: 'Baker Oren', model: 'RespecNPC', x: 40130, z: 39838,
        introduction: 'Oren holds a loaf so carefully that you expect it to break. “Still warm. That used to be good news.”',
        topics: [
            { id: 'safety', question: 'Did you want the king’s protection?', answer: '“My old bakery burned with the street. Nobody died, but I spent years hearing the beams fall whenever I closed my eyes. So yes. I asked for a morning without that sound.\n\n“Do not tell me I was foolish to want it. Help me find something better than being afraid forever—or never reaching evening.”' },
            { id: 'bread', requiresDiscovery: 'dark_bakers_ledger', question: 'Who is the extra loaf for?', answer: '“I do not know yet. That is why I make it. Someone might arrive hungry tomorrow. Someone might grow.\n\n“The bell keeps correcting my count. I keep kneading the dough. My hands remember a welcome my ledger has not learned to record.”' },
            { id: 'after', requiresDarkKing: true, question: 'How was the first new morning?', answer: '“I burned a loaf. Then I laughed until I had to sit down.\n\n“Tomorrow I will watch the oven more carefully. A mistake I can learn from feels different from a safety I cannot leave.”' }
        ]
    }
].map(witness => ({ ...witness, realm: 'dark', instanceId: 'dark-realm' }));
