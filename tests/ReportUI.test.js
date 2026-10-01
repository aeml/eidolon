import { jest } from '@jest/globals';
import { ReportUI, collectReportContext, formatReportContext } from '../src/ui/ReportUI.js';
import { GameEngine } from '../src/core/GameEngine.js';

function setup() {
    document.body.innerHTML = `<span class="start-version-row__label">Alpha test</span><div id="report-screen">
        <select id="report-type"><option>Bug Report</option><option>Player Report</option><option>Moderation Appeal</option></select><p id="report-guidance"></p><textarea id="report-text"></textarea>
        <button id="btn-submit-report">Submit</button><input id="report-diagnostics" type="checkbox">
        <pre id="report-context"></pre><p id="report-status"></p><output id="report-count"></output></div>`;
    const ui = { reportScreen: document.querySelector('#report-screen'), reportText: document.querySelector('#report-text'),
        reportType: document.querySelector('#report-type'), btnSubmitReport: document.querySelector('button'),
        getReportContext: jest.fn(() => ({ build: 'Alpha test', area: 'Lanternhold' })), onReportSubmit: jest.fn(() => true) };
    ui.report = new ReportUI(ui);
    ui.report.refreshContext();
    ui.reportText.value = 'A detailed bug report';
    return ui;
}

describe('report save confirmation and privacy', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(crypto, 'randomUUID').mockReturnValue('test-request-id');
    });
    afterEach(() => { document.querySelector('#report-screen')?.__eidolonReportUI?.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });

    test('keeps the draft until a matching persistence acknowledgement and prevents double sends', () => {
        const ui = setup();
        ui.report.submit(); ui.report.submit();
        expect(ui.onReportSubmit).toHaveBeenCalledTimes(1);
        expect(ui.onReportSubmit).toHaveBeenCalledWith('Bug Report', expect.stringContaining('Client-reported context:'), 'test-request-id');
        expect(ui.reportText.value).toBe('A detailed bug report');
        expect(ui.btnSubmitReport.disabled).toBe(true);
        ui.report.handleResult({ requestId: 'old-request', success: true });
        expect(ui.reportText.value).not.toBe('');
        ui.report.handleResult({ requestId: 'test-request-id', success: true, reportId: '0123456789abcdef01234567' });
        expect(ui.reportText.value).toBe('');
        expect(ui.btnSubmitReport.disabled).toBe(false);
        expect(ui.report.status.textContent).toContain('0123456789abcdef01234567');
    });

    test('appeals use the private report route without implying a sanction reversal', () => {
        const ui = setup();
        ui.reportType.value = 'Moderation Appeal';
        ui.reportType.dispatchEvent(new Event('change'));
        expect(ui.report.guidance.textContent).toContain('moderation notice or report reference');
        expect(ui.report.guidance.textContent).toContain('does not automatically cancel a sanction');
        expect(ui.reportText.value).toBe('A detailed bug report');
        expect(ui.report.optIn.checked).toBe(false);
        ui.reportText.value = 'Please review notice 0123456789abcdef01234567: the context was misunderstood.';
        ui.report.submit();
        expect(ui.onReportSubmit).toHaveBeenCalledWith('Moderation Appeal', expect.stringContaining('Please review notice'), 'test-request-id');
        expect(ui.reportText.value).toContain('Please review');
        ui.report.handleResult({ requestId: 'test-request-id', success: true, reportId: 'abcdef0123456789abcdef01' });
        expect(ui.report.status.textContent).toContain('operator review');
        expect(ui.report.status.textContent).not.toContain('cancelled');
        expect(ui.reportText.value).toBe('');
    });

    test('selected player context is an editable draft, never an automatic report', () => {
        const ui = setup();
        expect(ui.report.startPlayerReport('Ayla', 'party chat; selected message: Meet by the gate')).toBe(true);
        expect(ui.reportText.value).toContain('A detailed bug report');
        expect(ui.reportText.value).toContain('Player: Ayla');
        expect(ui.reportType.value).toBe('Player Report');
        expect(ui.report.guidance.textContent).toContain('not verified evidence');
        expect(ui.report.count.textContent).toBe(`${[...ui.reportText.value].length} / 3200 characters`);
        expect(ui.onReportSubmit).not.toHaveBeenCalled();
    });

    test('contextual reports cannot rewrite a pending submission or overflow an existing draft', () => {
        const ui = setup();
        ui.report.submit();
        expect(ui.report.startPlayerReport('Ayla', 'selected message')).toBe(false);
        expect(ui.reportText.value).toBe('A detailed bug report');
        expect(ui.reportType.value).toBe('Bug Report');
        ui.report.handleResult({requestId: 'test-request-id', success: false});
        ui.reportText.value = 'x'.repeat(3190);
        expect(ui.report.startPlayerReport('Ayla', 'selected message')).toBe(false);
        expect(ui.reportText.value).toBe('x'.repeat(3190));
        expect(ui.reportType.value).toBe('Bug Report');
        expect(ui.onReportSubmit).toHaveBeenCalledTimes(1);
    });

    test('changing report type preserves save status and disposal removes type listeners', () => {
        const ui = setup();
        ui.report.setStatus('Previous save remains unconfirmed.');
        ui.reportType.value = 'Moderation Appeal'; ui.reportType.dispatchEvent(new Event('change'));
        expect(ui.report.status.textContent).toBe('Previous save remains unconfirmed.');
        ui.report.dispose();
        const text = ui.report.guidance.textContent;
        ui.reportType.value = 'Bug Report'; ui.reportType.dispatchEvent(new Event('change'));
        expect(ui.report.guidance.textContent).toBe(text);
    });

    test.each(['offline', 'throw', 'failure', 'timeout'])('%s retains draft without an automatic retry', mode => {
        const ui = setup();
        if (mode === 'offline') ui.onReportSubmit.mockReturnValue(false);
        if (mode === 'throw') ui.onReportSubmit.mockImplementation(() => { throw new Error('closed socket'); });
        ui.report.submit();
        if (mode === 'failure') ui.report.handleResult({ requestId: 'test-request-id', success: false });
        jest.advanceTimersByTime(16000);
        expect(ui.reportText.value).toBe('A detailed bug report');
        expect(ui.onReportSubmit).toHaveBeenCalledTimes(1);
        expect(ui.btnSubmitReport.disabled).toBe(false);
        if (mode === 'timeout') expect(ui.report.status.textContent).toContain('may have received');
    });

    test('actual engine message route delivers the correlated acknowledgement to the form', () => {
        const ui = setup(); ui.report.submit();
        GameEngine.prototype.handleServerMessage.call({ player: { id: 'reporter' }, uiManager: ui },
            { type: 'report_result', payload: { requestId: 'test-request-id', success: true } });
        expect(ui.reportText.value).toBe('');
        expect(ui.report.status.textContent).toContain('Report saved');
    });

    test('actual engine message route sends owner-status replies only to the owned lookup', () => {
        const ui = setup();
        ui.report.lookup.handleResult = jest.fn();
        const payload = {requestId: 'lookup-request-000001', success: false};
        GameEngine.prototype.handleServerMessage.call({player: {id: 'reporter'}, uiManager: ui},
            {type: 'report_status_result', payload});
        expect(ui.report.lookup.handleResult).toHaveBeenCalledWith(payload);
        expect(ui.reportText.value).toBe('A detailed bug report');
    });

    test('keyboard focus skips collapsed disclosure contents even when the browser retains rectangles', () => {
        const ui = setup();
        const details = document.createElement('details');
        details.innerHTML = '<summary tabindex="0">Check my report</summary><input><button>Check status</button>';
        ui.reportScreen.append(details);
        for (const element of ui.reportScreen.querySelectorAll('button, input, select, textarea, summary')) {
            element.getClientRects = () => [{width: 100, height: 44}];
        }
        const summary = details.querySelector('summary'); summary.focus();
        summary.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true}));
        expect(document.activeElement).toBe(ui.reportType);
        ui.reportType.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', shiftKey: true, bubbles: true}));
        expect(document.activeElement).toBe(summary);
    });

    test('does not erase a newer draft or accept an acknowledgement after timeout', () => {
        const ui = setup(); ui.report.submit();
        ui.reportText.value = 'Newer draft';
        ui.report.handleResult({ requestId: 'test-request-id', success: true });
        expect(ui.reportText.value).toBe('Newer draft');
        ui.report.submit(); jest.advanceTimersByTime(16000);
        ui.report.handleResult({ requestId: 'test-request-id', success: true });
        expect(ui.reportText.value).toBe('Newer draft');
    });

    test('bounded text and explicit context allowlist reject empty/oversized drafts and private fields', () => {
        const ui = setup();
        for (const text of ['  ', 'x'.repeat(3201)]) { ui.reportText.value = text; ui.report.submit(); }
        expect(ui.onReportSubmit).not.toHaveBeenCalled();
        expect(formatReportContext({ build: 'release\nforged', area: 'town', password: 'secret', chat: 'private' }))
            .toBe('build: release forged\narea: town');
        ui.getReportContext.mockReturnValue(Object.fromEntries(['build', 'commit', 'area', 'quality', 'viewport', 'controls', 'position'].map(key => [key, 'x'.repeat(1000)])));
        ui.report.refreshContext(); ui.reportText.value = 'x'.repeat(3200); ui.report.submit();
        expect([...ui.onReportSubmit.mock.calls[0][1]].length).toBeLessThanOrEqual(4000);
    });

    test('optional diagnostics are off by default and never copy account, private instance id or logs', () => {
        setup();
        const engine = { player: { position: { x: 5.4, z: 200.6 }, password: 'secret' },
            currentInstanceId: 'private-session-id', renderSystem: { graphicsQuality: 'low' }, chat: ['private'] };
        expect(collectReportContext(engine)).toEqual({ build: 'Alpha test', commit: 'local', area: 'Lanternhold' });
        expect(collectReportContext(engine, true)).toEqual(expect.objectContaining({ quality: 'low', position: '5, 201', controls: 'desktop' }));
        expect(JSON.stringify(collectReportContext(engine, true))).not.toMatch(/secret|private/);
        engine.player.position.x = Infinity;
        expect(collectReportContext(engine, true).position).toBeUndefined();
    });

    test.each([
        [0, 200, 'Lanternhold'], [100, 300, 'Lanternhold'], [101, 300, 'Earth Realm'],
        [0, -600, 'Earth Realm'], [0, -601, 'Water Realm'],
        [-1001, 200, 'Fire Realm'], [1001, 200, 'Air Realm'],
        [20000, 20000, 'overworld'], [NaN, 200, 'overworld'],
        [-2400, -900, 'overworld']
    ])('report context follows shared geography at %s,%s', (x, z, area) => {
        setup();
        const engine = { player: { position: { x, z } } };
        expect(collectReportContext(engine).area).toBe(area);
        engine.currentInstanceType = 'casino';
        engine.currentInstanceId = 'private-allocation';
        expect(collectReportContext(engine).area).toBe('casino');
        expect(JSON.stringify(collectReportContext(engine))).not.toContain('private-allocation');
    });

    test('reconstructing the form clears prior session drafts and removes old listeners/timers', () => {
        const ui = setup(); const old = ui.report;
        old.submit();
        ui.report = new ReportUI(ui);
        expect(ui.reportText.value).toBe('');
        old.handleResult({ requestId: 'test-request-id', success: true });
        ui.reportText.value = 'Current session';
        ui.btnSubmitReport.click();
        expect(ui.onReportSubmit).toHaveBeenCalledTimes(2);
        expect(jest.getTimerCount()).toBe(1);
    });

    test('retained callbacks and repeated disposal cannot alter the replacement session', () => {
        const ui = setup(); const old = ui.report;
        ui.report = new ReportUI(ui);
        ui.reportText.value = 'Current session private draft';
        ui.report.setStatus('Current session status');
        expect(old.startPlayerReport('Ayla', 'old selection')).toBe(false);
        old.submit(); old.refreshContext(); old.dispose();
        expect(ui.onReportSubmit).not.toHaveBeenCalled();
        expect(ui.reportText.value).toBe('Current session private draft');
        expect(ui.reportType.value).toBe('Bug Report');
        expect(ui.report.status.textContent).toBe('Current session status');
        ui.report.submit();
        old.dispose();
        expect(ui.btnSubmitReport.disabled).toBe(true);
        expect(ui.reportText.readOnly).toBe(true);
        expect(jest.getTimerCount()).toBe(1);
    });

    test('retirement during submission cannot install an old-session timeout', () => {
        const ui = setup(); const old = ui.report;
        ui.onReportSubmit.mockImplementation(() => { ui.report = new ReportUI(ui); return true; });
        old.submit();
        expect(jest.getTimerCount()).toBe(0);
        expect(ui.reportText.value).toBe('');
        expect(ui.btnSubmitReport.disabled).toBe(false);
    });
});
