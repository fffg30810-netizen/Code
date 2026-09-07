// Fetch a Google Hotels property search (JS-rendered) and print the offers block. Usage: node fetch_google_hotels.js "<query>" <checkin> <checkout> <adults> <out.html.gz>
const { chromium } = require('playwright'); const fs = require('fs'); const zlib = require('zlib');
const { sleep } = require('./booking_lib');
(async () => {
  const [q, checkin, checkout, adults, out] = process.argv.slice(2);
  const url = `https://www.google.com/travel/search?q=${encodeURIComponent(q)}&hl=it&gl=it&curr=EUR&checkin=${checkin}&checkout=${checkout}&adults=${adults}`;
  const browser = await chromium.launch({ headless: true, channel: 'chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--lang=it-IT', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1366, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
  await ctx.route('**/*', async route => { const u = route.request().url(); if (/\.(png|jpg|jpeg|gif|webp|woff2?|ttf|mp4|ico)(\?|$)/i.test(u) || /doubleclick|google-analytics|googletagmanager/.test(u)) return route.abort(); try { const r = await route.fetch(); await route.fulfill({ response: r }); } catch (e) { await route.abort(); } });
  const page = await ctx.newPage();
  const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  // consent page?
  const consent = await page.$('button:has-text("Accetta tutto"), button:has-text("Rifiuta tutto"), form[action*="consent"] button');
  if (consent) { console.log('consent page, clicking'); await consent.click().catch(() => {}); await page.waitForLoadState('domcontentloaded').catch(() => {}); await sleep(3000); }
  await sleep(6000);
  const html = await page.content(); fs.writeFileSync(out, zlib.gzipSync(html));
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  console.log('status', r.status(), 'url', page.url().slice(0, 140));
  const i = text.indexOf('Prenota una camera'); const j = text.indexOf('Check-in');
  console.log(text.slice(Math.max(0, (i > 0 ? i : j) - 700), (i > 0 ? i : j) + 1500));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
