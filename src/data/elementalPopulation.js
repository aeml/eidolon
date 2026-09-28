import { chronicleInvestigations } from './chronicleInvestigations.generated.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from './dungeonEntrances.js';

const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
};
const story = id => {
    const site = chronicleInvestigations.flatMap(chapter => chapter.sites).find(site => site.id === id);
    if (!site) throw new Error(`Missing elemental population anchor: ${id}`);
    return { x: site.x, z: site.z, source: { kind: 'investigation', id } };
};
const entrance = id => {
    const entry = DUNGEON_ENTRANCE_DEFINITIONS[id];
    if (!entry) throw new Error(`Missing elemental entrance: ${id}`);
    return { x: entry.position[0], z: entry.position[2], source: { kind: 'entrance', id } };
};

// Shared authored anchors for physical scenery, foliage clearings, readings
// and atlas destinations. Existing story IDs and authority remain unchanged.
export const WATER_LOCATIONS = freeze([
    { id: 'flood-shelter', name: 'The Abandoned Flood Shelter', region: 'water', role: 'story', recipe: 'mooring-yard',
        ...story('dain_ledger'), radius: 20, visibility: 'quest',
        purpose: 'Evacuation ropes and tide marks surround Dain’s shelter. Its ledger remains part of Ilyra’s investigation.' },
    { id: 'false-reflection', name: 'The False Reflection', region: 'water', role: 'story', recipe: 'echo-bank',
        ...story('mooring_bell'), radius: 22, visibility: 'quest',
        purpose: 'An exposed mooring frames the two echo pools and their bell; follow the existing investigation in order.' },
    { id: 'abyssal-approach', name: 'Abyssal Well Approach', region: 'water', role: 'landmark', recipe: 'tide-procession',
        ...entrance('abyssal_well'), radius: 68, arrivalOffset: [0, 48], visibility: 'public',
        purpose: 'Flood gauges mark the old procession route. Gather south of the Well, outside its entrance.' },
    { id: 'tide-rib', name: 'The Tide Rib', region: 'water', role: 'landmark', recipe: 'tide-rib',
        x: 0, z: -1170, radius: 24, visibility: 'public',
        purpose: 'A ribbed tide-measuring arch spans a dry trail. Its unreachable upper marks record floods, not a climbing route.' },
    { id: 'castaways-refuge', name: 'Castaways’ Refuge', region: 'water', role: 'camp', recipe: 'sail-shelter',
        x: -360, z: -980, radius: 26, visibility: 'public',
        purpose: 'A deserted sailcloth shelter surrounds a cold cookpot. This camp is combat territory, not a safe zone.' },
    { id: 'stranded-flotilla', name: 'The Stranded Flotilla', region: 'water', role: 'camp', recipe: 'boat-grave',
        x: 230, z: -1780, radius: 30, visibility: 'public',
        purpose: 'Broken boat ribs and abandoned salvage lie on exposed ground. Walk between the hulls; their decks are not traversable.' },
    { id: 'soundings-stone', name: 'Soundings Stone', region: 'water', role: 'lore', recipe: 'sounding-gauge',
        x: -400, z: -1600, radius: 15, visibility: 'public', readingOffset: [6, -6],
        purpose: 'Read a tidekeeper’s record of the night the water stopped answering. Optional lore, without rewards or saved discovery credit.',
        reading: { title: 'The Depth That Would Not Change',
            introduction: 'Lead weights hang beside a slate of measurements. The final seven lines give exactly the same depth.',
            paragraphs: [
                'A good sounding is an argument with yesterday. Wind, rain and the breathing ice all have their say. We lower the weight again because yesterday’s certainty is not a promise that the water has made to us.',
                'For seven nights the line has returned the same answer. The weight comes up dry. My apprentice called it peace until we heard a child crying beneath the measuring bell, repeating the same breath without drawing another.',
                'Someone has taught the tide to preserve an instant instead of carrying it onward. We have cut the bell rope, not the rescue lines. If the waters move again, let the first thing they carry be someone living.'
            ] } },
    { id: 'unclaimed-names', name: 'The Unclaimed Names', region: 'water', role: 'lore', recipe: 'name-mooring',
        x: 430, z: -1220, radius: 15, visibility: 'public', readingOffset: [6, -6],
        purpose: 'Read the rescue crew’s names beside an empty mooring. Optional lore; this place gives no protection or quest credit.',
        reading: { title: 'No Toll for the Remembered',
            introduction: 'Small nameplates cover a mooring post. The newest plaque is blank, its cord already tied for the next person.',
            paragraphs: [
                'We used to record what each boat carried: barrels, wool, salt, six sacks of grain. After the first flood we began recording who stepped ashore. There is no column for what they could pay.',
                'The reflection beneath the pier offered to return our lost crew if we gave it the names of those still breathing. It used my sister’s voice. I nearly answered before I remembered she always called me by the wrong nickname.',
                'Memory is a way of keeping company, not a deed of ownership. We left the blank plate for a stranger and rowed back into the storm. Whatever wears our loved ones’ faces will not decide who we rescue.'
            ] } }
]);

