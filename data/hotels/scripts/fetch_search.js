// One-off: fetch a Booking searchresults URL (or several) and print the parsed cards. Usage: node fetch_search.js <outprefix> <url1> [url2...]
const { chromium } = require('playwright'); const fs = require('fs'); const zlib = require('zlib');
const { parseApollo, sleep } = require('./booking_lib');
(async () => {
  const [outprefix, ...urls] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: true, channel: 'chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--lang=it-IT', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1366, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
  await ctx.route('**/*', async route => { const u = route.request().url(); if (/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|mp4|ico)(\?|$)/i.test(u) || /doubleclick|google-analytics|googletagmanager|facebook|criteo|hotjar|adsrvr|demdex/.test(u)) return route.abort(); try { const r = await route.fetch(); await route.fulfill({ response: r }); } catch (e) { await route.abort(); } });
  const page = await ctx.newPage(); let i = 0;
  for (const url of urls) {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-testid="property-card"], h1', { timeout: 60000 }).catch(() => {}); await sleep(800);
    const html = await page.content(); fs.writeFileSync(`${outprefix}_${i++}.html.gz`, zlib.gzipSync(html));
    const p = parseApollo(html);
    console.log('URL', url.slice(url.indexOf('nflt')), 'status', r.status(), 'total', p && p.nbResultsTotal, 'filters', p && JSON.stringify(p.input.filters));
    if (p) for (const c of p.results) console.log('  ', String(c.total_eur).padStart(7), (c.distance_km + 'km').padEnd(7), c.type.slice(0, 6).padEnd(6), c.is_dorm ? 'DORM' : '    ', c.name.slice(0, 34).padEnd(35), c.room.slice(0, 34));
    await sleep(1500);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
