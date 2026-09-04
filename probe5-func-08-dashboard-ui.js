// PROBE 08e: recovery sau invalid date, DGT option text, tooltip sau apply ALL thang
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
    return c ? { cats: c.xAxis[0].categories, s: c.series.map(x => ({ n: x.name, d: x.data.map(y => (typeof y.y === 'number' ? y.y : null)) })) } : null;
  });
  const apply = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    try { await page.locator('button.btn-back.btn-p-input').click({ timeout: 8000 }); }
    catch (e) { await page.evaluate(() => document.querySelector('button.btn-back.btn-p-input').click()); }
    await page.waitForTimeout(3000);
  };

  // option DGT/HHO text
  console.log('DGT option:', JSON.stringify(await page.evaluate(() => {
    const s = document.getElementById('ma_dvi_sl');
    return Array.from(s.options).filter(o => ['DGT', 'HHO'].includes(o.value)).map(o => ({ v: o.value, text: o.textContent, html: o.innerHTML.slice(0, 60) }));
  })));

  // 1. invalid date -> apply -> restore valid -> apply (recovery?)
  await page.locator('#ngay_ht').fill('abc');
  await apply();
  console.log('sau "abc":', JSON.stringify(await chartState()).slice(0, 200));
  await page.locator('#ngay_ht').fill('04/09/2026');
  await apply();
  const rec = await chartState();
  console.log('RECOVERY sau valid date:', JSON.stringify(rec).slice(0, 300));

  // 2. tooltip hover cot AGI sau apply mac dinh
  const pts = await page.evaluate(() => {
    const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    return c.series[0].points.map(p => ({ cat: p.category, x: p.plotX, y: p.plotY }));
  });
  console.log('pts:', JSON.stringify(pts));
  if (pts.length > 1) {
    const cRect = await page.evaluate(() => { const r = document.getElementById('bar-chart-dt').getBoundingClientRect(); return { left: r.left, top: r.top }; });
    const p1 = pts[1];
    await page.mouse.move(cRect.left + p1.x, cRect.top + p1.y + 30, { steps: 10 });
    await page.waitForTimeout(1400);
    const tip = await page.evaluate(() => Array.from(document.querySelectorAll('.highcharts-tooltip')).filter(t => (t.textContent || '').trim()).map(t => (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200)));
    console.log('TIP AGI sau recovery:', JSON.stringify(tip));
  }

  // 3. modal sau khi apply mac dinh (ALL thang): mo, dung heading, kiem tra dong Tong cung trong thead?
  await page.locator('button.btn-filter-update').click();
  await page.waitForTimeout(2200);
  console.log('MODAL final:', JSON.stringify(await page.evaluate(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
    return {
      open: m.classList.contains('in'),
      title: m.querySelector('h4,.modal-title')?.textContent?.trim(),
      theadRowCount: t ? t.querySelectorAll('thead tr').length : 0,
      headRow1: t ? Array.from(t.querySelectorAll('thead tr:first-child td, thead tr:first-child th')).map(x => x.textContent.trim()) : null,
      tbodyRows: t ? t.querySelectorAll('tbody tr').length : 0,
    };
  })));
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForTimeout(800);

  // 4. page reload khi modal dang mo? khong — bo. chi check state cuoi
  console.log('ERRORS:', JSON.stringify(errors));
  await browser.close();
})();