import { jest } from '@jest/globals';
import { selectPreparedRune, clearPreparedRune } from './e2e/prepared-rune-input.js';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';
import { getAbilityRuneVariants, PLAYER_ABILITY_VISUALS, isAbilityVisualLayerEnabled } from '../src/skills/abilityVisualManifest.js';

afterEach(() => { delete window.game; });
const rune = { skill: 'Fireball', id: 'fireball_empowered', name: 'Empowered' };

test.each(['fireball_empowered', undefined, 'fireball_explosive'])('observes existing rune %s before deciding to click', async selected => {
    window.game = { player: { skillRunes: Object.freeze({ Fireball: selected }) } };
    const click = jest.fn(), tab = jest.fn();
    const name = jest.fn(() => ({ click }));
    const parent = jest.fn(() => ({ getByText: name }));
    const skills = { getByRole: jest.fn(() => ({ click: tab })),
        getByText: jest.fn(() => ({ locator: parent })) };
    expect(await selectPreparedRune({ evaluate: (fn, arg) => fn(arg) }, skills, rune))
        .toBe(selected !== rune.id);
    expect(click).toHaveBeenCalledTimes(selected === rune.id ? 0 : 1);
    expect(tab).toHaveBeenCalledTimes(selected === rune.id ? 0 : 1);
    if (selected !== rune.id) {
        expect(skills.getByText).toHaveBeenCalledWith('Fireball', { exact: true });
        expect(name).toHaveBeenCalledWith('Empowered', { exact: true });
    }
    expect(window.game.player.skillRunes.Fireball).toBe(selected);
});

test.each(['teleport_warp', 'teleport_blink', undefined])('base preparation removes only the actually equipped rune %s through its UI', async selected => {
    const variants = [{id:'teleport_warp',name:'Warp'},{id:'teleport_blink',name:'Blink'}];
    const saved = Object.freeze({Teleport:selected,Fireball:'fireball_empowered'});
    window.game = {player:{skillRunes:saved}};
    const click=jest.fn(),tab=jest.fn(),name=jest.fn(()=>({click}));
    const skills={getByRole:jest.fn(()=>({click:tab})),getByText:jest.fn(()=>({locator:()=>({getByText:name})}))};
    expect(await clearPreparedRune({evaluate:(fn,arg)=>fn(arg)},skills,'Teleport',variants)).toBe(Boolean(selected));
    expect(click).toHaveBeenCalledTimes(selected?1:0);
    if(selected)expect(name).toHaveBeenCalledWith(variants.find(v=>v.id===selected).name,{exact:true});
    expect(window.game.player.skillRunes).toBe(saved);
    expect(window.game.player.skillRunes.Teleport).toBe(selected); // Only the server may acknowledge removal.
    expect(window.game.player.skillRunes.Fireball).toBe('fireball_empowered');
});

test('base preparation rechecks the equipped rune after opening the tab',async()=>{
    let selected='teleport_warp';
    const click=jest.fn(),names=jest.fn(()=>({click}));
    const skills={getByRole:()=>({click:()=>{selected='';}}),getByText:()=>({locator:()=>({getByText:names})})};
    expect(await clearPreparedRune({evaluate:()=>selected},skills,'Teleport',[{id:'teleport_warp',name:'Warp'}])).toBe(false);
    expect(click).not.toHaveBeenCalled();
});

test('unknown saved runes fail rather than clearing state or selecting an arbitrary replacement',async()=>{
    window.game={player:{skillRunes:Object.freeze({Teleport:'unknown-rune'})}};
    const skills={getByRole:jest.fn()};
    await expect(clearPreparedRune({evaluate:(fn,arg)=>fn(arg)},skills,'Teleport',[])).rejects.toThrow(/unknown-rune/);
    expect(skills.getByRole).not.toHaveBeenCalled();
    expect(window.game.player.skillRunes.Teleport).toBe('unknown-rune');
});

test.each([
    ['Wizard','Teleport','teleport_warp',4,2],
    ['Cleric','Healing Light','healinglight_beacon',3,2]
])('%s/%s retained rune is removed by the real desktop toggle, with layers changing only after acknowledgement',async(className,skill,id,trainedLayers,baseLayers)=>{
    document.body.innerHTML='<div id="skill-tree-window"><div id="skill-tree-content"></div></div>';
    const player={subType:className,level:100,unlockedSkills:[skill],skillRunes:Object.freeze({[skill]:id})};
    window.game={player};
    const ui=new SkillTreeUI({getLastPlayer:()=>player});
    ui.onSelectRune=jest.fn();ui.renderRunesTab(className);
    const count=()=>PLAYER_ABILITY_VISUALS[className][skill].layers.filter(entry=>isAbilityVisualLayerEnabled(entry,player,skill)).length;
    expect(count()).toBe(trainedLayers);
    const wrap=element=>({
        getByText:name=>wrap([...element.querySelectorAll('*')].find(node=>node.textContent===name)),
        locator:selector=>{expect(selector).toBe('..');return wrap(element.parentElement);},
        click:()=>element.click()
    });
    const skills={...wrap(ui.skillTreeContent),getByRole:()=>({click:jest.fn()})};
    await clearPreparedRune({evaluate:(fn,arg)=>fn(arg)},skills,skill,getAbilityRuneVariants(className,skill));
    expect(ui.onSelectRune).toHaveBeenCalledTimes(1);expect(ui.onSelectRune).toHaveBeenCalledWith(skill,'');
    expect(count()).toBe(trainedLayers);expect(player.skillRunes[skill]).toBe(id);
    // Model a later server acknowledgement, not optimistic mutation by QA.
    player.skillRunes=Object.freeze({[skill]:''});
    expect(count()).toBe(baseLayers);
    document.body.innerHTML='';
});
