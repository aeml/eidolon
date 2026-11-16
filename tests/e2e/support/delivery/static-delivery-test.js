import { test as base, expect, devices } from '@playwright/test';
import { recordStaticDelivery } from './static-delivery-evidence.js';

export const test = base.extend({
    staticDeliveryEvidence: [async ({ page, baseURL }, use, testInfo) => {
        await recordStaticDelivery({ page, baseURL }, use, testInfo);
    }, { auto: true }]
});
export { expect, devices };
