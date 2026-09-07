import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { eidolon } from '../src/proto/state_pb.js';
import { getChronicleInvestigation, getRecordedChronicleDiscoveries } from '../src/core/ChronicleInvestigation.js';

test('client/server investigation content matches its authored source', () => {
    const server = JSON.parse(fs.readFileSync('server/internal/game/content/chronicle-investigations.json','utf8'));
    expect(server.chapters).toEqual(chronicleInvestigations);
    expect(chronicleInvestigations).toHaveLength(8);
    expect(chronicleInvestigations.flatMap(chapter=>chapter.sites)).toHaveLength(16);
    expect(execFileSync(process.execPath,['scripts/generate-chronicle-investigations.mjs','--check'],{encoding:'utf8'})).toContain('Verified eight Chronicle investigations');
});

test('recovered lore uses individual saved bits and never reveals an unseen diary from its count', () => {
    const quest = { id: 'chronicle_earth_returning_scar', accepted: true, count: 3, investigationMask: 5 };
    expect(getRecordedChronicleDiscoveries(quest).map(site => site.id)).toEqual(['severed_root', 'marked_stone']);
    expect(getRecordedChronicleDiscoveries({ ...quest, investigationMask: 0 })).toEqual([]);
    expect(getRecordedChronicleDiscoveries({ ...quest, investigationMask: 1 << 20 })).toEqual([]);
    expect(getRecordedChronicleDiscoveries({ ...quest, accepted: false })).toEqual([]);
    expect(getRecordedChronicleDiscoveries({ ...quest, accepted: false, completed: true })).toHaveLength(2);
    for (const mask of [undefined, -1, NaN, Infinity, 1.5, '7', 0x100000000]) {
        expect(getRecordedChronicleDiscoveries({ ...quest, investigationMask: mask })).toEqual([]);
    }
    expect(getChronicleInvestigation('daily_skeleton')).toBeNull();
    expect(getRecordedChronicleDiscoveries(null)).toEqual([]);
});

test('the browser receives distinct discovery bits, not just a total count',()=>{
    const quest={id:'chronicle_earth_returning_scar',type:'INVESTIGATE',count:2,maxCount:3,investigationMask:5};
    const received=eidolon.state.Quest.decode(eidolon.state.Quest.encode(quest).finish());
    expect(received.investigationMask).toBe(5);
    const sites=chronicleInvestigations.find(chapter=>chapter.id===quest.id).sites;
    expect(sites.filter((site,index)=>(received.investigationMask & (1<<index))!==0).map(site=>site.id)).toEqual(['severed_root','marked_stone']);
});
