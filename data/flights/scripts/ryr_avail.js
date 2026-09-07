const { launch } = require('./browser.js'); const fs = require('fs');
const RAW='data/flights/raw';
(async () => {
  const { browser, ctx } = await launch();
  const page = await ctx.newPage();
  await page.goto('https://www.ryanair.com/it/it/trip/flights/select?adults=1&teens=0&children=0&infants=0&dateOut=2026-10-02&dateIn=2026-10-04&isConnectedFlight=false&discount=0&promoCode=&isReturn=true&originIata=CTA&destinationIata=FCO&tpAdults=1&tpTeens=0&tpChildren=0&tpInfants=0&tpStartDate=2026-10-02&tpEndDate=2026-10-04&tpDiscount=0&tpPromoCode=&tpOriginIata=CTA&tpDestinationIata=FCO', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const log=[];
  const pairs = (process.argv[2]||'CTA-FCO,FCO-CTA,REG-FCO,FCO-REG,CTA-CIA').split(',');
  const dates=[]; for (let d=new Date('2026-09-25'); d<=new Date('2026-12-03'); d.setDate(d.getDate()+7)) dates.push(d.toISOString().slice(0,10));
  for (const pr of pairs) { const [o,dst]=pr.split('-');
    for (const d of dates) {
      const url=`https://www.ryanair.com/api/booking/v4/it-it/availability?ADT=1&TEEN=0&CHD=0&INF=0&Origin=${o}&Destination=${dst}&promoCode=&IncludeConnectingFlights=false&DateOut=${d}&FlexDaysBeforeOut=0&FlexDaysOut=6&RoundTrip=false&ToUs=AGREED`;
      const t=new Date().toISOString();
      const res = await page.evaluate(async (u) => { try { const r = await fetch(u, {credentials:'include', headers:{'accept':'application/json, text/plain, */*','client':'desktop','client-version':'3.213.0'}}); return {status:r.status, body: await r.text()}; } catch(e) { return {status:'ERR', body:String(e)}; } }, url);
      const fn=`${RAW}/ryanair_avail_${o}_${dst}_${d}.json`; fs.writeFileSync(fn, res.body);
      let n='?'; try { const j=JSON.parse(res.body); n=j.trips?.[0]?.dates?.reduce((a,x)=>a+x.flights.length,0); } catch(e){}
      log.push({url, file:fn, status:res.status, fetched_at:t, flights:n}); console.log(res.status, fn, 'flights:', n, res.status!==200?res.body.slice(0,150):'');
      await page.waitForTimeout(900);
    }
  }
  fs.appendFileSync(`${RAW}/ryanair_avail_log.json`, JSON.stringify(log,null,1)+'\n');
  await browser.close();
})();
