import { test } from '@playwright/test';
import { runGearedPartyRoute } from './geared-party-route.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('four geared roles clear the selected dungeon through real party inputs and receive individual credit', runGearedPartyRoute);
