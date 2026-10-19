import {expect,test} from '@playwright/test';
import {collectBrowserFailures} from './helpers.js';
import {prepareCasinoReview} from './casinoPreparedController.js';

test.use({hasTouch:true,isMobile:true,actionTimeout:12000});
// Real UIManager/controller with saved phone settings. The modeled visual
// viewport checks keyboard layout, without claiming physical-device coverage.
for (const [width,height,textScale] of [[320,740,125],[390,844,125],[844,390,125],[390,844,100]]) for (const game of ['roulette','baccarat','blackjack','poker','slots']) {
 test(`${game} saved text ${textScale}%, keyboard and placement at ${width}x${height}`,async({page,baseURL},testInfo)=>{
  const failures=collectBrowserFailures(page,baseURL);
  await page.setViewportSize({width,height});
  await page.route('**/src/main.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.route('**/src/analytics/game.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto('/',{waitUntil:'networkidle'});
  await page.evaluate(prepareCasinoReview,{game,phone:true,textScale});
  const panel=page.locator('.casino-session'),header=panel.locator('.casino-session-header');
  const checkHands=async()=>{
   if(game!=='blackjack') return;
   await expect(panel.locator('.card-table-seat .casino-hand-value')).toHaveCount(6);
   expect(await panel.locator('.card-table-seat .casino-hand-value').evaluateAll(values=>values.flatMap(n=>{
    const r=n.getBoundingClientRect(),clip=n.closest('.card-table-seat-hands').getBoundingClientRect();
    return r.top>=clip.top-1&&r.bottom<=clip.bottom+1?[]:[{value:n.textContent,top:r.top,bottom:r.bottom,clipTop:clip.top,clipBottom:clip.bottom}];
   }))).toEqual([]);
  };
  const keyboardHeight=Math.min(400,height-200);
  const showKeyboard=async(field)=>{
   await field.focus();
   await page.evaluate(height=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,value:height});window.visualViewport.dispatchEvent(new Event('resize'));},keyboardHeight);
   await expect(page.locator('body')).toHaveAttribute('data-phone-keyboard','true');
  };
  const hideKeyboard=async()=>{
   await page.evaluate(height=>{document.activeElement?.blur();Object.defineProperty(window.visualViewport,'height',{configurable:true,value:height});window.visualViewport.dispatchEvent(new Event('resize'));},height);
   await expect(page.locator('body')).not.toHaveAttribute('data-phone-keyboard');
  };
  try {
   await expect(panel).toBeVisible();
   expect(await header.locator('h2').evaluate(n=>n.scrollWidth-n.clientWidth),'Full game title fits the header').toBeLessThanOrEqual(1);
   expect(await panel.locator('.casino-play-controls-row > span').evaluate(n=>n.scrollWidth-n.clientWidth),'Compact timer label fits').toBeLessThanOrEqual(1);
   expect(await header.getByRole('button',{name:'Rules',exact:true}).evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual((width<=700?12:14)*textScale/100);
   expect(await panel.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
   await testInfo.attach('initial-geometry',{body:JSON.stringify(await panel.evaluate(n=>Object.fromEntries(['.casino-session-header','.casino-play-controls','.blackjack-game','.blackjack-scene','.card-table-seat','.card-table-seat-name','.card-table-seat-status','.card-table-seat-hands','.blackjack-hand','.casino-hand-value','.card-table-dealer','.card-table-clock'].map(selector=>{const e=n.querySelector(selector);if(!e)return[selector,null];const r=e.getBoundingClientRect();return[selector,{x:r.x,y:r.y,width:r.width,height:r.height,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,font:getComputedStyle(e).fontSize}];})))),contentType:'application/json'});
   await checkHands();
   await header.focus(); await page.keyboard.press('ArrowUp');
   const remembered=await panel.boundingBox();
   const preference=await page.evaluate(()=>window.__controllerReview.ui.windowLayoutPreferences.get('casino','compact'));
   expect(preference).toEqual({left:expect.any(Number),top:expect.any(Number)});
   const field=panel.locator('input[type="number"]:visible').first();
   expect(await field.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(16*textScale/100);
   const draft=await field.evaluate(n=>String(Math.min(Number(n.max)||Infinity,Math.max(Number(n.min)||0,(Number(n.min)||0)+(Number(n.step)||1)))));
   await field.fill(draft);
   await showKeyboard(field);
   const edited=await field.boundingBox(),fit=await panel.boundingBox(),topbar=await header.boundingBox();
   expect(fit.y).toBeGreaterThanOrEqual(0);expect(fit.y+fit.height).toBeLessThanOrEqual(keyboardHeight);
   expect(edited.y).toBeGreaterThanOrEqual(topbar.y+topbar.height-1);expect(edited.y+edited.height).toBeLessThanOrEqual(keyboardHeight);
   await page.screenshot({path:testInfo.outputPath(`keyboard-${game}-${width}.png`)});
   // Polling and resize cannot replace the user's full-screen coordinates.
   await page.evaluate(()=>{const f=window.__controllerReview;f.c.updateState(f.payload);window.dispatchEvent(new Event('resize'));});
   expect(await page.evaluate(()=>window.__controllerReview.ui.windowLayoutPreferences.get('casino','compact'))).toEqual(preference);
   await expect(field).toHaveValue(draft);
   await hideKeyboard();
   const restored=await panel.boundingBox();
   expect(restored.x).toBeCloseTo(remembered.x,0);expect(restored.y).toBeCloseTo(remembered.y,0);
   expect(await panel.evaluate(n=>n.scrollTop)).toBe(0);await checkHands();
   await header.getByRole('button',{name:'Rules',exact:true}).click();
   const rules=page.locator('.casino-info-dialog[open]');await expect(rules).toBeVisible();
   expect(await rules.locator('.casino-info-body').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(14*textScale/100);
   expect(await rules.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
   await page.keyboard.press('Escape');
   await panel.getByRole('button',{name:'Play options',exact:true}).click();
   const options=page.getByRole('dialog',{name:'Play-time controls',exact:true});
   await expect(options.getByRole('combobox')).toBeVisible();
   expect(await options.getByRole('combobox').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(16*textScale/100);
   const optionsBounds=await options.boundingBox();expect(optionsBounds.y+optionsBounds.height).toBeLessThanOrEqual(height);
   await options.getByRole('combobox').selectOption('15');
   await options.getByRole('button',{name:'Apply time limit',exact:true}).click();
   await expect(panel.locator('.casino-play-controls [role="status"]')).toHaveAttribute('aria-label',/^New play stops in /);
   if(game==='slots') {
    await panel.getByRole('button',{name:'Auto',exact:true}).click();
    const auto=page.getByRole('dialog',{name:'Auto spins',exact:true});
    const autoField=auto.locator('input[type="number"]:visible').first();
    await showKeyboard(autoField);
    const popup=await auto.boundingBox(),editor=await autoField.boundingBox();
    expect(popup.y+popup.height).toBeLessThanOrEqual(keyboardHeight);expect(editor.y+editor.height).toBeLessThanOrEqual(keyboardHeight);
    await hideKeyboard();await auto.getByRole('button',{name:'Close popup',exact:true}).click();
   }
   await panel.getByRole('button',{name:'Take a break',exact:true}).click();
   await expect(panel.locator('.casino-play-controls [role="status"]')).toHaveAttribute('data-brief','Paused');
   expect(await panel.evaluate(n=>n.scrollWidth-n.clientWidth),'Paused controls stay contained').toBeLessThanOrEqual(1);
   await checkHands();
   if(game==='blackjack') for(const name of ['Hit','Stand']) {
    const decision=panel.getByRole('button',{name,exact:true});
    await expect(decision).toBeEnabled();await expect(decision).toBeInViewport({ratio:1});
   }
   await panel.getByRole('button',{name:'Start new session',exact:true}).click();
   expect(await panel.evaluate(n=>n.scrollWidth-n.clientWidth),'Active timer stays contained').toBeLessThanOrEqual(1);
   await page.screenshot({path:testInfo.outputPath(`text${textScale}-${game}-${width}.png`)});
   expect(await page.evaluate(()=>window.__controllerReview.sent)).toEqual([]);
  } catch(error) {
   if(!page.isClosed()) await page.screenshot({path:testInfo.outputPath(`failure-${game}-${width}.png`)});
   throw error;
  } finally {
   if(!page.isClosed()) await page.evaluate(()=>{const f=window.__controllerReview;f.c.dispose();f.ui.dispose();}).catch(error=>{if(!page.isClosed()) throw error;});
   expect(failures,failures.join('\n')).toEqual([]);
  }
 });
}
