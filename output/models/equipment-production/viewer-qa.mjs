import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const work=fileURLToPath(new URL('.',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('http://127.0.0.1:4189/output/models/equipment-production/viewer.html');
await page.waitForFunction(()=>window.reviewReady||window.reviewError,{timeout:60000});
const error=await page.evaluate(()=>window.reviewError);if(error)throw Error(error);
await page.evaluate(()=>{window.equipmentReview.paused=true;window.equipmentReview.freezeRendering();});
const report=[],accessories=[];
for(const c of ['Fighter','Wizard','Cleric','Rogue']){
 for(const family of ['plate','leather','cloth'])for(const tier of ['standard','legendary']){
  await page.evaluate(async({c,family,tier})=>{await window.equipmentReview.configure(c,family,tier);},{c,family,tier});
  const samples=await page.evaluate(()=>{const r=window.equipmentReview,out=[];for(const name of ['','Walk','Run','Attack','Block','Hit']){const clip=r.clips.find(c=>c.name===name);if(name&&!clip)continue;for(const fraction of [0,.25,.5,.75]){r.pose(name,(clip?.duration||0)*fraction);out.push({clip:name||'Bind pose',fraction,meshes:r.sample()});}}r.pose('');return out;});
  report.push({character:c,family,tier,samples});
  console.log(c,family,tier,'passed');
  if(tier==='legendary'&&family===({Fighter:'plate',Wizard:'cloth',Cleric:'plate',Rogue:'leather'}[c])){await page.click('#front');await page.evaluate(()=>window.equipmentReview.render());await page.screenshot({path:work+'/viewer-'+c.toLowerCase()+'.png'});await page.evaluate(()=>{const r=window.equipmentReview;const clip=r.clips.find(c=>c.name==='Walk');r.pose('Walk',clip.duration*.25);r.render();});await page.screenshot({path:work+'/viewer-'+c.toLowerCase()+'-walk.png'});}
 }
 for(const tier of ['standard','legendary']){
  await page.evaluate(async({c,tier})=>window.equipmentReview.configure(c,'plate',tier),{c,tier});
  for(let i=0;i<3;i++){
   const result=await page.evaluate(async i=>{const r=window.equipmentReview;await r.setItems({ring:['gold-ring','silver-ring','ruby-ring'][i],neck:['pendant','choker','necklace'][i],trinket:['amulet-of-power','talisman-of-speed','orb-of-mana'][i]});r.pose('Attack',.35);return r.sample();},i);
   accessories.push({character:c,tier,group:i,meshes:result});
  }
 }
}
if(errors.length)throw Error(errors.join('\n'));
fs.writeFileSync(work+'/animation-qa.json',JSON.stringify({outfits:report.length,accessoryCombinations:accessories.length,sampleCount:report.reduce((n,r)=>n+r.samples.length,0),errors,results:report,accessories},null,2));
console.log(JSON.stringify({outfits:report.length,accessoryCombinations:accessories.length,errors:errors.length}));
}finally{await browser.close();}
