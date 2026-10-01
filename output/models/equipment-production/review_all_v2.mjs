import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const work=fileURLToPath(new URL('./revision-v2',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[],report=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4189/output/models/equipment-production/viewer.html');await page.waitForFunction(()=>window.reviewReady||window.reviewError,null,{timeout:60000});
 await page.evaluate(()=>{const r=window.equipmentReview;r.freezeRendering();r.paused=true;});
 const runtime=await page.evaluate(async()=>{
  const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{createAuthoredFighterInstance}=await import('/src/art/AuthoredFighter.js');
  const gltf=await new GLTFLoader().loadAsync('/assets/archetypes/Fighter/fighter-runtime-high.glb'),root=createAuthoredFighterInstance(gltf);
  const grips=(await(await fetch('/assets/equipment/authored/grip-transforms.json')).json()).characters.Fighter;
  const out=[];for(const slot of ['mainHand','offHand']){const mount=root.getObjectByName('AuthoredMount_'+slot),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();new THREE.Matrix4().fromArray(grips[slot].localMatrix).decompose(p,q,s);out.push({slot,positionError:mount.position.distanceTo(p),angleError:mount.quaternion.angleTo(q)});}
  root.userData.disposeInstance();return out;
 });
 if(runtime.some(x=>x.positionError>.001||x.angleError>.002))throw Error('Runtime grip mismatch '+JSON.stringify(runtime));
 for(const c of ['Fighter','Wizard','Cleric','Rogue']){
  const family={Fighter:'plate',Wizard:'cloth',Cleric:'plate',Rogue:'leather'}[c];
  await page.evaluate(async({c,family})=>window.equipmentReview.configure(c,family,'legendary'),{c,family});
  // Default class weapon, shield/book, and motion poses, with the entire blade visible.
  for(const[name,time,angle,label]of [['CombatIdle',0,.32,'guard'],['Walk',.18,1.35,'walk'],['Run',.14,1.35,'run'],['Attack',.23,.35,'windup'],['Attack',14/30,.35,'contact'],['Attack',.62,.35,'followthrough']]){
   await page.evaluate(({name,time,angle})=>{const r=window.equipmentReview;r.pose(name,time);r.setView(angle,5.1);r.render();},{name,time,angle});
   await page.screenshot({path:work+'/'+c.toLowerCase()+'-'+label+'.png'});
  }
  // All chest families, both rarities, unobscured by pauldrons/hair/hand gear.
  for(const family of ['plate','leather','cloth'])for(const tier of ['standard','legendary']){
   await page.evaluate(async({c,family,tier})=>{const r=window.equipmentReview;await r.configure(c,family,tier);await r.setItems({shoulders:'',mainHand:'',offHand:'',neck:''});r.pose('');},{c,family,tier});
   for(const [angle,label]of [[0,'front'],[1.57,'side'],[Math.PI,'back']]){
    await page.evaluate(angle=>{const r=window.equipmentReview;r.setView(angle,3.6);r.render();},angle);
    await page.screenshot({path:work+`/chest-${c}-${family}-${tier}-${label}.png`});
   }
  }
  // Every weapon profile on each rig, including stationary grip and gait samples.
  await page.evaluate(async({c,family})=>window.equipmentReview.configure(c,family,'legendary'),{c,family});
  for(const item of ['iron-sword','steel-dagger','wooden-staff','cleric-mace','']){
   await page.evaluate(async item=>{const r=window.equipmentReview;await r.setItems({mainHand:item,offHand:item==='wooden-staff'?'spell-tome':item==='iron-sword'||item==='cleric-mace'?'wooden-shield':''});},item);
   const samples=await page.evaluate(async()=>{
    const THREE=await import('three'),r=window.equipmentReview,out=[],body=r.character.getObjectByName(document.querySelector('#character').value+'_Body'),pos=body.geometry.attributes.position;
    const feet={l:[],r:[]};for(let i=0;i<pos.count;i++)if(pos.getY(i)<.085)feet[pos.getX(i)>0?'l':'r'].push(i);
    for(const name of ['Walk','Run','Attack'])for(let k=0;k<=30;k++){
     const duration=name==='Run'?.733333:name==='Walk'?1:1,time=duration*k/31;r.pose(name,time);const meshes=r.sample();body.skeleton.update();
     const minima={};for(const s of ['l','r']){let min=Infinity;for(const i of feet[s]){const v=new THREE.Vector3();body.getVertexPosition(i,v);min=Math.min(min,v.applyMatrix4(body.matrixWorld).y);}minima[s]=min;}
     const weapon=r.equipment.find(x=>x.userData.itemId===document.querySelector('[data-slot="mainHand"]')?.value);
     out.push({name,time,feet:minima,meshes:meshes.length});
    }return out;
   });report.push({character:c,item,samples});
  }
  console.log(c+' chest views and five motion profiles checked');
 }
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(work+'/review-qa.json',JSON.stringify({runtimeGrips:runtime,errors,profileCombinations:report.length,poseSamples:report.reduce((s,r)=>s+r.samples.length,0),results:report},null,2));
 console.log('QA complete',report.length,'profile combinations');
}finally{await browser.close();}
