// Fetch a Booking.com property page for given dates and print room/price rows found in the server-rendered HTML.
// Usage: node fetch_hotel.js <pageName> <checkin> <checkout> <adults> <out.html.gz>
const { chromium } = require('playwright'); const fs = require('fs'); const zlib = require('zlib');
const { sleep } = require('./booking_lib');
(async () => {
  const [pageName, checkin, checkout, adults, out] = process.argv.slice(2);
  const url = `https://www.booking.com/hotel/it/${pageName}.it.html?checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=1&group_children=0&selected_currency=EUR`;
  const browser = await chromium.launch({ headless: true, channel: 'chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--lang=it-IT', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1366, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
  await ctx.route('**/*', async route => { const u = route.request().url(); if (/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|mp4|ico)(\?|$)/i.test(u) || /doubleclick|google-analytics|googletagmanager|facebook|criteo|hotjar|adsrvr|demdex/.test(u)) return route.abort(); try { const r = await route.fetch(); await route.fulfill({ response: r }); } catch (e) { await route.abort(); } });
  const page = await ctx.newPage();
  const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#hprt-table, [data-testid="rt-table"], .hprt-table, h2.pp-header__title', { timeout: 60000 }).catch(() => {});
  await sleep(1500);
  const html = await page.content(); fs.writeFileSync(out, zlib.gzipSync(html));
  console.log('status', r.status(), 'title', JSON.stringify(await page.title()), 'url', page.url().slice(0, 100));
  const rows = await page.$$eval('#hprt-table tbody tr, .hprt-table tbody tr', trs => trs.map(tr => {
    const name = tr.querySelector('.hprt-roomtype-icon-link, .hprt-roomtype-link, [data-room-name]');
    const occ = tr.querySelector('.hprt-occupancy-occupancy-info, .c-occupancy-icons');
    const price = tr.querySelector('.prco-valign-middle-helper, .bui-price-display__value, [data-testid="price-and-discounted-price"]');
    const cond = tr.querySelector('.hprt-conditions, .hprt-block');
    return { room: name ? name.innerText.trim() : null, occupancy: occ ? occ.innerText.replace(/\s+/g, ' ').trim() : null, price_text: price ? price.innerText.replace(/\s+/g, ' ').trim() : null, text: tr.innerText.replace(/\s+/g, ' ').trim().slice(0, 500) };
  }).filter(r => r.text));
  let current = null; const parsed = [];
  for (const r of rows) { if (r.room) current = r.room; const m = r.text.match(/Prezzo attuale\s*€\s?([\d.]+)|Prezzo:?\s*€\s?([\d.]+)|€\s?([\d.]+)\s*(?:\d+ nott|Prezzo)/); parsed.push({ room: current, occupancy: r.occupancy, price_text: r.price_text, total_eur: m ? +(m[1] || m[2] || m[3]).replace('.', '') : null, free_cancellation: /Cancellazione gratuita/.test(r.text), breakfast: /[Cc]olazione (?:inclusa|compresa|ottima|buona|eccellente)/.test(r.text) && !/Colazione .* per €/.test(r.text), non_refundable: /Non rimborsabile/.test(r.text), text: r.text }); }
  fs.writeFileSync(out.replace(/\.html\.gz$/, '') + '.json', JSON.stringify({ pageName, checkin, checkout, adults: +adults, url, status: r.status(), title: await page.title(), fetched_at: new Date().toISOString(), rows: parsed }, null, 1));
  console.log(parsed.map(p => `${p.room} | ${p.occupancy} | ${p.total_eur} | ${p.free_cancellation ? 'FC' : ''} ${p.non_refundable ? 'NR' : ''} | ${p.text.slice(0, 120)}`).join('\n'));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
