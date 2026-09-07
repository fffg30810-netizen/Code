const { launch } = require('./browser.js'); const fs = require('fs');
const RAW='data/flights/raw';
(async () => {
  const { browser, ctx } = await launch();
  const page = await ctx.newPage();
  let auth=null, subkey=null;
  page.on('request', r => { const h=r.headers(); if (r.url().includes('dotrezprod') && h['authorization']) { auth=h['authorization']; subkey=h['ocp-apim-subscription-key']; } });
  await page.goto('https://www.aeroitalia.com/it', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  try { await page.locator('button:has-text("Accetta tutti")').first().click({timeout:3000}); } catch(e){}
  await page.waitForTimeout(2000);
  const from = page.locator('input[placeholder="Seleziona la partenza"]:visible').first();
  await from.click({timeout:10000}); await page.waitForTimeout(600); await page.keyboard.type('Catania',{delay:70}); await page.waitForTimeout(2500);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  const to = page.locator('input[placeholder="Seleziona la destinazione"]:visible').first();
  await to.click({timeout:10000}); await page.waitForTimeout(600); await page.keyboard.type('Roma',{delay:70}); await page.waitForTimeout(2500);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(5000);
  if (!auth) { console.log('NO AUTH'); await browser.close(); return; }
  const base='https://aeroitalia-gateway.azure-api.net/dotrezprod/';
  const log=[];
  async function call(path, body) {
    const t=new Date().toISOString();
    const res = await page.evaluate(async ({u, body, auth, subkey}) => { try { const r = await fetch(u, {method:'POST', headers:{'accept':'*/*','content-type':'application/json','authorization':auth,'ocp-apim-subscription-key':subkey}, body: JSON.stringify(body)}); return {status:r.status, body: await r.text()}; } catch(e) { return {status:'ERR', body:String(e)}; } }, {u: base+path, body, auth, subkey});
    return {...res, fetched_at:t, url:base+path};
  }
  const pax={types:[{type:'ADT',count:1}]};
  const pairs=(process.argv[2]||'CTA-FCO,FCO-CTA').split(',');
  const span=parseInt(process.argv[3]||'7');
  for (const pr of pairs) { const [o,d]=pr.split('-');
    for (let day=new Date('2026-09-25'); day<=new Date('2026-12-03'); day.setDate(day.getDate()+span)) {
      const b=day.toISOString().slice(0,10); const e=new Date(day); e.setDate(e.getDate()+span-1); let es=e.toISOString().slice(0,10); if (es>'2026-12-03') es='2026-12-03';
      const body={origin:o,destination:d,beginDate:b,endDate:es,passengers:pax,currencyCode:'EUR'};
      const res=await call('api/nsk/v4/availability/search/simple', body);
      const fn=`${RAW}/aeroitalia_avail_${o}_${d}_${b}.json`; fs.writeFileSync(fn, res.body);
      let nd='?', nj='?'; try { const j=JSON.parse(res.body); const trips=j.data.results[0].trips; nd=trips.length; nj=trips.reduce((a,t)=>a+Object.values(t.journeysAvailableByMarket||{}).reduce((x,y)=>x+y.length,0),0); } catch(err){}
      log.push({url:res.url, post:body, file:fn, status:res.status, fetched_at:res.fetched_at, days:nd, journeys:nj});
      console.log(res.status, fn, 'days', nd, 'journeys', nj, res.status!==200?res.body.slice(0,200):'');
      await page.waitForTimeout(1200);
    }
  }
  fs.writeFileSync(`${RAW}/aeroitalia_fetch_log.json`, JSON.stringify(log,null,1));
  await browser.close();
})();
