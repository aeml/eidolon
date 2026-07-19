import { chromium } from '@playwright/test';
import { accessSync, constants } from 'node:fs';
import { hardwareWebGLBrowserArgs } from '../tests/e2e/browserLaunchPolicy.js';

const executablePath = process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome';
try {
    accessSync(executablePath, constants.X_OK);
} catch {
    throw new Error(`System Chrome is not executable at ${executablePath}`);
}

const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: hardwareWebGLBrowserArgs()
});

try {
    const page = await browser.newPage();
    await page.setContent('<canvas id="probe"></canvas>');
    const result = await page.locator('#probe').evaluate((canvas) => {
        const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!context) return null;
        const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
        return {
            renderer: debugInfo
                ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
                : context.getParameter(context.RENDERER),
            vendor: debugInfo
                ? context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
                : context.getParameter(context.VENDOR)
        };
    });
    if (!result) throw new Error('System Chrome could not create a WebGL context');
    console.log(`WebGL vendor: ${result.vendor}`);
    console.log(`WebGL renderer: ${result.renderer}`);
    if (/swiftshader|llvmpipe|software/i.test(`${result.vendor} ${result.renderer}`)) {
        throw new Error('System Chrome is using a software WebGL renderer');
    }
} finally {
    await browser.close();
}
