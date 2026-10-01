import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
const root=fileURLToPath(new URL('../../../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,''),work=root+'/output/models/equipment-production';
const output={schemaVersion:2,coordinateSystem:'glTF Y-up, column-major matrices',application:'Apply this calibrated grip matrix to the GLB scene root under the named socket. Use the matching weapon motion profile; the hand, fingers, and wrist carry the weapon without per-frame weapon corrections.',characters:{}};
for(const c of ['Fighter','Wizard','Cleric','Rogue']){
 const file=`${work}/revision-v2/${c.toLowerCase()}-grips.json`;
 if(!fs.existsSync(file))throw Error('Bake revision 2 motion before packaging grips: '+c);
 output.characters[c]=JSON.parse(fs.readFileSync(file));
}
fs.writeFileSync(root+'/assets/equipment/authored/grip-transforms.json',JSON.stringify(output,null,2)+'\n');console.log('Wrote calibrated grips for four characters.');
