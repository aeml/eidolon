import fs from 'node:fs';
import { BASE_ITEMS, SET_DEFINITIONS } from '../../../src/core/ItemSystem.js';
import { EQUIPMENT_VISUAL_DESCRIPTORS } from '../../../src/art/ProceduralEquipment.js';
const items=BASE_ITEMS.filter(i=>EQUIPMENT_VISUAL_DESCRIPTORS[i.name]).map(i=>({
 name:i.name,id:i.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),slot:i.slot,type:i.type,...EQUIPMENT_VISUAL_DESCRIPTORS[i.name]
}));
const inventory={version:1,rarityModels:{Common:'standard',Uncommon:'standard',Rare:'standard',Legendary:'legendary'},characters:['Fighter','Wizard','Cleric','Rogue'],items,sets:SET_DEFINITIONS};
fs.writeFileSync('output/models/equipment-production/inventory.json',JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify({items:items.length,slots:[...new Set(items.map(i=>i.slot))],sets:Object.keys(SET_DEFINITIONS)}));