export const FIRE_LOCATIONS = freeze([
    { id: 'communal-kiln', name: 'The Cold Communal Kiln', region: 'fire', role: 'story', recipe: 'kiln-yard',
        ...story('hessa_ledger'), radius: 22, visibility: 'quest',
        purpose: 'Cooling racks and empty fuel baskets surround Hessa’s kiln. Its ledger belongs to the existing Chronicle.' },
    { id: 'command-scar', name: 'The Command Scar', region: 'fire', role: 'story', recipe: 'exhaust-channel',
        ...story('cold_ash'), radius: 25, visibility: 'quest',
        purpose: 'A broken exhaust channel links the cold ash, command anchor and released ember. Existing combat and inspection prerequisites still apply.' },
    { id: 'molten-approach', name: 'Molten Core Approach', region: 'fire', role: 'landmark', recipe: 'furnace-procession',
        ...entrance('molten_core'), radius: 68, arrivalOffset: [52, 0], visibility: 'public',
        purpose: 'Old heat baffles shelter the eastern gathering approach. Meet outside the gate; the northern trail bypasses the entrance.' },
    { id: 'kiln-span', name: 'The Kiln Span', region: 'fire', role: 'landmark', recipe: 'kiln-span',
        x: -1740, z: 240, radius: 24, visibility: 'public',
        purpose: 'A broken furnace flue forms an arch over the ash road. Its cold ribs guide travelers around the active lava fields.' },
    { id: 'workers-court', name: 'The Workers’ Court', region: 'fire', role: 'camp', recipe: 'workers-court',
        x: -1450, z: 500, radius: 26, visibility: 'public',
        purpose: 'A deserted shift shelter retains shared benches and meal tins. This is combat territory, not a safe zone.' },
    { id: 'quenched-foundry', name: 'The Quenched Foundry', region: 'fire', role: 'camp', recipe: 'quenched-foundry',
        x: -2150, z: -170, radius: 28, visibility: 'public',
        purpose: 'Open casting frames, cooling molds and broken bellows remain after an evacuation. The central working aisle stays open.' },
    { id: 'commons-register', name: 'The Commons Register', region: 'fire', role: 'lore', recipe: 'kiln-register',
        x: -1880, z: 600, radius: 15, visibility: 'public', readingOffset: [6, -6],
        purpose: 'Read the kiln workers’ account of refusing a royal quota. Optional lore; no currency, item or quest reward.',
        reading: { title: 'The Last Communal Firing',
            introduction: 'A fired-clay register stands among unglazed cups. A royal seal has been pressed into the margin, then crossed out.',
            paragraphs: [
                'The kiln belonged to the village because every house had carried a stone for it. We fired roof tiles beside funeral bowls and left space for anyone who arrived with a handful of clay.',
                'The inspector said warmth was a privilege of the obedient. His seal made the coals lean toward him like grass in wind. Hessa asked whose children should freeze while he counted the bowls, and no one put down their tools.',
                'We opened the dampers before his order could close around the fire. The last firing spoiled, but everyone left together. Keep one cracked cup: not as proof that we failed, but that nothing living was fed to his perfect furnace.'
            ] } },
    { id: 'counterseal-stone', name: 'The Counterseal Stone', region: 'fire', role: 'lore', recipe: 'counterseal',
        x: -2630, z: -220, radius: 15, visibility: 'public', readingOffset: [6, -6],
        purpose: 'Read an engineer’s warning beside a dismantled command conduit. Optional lore, not a repair objective or safe place.',
        reading: { title: 'Heat Is Not Allegiance',
            introduction: 'A split iron collar lies below a mason’s tablet. Its two halves have been hammered flat so they cannot close again.',
            paragraphs: [
                'The first collar merely directed heat away from the workers. The second demanded a spoken order before it would open. By the third, the furnace answered to a distant throne and refused to warm the hands that had built it.',
                'We mistook precision for care. Every new command made the numbers steadier while the people beside the gauges grew colder. The dark messenger never asked us to extinguish the fire; he asked us to decide who deserved it.',
                'I have broken the returning circuit and left the channel open. A flame may need a hearth, but it does not need a king. Whoever repairs the great crystal must restore its generosity, not merely teach it to obey a kinder voice.'
            ] } }
]);

