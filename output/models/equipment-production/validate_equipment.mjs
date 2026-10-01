import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),validator=require('gltf-validator');
const root=fileURLToPath(new URL('../../../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,''),work=root+'/output/models/equipment-production',dest=root+'/assets/equipment/authored';
const classes=process.argv.slice(2).filter(v=>v!=='weapons');const useWeapons=process.argv.includes('weapons')||!process.argv.slice(2).length;
if(!process.argv.slice(2).length)classes.push('Fighter','Wizard','Cleric','Rogue');
function parse(file){const bytes=fs.readFileSync(file),jsonLength=bytes.readUInt32LE(12);return{bytes,data:JSON.parse(bytes.subarray(20,20+jsonLength)),bin:bytes.subarray(28+jsonLength)}}
function accessor(gltf,index){const a=gltf.data.accessors[index],view=gltf.data.bufferViews[a.bufferView];return new Float32Array(gltf.bin.buffer,gltf.bin.byteOffset+(view.byteOffset||0)+(a.byteOffset||0),a.count*16)}
const reports=[];if(useWeapons)reports.push(...JSON.parse(fs.readFileSync(work+'/weapon-report.json')));
for(const c of classes)reports.push(...JSON.parse(fs.readFileSync(work+'/'+c.toLowerCase()+'-report.json')));
const refs=Object.fromEntries(classes.map(c=>[c,parse(root+'/assets/archetypes/'+c+'/'+c.toLowerCase()+'.glb')]));const results=[];
for(const entry of reports){
 const file=root+'/'+entry.file,g=parse(file),d=g.data;
 const result=await validator.validateBytes(new Uint8Array(g.bytes),{uri:path.basename(file),maxIssues:100});
 fs.writeFileSync(file+'.validation.json',JSON.stringify(result,null,2)+'\n');
 if(result.issues.numErrors||result.issues.numWarnings)throw Error(entry.file+' validation '+JSON.stringify(result.issues));
 if(d.meshes.length!==1||(d.animations||[]).length)throw Error('Unexpected mesh/animation payload '+entry.file);
 let bindError=0;
 if(entry.character){
  if(d.skins?.length!==1||d.skins[0].joints.length!==53)throw Error('Invalid skin '+entry.file);
  const ref=refs[entry.character],skin=d.skins[0],bind=accessor(g,skin.inverseBindMatrices),refSkin=ref.data.skins[0],refBind=accessor(ref,refSkin.inverseBindMatrices);
  const names=refSkin.joints.map(i=>ref.data.nodes[i].name);
  skin.joints.forEach((node,j)=>{const r=names.indexOf(d.nodes[node].name);if(r<0)throw Error('Unexpected joint');for(let k=0;k<16;k++)bindError=Math.max(bindError,Math.abs(bind[j*16+k]-refBind[r*16+k]));});
  if(bindError>.00005)throw Error('Bind pose mismatch '+entry.file+' '+bindError);
 }else if(d.skins?.length)throw Error('Rigid weapon contains a skin');
 const emissive=d.materials.some(m=>m.emissiveFactor?.some(x=>x>0));
 if(entry.tier==='legendary'&&!emissive)throw Error('Missing legendary emission '+entry.file);
 const resultEntry={...entry,sha256:createHash('sha256').update(g.bytes).digest('hex'),errors:0,warnings:0,bindMatrixMaximumError:bindError,emissive,extensions:d.extensionsUsed||[]};
 results.push(resultEntry);
}
fs.writeFileSync(work+'/validated-'+[...(useWeapons?['weapons']:[]),...classes].join('-').toLowerCase()+'.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({validated:results.length,errors:0,warnings:0,maximumBindError:Math.max(0,...results.map(v=>v.bindMatrixMaximumError))}));
