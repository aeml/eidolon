import { test } from '@playwright/test';
import { reviewEarthRockShelves } from './earth-rock-shelf-review.js';

for (const quality of ['high', 'low']) test(`${quality}: Earth rock shelves retain grounded equipped views and owned resources`, async ({ page, baseURL }, testInfo) => {
    await reviewEarthRockShelves({ page, baseURL }, testInfo, quality);
});

test('low phone: Earth rock shelves retain grounded equipped views and owned resources', async ({ page, baseURL }, testInfo) => {
    await reviewEarthRockShelves({ page, baseURL }, testInfo, 'low', '/src/core/GameEngine.js', 390);
});
