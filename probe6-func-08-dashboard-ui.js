// PROBE 08f: invalid date — request/response co luc, tung case ri voi restore giua cac case
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, storageState: 'd:/bore/13/.auth/uat.json' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 250)));

  await page.goto(BASE + '/Home/Index', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3500);

  const chartState = () => page.evaluate(() => {
    const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    return c ? { cats: c.xAxis[0].categories, n: c.series[0].data.length, v0: c.series[0].data.length ? c.series[0].data[0].y : null } : null;
  });
  const apply = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    try { await page.locator('button.btn-back.btn-p-input').click({ timeout: 8000 }); }
    catch (e) { await page.evaluate(() => document.querySelector('button.btn-back.btn-p-input').click()); }
    await page.waitForTimeout(3500);
  };

  const runCase = async (label, dateVal) => {
    const reqs = [];
    const handler = r => { if (r.url().includes('/Dashboard/GeneratedRevenue')) reqs.push(r.method()); };
    let respBody = null;
    const respHandler = async r => {
      if (r.url().includes('/Dashboard/GeneratedRevenue')) { try { respBody = (await r.text()).slice(0, 300); } catch (e) {} }
    };
    page.on('request', handler);
    page.on('response', respHandler);
    await page.locator('#ngay_ht').fill(dateVal);
    await apply();
    page.removeListener('request', handler);
    page.removeListener('response', respHandler);
    const st = await chartState();
    console.log('CASE ' + label + ' (fill="' + dateVal + '"): reqs=' + JSON.stringify(reqs) + ' chart=' + JSON.stringify(st));
    console.log('  resp: ' + respBody);
    // restore ve ngay mac dinh
    await page.locator('#ngay_ht').fill('04/09/2026');
    await apply();
    const st2 = await chartState();
    console.log('  restore: ' + JSON.stringify(st2));
  };

  console.log('BASE:', JSON.stringify(await chartState()));
  await runCase('invalid-32/13', '32/13/2026');
  await runCase('text-abc', 'abc');
  await runCase('empty', '');
  await runCase('special', '"><&!@#$%');
  await runCase('valid-01/08', '01/08/2026');
  await runCase('valid-01/09/2025', '01/09/2025');

  console.log('ERRORS:', JSON.stringify(errors));
  await browser.close();
})();