// PROBE 08b: condbtn = apply?, tooltip đùng trong thân cột, tab-slider class diff, modal thead, reload persistence
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, storageState: 'd:/bore/13/.auth/uat.json' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 250)));
  const reqs = [];
  page.on('request', r => { if (r.url().includes('/Dashboard/') || r.url().includes('/Home/')) reqs.push(r.method() + ' ' + r.url().slice(0, 120)); });

  await page.goto(BASE + '/Home/Index', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3500);

  const chartState = () => page.evaluate(() => {
    const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    return c ? { cats: c.xAxis[0].categories, s0: c.series[0].data.map(d => (typeof d.y === 'number' ? d.y : null)), names: c.series.map(s => s.name) } : null;
  });

  // ===== 1. TOOLTIP: hover vào THÂN cột (plotY + 40) =====
  const pts = await page.evaluate(() => {
    const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    return c.series[0].points.map(p => ({ cat: p.category, x: p.plotX, y: p.plotY, shapeArgs: p.shapeArgs ? { x: p.shapeArgs.x, y: p.shapeArgs.y, w: p.shapeArgs.width, h: p.shapeArgs.height } : null }));
  });
  console.log('POINTS:', JSON.stringify(pts));
  const cRect = await page.evaluate(() => { const r = document.getElementById('bar-chart-dt').getBoundingClientRect(); return { left: r.left, top: r.top }; });
  const p0 = pts[0];
  await page.mouse.move(cRect.left + p0.x, cRect.top + p0.y + 40, { steps: 10 });
  await page.waitForTimeout(1500);
  const tipDump = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.highcharts-tooltip').forEach(t => out.push({
      inChart: !!t.closest('#bar-chart-dt'),
      vis: t.getAttribute('visibility'), op: t.getAttribute('opacity'),
      html: (t.innerHTML || '').slice(0, 400), text: (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 250),
    }));
    return out;
  });
  console.log('TIPDUMP (than cot TCT):', JSON.stringify(tipDump, null, 1));

  // ===== 2. CONDBTN = APPLY? : chon AGI + kieu nam roi bam "Theo điều kiện chọn" =====
  reqs.length = 0;
  await page.locator('#ma_dvi_sl').selectOption('AGI');
  await page.locator('#kieu_sl').selectOption('BHTT_Y');
  await page.locator('#ngay_ht').fill('01/08/2026');
  await page.waitForTimeout(500);
  console.log('CHART truoc condbtn:', JSON.stringify(await chartState()));
  // co alert chan? lang nghe dialog
  page.on('dialog', d => { console.log('DIALOG:', d.type(), d.message().slice(0, 100)); d.dismiss().catch(() => {}); });
  await page.locator('button.btn-back.btn-p-input').click();
  await page.waitForTimeout(3000);
  console.log('reqs sau condbtn:', JSON.stringify(reqs));
  console.log('CHART sau condbtn (AGI + nam):', JSON.stringify(await chartState()));
  // modal sau condbtn
  await page.locator('button.btn-filter-update').click();
  await page.waitForTimeout(2000);
  const modalAfter = await page.evaluate(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
    return {
      open: m.classList.contains('in'),
      title: m.querySelector('h4,.modal-title')?.textContent?.trim(),
      theadHTML: t ? (t.querySelector('thead')?.outerHTML || 'NO-THEAD').slice(0, 900) : null,
      rowCount: t ? t.querySelectorAll('tbody tr').length : 0,
      rowUnits: t ? Array.from(t.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim()?.slice(0, 25)) : null,
    };
  });
  console.log('MODAL sau condbtn (AGI+nam):', JSON.stringify(modalAfter).slice(0, 1400));
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForTimeout(800);

  // ===== 3. CONDBTN lan 2 (mac dinh sau khi da apply?) + form_chay =====
  reqs.length = 0;
  await page.locator('button.btn-back.btn-p-input').click();
  await page.waitForTimeout(2500);
  console.log('reqs sau condbtn lan2:', JSON.stringify(reqs));
  console.log('CHART sau condbtn lan2:', JSON.stringify(await chartState()));
  const formChay = await page.evaluate(() => typeof form_chay !== 'undefined' ? form_chay : 'undef');
  console.log('form_chay:', JSON.stringify(formChay));

  // ===== 4. TAB-SLIDER NAV: class diff chi tiet =====
  const before = await page.evaluate(() => {
    const nav = document.querySelector('.tab-slider--nav');
    const cont = document.querySelector('.tab-slider--container');
    return { navCls: nav.className, contCls: cont.className, contVis: cont.offsetParent !== null, contH: cont.getBoundingClientRect().height };
  });
  await page.locator('.tab-slider--nav').click();
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const nav = document.querySelector('.tab-slider--nav');
    const cont = document.querySelector('.tab-slider--container');
    return { navCls: nav.className, contCls: cont.className, contVis: cont.offsetParent !== null, contH: cont.getBoundingClientRect().height };
  });
  console.log('NAV before:', JSON.stringify(before));
  console.log('NAV after click1:', JSON.stringify(after));
  await page.locator('.tab-slider--nav').click();
  await page.waitForTimeout(1200);
  console.log('NAV after click2:', JSON.stringify(await page.evaluate(() => {
    const cont = document.querySelector('.tab-slider--container');
    return { contCls: cont.className, contVis: cont.offsetParent !== null, contH: cont.getBoundingClientRect().height };
  })));

  // ===== 5. RELOAD GIỮA CHỪNG (AGI + nam da chon) =====
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3500);
  console.log('AFTER RELOAD:', JSON.stringify(await page.evaluate(() => ({
    dvi: document.getElementById('ma_dvi_sl')?.value,
    kieu: document.getElementById('kieu_sl')?.value,
    ngay: document.getElementById('ngay_ht')?.value,
    chart: (() => { const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt'); return c ? { cats: c.xAxis[0].categories, s0: c.series[0].data.map(d => (typeof d.y === 'number' ? d.y : null)) } : null; })(),
  }))));

  // ===== 6. modal open: table-dt1 headers (thead td) khi mac dinh =====
  await page.locator('button.btn-filter-update').click();
  await page.waitForTimeout(2000);
  const modalDefault = await page.evaluate(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
    return {
      title: m.querySelector('h4,.modal-title')?.textContent?.trim(),
      headCells: t ? Array.from(t.querySelectorAll('thead td, thead th')).map(x => x.textContent.trim().slice(0, 18)) : null,
      rowCount: t ? t.querySelectorAll('tbody tr').length : 0,
      rowUnits: t ? Array.from(t.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim()?.slice(0, 25)) : null,
    };
  });
  console.log('MODAL default:', JSON.stringify(modalDefault).slice(0, 1200));
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForTimeout(600);

  console.log('ERRORS:', JSON.stringify(errors));
  await browser.close();
})();