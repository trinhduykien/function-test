const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1680, height: 950 } });
  const page = await ctx.newPage();
  await page.goto('https://uat-capdon.pjico.com.vn/Home/Index', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 20000 });
  // menu structure: find links containing ContractCar
  await page.waitForTimeout(2000);
  const links = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a[href*="ContractCar"]').forEach(a => out.push({ href: a.getAttribute('href'), text: (a.innerText||'').trim().slice(0,50), visible: !!(a.offsetParent || a.getClientRects().length) }));
    return out.slice(0, 10);
  });
  console.log('ContractCar links:', JSON.stringify(links, null, 1));
  // how is the menu structured? top-level items
  const topMenu = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.name-menu--item, .dropdown-toggle')).slice(0, 12).map(e => ({ tag: e.tagName, cls: (e.className||'').slice(0,60), text: (e.innerText||'').trim().slice(0,40) }));
  });
  console.log('topMenu:', JSON.stringify(topMenu, null, 1));
  // check full href list in DOM mentioning Search
  const allHrefs = await page.evaluate(() => {
    const s = new Set();
    document.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href')||''; if (/Search|Contract|Don/i.test(h)) s.add(h); });
    return [...s].slice(0, 30);
  });
  console.log('searchy hrefs:', JSON.stringify(allHrefs, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
