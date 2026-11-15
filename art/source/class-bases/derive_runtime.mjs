import {fileURLToPath} from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, resample, simplifyPrimitive, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const validator=require('gltf-validator');
const root=fileURLToPath(new URL('../../../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
function summary(file){
 const bytes=readFileSync(file),data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 return {bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
 triangles:data.meshes.reduce((s,m)=>s+m.primitives.reduce((s,p)=>s+data.accessors[p.indices].count/3,0),0),
 bones:data.skins.map(s=>s.joints.length),animations:data.animations.map(a=>a.name).sort(),
 sockets:data.nodes.filter(n=>n.name?.startsWith('socket_')).map(n=>n.name).sort(),
 morphs:data.meshes.flatMap(m=>m.extras?.targetNames||[]),
 images:data.images.length,externalDependencies:[...(data.images||[]),...(data.buffers||[])].filter(r=>r.uri&&!r.uri.startsWith('data:')).map(r=>r.uri)};
}
async function validate(file){
 const bytes=readFileSync(file),report=await validator.validateBytes(new Uint8Array(bytes),{uri:file.split('/').at(-1),maxIssues:1000});
 writeFileSync(file+'.validation.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({file,errors:report.issues.numErrors,warnings:report.issues.numWarnings}));
 if(report.issues.numErrors||report.issues.numWarnings)throw Error('Validation failed: '+file);
 return report;
}
await MeshoptSimplifier.ready;
for(const name of process.argv.slice(2).length?process.argv.slice(2):['Wizard','Cleric','Rogue']){
 const directory=`${root}/assets/archetypes/${name}`,stem=name.toLowerCase(),source=`${directory}/${stem}.glb`;
 await validate(source);const sourceSummary=summary(source);const variants={};
 if(sourceSummary.bones.some(n=>n!==53)||sourceSummary.sockets.length!==10||sourceSummary.animations.length!==14||sourceSummary.externalDependencies.length)throw Error('Incomplete character '+name);
 for(const [quality,ratio,error,textureSize] of [['high',.45,.002,1024],['low',.18,.006,512]]){
  const document=await io.read(source);
  await document.transform(weld({overwrite:false}),resample({tolerance:.00001}));
  const body=document.getRoot().listNodes().find(n=>n.getName()===name+'_Body').getMesh();
  for(const p of body.listPrimitives())simplifyPrimitive(p,{simplifier:MeshoptSimplifier,ratio,error,lockBorder:true});
  await document.transform(
   textureCompress({encoder:sharp,targetFormat:'webp',resize:[textureSize,textureSize],slots:/^(?:normalTexture|metallicRoughnessTexture|occlusionTexture)$/,lossless:true,effort:80}),
   textureCompress({encoder:sharp,targetFormat:'webp',resize:[textureSize,textureSize],slots:/^(?:baseColorTexture)$/,quality:90,effort:80})
  );
  const destination=`${directory}/${stem}-runtime-${quality}.glb`;await io.write(destination,document);await validate(destination);
  const result=summary(destination);
  for(const f of ['bones','animations','sockets','morphs','externalDependencies'])if(JSON.stringify(result[f])!==JSON.stringify(sourceSummary[f]))throw Error('Changed contract: '+name+' '+quality+' '+f);
  variants[quality]={...result,maximumTextureSize:textureSize};
 }
 writeFileSync(`${directory}/${stem}-runtime.manifest.json`,JSON.stringify({class:name,source:sourceSummary,policy:'Body-only simplification; fitted meshes retained; lossless data textures.',variants},null,2)+'\n');
 console.log(JSON.stringify({class:name,source:sourceSummary,variants},null,2));
}