export const AIR_LOCATIONS = freeze([
    { id: 'open-observatory', name: 'The Open Observatory', region: 'air', role: 'story', recipe: 'chart-court',
        ...story('selen_journal'), radius: 23, visibility: 'quest',
        purpose: 'Weather charts and dismantled sighting frames surround Selen’s observatory. Her journal remains part of the existing investigation.' },
    { id: 'silent-weatherworks', name: 'The Silent Weatherworks', region: 'air', role: 'story', recipe: 'vane-array',
        ...story('silent_vane'), radius: 25, visibility: 'quest',
        purpose: 'Unmoving vanes frame the trapped updraft and freed horizon. Follow Ilyra’s existing evidence sequence; these frames do not grant credit.' },
    { id: 'spire-muster', name: 'Tempest Spire Muster', region: 'air', role: 'landmark', recipe: 'courier-muster',
        ...entrance('tempest_spire'), radius: 64, arrivalOffset: [-45, 0], visibility: 'public',
        purpose: 'Courier standards mark a gathering court west of the Spire. Meet outside its gate; the southern trail passes around the tower.' },
    { id: 'horizon-orrery', name: 'The Horizon Orrery', region: 'air', role: 'landmark', recipe: 'horizon-orrery',
        x: 1810, z: 130, radius: 26, visibility: 'public',
        purpose: 'An open instrument frames the moving sky above the road. Walk beneath its suspended rings; it is not a portal or climbable platform.' },
    { id: 'couriers-exchange', name: 'Couriers’ Exchange', region: 'air', role: 'camp', recipe: 'courier-exchange',
        x: 1460, z: -160, radius: 27, visibility: 'public',
        purpose: 'Open sorting bays and anchored mail sails await couriers who never returned. This abandoned workspace is combat territory.' },
    { id: 'weatherkeepers-bivouac', name: 'Weatherkeepers’ Bivouac', region: 'air', role: 'camp', recipe: 'weather-bivouac',
        x: 2250, z: 540, radius: 28, visibility: 'public',
        purpose: 'Low windbreaks shelter empty bedrolls and rescued charts. The central aisle is open; the camp provides no safe-zone recovery.' },
    { id: 'unsent-dispatch', name: 'The Unsent Dispatch', region: 'air', role: 'lore', recipe: 'dispatch-frame',
        x: 2020, z: -460, radius: 18, readingOffset: [6, -6], visibility: 'public',
        purpose: 'Read a courier’s last unsent dispatch. Optional lore, with no item, reward or saved discovery claim.',
        reading: { title: 'Leave the Route Unfinished',
            introduction: 'A waterproof dispatch case hangs beside an empty route board. Its seal was broken from the inside.',
            paragraphs: [
                'We carried weather warnings, marriage promises and news of ordinary births. Every delivery ended with a question: where next? The wind knew more roads than our maps, and a courier was allowed to change her mind.',
                'Then every vane pointed toward the same distant throne. Dispatches arrived before their writers had chosen the words. My own hand had signed an order to abandon the valley, though I had spent the morning carrying its children uphill.',
                'I have left the last route blank. Selen says a forecast is a possibility, not a command. If you find this case, take whatever path brings someone home. No king gets to write the journey before we have lived it.'
            ] } },
    { id: 'unmeasured-sky', name: 'The Unmeasured Sky', region: 'air', role: 'lore', recipe: 'sky-measure',
        x: 2790, z: 790, radius: 18, readingOffset: [6, -6], visibility: 'public',
        purpose: 'Read a weatherkeeper’s field note beside an unbound measuring ring. Optional lore; no protection or progression credit.',
        reading: { title: 'An Instrument Must Listen',
            introduction: 'The sighting ring has been unbolted from its royal bearing. A note is pinned beneath a handful of stones.',
            paragraphs: [
                'Our instruments once disagreed. A shepherd at the lower ridge would see rain while we saw clear sky. We kept both readings because the mountain was larger than either of us, and tomorrow might need the shepherd’s answer.',
                'The new governor called disagreement a defect. He tied every instrument to a single bearing until even the clouds bent to match his chart. The records became immaculate. The birds stopped crossing the ridge.',
                'We loosened the bearing one bolt at a time. The first breath that escaped carried no message and owed us nothing. When the crystal sings freely again, keep room in every chart for a wind you did not predict.'
            ] } }
]);

