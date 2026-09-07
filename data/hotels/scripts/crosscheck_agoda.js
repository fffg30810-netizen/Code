// Cross-check one property/date on Agoda: Google Hotels (plain fetch) -> Agoda hotel id (hid) from the partner deep link -> Agoda property page with the requested dates.
// Usage: node crosscheck_agoda.js "<property name>" <checkin> <checkout> <adults> <outprefix>
const { chromium, request } = require('playwright'); const fs = require('fs'); const zlib = require('zlib');
const { sleep } = require('./booking_lib');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
(async () => {
  const [name, checkin, checkout, adults, outprefix] = process.argv.slice(2);
  const rc = await request.newContext({ proxy: { server: process.env.HTTPS_PROXY }, extraHTTPHeaders: { 'User-Agent': UA, 'Accept-Language': 'it-IT,it;q=0.9' } });
  const gurl = `https://www.google.com/travel/search?q=${encodeURIComponent(name + ' Roma')}&hl=it&gl=it&curr=EUR`;
  const g = await rc.get(gurl, { timeout: 60000 }); const gh = await g.text();
  fs.writeFileSync(`${outprefix}_google.html.gz`, zlib.gzipSync(gh));
  const title = (gh.match(/<title>([^<]*)/) || [])[1];
  const hidm = gh.match(/agoda\.com[^"]*?hid(?:%3D|=)(\d+)/);
  const gname = (() => { const m = gh.match(/Torna all&#39;elenco di tutti i risultati|Torna all'elenco/); return !!m; })();
  const out = { name, checkin, checkout, adults: +adults, google_url: gurl, google_status: g.status(), google_title: title, agoda_hid: hidm ? hidm[1] : null };
  console.log(JSON.stringify(out));
  if (!hidm) { fs.writeFileSync(`${outprefix}.json`, JSON.stringify({ ...out, error: 'no agoda hid found on google hotels page' }, null, 1)); await rc.dispose(); return; }
  await sleep(1500);
  const [y, m, d] = checkin.split('-'), [y2, m2, d2] = checkout.split('-'); const los = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  const aurl = `https://www.agoda.com/it-it/partners/partnersearch.aspx?hid=${hidm[1]}&CkInDay=${d}&CkInMonth=${m}&CkInYear=${y}&CkOutDay=${d2}&CkOutMonth=${m2}&CkOutYear=${y2}&NumberOfAdults=${adults}&NumberOfChildren=0&NumberOfRooms=1&los=${los}&currency=EUR&PartnerCurrency=EUR`;
  const browser = await chromium.launch({ headless: true, channel: 'chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--lang=it-IT', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1366, height: 900 }, userAgent: UA });
  await ctx.route('**/*', async route => { const u = route.request().url(); if (/\.(png|jpg|jpeg|gif|webp|woff2?|ttf|mp4|ico)(\?|$)/i.test(u) || /doubleclick|google-analytics|googletagmanager|facebook|criteo|hotjar/.test(u)) return route.abort(); try { const r = await route.fetch(); await route.fulfill({ response: r }); } catch (e) { await route.abort(); } });
  const page = await ctx.newPage();
  const r = await page.goto(aurl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await sleep(4000);
  const html = await page.content(); fs.writeFileSync(`${outprefix}_agoda.html.gz`, zlib.gzipSync(html));
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  // first listed property card text (the hid-selected property is listed first)
  const first = await page.$$eval('[data-selenium="hotel-item"], li[data-hotelid], [data-element-name="property-card"]', els => els.slice(0, 2).map(e => ({ hotelid: e.getAttribute('data-hotelid'), text: e.innerText.replace(/\s+/g, ' ').slice(0, 700) })));
  const track = (html.match(/"content_ids":(\d+),"checkin_date":"([^"]+)".*?"num_adults":(\d+),"currency":"(\w+)".*?"price":([\d.]+)/) || []);
  const res = { ...out, agoda_url: aurl, agoda_status: r.status(), agoda_final_url: page.url(), first_cards: first,
    tracking: track.length ? { hid: track[1], checkin: track[2], adults: +track[3], currency: track[4], price_total_ex_tax: +track[5] } : null,
    per_night_text: (text.match(/Per notte, tasse escluse\s*([\d.,]+)\s*€/) || [])[1] || null, fetched_at: new Date().toISOString() };
  fs.writeFileSync(`${outprefix}.json`, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ hid: res.agoda_hid, tracking: res.tracking, per_night_text: res.per_night_text, first: first[0] && first[0].text.slice(0, 300) }));
  await browser.close(); await rc.dispose();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
