import { jest } from '@jest/globals';
import { ReportUI, collectReportContext, formatReportContext } from '../src/ui/ReportUI.js';
import { GameEngine } from '../src/core/GameEngine.js';

function setup() {
    document.body.innerHTML = `<span class="start-version-row__label">Alpha test</span><div id="report-screen">
        <select id="report-type"><option>Bug Report</option></select><textarea id="report-text"></textarea>
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
});
