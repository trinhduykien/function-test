// PROBE 08g: empty-date blank chart — response keys, restore co thuc su fire POST?, reload recovery
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, storageState: 'd:/bore/13/.auth/uat.json' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 250)));
  page.on('dialog', d => { console.log('DIALOG:', d.type(), d.message().slice(0, 120)); d.dismiss().catch(() => {}); });

  await page.goto(BASE + '/Home/Index', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3500);

  const chartState = () => page.evaluate(() => {
    const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    return c ? { cats: c.xAxis[0].categories, n: c.series[0].data.length } : null;
  });

  // theo doi moi POST GeneratedRevenue: log keys + chart field
  page.on('response', async r => {
    if (r.url().includes('/Dashboard/GeneratedRevenue')) {
      try {
        const j = JSON.parse(await r.text());
        const d = j.data || {};
        const keys = Object.keys(d);
        const chartKeys = keys.filter(k => k !== 'kq_dtth');
        const summary = {};
        for (const k of chartKeys) {
          const v = d[k];
          summary[k] = typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 120);
        }
        console.log('  RESP keys=' + JSON.stringify(keys) + ' code=' + j.code + ' msg=' + JSON.stringify(j.message) + ' other=' + JSON.stringify(summary).slice(0, 400));
      } catch (e) { console.log('  RESP parse err'); }
    }
  });
  const reqLog = [];
  page.on('request', r => { if (r.url().includes('/Dashboard/GeneratedRevenue')) reqLog.push(Date.now()); });

  const apply = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    try { await page.locator('button.btn-back.btn-p-input').click({ timeout: 8000 }); }
    catch (e) { console.log('  (JS click fallback)'); await page.evaluate(() => document.querySelector('button.btn-back.btn-p-input').click()); }
    await page.waitForTimeout(3500);
  };

  console.log('BASE:', JSON.stringify(await chartState()));
  // 1. empty date -> apply
  console.log('== fill "" apply ==');
  await page.locator('#ngay_ht').fill('');
  await apply();
  console.log('after empty apply:', JSON.stringify(await chartState()));
  // 2. restore valid -> apply (co POST?)
  console.log('== fill 04/09/2026 apply ==');
  await page.locator('#ngay_ht').fill('04/09/2026');
  await apply();
  console.log('after restore apply:', JSON.stringify(await chartState()));
  // 3. lan 3: doi ngay khac 01/08/2026
  console.log('== fill 01/08/2026 apply ==');
  await page.locator('#ngay_ht').fill('01/08/2026');
  await apply();
  console.log('after 01/08 apply:', JSON.stringify(await chartState()));
  // 4. reload
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3500);
  console.log('after RELOAD:', JSON.stringify(await chartState()));
  console.log('total GeneratedRevenue POSTs observed (excl. load):', reqLog.length);
  console.log('ERRORS:', JSON.stringify(errors));
  await browser.close();
})();