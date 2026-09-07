const { launch } = require('./browser.js'); const fs = require('fs');
const RAW='data/flights/raw';
(async () => {
  const { browser, ctx } = await launch();
  const page = await ctx.newPage();
  let api=null;
  page.on('response', r => { const m=r.url().match(/^(https:\/\/be\.wizzair\.com\/[\d.]+\/Api)\//); if (m) api=m[1]; });
  await page.goto('https://www.wizzair.com/it-it/booking/select-flight/CTA/FCO/2026-10-02/2026-10-04/1/0/0/null', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);
  console.log('API', api);
  const log=[];
  async function call(method, path, body, fn) {
    const t=new Date().toISOString();
    const res = await page.evaluate(async ({u, method, body}) => { const tok=(document.cookie.match(/RequestVerificationToken=([^;]+)/)||[])[1]; try { const r = await fetch(u, {method, credentials:'include', headers:{'accept':'application/json, text/plain, */*','content-type':'application/json','x-requestverificationtoken': tok||''}, body: body?JSON.stringify(body):undefined}); return {status:r.status, body: await r.text()}; } catch(e) { return {status:'ERR', body:String(e)}; } }, {u: api+path, method, body});
    fs.writeFileSync(fn, res.body); log.push({url:api+path, method, post:body, file:fn, status:res.status, fetched_at:t}); console.log(res.status, fn, res.body.length, res.status!==200?res.body.slice(0,120).replace(/\s+/g,' '):'');
    await page.waitForTimeout(1000); return res;
  }
  await call('GET','/asset/map?languageCode=it-it&withConnections=true',null,`${RAW}/wizzair_map.json`);
  // timetable attempt
  await call('POST','/search/timetable',{flightList:[{departureStation:'CTA',arrivalStation:'FCO',from:'2026-09-25',to:'2026-10-31'},{departureStation:'FCO',arrivalStation:'CTA',from:'2026-09-27',to:'2026-11-02'}],priceType:'regular',adultCount:1,childCount:0,infantCount:0},`${RAW}/wizzair_timetable_try1.json`);
  // farechart sliding windows (dayInterval 9 => date-9..date+9)
  const centers=['2026-10-04','2026-10-22','2026-11-09','2026-11-27'];
  for (const c of centers) {
    const c2=new Date(c); c2.setDate(c2.getDate()+2); const cin=c2.toISOString().slice(0,10);
    await call('POST','/asset/farechart',{isRescueFare:false,adultCount:1,childCount:0,dayInterval:9,wdc:false,isFlightChange:false,flightList:[{departureStation:'CTA',arrivalStation:'FCO',date:c+'T00:00:00'},{departureStation:'FCO',arrivalStation:'CTA',date:cin+'T00:00:00'}]},`${RAW}/wizzair_farechart_CTA_FCO_${c}.json`);
  }
  // try bigger interval
  await call('POST','/asset/farechart',{isRescueFare:false,adultCount:1,childCount:0,dayInterval:40,wdc:false,isFlightChange:false,flightList:[{departureStation:'CTA',arrivalStation:'FCO',date:'2026-10-30T00:00:00'},{departureStation:'FCO',arrivalStation:'CTA',date:'2026-11-01T00:00:00'}]},`${RAW}/wizzair_farechart_CTA_FCO_wide.json`);
  // search/search retry in-page
  await call('POST','/search/search',{isFlightChange:false,flightList:[{departureStation:'CTA',arrivalStation:'FCO',departureDate:'2026-10-02T00:00:00'},{departureStation:'FCO',arrivalStation:'CTA',departureDate:'2026-10-04T00:00:00'}],adultCount:1,childCount:0,infantCount:0,wdc:false},`${RAW}/wizzair_search_try1.json`);
  fs.writeFileSync(`${RAW}/wizzair_fetch_log.json`, JSON.stringify(log,null,1));
  await browser.close();
})();
