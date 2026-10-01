import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const root=fileURLToPath(new URL('../../../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,''),rev=root+'/output/models/equipment-production/revision-v2';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const hash=a=>createHash('sha256').update(a).digest('hex');
function snapshot(doc){
 const r=doc.getRoot(),arr=a=>a?{type:a.getType(),normalized:a.getNormalized(),hash:hash(new Uint8Array(a.getArray().buffer,a.getArray().byteOffset,a.getArray().byteLength))}:null;
 return {
  meshes:r.listMeshes().map(m=>({name:m.getName(),weights:m.getWeights(),primitives:m.listPrimitives().map(p=>({mode:p.getMode(),material:p.getMaterial()?.getName(),indices:arr(p.getIndices()),attributes:Object.fromEntries(p.listSemantics().map(s=>[s,arr(p.getAttribute(s))])),targets:p.listTargets().map(t=>Object.fromEntries(t.listSemantics().map(s=>[s,arr(t.getAttribute(s))])))}))})),
  skins:r.listSkins().map(s=>({joints:s.listJoints().map(n=>n.getName()),bind:arr(s.getInverseBindMatrices())})),
  nodes:r.listNodes().map(n=>({name:n.getName(),matrix:n.getMatrix(),children:n.listChildren().map(c=>c.getName())})),
  materials:r.listMaterials().map(m=>({name:m.getName(),color:m.getBaseColorFactor(),metal:m.getMetallicFactor(),rough:m.getRoughnessFactor(),emissive:m.getEmissiveFactor(),alpha:m.getAlphaMode(),double:m.getDoubleSided()})),
  textures:r.listTextures().map(t=>({name:t.getName(),mime:t.getMimeType(),hash:hash(t.getImage())}))
 };
}
const results=[];
for(const c of ['Fighter','Wizard','Cleric','Rogue'])for(const suffix of ['','-runtime-high','-runtime-low']){
 const rel=`assets/archetypes/${c}/${c.toLowerCase()}${suffix}.glb`;
 const before=snapshot(await io.read(rev+'/before/'+rel)),after=snapshot(await io.read(root+'/'+rel));
 let maximumNodeTransformError=0;
 for(let i=0;i<before.nodes.length;i++){const a=before.nodes[i],b=after.nodes[i];for(let j=0;j<16;j++)maximumNodeTransformError=Math.max(maximumNodeTransformError,Math.abs(a.matrix[j]-b.matrix[j]));delete a.matrix;delete b.matrix;}
 if(maximumNodeTransformError>.00001)throw Error('Changed node transform in '+rel);
 if(JSON.stringify(before)!==JSON.stringify(after)){fs.writeFileSync(rev+'/preservation-before.json',JSON.stringify(before,null,2));fs.writeFileSync(rev+'/preservation-after.json',JSON.stringify(after,null,2));throw Error('Non-animation change in '+rel);}
 results.push({file:rel,geometrySkinBindMaterialsTexturesUnchanged:true,maximumNodeTransformError});
}
fs.writeFileSync(rev+'/character-preservation.json',JSON.stringify(results,null,2));console.log('Exact preservation verified for all 12 character exports.');
