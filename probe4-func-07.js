const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1680, height: 950 } });
  const page = await ctx.newPage();
  await page.goto('https://uat-capdon.pjico.com.vn/CategorySystem/Unit', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const at = async (ms) => {
    await page.waitForTimeout(ms);
    const r = await page.evaluate(() => ({
      tables: document.querySelectorAll('table').length,
      rows: Array.from(document.querySelectorAll('table')).map(t => t.querySelectorAll('tbody tr').length),
      noData: (document.body.innerText || '').includes('Không có dữ liệu'),
    }));
    console.log(`t+${ms}:`, JSON.stringify(r));
  };
  await at(0); await at(1000); await at(2000);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
