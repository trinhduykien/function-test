// PROBE 08c: tách biến — dvi riêng lẻ, kieu năm riêng, ngay invalid + apply, option DGT/HHO null, tab-slider chi tiết
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
    return c ? { cats: c.xAxis[0].categories, s: c.series.map(x => ({ n: x.name, v: x.visible, d: x.data.map(y => (typeof y.y === 'number' ? y.y : null)) })) } : null;
  });
  const modalRows = async () => {
    await page.locator('button.btn-filter-update').click();
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
      const m = document.querySelector('#modal_MonthlyRevenue');
      const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
      return { open: m.classList.contains('in'), title: m.querySelector('h4,.modal-title')?.textContent?.trim(), rowCount: t ? t.querySelectorAll('tbody tr').length : 0, units: t ? Array.from(t.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim()?.slice(0, 25)) : [] };
    });
    await page.locator('#modal_MonthlyRevenue .close').first().click();
    await page.waitForTimeout(800);
    return r;
  };
  const apply = async () => { await page.locator('button.btn-back.btn-p-input').click(); await page.waitForTimeout(3000); };

  // ===== A. AGI (kieu thang mac dinh) =====
  await page.locator('#ma_dvi_sl').selectOption('AGI');
  await apply();
  console.log('A. AGI thang CHART:', JSON.stringify(await chartState()));
  console.log('A. AGI thang MODAL:', JSON.stringify(await modalRows()));

  // ===== B. TCT (kieu thang) =====
  await page.locator('#ma_dvi_sl').selectOption('TCT');
  await apply();
  console.log('B. TCT thang CHART:', JSON.stringify(await chartState()));
  console.log('B. TCT thang MODAL:', JSON.stringify(await modalRows()));

  // ===== C. ALL + kieu nam =====
  await page.locator('#ma_dvi_sl').selectOption('ALL');
  await page.locator('#kieu_sl').selectOption('BHTT_Y');
  await apply();
  console.log('C. ALL nam CHART:', JSON.stringify(await chartState()));
  console.log('C. ALL nam MODAL:', JSON.stringify(await modalRows()));
  // ve mac dinh
  await page.locator('#kieu_sl').selectOption('BHTT_M');
  await apply();
  console.log('restore thang CHART:', JSON.stringify(await chartState()).slice(0, 300));

  // ===== D. ngay invalid + apply =====
  const cases = ['32/13/2026', '"><&!@#', '', 'abc'];
  for (const c of cases) {
    await page.locator('#ngay_ht').fill(c);
    await apply();
    const st = await chartState();
    console.log('D. ngay="' + c + '" CHART:', JSON.stringify(st).slice(0, 260), '| errors:', JSON.stringify(errors.slice(-2)));
    const m = await modalRows();
    console.log('D. ngay="' + c + '" MODAL:', JSON.stringify(m));
  }
  // restore ngay
  await page.locator('#ngay_ht').fill('04/09/2026');
  await apply();

  // ===== E. option DGT (nhan null) =====
  const opts = await page.evaluate(() => Array.from(document.getElementById('ma_dvi_sl').options).map(o => o.value + '|' + (o.textContent || '').trim()));
  console.log('E. options tail:', JSON.stringify(opts.slice(-4)));
  await page.locator('#ma_dvi_sl').selectOption('DGT');
  await apply();
  console.log('E. DGT CHART:', JSON.stringify(await chartState()).slice(0, 260));
  console.log('E. DGT MODAL:', JSON.stringify(await modalRows()));
  await page.locator('#ma_dvi_sl').selectOption('ALL');
  await apply();

  // ===== F. tab-slider: HTML + hidden panes + click via evaluate =====
  const sliderInfo = await page.evaluate(() => {
    const nav = document.querySelector('.tab-slider--nav');
    const cont = document.querySelector('.tab-slider--container');
    const tabs = Array.from(document.querySelectorAll('[id^="tab"]')).map(e => e.id + '|' + e.tagName + '|vis:' + (e.offsetParent !== null));
    return {
      navHTML: nav.outerHTML.slice(0, 300),
      navOnclick: nav.getAttribute('onclick'),
      contHTMLHead: cont.outerHTML.slice(0, 250),
      allTabs: tabs,
      navParentCls: nav.parentElement.className,
    };
  });
  console.log('F. SLIDER:', JSON.stringify(sliderInfo, null, 1));
  // click via JS + jQuery event check
  await page.evaluate(() => { document.querySelector('.tab-slider--nav').click(); });
  await page.waitForTimeout(1000);
  console.log('F. after JS click:', JSON.stringify(await page.evaluate(() => {
    const cont = document.querySelector('.tab-slider--container');
    return { contCls: cont.className, vis: cont.offsetParent !== null, h: cont.getBoundingClientRect().height, navCls: document.querySelector('.tab-slider--nav').className };
  })));
  console.log('F. jQuery handlers on nav:', await page.evaluate(() => (typeof jQuery !== 'undefined' && jQuery._data) ? Object.keys(jQuery._data(document.querySelector('.tab-slider--nav'), 'events') || {}) : 'no-jquery-data'));

  // ===== G. legend khi AGI da apply (2 cats) =====
  console.log('G. legend items:', await page.locator('.highcharts-legend-item').count());

  console.log('ERRORS CUOI:', JSON.stringify(errors));
  await browser.close();
})();