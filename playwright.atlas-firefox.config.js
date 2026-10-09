import base from './playwright.config.js';

// Narrow 2D compatibility check, not a headless Firefox WebGL certificate.
// Preserve the main configuration's credential-safe recording policy.
export default {
    ...base,
    projects: [
        { name: 'Firefox desktop atlas controls', testMatch: 'atlas-navigation.spec.js', grep: /1280x800/ },
        { name: 'Firefox desktop and phone-sized relief', testMatch: 'atlas-terrain-relief.spec.js' }
    ],
    use: { ...base.use, browserName: 'firefox', userAgent: undefined, launchOptions: {} }
};
