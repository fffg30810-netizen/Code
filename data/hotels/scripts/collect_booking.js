// Booking.com collector: headless Chromium (Playwright) with all network routed through Node (agent proxy).
// Usage: node collect_booking.js --from 2026-09-25 --to 2026-11-30 --nights 2 --adults 1 --out data/hotels [--dates d1,d2] [--tag x]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null).filter(Boolean));
const NIGHTS = +args.nights || 2, ADULTS = +args.adults || 1, OUT = args.out || 'data/hotels';
const MAXKM = 1.5, WANT = 8;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { TYPES, addDays, buildUrlBase, parseKm, parseApollo } = require('./booking_lib');
function dates() { if (args.dates) return args.dates.split(','); const out = []; for (let d = args.from; d <= args.to; d = addDays(d, 1)) out.push(d); return out; }
const buildUrl = (ci, co, nflt) => buildUrlBase(ci, co, ADULTS, nflt);
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--lang=it-IT', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1366, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|mp4|ico)(\?|$)/i.test(u) || /doubleclick|google-analytics|googletagmanager|facebook|criteo|bing\.com|hotjar|adsrvr|demdex/.test(u)) return route.abort();
    try { const r = await route.fetch(); await route.fulfill({ response: r }); } catch (e) { await route.abort(); }
  });
  const page = await ctx.newPage();
  const log = m => { const line = `${new Date().toISOString()} ${m}`; console.log(line); fs.appendFileSync(path.join(OUT, `collect_${NIGHTS}n_${ADULTS}a${args.tag ? '_' + args.tag : ''}.log`), line + '\n'); };
  async function fetchQuery(checkin, checkout, nflt, qtag) {
    const url = buildUrl(checkin, checkout, nflt);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForSelector('[data-testid="property-card"], [data-testid="zero-results"], h1', { timeout: 60000 }).catch(() => {});
        await sleep(800);
        const html = await page.content();
        const parsed = parseApollo(html);
        const fetched_at = new Date().toISOString();
        const base = `booking_${checkin}_${NIGHTS}n_${ADULTS}a_${qtag}`;
        fs.writeFileSync(path.join(OUT, 'raw', base + '.html.gz'), zlib.gzipSync(html));
        if (!parsed) { log(`WARN ${base} no apollo data (status ${resp && resp.status()}, title ${JSON.stringify(await page.title())}) attempt ${attempt}`); if (attempt < 3) { await sleep(5000 * attempt); continue; } return { url, fetched_at, status: resp && resp.status(), error: 'no-apollo', results: [] }; }
        return { url, fetched_at, status: resp && resp.status(), nflt, qtag, nbResultsTotal: parsed.nbResultsTotal, input_filters: parsed.input.filters, results: parsed.results };
      } catch (e) { log(`ERR ${checkin} ${qtag} attempt ${attempt}: ${e.message.split('\n')[0]}`); await sleep(5000 * attempt); }
    }
    return { url, fetched_at: new Date().toISOString(), error: 'failed', results: [] };
  }
  const TYPES_NFLT = 'ht_id=204;ht_id=208;ht_id=216';
  for (const checkin of dates()) {
    const checkout = addDays(checkin, NIGHTS);
    const outFile = path.join(OUT, 'parsed', `booking_${checkin}_${NIGHTS}n_${ADULTS}a.json`);
    if (fs.existsSync(outFile) && !args.force) { log(`skip ${checkin} (exists)`); continue; }
    const t0 = Date.now(); const queries = [];
    queries.push(await fetchQuery(checkin, checkout, `distance=1000;${TYPES_NFLT}`, 'q1_1km')); await sleep(1500);
    queries.push(await fetchQuery(checkin, checkout, `distance=3000;${TYPES_NFLT}`, 'q2_3km')); await sleep(1500);
    const cand = () => { const seen = new Map(); for (const q of queries) for (const r of q.results) if (r.distance_km != null && r.distance_km <= MAXKM && !r.is_dorm && r.total_eur) { if (!seen.has(r.property_id) || seen.get(r.property_id).total_eur > r.total_eur) seen.set(r.property_id, r); } return [...seen.values()].sort((a, b) => a.total_eur - b.total_eur); };
    // price-band continuation on the 3 km query while the 8th candidate might be undercut by unseen 1-1.5 km properties
    let last = queries[1]; let bands = 0;
    while (bands < 3 && last.results.length >= 25) {
      const c = cand(); const maxSeenNight = Math.max(...last.results.map(r => r.per_night_eur || 0));
      if (c.length >= WANT && c[WANT - 1].total_eur <= maxSeenNight * NIGHTS) break;
      const from = Math.floor(maxSeenNight);
      last = await fetchQuery(checkin, checkout, `distance=3000;${TYPES_NFLT};price=EUR-${from}-max-1`, `q3_3km_band${++bands}_${from}`); queries.push(last); await sleep(1500);
    }
    // hostels (all within 3 km): Booking shows each hostel's cheapest unit (usually a dorm bed); dorm rows are kept in raw/parsed data but excluded from candidates
    queries.push(await fetchQuery(checkin, checkout, `distance=3000;ht_id=203`, 'q4_hostels')); await sleep(1500);
    const c = cand();
    fs.writeFileSync(outFile, JSON.stringify({ checkin, checkout, nights: NIGHTS, adults: ADULTS, queries, candidates: c }, null, 1));
    log(`${checkin} done in ${Math.round((Date.now() - t0) / 1000)}s: ${queries.length} queries, ${c.length} candidates <=${MAXKM}km, cheapest ${c[0] ? c[0].total_eur + ' ' + c[0].name : 'none'}`);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
