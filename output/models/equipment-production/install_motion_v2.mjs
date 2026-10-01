import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {resample} from '@gltf-transform/functions';
const require=createRequire(import.meta.url),validator=require('gltf-validator');
const root=fileURLToPath(new URL('../../../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,''),work=root+'/output/models/equipment-production',rev=work+'/revision-v2';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
function hash(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function validate(file){const bytes=fs.readFileSync(file),r=await validator.validateBytes(new Uint8Array(bytes),{uri:file.split('/').at(-1),maxIssues:100});fs.writeFileSync(file+'.validation.json',JSON.stringify(r,null,2));if(r.issues.numErrors||r.issues.numWarnings)throw Error(file+' '+JSON.stringify(r.issues));return{bytes:bytes.length,sha256:hash(bytes),errors:0,warnings:0};}
function copyClip(document,source,name){
 const nodes=new Map(document.getRoot().listNodes().map(n=>[n.getName(),n])),buffer=document.getRoot().listBuffers()[0],accessors=new Map(),clip=document.createAnimation(name).setExtras(source.getExtras());
 const copyAccessor=a=>{if(!accessors.has(a))accessors.set(a,document.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buffer));return accessors.get(a);};
 const samplers=new Map();
 for(const s of source.listSamplers()){const next=document.createAnimationSampler().setInput(copyAccessor(s.getInput())).setOutput(copyAccessor(s.getOutput())).setInterpolation(s.getInterpolation());clip.addSampler(next);samplers.set(s,next);}
 for(const c of source.listChannels()){const name=c.getTargetNode().getName(),target=nodes.get(name);if(!target)throw Error('Missing target '+name);clip.addChannel(document.createAnimationChannel().setSampler(samplers.get(c.getSampler())).setTargetNode(target).setTargetPath(c.getTargetPath()));}
 return clip;
}
function removeClips(document){const accessors=new Set();for(const a of document.getRoot().listAnimations()){for(const s of a.listSamplers()){accessors.add(s.getInput());accessors.add(s.getOutput());}for(const c of a.listChannels())c.dispose();for(const s of a.listSamplers())s.dispose();a.dispose();}for(const a of accessors)if(a.listParents().every(p=>p.propertyType==='Root'))a.dispose();}
const manifestPath=root+'/assets/equipment/authored/motion-profiles.json';const motionManifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath)):{version:2,profiles:['Sword','Dagger','Staff','Mace','Unarmed'],states:['Idle','CombatIdle','Walk','Run','Attack','Block'],contactSeconds:14/30,characters:{}};
const grips=JSON.parse(fs.readFileSync(root+'/assets/equipment/authored/grip-transforms.json'));grips.schemaVersion=2;grips.application='Apply this calibrated grip matrix to the GLB scene root under the named socket. Use the matching weapon motion profile; the hand, fingers, and wrist carry the weapon without per-frame weapon corrections.';
for(const CLASS of process.argv.slice(2)){
 const stem=CLASS.toLowerCase(),bank=await io.read(`${rev}/${stem}-motion.glb`);await bank.transform(resample({tolerance:.00001}));
 for(const skin of bank.getRoot().listSkins())skin.dispose();
 const bankPath=`${root}/assets/equipment/authored/motions/${CLASS}.glb`;fs.mkdirSync(root+'/assets/equipment/authored/motions',{recursive:true});await io.write(bankPath,bank);const bankValidation=await validate(bankPath);
 const baseNames=bank.getRoot().listAnimations().map(a=>a.getName()).filter(n=>!n.includes('_'));const summary={};
 for(const suffix of ['', '-runtime-high','-runtime-low']){
  const file=`${root}/assets/archetypes/${CLASS}/${stem}${suffix}.glb`,document=await io.read(file);const oldNames=document.getRoot().listAnimations().map(a=>a.getName()).sort();
  if(JSON.stringify(oldNames)!==JSON.stringify([...baseNames].sort()))throw Error('Clip contract changed: '+CLASS);
  removeClips(document);for(const a of bank.getRoot().listAnimations())if(baseNames.includes(a.getName()))copyClip(document,a,a.getName());
  await io.write(file,document);summary[suffix||'source']=await validate(file);
 }
 const runtimePath=`${root}/assets/archetypes/${CLASS}/${stem}-runtime.manifest.json`,runtime=JSON.parse(fs.readFileSync(runtimePath));
 Object.assign(runtime.source,summary.source);for(const quality of ['high','low'])Object.assign(runtime.variants[quality],summary['-runtime-'+quality]);runtime.motionRevision=2;
 fs.writeFileSync(runtimePath,JSON.stringify(runtime,null,2)+'\n');
 grips.characters[CLASS]=JSON.parse(fs.readFileSync(`${rev}/${stem}-grips.json`));
 motionManifest.characters[CLASS]={file:`assets/equipment/authored/motions/${CLASS}.glb`,defaultProfile:({Fighter:'Sword',Wizard:'Staff',Cleric:'Mace',Rogue:'Dagger'})[CLASS],clips:bank.getRoot().listAnimations().map(a=>a.getName()),...bankValidation};
 console.log(JSON.stringify({character:CLASS,bank:bankValidation,exports:summary}));
}
fs.writeFileSync(root+'/assets/equipment/authored/grip-transforms.json',JSON.stringify(grips,null,2)+'\n');fs.writeFileSync(manifestPath,JSON.stringify(motionManifest,null,2)+'\n');
