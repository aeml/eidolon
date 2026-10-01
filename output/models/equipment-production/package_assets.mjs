import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,''),work=root+'/output/models/equipment-production',dest=root+'/assets/equipment/authored';
const inventory=JSON.parse(fs.readFileSync(work+'/inventory.json'));
const validation=JSON.parse(fs.readFileSync(work+'/validated-weapons-fighter-wizard-cleric-rogue.json'));
const measures=JSON.parse(fs.readFileSync(work+'/character-measurements.json'));
const setColors={warlord_fury:'#c44a32',bulwark_ages:'#6e91a0',shadow_embrace:'#705179',venom_lord:'#55a85b',inferno_heart:'#e06a32',temporal_weave:'#617ed3',divine_light:'#e6c66a',crusader_zeal:'#d7e2d2'};
const manifest={schemaVersion:2,revision:2,status:'fitted-assets-delivery',gameIntegration:false,units:'meters',upAxis:'Y',forwardAxis:'+Z',catalogSource:'src/core/ItemSystem.js:BASE_ITEMS',
 rarityModels:{...inventory.rarityModels,Eidolic:'legendary'},rarityAccentColors:{Eidolic:'#9f66dc'},
 counts:{baseItems:36,designs:72,rigidExports:12,fittedExports:240,modelGLBs:252,motionBanks:4,totalGLBs:256},
 characters:Object.fromEntries(inventory.characters.map(c=>[c,{height:measures[c].height,joints:53,reference:`assets/archetypes/${c}/${c.toLowerCase()}.glb`,blenderSource:`output/models/equipment-production/${c.toLowerCase()}-equipment.blend`}])),
 sources:{weapons:'output/models/equipment-production/weapons.blend',authoringScripts:'output/models/equipment-production',reviewer:'output/models/equipment-production/viewer.html',documentation:'docs/art/EQUIPMENT_ASSETS.md'},
 binding:{fitted:'Use the matching character fit. Keep the mesh at the character scene root and bind joints by bone name to that character skeleton, preserving inverse bind matrices. Do not parent a skinned item to a socket.',rigid:'Parent weapon GLB scene to socket_mainHand or socket_offHand, using grip-transforms.json.',animation:'Equipment contains no duplicate animation clips; play the character clips on the shared skeleton.',ring2:'Mirror the ring bind-space X, reverse triangle winding and remap left joint names to right. Use the right joint inverse bind matrices.',trinket2:'Mirror bind-space X, reverse triangle winding and remap left/right influences as applicable.'},
 coverage:{head:'Hide character Hair and Scalp while any headwear is equipped.',chest:'Hide Undertop and its seams. Mask underlying torso triangles strictly inside the garment.',legs:'Hide Undershorts and seams for trousers/greaves. Keep them for skirts and robes. Mask covered leg/pelvis triangles for trousers/greaves.',feet:'Mask covered feet/ankles for boots; retain the body for sandals.',gloves:'Mask the underlying hands/fingers. Keep exposed forearms.',referenceImplementation:'output/models/equipment-production/viewer.js:updateCoverage'},
 rendering:{materials:'Embedded glTF metallic-roughness PBR materials with geometric trim and engraved/rune inlays.',textures:0,legendaryEmission:'KHR_materials_emissive_strength. Bloom must be enabled by the renderer to produce a screen-space glow halo.',lods:'One authored LOD per item; integration may derive reduced variants.',cloth:'Skinned panels with movement slits; no cloth simulation is embedded.'},
 sets:Object.fromEntries(Object.values(inventory.sets).map(s=>[s.id,{name:s.name,character:s.class,slots:s.slots,modelTier:'legendary',accentColor:setColors[s.id],application:'Optional material accent override on luminous inlay and cut crystal; shared legendary geometry.'}])),
 items:inventory.items.map(item=>{const models={};for(const tier of ['standard','legendary']){const entries=validation.filter(v=>v.id===item.id&&v.tier===tier);models[tier]=Object.fromEntries(entries.map(v=>[v.character||'universal',{file:v.file,bytes:v.bytes,triangles:v.triangles,materials:v.materials,sha256:v.sha256}]));}return{...item,models};}),
 verification:{validator:'Khronos glTF Validator',errors:0,warnings:0,maximumInverseBindMatrixError:0,animationQA:'output/models/equipment-production/animation-qa.json'}
};
manifest.layeringRules=[{whenEquipped:['robes','silk-skirt'],hideMesh:'silk-skirt',reason:'The robe completely covers the shorter skirt; hide nested panels to avoid intersecting trim during movement.'}];
manifest.verification.finalFitQA='output/models/equipment-production/revision-v2/review-qa.json';
manifest.sources.collectionPreview='output/models/equipment-production/legendary-lineup.png';
manifest.sources.motionProfiles='assets/equipment/authored/motion-profiles.json';
manifest.sources.motionAuthoring='output/models/equipment-production/revision-v2/{class}-animation-review.blend';
manifest.binding.animation='Use the matching character motion bank on the shared skeleton. Resolve Sword, Dagger, Staff, Mace, or Unarmed profiles for Idle, CombatIdle, Walk, Run, Attack, and Block. Default class clips remain in the character exports. The viewer demonstrates 180 ms crossfades and Dagger offhand support.';
manifest.coverage.chest='Full collar, chest, back, shoulder yoke and short sleeves; pauldrons layer above. Hide Undertop and its seams; mask covered torso/clavicle and proximal upperarm skin with the reference viewer rules.';
manifest.verification.animationQA='output/models/equipment-production/revision-v2/review-qa.json';
manifest.verification.characterPreservation='output/models/equipment-production/revision-v2/character-preservation.json';
manifest.verification.motionContinuity='output/models/equipment-production/revision-v2/{class}-continuity.json';
if(validation.length!==252||inventory.items.length!==36)throw Error('Incomplete equipment catalog');
for(const entry of validation){const bytes=fs.readFileSync(root+'/'+entry.file);if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Validation out of date: '+entry.file);}
fs.writeFileSync(dest+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const motions=JSON.parse(fs.readFileSync(dest+'/motion-profiles.json'));
for(const m of Object.values(motions.characters)){const bytes=fs.readFileSync(root+'/'+m.file);if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('Motion manifest out of date: '+m.file);}
const summary={...manifest.counts,modelBytes:validation.reduce((n,v)=>n+v.bytes,0),motionBytes:Object.values(motions.characters).reduce((n,v)=>n+v.bytes,0),triangleRange:[Math.min(...validation.map(v=>v.triangles)),Math.max(...validation.map(v=>v.triangles))],largestModelBytes:Math.max(...validation.map(v=>v.bytes)),errors:0,warnings:0};
fs.writeFileSync(dest+'/validation-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
