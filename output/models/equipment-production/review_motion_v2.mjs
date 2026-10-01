import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const work=fileURLToPath(new URL('./revision-v2',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1200,height:1050}});
page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
try{
await page.goto('http://127.0.0.1:4189/output/models/equipment-production/viewer.html');await page.waitForFunction(()=>window.reviewReady||window.reviewError,null,{timeout:60000});
await page.evaluate(()=>{const r=window.equipmentReview;r.freezeRendering();r.paused=true;});
for(const [name,time,angle,label]of [['CombatIdle',0,0,'guard'],['Walk',.18,1.25,'walk'],['Run',.14,1.25,'run'],['Attack',.23,.35,'windup'],['Attack',14/30,.35,'contact'],['Attack',.62,.35,'followthrough']]){
 await page.evaluate(({name,time,angle})=>{const r=window.equipmentReview;r.pose(name,time);r.setView(angle,4.2);r.render();},{name,time,angle});await page.screenshot({path:work+'/fighter-'+label+'.png'});
}
console.log('Saved Fighter motion review frames.');
}finally{await browser.close();}
