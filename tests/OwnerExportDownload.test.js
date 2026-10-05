import { jest } from '@jest/globals';
import { OwnerExportDownload } from '../src/ui/OwnerExportDownload.js';
import { GameEngine } from '../src/core/GameEngine.js';

let ui, parent, send, current, savedURLs, revokedURLs;
const approval={id:'0123456789abcdef01234567',reportType:'Account Data Export',exportApproved:true,exportApprovalRevision:1};
beforeEach(()=>{
    jest.useFakeTimers();jest.spyOn(crypto,'randomUUID').mockReturnValue('owner-section-00001');
    window.__eidolonRecoverySensitivePage=true;delete window.__eidolonGoogleTagInitialized;
    document.body.innerHTML='<section></section>';parent=document.querySelector('section');current=true;send=jest.fn(()=>true);
    savedURLs=URL.createObjectURL;revokedURLs=URL.revokeObjectURL;URL.createObjectURL=jest.fn(()=> 'blob:private-test');URL.revokeObjectURL=jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    ui=new OwnerExportDownload({parent,send,isCurrent:()=>current});ui.root.open=true;ui.setApproval(approval);
});
afterEach(()=>{ui?.dispose();jest.runOnlyPendingTimers();URL.createObjectURL=savedURLs;URL.revokeObjectURL=revokedURLs;delete window.__eidolonRecoverySensitivePage;delete window.__eidolonGoogleTagInitialized;jest.restoreAllMocks();jest.useRealTimers();});
const submit=()=>{ui.password.value='synthetic owner proof';ui.submit();};
const response=()=>({requestId:'owner-section-00001',success:true,data:{format:'eidolon-owner-account-profile',version:1,profile:{username:'owner',submitted_email:'owner@example.invalid'}}});

