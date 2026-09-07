const { chromium } = require('playwright');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
async function launch(extra={}) {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--ssl-version-max=tls1.2','--disable-blink-features=AutomationControlled','--lang=it-IT'], ...extra });
  const ctx = await browser.newContext({ userAgent: UA, locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: {width:1366,height:900}, extraHTTPHeaders: {'Accept-Language':'it-IT,it;q=0.9,en;q=0.8'} });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', {get: () => undefined}); window.chrome = window.chrome || { runtime: {} }; Object.defineProperty(navigator,'languages',{get:()=>['it-IT','it','en']}); Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3]}); });
  return { browser, ctx };
}
module.exports = { launch, UA };
