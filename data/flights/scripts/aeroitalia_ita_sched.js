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
  async function call(method, path, body, fn) {
    const t=new Date().toISOString();
    const res = await page.evaluate(async ({u, method, body, auth, subkey}) => { try { const r = await fetch(u, {method, headers:{'accept':'*/*','content-type':'application/json','authorization':auth,'ocp-apim-subscription-key':subkey}, body: body?JSON.stringify(body):undefined}); return {status:r.status, body: await r.text()}; } catch(e) { return {status:'ERR', body:String(e)}; } }, {u: base+path, method, body, auth, subkey});
    fs.writeFileSync(fn, res.body); log.push({url:base+path, method, post:body, file:fn, status:res.status, fetched_at:t});
    let summary=''; try { const j=JSON.parse(res.body); if (j.data && Array.isArray(j.data)) summary = j.data.length+' entries; first='+JSON.stringify(j.data[0]).slice(0,120)+' last='+JSON.stringify(j.data[j.data.length-1]).slice(0,120); } catch(e){}
    console.log(res.status, method, path.slice(0,60), res.body.length, summary || res.body.slice(0,150));
    await page.waitForTimeout(1200); return res;
  }
  for (const [o,d] of [['REG','FCO'],['FCO','REG'],['CTA','FCO'],['FCO','CTA']]) {
    await call('GET',`api/nsk/v1/trip/schedule?Origin=${o}&Destination=${d}&BeginDate=2026-09-25&EndDate=2026-12-03T23:59:59.000Z`,null,`${RAW}/aeroitalia_gw_schedule_${o}_${d}.json`);
    for (const cc of ['AZ']) {
      await call('POST','api/nsk/v2/trip/info',{beginDate:'2026-11-01',endDate:'2026-12-03T23:59:59.000Z',carrierCode:cc,originStations:[o],destinationStations:[d],numberOfJourneys:100},`${RAW}/aeroitalia_gw_tripinfo_${cc}_${o}_${d}_2026-11.json`);
    }
  }
  fs.writeFileSync(`${RAW}/aeroitalia_gw_schedule_log.json`, JSON.stringify(log,null,1));
  await browser.close();
})();
