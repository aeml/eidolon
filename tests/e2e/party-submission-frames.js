import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

import { observeSubmissionFramesInPage } from '../submissionFrameObservation.js';

export async function capturePartySubmissionFrames(page, testInfo, filename = 'party-submission-frames.json', { frameCount = 12, activity = false } = {}) {
    const evidence = await page.evaluate(observeSubmissionFramesInPage, { frameCount, activity });
    await writeFile(testInfo.outputPath(filename), JSON.stringify(evidence, null, 2));
    expect(evidence.restored).toBe(true); expect(evidence.frames).toHaveLength(frameCount);
    for (const frame of evidence.frames) {
        expect(frame.rows.reduce((total, row) => total + row.submittedCalls, 0)).toBe(frame.calls);
        expect(frame.rows.reduce((total, row) => total + row.submittedTriangles, 0)).toBe(frame.triangles);
        expect(frame.calls).toBeGreaterThan(0);
    }
    return evidence;
}
