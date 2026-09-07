// Fetch an Agoda property page by hotel id for given dates and print price-related text. Usage: node fetch_agoda.js <hid> <checkin> <checkout> <adults> <out.html.gz>
const { chromium } = require('playwright'); const fs = require('fs'); const zlib = require('zlib');
const { sleep } = require('./booking_lib');
(async () => {
  const [hid, checkin, checkout, adults, out] = process.argv.slice(2);
  const [y, m, d] = checkin.split('-'), [y2, m2, d2] = checkout.split('-');
  const los = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  const url = `https://www.agoda.com/it-it/partners/partnersearch.aspx?hid=${hid}&CkInDay=${d}&CkInMonth=${m}&CkInYear=${y}&CkOutDay=${d2}&CkOutMonth=${m2}&CkOutYear=${y2}&NumberOfAdults=${adults}&NumberOfChildren=0&NumberOfRooms=1&los=${los}&currency=EUR&PartnerCurrency=EUR`;
  const browser = await chromium.launch({ headless: true, channel: 'chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--lang=it-IT', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1366, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
  await ctx.route('**/*', async route => { const u = route.request().url(); if (/\.(png|jpg|jpeg|gif|webp|woff2?|ttf|mp4|ico)(\?|$)/i.test(u) || /doubleclick|google-analytics|googletagmanager|facebook|criteo|hotjar/.test(u)) return route.abort(); try { const r = await route.fetch(); await route.fulfill({ response: r }); } catch (e) { await route.abort(); } });
  const page = await ctx.newPage();
  const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('[data-element-name="final-price"], [data-selenium="hotel-header-name"], h1', { timeout: 45000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await sleep(4000);
  const html = await page.content(); fs.writeFileSync(out, zlib.gzipSync(html));
  console.log('status', r.status(), 'title', JSON.stringify(await page.title()), 'url', page.url().slice(0, 160));
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const rooms = await page.$$eval('[data-selenium="MasterRoom"], [data-element-name="room-grid-master-room"], .MasterRoom', els => els.slice(0, 6).map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 400)));
  console.log('ROOMS', JSON.stringify(rooms, null, 1));
  const i = text.indexOf('SPQR'); console.log('HAS_NAME', i, 'TEXT', text.slice(Math.max(0, i - 200), i + 1500)); console.log('EUROS', (text.match(/€\s?[\d.,]+/g) || []).slice(0, 30).join(' '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