test('ordinary or already-tagged page renders no export password input and only a clean private-mode link',()=>{
    ui.dispose();delete window.__eidolonRecoverySensitivePage;
    ui=new OwnerExportDownload({parent,send,isCurrent:()=>true});
    expect(ui.root.querySelector('input[type=password]')).toBeNull();expect(ui.root.querySelector('a').getAttribute('href')).toBe(`${location.pathname}?eidolon-private=account`);
    ui.dispose();window.__eidolonRecoverySensitivePage=true;window.__eidolonGoogleTagInitialized=true;
    ui=new OwnerExportDownload({parent,send,isCurrent:()=>true});expect(ui.root.querySelector('input[type=password]')).toBeNull();expect(send).not.toHaveBeenCalled();
});
test('only explicit approved request sends; proof clears and pending retains no credential',()=>{
    expect(send).not.toHaveBeenCalled();submit();ui.submit();
    expect(send).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledWith(expect.objectContaining({reportId:approval.id,approvalRevision:1,currentPassword:'synthetic owner proof',section:'profile',characterName:''}));
    expect(ui.password.value).toBe('');expect(ui.pending).toEqual({requestId:'owner-section-00001',section:'profile',before:''});
});
test('real engine reply route prepares in RAM; save needs another click and revokes its object URL',()=>{
    submit();GameEngine.prototype.handleServerMessage.call({player:{id:'owner'},uiManager:{report:{exportDownload:ui}}},{type:'owner_export_section_result',payload:response()});
    expect(ui.prepared.text).toContain('owner@example.invalid');expect(parent.textContent).not.toContain('owner@example.invalid');
    expect(URL.createObjectURL).not.toHaveBeenCalled();ui.save.click();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);expect(ui.prepared).toBeNull();
    jest.advanceTimersByTime(1000);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-test');
});
test.each(['close','disconnect','replacement','other-response'])('late result cannot prepare a file after %s',mode=>{
    const old=ui;submit();
    if(mode==='close')ui.close();if(mode==='disconnect'){current=false;ui.connectionState('lost');}
    if(mode==='replacement'){ui=new OwnerExportDownload({parent,send,isCurrent:()=>true});}
    const result=response();if(mode==='other-response')result.requestId='other-session';
    old.handleResult(result);expect(old.prepared).toBeFalsy();expect(URL.createObjectURL).not.toHaveBeenCalled();expect(old.password.value).toBe('');
});
test('failed, malformed and oversized sections never become downloadable; no auto retry',()=>{
    for(const result of [{...response(),success:false},{...response(),data:{format:'wrong',version:1}},
        {...response(),data:{...response().data,padding:'x'.repeat(513*1024)}}]){submit();ui.handleResult(result);expect(ui.prepared).toBeFalsy();expect(ui.save.hidden).toBe(true);}
    expect(URL.createObjectURL).not.toHaveBeenCalled();const calls=send.mock.calls.length;jest.advanceTimersByTime(60000);expect(send).toHaveBeenCalledTimes(calls);
});
test('approval revocation or another case clears current proof and prepared contents',()=>{
    submit();ui.handleResult(response());ui.password.value='unsent proof';ui.setApproval({...approval,exportApproved:false});
    expect(ui.approval).toBeNull();expect(ui.prepared).toBeNull();expect(ui.password.value).toBe('');expect(ui.button.disabled).toBe(true);
});
test('timeout retains no password/file, releases read controls and never resends',()=>{
    submit();jest.advanceTimersByTime(11000);expect(ui.pending).toBeNull();expect(ui.prepared).toBeNull();expect(ui.password.value).toBe('');expect(send).toHaveBeenCalledTimes(1);
});
test('reports use explicit owner-scoped pages; next never reads or downloads automatically',()=>{
    ui.section.value='reports';ui.section.dispatchEvent(new Event('change'));
    const next='0123456789abcdef01234560';submit();
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({section:'reports',characterName:'',before:''}));
    ui.handleResult({...response(),data:{format:'eidolon-owner-report-submissions',version:1,reports:[{submitted_text:'Owner authored text'}],next,coverage:{complete_account_export:false}}});
    expect(ui.prepared.text).toContain('Owner authored text');expect(parent.textContent).not.toContain('Owner authored text');
    expect(send).toHaveBeenCalledTimes(1);expect(URL.createObjectURL).not.toHaveBeenCalled();
    ui.save.click();ui.next.click();expect(ui.before.value).toBe(next);expect(ui.password.value).toBe('');
    expect(ui.prepared).toBeNull();expect(send).toHaveBeenCalledTimes(1);
    submit();expect(send).toHaveBeenLastCalledWith(expect.objectContaining({before:next}));
    ui.handleResult({...response(),data:{format:'eidolon-owner-report-submissions',version:1,reports:[]}});
    expect(ui.next.hidden).toBe(true);expect(ui.status.textContent).toContain('other account categories remain');
});
test('invalid cursor, backwards/non-decreasing next or unbounded report page cannot be saved',()=>{
    ui.section.value='reports';ui.section.dispatchEvent(new Event('change'));ui.before.value='forged';submit();expect(send).not.toHaveBeenCalled();
    ui.before.value='0123456789abcdef01234560';
    for(const data of [
        {reports:[],next:'0123456789abcdef01234567'},
        {reports:[],next:'000000000000000000000000'},
        {reports:Array.from({length:11},()=>({}))},
    ]){submit();ui.handleResult({...response(),data:{format:'eidolon-owner-report-submissions',version:1,...data}});expect(ui.prepared).toBeNull();}
    expect(URL.createObjectURL).not.toHaveBeenCalled();
});
test('retained session history uses its own page format and requires manual save/continuation',()=>{
    ui.section.value='sessions';ui.section.dispatchEvent(new Event('change'));submit();
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({section:'sessions',before:'',characterName:''}));
    const next='0123456789abcdef01234560';
    ui.handleResult({...response(),data:{format:'eidolon-owner-session-history',version:1,retention_days:90,entries:[{action:'disconnect',at:'2026-10-05T11:00:00Z'}],next}});
    expect(ui.prepared.text).toContain('disconnect');expect(ui.next.disabled).toBe(true);expect(send).toHaveBeenCalledTimes(1);
    ui.save.click();ui.next.click();expect(ui.before.value).toBe(next);expect(ui.password.value).toBe('');expect(send).toHaveBeenCalledTimes(1);
    ui.section.value='reports';ui.section.dispatchEvent(new Event('change'));expect(ui.before.value).toBe('');expect(ui.next.hidden).toBe(true);
});
test.each([['social','eidolon-owner-social-relationships'],['market','eidolon-owner-marketplace-summary']])('%s summaries retain private manual pagination', (section,format)=>{
    ui.section.value=section;ui.section.dispatchEvent(new Event('change'));submit();
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({section,characterName:'',before:''}));
    ui.handleResult({...response(),data:{format,version:1,entries:[{id:'0123456789abcdef01234561'}],next:'0123456789abcdef01234560',coverage:{complete_account_export:false}}});
    expect(ui.prepared.text).toContain(format);expect(ui.next.disabled).toBe(true);expect(send).toHaveBeenCalledTimes(1);expect(URL.createObjectURL).not.toHaveBeenCalled();
    ui.save.click();ui.next.click();expect(ui.before.value).toBe('0123456789abcdef01234560');expect(send).toHaveBeenCalledTimes(1);
});
