const { launch } = require('./browser.js'); const fs = require('fs');
const RAW='data/flights/raw';
(async () => {
  const { browser, ctx } = await launch();
  const page = await ctx.newPage();
  let api=null;
  page.on('response', r => { const m=r.url().match(/^(https:\/\/be\.wizzair\.com\/[\d.]+\/Api)\//); if (m) api=m[1]; });
  await page.goto('https://www.wizzair.com/it-it/booking/select-flight/CTA/FCO/2026-12-20/2026-12-22/1/0/0/null', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);
  const log=[];
  async function call(method, path, body, fn) {
    const t=new Date().toISOString();
    const res = await page.evaluate(async ({u, method, body}) => { const tok=(document.cookie.match(/RequestVerificationToken=([^;]+)/)||[])[1]; try { const r = await fetch(u, {method, credentials:'include', headers:{'accept':'application/json, text/plain, */*','content-type':'application/json','x-requestverificationtoken': tok||''}, body: body?JSON.stringify(body):undefined}); return {status:r.status, body: await r.text()}; } catch(e) { return {status:'ERR', body:String(e)}; } }, {u: api+path, method, body});
    fs.writeFileSync(fn, res.body); log.push({url:api+path, method, post:body, file:fn, status:res.status, fetched_at:t}); console.log(res.status, fn, res.body.length, res.body.slice(0,300).replace(/\s+/g,' '));
    await page.waitForTimeout(1000); return res;
  }
  await call('POST','/asset/farechart',{isRescueFare:false,adultCount:1,childCount:0,dayInterval:9,wdc:false,isFlightChange:false,flightList:[{departureStation:'CTA',arrivalStation:'FCO',date:'2026-12-20T00:00:00'},{departureStation:'FCO',arrivalStation:'CTA',date:'2026-12-22T00:00:00'}]},`${RAW}/wizzair_farechart_CTA_FCO_2026-12-20_validation.json`);
  await call('POST','/search/timetable',{flightList:[{departureStation:'CTA',arrivalStation:'FCO',from:'2026-12-01',to:'2026-12-31'},{departureStation:'FCO',arrivalStation:'CTA',from:'2026-12-01',to:'2026-12-31'}],priceType:'regular',adultCount:1,childCount:0,infantCount:0},`${RAW}/wizzair_timetable_CTA_FCO_2026-12_validation.json`);
  await call('POST','/search/timetable',{flightList:[{departureStation:'CTA',arrivalStation:'BUD',from:'2026-10-01',to:'2026-10-31'},{departureStation:'BUD',arrivalStation:'CTA',from:'2026-10-01',to:'2026-10-31'}],priceType:'regular',adultCount:1,childCount:0,infantCount:0},`${RAW}/wizzair_timetable_CTA_BUD_2026-10_control.json`);
  fs.appendFileSync(`${RAW}/wizzair_fetch_log.json`, '\n'+JSON.stringify(log,null,1));
  await browser.close();
})();