export const AIR_PATHS = freeze([
    { id: 'air-passage', width: 8, points: [[1000,200],[1410,200],[1490,130],[2250,130],[2280,200],[2355,200]] },
    { id: 'spire-bypass', width: 6, points: [[2280,200],[2300,280],[2510,280],[2630,310],[2820,310],[2920,260]] },
    { id: 'observatory-path', width: 4, points: [[1080,200],[1080,290],[1150,290],[1150,254]] },
    { id: 'weatherworks-path', width: 4, points: [[1080,200],[1080,155],[1160,155]] },
    { id: 'exchange-path', width: 6, points: [[1410,200],[1410,-110],[1460,-110],[1460,-160]] },
    { id: 'bivouac-path', width: 6, points: [[2510,280],[2510,590],[2250,590],[2250,540]] },
    { id: 'dispatch-path', width: 6, points: [[2020,130],[1980,-120],[1980,-330],[2020,-420],[2020,-460]] },
    { id: 'sky-measure-path', width: 6, points: [[2820,310],[2790,390],[2790,790]] }
]);

export const WATER_PATHS = freeze([
    { id: 'water-passage', width: 8, points: [[0,-600],[0,-950],[35,-975],[35,-1025],[0,-1050],[0,-1352]] },
    { id: 'well-bypass', width: 6, points: [[0,-1300],[-70,-1320],[-70,-1480],[0,-1500],[0,-1880],[35,-1910],[35,-1985],[0,-2015],[0,-2150]] },
    { id: 'flood-shelter-path', width: 4, points: [[0,-710],[-60,-710],[-60,-733]] },
    { id: 'echo-pools-path', width: 4, points: [[0,-820],[-40,-815],[-74,-817]] },
    { id: 'castaways-path', width: 6, points: [[0,-1050],[-360,-980]] },
    { id: 'soundings-path', width: 6, points: [[-70,-1480],[-260,-1520],[-400,-1600]] },
    { id: 'names-path', width: 6, points: [[0,-1210],[80,-1240],[280,-1235],[430,-1220]] },
    { id: 'flotilla-path', width: 6, points: [[0,-1800],[0,-1740],[230,-1740],[230,-1780]] }
]);
export const FIRE_PATHS = freeze([
    { id: 'fire-passage', width: 8, points: [[-1000,200],[-1450,200],[-1490,240],[-2200,240],[-2250,200],[-2348,200]] },
    { id: 'core-bypass', width: 6, points: [[-2250,200],[-2290,280],[-2510,280],[-2590,240],[-2800,240],[-2920,200]] },
    { id: 'communal-kiln-path', width: 4, points: [[-1100,200],[-1100,285],[-1170,285],[-1170,253]] },
    { id: 'command-scar-path', width: 4, points: [[-1100,200],[-1100,155],[-1164,155]] },
    { id: 'workers-path', width: 6, points: [[-1490,240],[-1490,535],[-1450,535],[-1450,500]] },
    { id: 'foundry-path', width: 6, points: [[-2100,240],[-2150,100],[-2150,-170]] },
    { id: 'commons-path', width: 6, points: [[-1880,240],[-1880,600]] },
    { id: 'counterseal-path', width: 6, points: [[-2590,240],[-2600,0],[-2630,-220]] }
]);
