import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

let nextID = 0;
const privatePage = () => window.__eidolonRecoverySensitivePage === true && !window.__eidolonGoogleTagInitialized;

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
        this.root.insertAdjacentHTML('beforeend', `<p>This prepares one profile or character gameplay section, not a complete account export or restore image. First check your own export request above. The operator must separately approve it. Nothing downloads automatically.</p>
            <form autocomplete="on"><label for="${prefix}-section">Section</label><select id="${prefix}-section" class="support-field__control"><option value="profile">Account profile</option><option value="progress">One character gameplay section</option></select>
            <label for="${prefix}-character">Character name (gameplay section only)</label><input id="${prefix}-character" class="support-field__control" maxlength="128" autocomplete="off">
            <label for="${prefix}-password">Current password</label><input id="${prefix}-password" class="support-field__control" type="password" autocomplete="current-password" maxlength="72" autocapitalize="none" spellcheck="false">
            <div class="support-field__row"><button class="menu-btn" type="submit">Prepare section</button><button class="menu-btn" type="button" data-save hidden>Save section locally</button><button class="menu-btn" type="button" data-close>Close and discard</button></div>
            <p role="status" aria-live="polite">Check your own approved export request first.</p></form>`);
        this.form = this.root.querySelector('form');
        this.section = this.root.querySelector('select');
        [this.character, this.password] = this.root.querySelectorAll('input');
        this.button = this.root.querySelector('[type="submit"]'); this.save = this.root.querySelector('[data-save]'); this.status = this.root.querySelector('[role="status"]');
        ownedEvent(this, this.form, 'submit', event => {event.preventDefault(); this.submit();});
        ownedEvent(this, this.save, 'click', () => this.saveFile());
        ownedEvent(this, this.root.querySelector('[data-close]'), 'click', () => {this.close();this.root.open=false;});
        ownedEvent(this, this.root, 'toggle', () => {if (!this.root.open) this.close();this.refresh();});
        ownedEvent(this, this.section, 'change', () => {this.discard();this.refresh();});
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
        this.save.disabled=!this.current() || !this.prepared;
    }
    submit() {
        if(!this.current() || !this.approval || this.pending){this.clearProof();return;}
        const currentPassword=this.password.value, characterName=this.section.value === 'progress' ? this.character.value : '';
        if(!['profile','progress'].includes(this.section.value) || !currentPassword || new Blob([currentPassword]).size>72 || (this.section.value==='progress' && (!characterName || new Blob([characterName]).size>128))){this.status.textContent='Enter your current password and exact character name for a gameplay section.';return;}
        this.discard();
        const requestId=crypto.randomUUID();
        this.pending={requestId,section:this.section.value};this.clearProof();this.refresh();
        this.status.textContent='Preparing this section… No automatic retry or download.';
        try {
            if(this.send({requestId,reportId:this.approval.reportId,approvalRevision:this.approval.revision,currentPassword,section:this.section.value,characterName})!==true)throw new Error('offline');
        } catch {this.pending=null;this.status.textContent='Not connected. Enter your proof again after reconnecting; no automatic retry.';this.refresh();return;}
        if(this.pending?.requestId !== requestId)return;
        this.timer=setTimeout(()=>{if(this.pending?.requestId!==requestId)return;this.pending=null;this.status.textContent='No section confirmed. Recheck approval and retry manually; no file or password was retained.';this.refresh();},10000);
    }
    handleResult(result) {
        if(!this.owns() || !this.pending || result?.requestId!==this.pending.requestId)return false;
        const section=this.pending.section;clearTimeout(this.timer);this.pending=null;this.clearProof();this.discard();
        if(!this.current()){this.refresh();return false;}
        const expected=section==='profile'?'eidolon-owner-account-profile':'eidolon-owner-progression';
        if(result.success!==true || result.data?.format!==expected || result.data.version!==1){this.status.textContent='Section unavailable. Recheck approval and ownership or ask the operator about missing/larger data.';this.refresh();return true;}
        let text;
        try {text=JSON.stringify(result.data);if(new Blob([text]).size>512*1024)throw new Error('oversized');} catch {this.status.textContent='Section exceeds the supported size. Nothing was saved; ask the operator.';this.refresh();return true;}
        this.prepared={text,section};this.save.hidden=false;this.status.textContent='One section is ready in memory. Save it locally only if you want it; protect the file. Close discards it. This is not your complete account export.';this.refresh();return true;
    }
    saveFile() {
        if(!this.current() || !this.prepared)return;
        const url=URL.createObjectURL(new Blob([this.prepared.text],{type:'application/json'}));
        try {const link=document.createElement('a');link.href=url;link.download=`eidolon-${this.prepared.section}-section.json`;document.body.append(link);try{link.click();}finally{link.remove();}}
        finally {setTimeout(()=>URL.revokeObjectURL(url),1000);this.discard();this.status.textContent='Section offered to your browser for saving. We cannot verify the device saved it; keep it private.';this.refresh();}
    }
    close() {this.clearProof();this.discard();this.pending=null;clearTimeout(this.timer);this.refresh();}
    connectionState(state) {if(state!=='connected'){this.close();this.approval=null;}this.refresh();}
    dispose() {if(this.disposed)return;this.close();this.disposed=true;disposeOwnedEvents(this);this.root.remove();if(this.parent.__eidolonOwnerExport===this)delete this.parent.__eidolonOwnerExport;}
}
