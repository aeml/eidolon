import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import fs from 'node:fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),rev=fileURLToPath(new URL('./revision-v2',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
for(const c of process.argv.slice(2).length?process.argv.slice(2):['Fighter']){
 const d=await io.read(`${rev}/${c.toLowerCase()}-motion.glb`),results=[];
 for(const clip of d.getRoot().listAnimations()){
  let max=0,worst='',loopError=0;
  for(const ch of clip.listChannels()){
   if(ch.getTargetPath()!=='rotation')continue;const a=ch.getSampler().getOutput().getArray();let local=0;
   for(let i=4;i<a.length;i+=4){let dot=0;for(let j=0;j<4;j++)dot+=a[i+j]*a[i-4+j];local=Math.max(local,2*Math.acos(Math.min(1,Math.abs(dot))));}
   if(local>max){max=local;worst=ch.getTargetNode().getName();}
   let dot=0;for(let j=0;j<4;j++)dot+=a[j]*a[a.length-4+j];loopError=Math.max(loopError,2*Math.acos(Math.min(1,Math.abs(dot))));
  }results.push({name:clip.getName(),maximumAdjacentDegrees:max*180/Math.PI,worstBone:worst,loopEndpointDegrees:loopError*180/Math.PI});
 }
 fs.writeFileSync(`${rev}/${c.toLowerCase()}-continuity.json`,JSON.stringify(results,null,2));console.log(c,JSON.stringify(results.filter(r=>r.maximumAdjacentDegrees>55||/Idle|Walk|Run|Block/.test(r.name)&&r.loopEndpointDegrees>1)));
}
