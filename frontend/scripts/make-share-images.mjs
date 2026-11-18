/**
 * Regenerates the link-preview image and the phone home-screen icon in `public/`.
 * Run with `node scripts/make-share-images.mjs` (uses the Chromium that Playwright installs).
 * The images are committed, so this is only needed when the name or look changes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const publicDir = new URL('../public/', import.meta.url);
const favicon = readFileSync(new URL('favicon.svg', publicDir), 'utf8');

const shareCard = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; width: 1200px; height: 630px; display: flex; align-items: center;
    background: linear-gradient(135deg, #0e1724 0%, #172a4a 100%); color: #edf1f7;
    font-family: 'Segoe UI', Inter, Arial, sans-serif; }
  .text { padding: 0 0 0 80px; width: 760px; }
  h1 { margin: 0; font-size: 104px; line-height: 1; letter-spacing: -1px; }
  p { margin: 22px 0 0; font-size: 44px; line-height: 1.25; color: #a9bddb; }
  .chips { margin-top: 44px; display: flex; flex-wrap: wrap; gap: 12px; }
  .chips span { padding: 8px 18px; border: 2px solid #3d5c8f; border-radius: 999px; font-size: 26px; color: #cfe0ff; }
  .art { width: 440px; display: flex; justify-content: center; }
</style>
<div class="text">
  <h1>RSA Lab</h1>
  <p>Learn RSA one step at a time</p>
  <div class="chips"><span>GCD</span><span>Inverse</span><span>Fast powers</span><span>RSA by hand</span><span>Attacks</span></div>
</div>
<div class="art">
  <svg width="320" height="320" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="#7db4ff" />
    <path d="M21 29v-6a11 11 0 0 1 22 0v6" fill="none" stroke="#0e1724" stroke-width="5" stroke-linecap="round" />
    <rect x="15" y="28" width="34" height="26" rx="6" fill="#0e1724" />
    <circle cx="32" cy="39" r="4" fill="#7db4ff" />
    <rect x="30" y="41" width="4" height="8" rx="2" fill="#7db4ff" />
  </svg>
</div>`;

const browser = await chromium.launch();
try {
  const share = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await share.setContent(shareCard);
  await share.screenshot({ path: fileURLToPath(new URL('og-image.png', publicDir)) });

  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await icon.setContent(
    `<style>html,body{margin:0;background:#1456b8}svg{display:block;width:180px;height:180px}</style>${favicon}`,
  );
  await icon.screenshot({ path: fileURLToPath(new URL('apple-touch-icon.png', publicDir)) });
} finally {
  await browser.close();
}
console.log('Wrote public/og-image.png and public/apple-touch-icon.png');
