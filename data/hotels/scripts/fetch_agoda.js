// Fetch an Agoda property page (by slug, e.g. "tiburtina-inn-guest-house", or by numeric hid) for given dates; save HTML and print/record prices.
// Usage: node fetch_agoda.js <slug-or-hid> <checkin> <checkout> <adults> <outprefix>
const { chromium } = require('playwright'); const fs = require('fs'); const zlib = require('zlib');
const { sleep } = require('./booking_lib');
(async () => {
  const [key, checkin, checkout, adults, outprefix] = process.argv.slice(2);
  const los = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  let url;
  if (/^\d+$/.test(key)) { const [y, m, d] = checkin.split('-'), [y2, m2, d2] = checkout.split('-'); url = `https://www.agoda.com/it-it/partners/partnersearch.aspx?hid=${key}&CkInDay=${d}&CkInMonth=${m}&CkInYear=${y}&CkOutDay=${d2}&CkOutMonth=${m2}&CkOutYear=${y2}&NumberOfAdults=${adults}&NumberOfChildren=0&NumberOfRooms=1&los=${los}&currency=EUR&PartnerCurrency=EUR`; }
  else url = `https://www.agoda.com/it-it/${key}/hotel/rome-it.html?checkIn=${checkin}&checkOut=${checkout}&los=${los}&adults=${adults}&rooms=1&children=0&currency=EUR&travellerType=0`;
  const browser = await chromium.launch({ headless: true, channel: 'chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--lang=it-IT', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1366, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
  await ctx.route('**/*', async route => { const u = route.request().url(); if (/\.(png|jpg|jpeg|gif|webp|woff2?|ttf|mp4|ico)(\?|$)/i.test(u) || /doubleclick|google-analytics|googletagmanager|facebook|criteo|hotjar/.test(u)) return route.abort(); try { const r = await route.fetch(); await route.fulfill({ response: r }); } catch (e) { await route.abort(); } });
  const page = await ctx.newPage();
  const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {}); await sleep(4000);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 1200); await sleep(600); }
  await page.waitForFunction(() => /Prezzo per notte|per notte|Prezzo totale|a notte/i.test(document.body.innerText) && /Scegli|Prenota ora|Seleziona/.test(document.body.innerText), { timeout: 25000 }).catch(() => {});
  await page.waitForSelector('[data-selenium="MasterRoom"], [data-element-name="room-grid-master-room"], [data-selenium="room-grid"], [data-element-name="soldout-message"]', { timeout: 30000 }).catch(() => {}); await sleep(1500);
  const html = await page.content(); fs.writeFileSync(`${outprefix}_agoda.html.gz`, zlib.gzipSync(html));
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const rooms = await page.$$eval('[data-selenium="MasterRoom"], [data-element-name="room-grid-master-room"], [data-selenium="MasterRoom-wrapper"], .MasterRoom', els => els.slice(0, 8).map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 500)));
  const track = html.match(/"checkin_date":"([^"]+)".*?"num_adults":(\d+),"currency":"(\w+)".*?"price":([\d.]+)/);
  const hotelName = await page.$eval('[data-selenium="hotel-header-name"], h1', e => e.innerText.trim()).catch(() => null);
  const roomSection = (() => { const i = text.search(/Camere disponibili|Seleziona la tua camera|Le camere|Scegli la tua camera|Tipo di camera/i); return i >= 0 ? text.slice(i, i + 2500) : text.slice(text.indexOf('a partire da'), text.indexOf('a partire da') + 300); })();
  const fromPrice = (text.match(/a partire da\s*([\d.,]+)\s?€/) || [])[1] || null;
  const res = { key, from_price_per_night_eur: fromPrice, room_section: roomSection, checkin, checkout, adults: +adults, url, status: r.status(), final_url: page.url(), hotel_name: hotelName, title: await page.title(),
    tracking: track ? { checkin: track[1], adults: +track[2], currency: track[3], price_total_ex_tax: +track[4] } : null,
    room_texts: rooms, euro_mentions: (text.match(/[\d.,]+\s?€|€\s?[\d.,]+/g) || []).slice(0, 40), fetched_at: new Date().toISOString() };
  fs.writeFileSync(`${outprefix}_agoda.json`, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ hotel_name: hotelName, from_price: fromPrice, status: r.status(), final_url: res.final_url.slice(0, 120), tracking: res.tracking, rooms: rooms.slice(0, 3), euros: res.euro_mentions.slice(0, 20), room_section: roomSection.slice(0, 1200) }, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
