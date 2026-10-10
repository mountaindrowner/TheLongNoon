// Automated playtests. Runs the built single-file game in headless Chromium at the
// screen sizes we care about: desktop 1080p is the primary target, phones are where
// the owner plays and tests most. WebGL is software-rendered here, so frame rates in
// these runs mean nothing; real-device performance has to be checked on real devices.
const { defineConfig } = require('@playwright/test');

const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { launchOptions: { args: gl } },
  projects: [
    { name: 'desktop-1080p', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'phone-landscape', use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: 'phone-portrait', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ],
});
