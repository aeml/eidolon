import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

let nextID = 0;
const privatePage = () => window.__eidolonRecoverySensitivePage === true && !window.__eidolonGoogleTagInitialized;
const FORMATS = {profile:'eidolon-owner-account-profile',progress:'eidolon-owner-progression',reports:'eidolon-owner-report-submissions',sessions:'eidolon-owner-session-history',social:'eidolon-owner-social-relationships',market:'eidolon-owner-marketplace-summary',guilds:'eidolon-owner-guild-memberships',invites:'eidolon-owner-guild-invitations',pvp:'eidolon-owner-competitive-records',raids:'eidolon-owner-weekly-raid-records',trades:'eidolon-owner-direct-trade-offers',bank:'eidolon-owner-guild-bank-transfers'};
const PAGED_SECTIONS = new Set(['reports','sessions','social','market','guilds','invites','pvp','raids','trades','bank']);
const OPERATION_SECTIONS = new Set(['trades','bank']);
const validCursor = (section,cursor) => OPERATION_SECTIONS.has(section) ? /^[a-f0-9]{64}$/.test(cursor) : /^[a-f0-9]{24}$/.test(cursor) && !/^0+$/.test(cursor);

// Only deliberate approved-section reads. Passwords are never kept in pending
// state. A reply prepares one bounded in-memory file; Save is a separate click.
export class OwnerExportDownload {
    constructor({parent, send, isCurrent}) {
        parent.__eidolonOwnerExport?.dispose();
        Object.assign(this, {parent, send, isCurrent});
        this.root = document.createElement('details'); this.root.className = 'support-field';
        this.root.innerHTML = '<summary>My approved data export — private download</summary>';
        parent.append(this.root); parent.__eidolonOwnerExport = this;
        if (!privatePage()) {
            const hint = document.createElement('p');
            hint.textContent = 'Open private account support and sign in again before downloading. It prevents the game analytics tag from loading; browser extensions and device recording are outside this protection. No account information is put in the link.';
            const link = document.createElement('a'); link.textContent = 'Open private account support';
            // A changed query forces a fresh document; a fragment-only link
            // would leave an already loaded analytics tag alive on this page.
            link.href = `${window.location.pathname}?eidolon-private=account`;
            this.root.append(hint, link); return;
        }
        const prefix = `owner-export-${++nextID}`;
        this.root.insertAdjacentHTML('beforeend', `<p>This prepares one section with a coverage manifest, not a complete account export or restore image. First check your own export request above. The operator must separately approve it. Nothing downloads automatically.</p>
            <form autocomplete="on"><label for="${prefix}-section">Section</label><select id="${prefix}-section" class="support-field__control"><option value="profile">Account profile</option><option value="progress">One character gameplay section</option><option value="reports">My report submissions — one page</option><option value="sessions">My retained login/session history — one page</option><option value="social">My current social relationships — one page</option><option value="market">My marketplace summaries — one page</option><option value="guilds">My current guild memberships — one page</option><option value="invites">My active guild invitations — one page</option><option value="pvp">My stored competitive records — one page</option><option value="raids">My weekly raid records — one page</option><option value="trades">My direct-trade offers — one page</option><option value="bank">My guild-bank transfer intents — one page</option></select>
            <label for="${prefix}-character">Character name (gameplay section only)</label><input id="${prefix}-character" class="support-field__control" maxlength="128" autocomplete="off">
            <label for="${prefix}-before">Page cursor (blank to start; use next from your previous file of this section)</label><input id="${prefix}-before" class="support-field__control" maxlength="64" autocomplete="off" autocapitalize="none" spellcheck="false">
            <label for="${prefix}-password">Current password</label><input id="${prefix}-password" class="support-field__control" type="password" autocomplete="current-password" maxlength="72" autocapitalize="none" spellcheck="false">
            <div class="support-field__row"><button class="menu-btn" type="submit">Prepare section</button><button class="menu-btn" type="button" data-save hidden>Save section locally</button><button class="menu-btn" type="button" data-next hidden>Choose next page</button><button class="menu-btn" type="button" data-close>Close and discard</button></div>
            <p role="status" aria-live="polite">Check your own approved export request first.</p></form>`);
        this.form = this.root.querySelector('form');
        this.section = this.root.querySelector('select');
        this.character = this.root.querySelector(`#${prefix}-character`); this.password = this.root.querySelector(`#${prefix}-password`);
        this.before = this.root.querySelector(`#${prefix}-before`); this.next = this.root.querySelector('[data-next]');
        this.button = this.root.querySelector('[type="submit"]'); this.save = this.root.querySelector('[data-save]'); this.status = this.root.querySelector('[role="status"]');
        ownedEvent(this, this.form, 'submit', event => {event.preventDefault(); this.submit();});
        ownedEvent(this, this.save, 'click', () => this.saveFile());
        ownedEvent(this, this.next, 'click', () => {
            if (!this.current() || !this.nextCursor || this.pending) return;
            this.before.value = this.nextCursor; this.nextCursor = null; this.discard(); this.clearProof();
            this.status.textContent = 'Next page selected. Enter your current password and prepare it manually. Save each page you need; no automatic download.'; this.refresh();
        });
        ownedEvent(this, this.root.querySelector('[data-close]'), 'click', () => {this.close();this.root.open=false;});
        ownedEvent(this, this.root, 'toggle', () => {if (!this.root.open) this.close();this.refresh();});
        ownedEvent(this, this.section, 'change', () => {this.discard();this.clearProof();this.before.value='';this.nextCursor=null;this.refresh();});
        this.refresh();
    }
    owns() {return !this.disposed && this.parent.__eidolonOwnerExport === this;}
    current() {return this.owns() && privatePage() && this.isCurrent() && this.root.open;}
    discard() {this.prepared=null;if(this.save)this.save.hidden=true;}
    clearProof() {if(this.password)this.password.value='';}
    setApproval(report) {
        this.close();
        this.approval = report?.reportType === 'Account Data Export' && report.exportApproved === true
            && /^[a-f0-9]{24}$/.test(report.id || '') && !/^0+$/.test(report.id)
            && Number.isSafeInteger(report.exportApprovalRevision) && report.exportApprovalRevision > 0 && report.exportApprovalRevision < 256 && report.exportApprovalRevision % 2 === 1
            ? {reportId: report.id, revision: report.exportApprovalRevision} : null;
        if(this.status)this.status.textContent = this.approval ? 'Operator approval found. Choose a section and prove current ownership; no file has been prepared.' : 'No current export approval for this request. Case review alone does not approve a download.';
        this.refresh();
    }
    refresh() {
        if(!this.owns() || !this.form)return;
        const locked = !this.current() || !this.approval || Boolean(this.pending);
        for(const field of [this.section,this.password,this.button])field.disabled=locked;
        this.character.disabled=locked || this.section.value !== 'progress';
        this.before.disabled=locked || !PAGED_SECTIONS.has(this.section.value);
        this.next.hidden=!this.nextCursor;this.next.disabled=!this.current() || Boolean(this.pending) || Boolean(this.prepared);
        this.save.disabled=!this.current() || !this.prepared;
    }
    submit() {
        if(!this.current() || !this.approval || this.pending){this.clearProof();return;}
        const currentPassword=this.password.value, characterName=this.section.value === 'progress' ? this.character.value : '', before=PAGED_SECTIONS.has(this.section.value)?this.before.value:'';
        if(!Object.hasOwn(FORMATS,this.section.value) || !currentPassword || new Blob([currentPassword]).size>72 || (this.section.value==='progress' && (!characterName || new Blob([characterName]).size>128)) || (before && !validCursor(this.section.value,before))){this.status.textContent='Enter your current password, exact character name for gameplay, and a valid page cursor if paging.';return;}
        this.discard();
        this.nextCursor=null;
        const requestId=crypto.randomUUID();
        this.pending={requestId,section:this.section.value,before};this.clearProof();this.refresh();
        this.status.textContent='Preparing this section… No automatic retry or download.';
        try {
            if(this.send({requestId,reportId:this.approval.reportId,approvalRevision:this.approval.revision,currentPassword,section:this.section.value,characterName,before})!==true)throw new Error('offline');
        } catch {this.pending=null;this.status.textContent='Not connected. Enter your proof again after reconnecting; no automatic retry.';this.refresh();return;}
        if(this.pending?.requestId !== requestId)return;
        this.timer=setTimeout(()=>{if(this.pending?.requestId!==requestId)return;this.pending=null;this.status.textContent='No section confirmed. Recheck approval and retry manually; no file or password was retained.';this.refresh();},10000);
    }
    handleResult(result) {
        if(!this.owns() || !this.pending || result?.requestId!==this.pending.requestId)return false;
        const {section,before}=this.pending;clearTimeout(this.timer);this.pending=null;this.clearProof();this.discard();
        if(!this.current()){this.refresh();return false;}
        const expected=FORMATS[section];
        if(result.success!==true || result.data?.format!==expected || result.data.version!==1){this.status.textContent='Section unavailable. Recheck approval and ownership or ask the operator about missing/larger data.';this.refresh();return true;}
        const cursor=result.data.next;
        const paged=PAGED_SECTIONS.has(section), entries=result.data[section==='reports'?'reports':'entries'];
        if(paged && (!Array.isArray(entries) || entries.length>10 || (cursor!==undefined && (typeof cursor!=='string' || !validCursor(section,cursor) || (before && cursor>=before))))){this.status.textContent='Invalid page. Nothing was saved; ask the operator.';this.refresh();return true;}
        let text;
        try {text=JSON.stringify(result.data);if(new Blob([text]).size>512*1024)throw new Error('oversized');} catch {this.status.textContent='Section exceeds the supported size. Nothing was saved; ask the operator.';this.refresh();return true;}
        this.nextCursor=paged?cursor:null;
        this.prepared={text,section,before};this.save.hidden=false;this.status.textContent=`One section is ready in memory. Save it locally only if you want it; protect the file. Close discards it. This is not your complete account export.${paged?(cursor?' More pages remain; save this file then choose next manually.':' No older available page at this read; other account categories remain.'):''}`;this.refresh();return true;
    }
    saveFile() {
        if(!this.current() || !this.prepared)return;
        const url=URL.createObjectURL(new Blob([this.prepared.text],{type:'application/json'}));
        try {const link=document.createElement('a');link.href=url;link.download=`eidolon-${this.prepared.section}${PAGED_SECTIONS.has(this.prepared.section)?`-${this.prepared.before||'start'}`:''}-section.json`;document.body.append(link);try{link.click();}finally{link.remove();}}
        finally {setTimeout(()=>URL.revokeObjectURL(url),1000);this.discard();this.status.textContent='Section offered to your browser for saving. We cannot verify the device saved it; keep it private.';this.refresh();}
    }
    close() {this.clearProof();this.discard();this.nextCursor=null;if(this.before)this.before.value='';this.pending=null;clearTimeout(this.timer);this.refresh();}
    connectionState(state) {if(state!=='connected'){this.close();this.approval=null;}this.refresh();}
    dispose() {if(this.disposed)return;this.close();this.disposed=true;disposeOwnedEvents(this);this.root.remove();if(this.parent.__eidolonOwnerExport===this)delete this.parent.__eidolonOwnerExport;}
}
