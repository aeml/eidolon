import { jest } from '@jest/globals';
import { AdminUI } from '../src/ui/AdminUI.js';
import { GameEngine } from '../src/core/GameEngine.js';

let ui, send;
const report = {id:'0123456789abcdef01234567', reportType:'Account Removal Request', reviewRevision:0, status:'open', username:'owner'};
const reply = extra => ui.handleResult(`${ui.pending.type}_result`, {id:ui.pending.id, success:true, authorized:true, ...extra});
const control = () => ui.reportReviews[1];
const snapshot = () => ({reportId:report.id,reviewRevision:0,caseStatus:'open',checkedAt:'2026-10-05T22:00:00Z',
    removalSupported:false,removalAuthorized:false,accountPresent:true,onlineObserved:false,
    references:[{source:'<img src=x>',referencePresent:true},{source:'direct trades',referencePresent:false}],
    requiredReview:['Separate authorization and restore fences required.']});
beforeEach(() => {
    jest.useFakeTimers(); document.body.innerHTML='<button id="launch"></button><div id="host"></div>';
    send=jest.fn();ui=new AdminUI({host:document.querySelector('#host'),launcher:document.querySelector('#launch'),send,
        openWindow:element=>{element.style.display='flex';},closeWindow:element=>{element.style.display='none';}});
    ui.connectionState('connected');reply();ui.launcher.click();reply({players:[]});
    ui.root.querySelector('[data-view="reports"]').click();reply({reports:{reports:[report]}});
});
afterEach(()=>{ui.dispose();jest.useRealTimers();});
test('deliberate dependency read stays on the quoted case, renders safe text and never grants clearance',()=>{
    const before=send.mock.calls.length;expect(control().details.open).toBe(false);expect(control().output.textContent).toBe('');
    expect(send).toHaveBeenCalledTimes(before);control().action.click();
    expect(send).toHaveBeenLastCalledWith('admin_removal_review',{id:ui.pending.id,reportId:report.id,expectedRevision:0,expectedStatus:'open'});
    reply({removal:snapshot()});
    expect(control().status.textContent).toContain('unsupported and unauthorized');
    expect(control().output.textContent).toContain('Pending character save observed: not checked');
    expect(control().output.textContent).toContain('no matching reference observed — not clearance');
    expect(control().output.querySelector('img,script')).toBeNull();
    expect(send).toHaveBeenCalledTimes(before+1);expect(ui.pending).toBeNull();
    expect([...ui.list.querySelectorAll('button')].some(button=>/delete|erase|settle/i.test(button.textContent))).toBe(false);
});
test.each(['case','revision','authorization','references','time'])('invalid %s response does not render dependency clearance',kind=>{
    control().action.click();const data=snapshot();
    if(kind==='case')data.reportId='1123456789abcdef01234567';
    if(kind==='revision')data.reviewRevision=1;
    if(kind==='authorization')data.removalAuthorized=true;
    if(kind==='references')data.references[0].referencePresent='yes';
    if(kind==='time')data.checkedAt='invalid';
    reply({removal:data,message:'Dependencies observed.'});expect(control().output.textContent).toBe('');
    expect(control().status.textContent).toContain('Invalid dependency reply');
});
test('denial, disconnect and filter replacement discard all dependency observations and ignore late results',()=>{
    control().action.click();reply({removal:snapshot()});const row=control();
    row.action.click();const id=ui.pending.id;ui.connectionState('disconnected');
    expect(row.output.textContent).toBe('');expect(row.action.onclick).toBeNull();
    ui.handleResult('admin_removal_review_result',{id,success:true,authorized:true,removal:snapshot()});expect(ui.list.children).toHaveLength(0);
});
test('game protocol routes removal review replies to the current administrator UI only',()=>{
    const admin={handleResult:jest.fn()};const payload={id:'test'};
    GameEngine.prototype.handleServerMessage.call({uiManager:{admin},player:{id:'staff'}}, {type:'admin_removal_review_result',payload});
    expect(admin.handleResult).toHaveBeenCalledWith('admin_removal_review_result',payload);
});
