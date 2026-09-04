// PROBE 08 FINAL: tổng hợp mọi hành vi dashboard /Home/Index — chỉ xuất TEXT
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, storageState: 'd:/bore/13/.auth/uat.json' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 250)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });
  const reqs = [];
  page.on('request', r => { if (r.url().includes('/Dashboard/') || r.url().includes('/Home/')) reqs.push(r.method() + ' ' + r.url().slice(0, 120)); });
  let genRespBody = null;
  page.on('response', async r => {
    if (r.url().includes('/Dashboard/GeneratedRevenue')) {
      try { genRespBody = (await r.text()).slice(0, 1500); } catch (e) {}
    }
  });

  await page.goto(BASE + '/Home/Index', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3500);
  console.log('REQS at load:', JSON.stringify(reqs));
  console.log('GeneratedRevenue resp:', genRespBody);

  const chartState = () => page.evaluate(() => {
    const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    const t2 = document.querySelector('#table-dt2');
    return c ? {
      cats: c.xAxis[0].categories,
      series: c.series.map(s => ({ name: s.name, visible: s.visible, data: s.data.map(d => (typeof d.y === 'number' ? d.y : null)) })),
      t2rows: t2 ? Array.from(t2.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim()?.slice(0, 25)) : null,
    } : null;
  });

  // ===== 1. CẤU TRÚC TAB / TAB-SLIDER =====
  const tabs = await page.evaluate(() => {
    const out = { tabSliderEls: [], navIcon: null, tab3Vis: null, kieuOpts: [], btnEl: null, btnInTab3: null };
    document.querySelectorAll('[class*="tab-slider"]').forEach(el => out.tabSliderEls.push(el.tagName + '|' + el.className + '|vis:' + (el.offsetParent !== null)));
    const nav = document.querySelector('.tab-slider--nav');
    out.navIcon = nav ? nav.className : null;
    const t3 = document.getElementById('tab3');
    out.tab3Vis = t3 ? (t3.offsetParent !== null) : null;
    const k = document.getElementById('kieu_sl');
    if (k) Array.from(k.options).forEach(o => out.kieuOpts.push(o.value + '|' + o.text.trim() + '|sel:' + o.selected));
    const b = document.getElementById('btn');
    if (b) out.btnEl = b.tagName + '|' + b.className + '|' + (b.textContent || '').trim().slice(0, 40);
    const btnIn = t3 ? t3.querySelector('button') : null;
    if (btnIn) out.btnInTab3 = btnIn.tagName + '|' + btnIn.className + '|' + (btnIn.textContent || '').trim().slice(0, 60) + '|id:' + btnIn.id;
    return out;
  });
  console.log('TABS:', JSON.stringify(tabs));

  // click tab-slider--nav lần 1 → container còn visible?
  const sliderVis = () => page.evaluate(() => {
    const c = document.querySelector('.tab-slider--container');
    const t3 = document.getElementById('tab3');
    const chart = document.getElementById('bar-chart-dt');
    return { containerVis: c ? c.offsetParent !== null : null, containerH: c ? c.getBoundingClientRect().height : null, tab3Vis: t3 ? t3.offsetParent !== null : null, chartVis: chart ? chart.offsetParent !== null : null };
  });
  console.log('SLIDER before:', JSON.stringify(await sliderVis()));
  await page.locator('.tab-slider--nav').click();
  await page.waitForTimeout(1000);
  console.log('SLIDER after click1:', JSON.stringify(await sliderVis()));
  await page.locator('.tab-slider--nav').click();
  await page.waitForTimeout(1000);
  console.log('SLIDER after click2:', JSON.stringify(await sliderVis()));

  // ===== 2. KIEU_SL: tháng -> năm -> tháng =====
  reqs.length = 0;
  const baseState = await chartState();
  console.log('BASE kieu=thang:', JSON.stringify(baseState));
  await page.locator('#kieu_sl').selectOption({ label: 'Doanh thu theo năm' }).catch(async e => {
    console.log('selectOption label fail:', e.message.slice(0, 100));
    const opts = await page.evaluate(() => Array.from(document.getElementById('kieu_sl').options).map(o => o.value));
    console.log('kieu opts values:', JSON.stringify(opts));
  });
  await page.waitForTimeout(2500);
  console.log('AFTER kieu=năm:', JSON.stringify(await chartState()));
  console.log('reqs sau kieu=năm:', JSON.stringify(reqs));
  // modal khi kieu=năm
  await page.locator('button.btn-filter-update').click();
  await page.waitForTimeout(1800);
  const modalNam = await page.evaluate(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
    return {
      open: m.classList.contains('in') && getComputedStyle(m).display === 'block',
      headings: Array.from(m.querySelectorAll('h4,h3,h5,.modal-title')).map(h => h.textContent.trim()),
      headers: t ? Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim().slice(0, 20)) : null,
      rows: t ? Array.from(t.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim().slice(0, 18))) : null,
    };
  });
  console.log('MODAL khi kieu=năm:', JSON.stringify(modalNam).slice(0, 1500));
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForTimeout(1000);
  // về tháng
  await page.locator('#kieu_sl').selectOption({ index: 0 });
  await page.waitForTimeout(2000);
  console.log('BACK kieu=tháng:', JSON.stringify(await chartState()));

  // ===== 3. FILTER ĐƠN VỊ =====
  // (a) AGI
  reqs.length = 0;
  await page.locator('#ma_dvi_sl').selectOption('AGI');
  await page.waitForTimeout(1000);
  console.log('reqs sau select AGI:', JSON.stringify(reqs));
  console.log('CHART sau select AGI:', JSON.stringify(await chartState()));
  await page.locator('button.btn-filter-update').click();
  await page.waitForTimeout(1800);
  console.log('reqs sau btn-update (AGI):', JSON.stringify(reqs));
  const modalAGI = await page.evaluate(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
    return {
      open: m.classList.contains('in') && getComputedStyle(m).display === 'block',
      headings: Array.from(m.querySelectorAll('h4,h3,h5,.modal-title')).map(h => h.textContent.trim()),
      headers: t ? Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim().slice(0, 15)) : null,
      rowCount: t ? t.querySelectorAll('tbody tr').length : 0,
      rows: t ? Array.from(t.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim()?.slice(0, 25)) : null,
    };
  });
  console.log('MODAL AGI:', JSON.stringify(modalAGI).slice(0, 1200));
  // đóng bằng ×, kiểm tra cơ chế
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForTimeout(1200);
  console.log('modal sau close x:', JSON.stringify(await page.evaluate(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    return { in: m.classList.contains('in'), display: getComputedStyle(m).display, backdrop: document.querySelectorAll('.modal-backdrop').length, bodyCls: document.body.className };
  })));
  // mở lại lần 2
  await page.locator('button.btn-filter-update').click();
  await page.waitForTimeout(1800);
  console.log('modal reopen (AGI):', JSON.stringify(await page.evaluate(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
    return { open: m.classList.contains('in') && getComputedStyle(m).display === 'block', rowCount: t ? t.querySelectorAll('tbody tr').length : 0 };
  })));
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForTimeout(1000);

  // (b) TCT
  await page.locator('#ma_dvi_sl').selectOption('TCT');
  await page.waitForTimeout(800);
  await page.locator('button.btn-filter-update').click();
  await page.waitForTimeout(1800);
  console.log('MODAL TCT rows:', JSON.stringify(await page.evaluate(() => {
    const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
    return t ? Array.from(t.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim()?.slice(0, 25)) : null;
  })));
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForTimeout(800);

  // (c) ALL
  await page.locator('#ma_dvi_sl').selectOption('ALL');
  await page.waitForTimeout(800);
  await page.locator('button.btn-filter-update').click();
  await page.waitForTimeout(1800);
  console.log('MODAL ALL rows:', JSON.stringify(await page.evaluate(() => {
    const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
    return t ? { rowCount: t.querySelectorAll('tbody tr').length, rows: Array.from(t.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim()?.slice(0, 25)) } : null;
  })));
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForTimeout(800);

  // ===== 4. LEGEND =====
  console.log('LEGEND before:', JSON.stringify(await chartState()).slice(0, 600));
  const items = page.locator('.highcharts-legend-item');
  console.log('legend count:', await items.count());
  for (let i = 0; i < await items.count(); i++) {
    await items.nth(i).click();
    await page.waitForTimeout(700);
    const st = await chartState();
    console.log('LEGEND after click item ' + i + ':', JSON.stringify(st.series.map(s => s.name + ':' + s.visible)));
  }
  for (let i = 0; i < await items.count(); i++) { await items.nth(i).click(); await page.waitForTimeout(400); }
  console.log('LEGEND after restore:', JSON.stringify((await chartState()).series.map(s => s.name + ':' + s.visible)));

  // ===== 5. TOOLTIP =====
  const pts = await page.evaluate(() => {
    const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    return c.series[0].points.map(p => ({ cat: p.category, x: p.plotX, y: p.plotY }));
  });
  console.log('POINTS:', JSON.stringify(pts));
  const cRect = await page.evaluate(() => { const r = document.getElementById('bar-chart-dt').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; });
  console.log('CHARTRECT:', JSON.stringify(cRect));
  for (const p of pts.slice(0, 2)) {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await page.mouse.move(cRect.left + p.x, cRect.top + p.y - 8, { steps: 10 });
    await page.waitForTimeout(1400);
    const tip = await page.evaluate(() => {
      const t = document.querySelector('#bar-chart-dt .highcharts-tooltip, .highcharts-tooltip');
      return t ? { text: (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 250), vis: t.getAttribute('visibility'), op: t.getAttribute('opacity') } : { exists: false };
    });
    console.log('TIP [' + p.cat + ']:', JSON.stringify(tip));
  }

  // ===== 6. NGAY_HT =====
  reqs.length = 0;
  const beforeNgay = await chartState();
  await page.locator('#ngay_ht').fill('01/08/2026');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  console.log('reqs sau ngay 01/08/2026:', JSON.stringify(reqs));
  console.log('CHART sau ngay:', JSON.stringify(await chartState()).slice(0, 500));
  // ngày vô lệch
  await page.locator('#ngay_ht').fill('32/13/2026');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  console.log('CHART sau ngay 32/13/2026:', JSON.stringify(await chartState()).slice(0, 400));
  console.log('errors den day_ht:', JSON.stringify(errors.slice(0, 3)));
  // ngày rỗng
  await page.locator('#ngay_ht').fill('');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  console.log('CHART sau ngay rỗng:', JSON.stringify(await chartState()).slice(0, 400));
  await page.locator('#ngay_ht').fill('01/09/2026');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // ===== 7. CONDBTN "Theo điều kiện chọn" =====
  const condInfo = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Theo điều kiện chọn');
    return b ? { cls: b.className, onclick: b.getAttribute('onclick'), parentVisible: b.offsetParent !== null } : null;
  });
  console.log('CONDBTN info:', JSON.stringify(condInfo));
  await page.locator('button.btn-back.btn-p-input').click();
  await page.waitForTimeout(1500);
  console.log('CONDBTN after click1:', JSON.stringify(await page.evaluate(() => ({
    url: location.href,
    visModals: Array.from(document.querySelectorAll('.modal')).filter(m => getComputedStyle(m).display !== 'none').map(m => m.id),
    newPanels: document.querySelectorAll('.panel:visible').length,
    sliderVis: (() => { const c = document.querySelector('.tab-slider--container'); return c ? c.offsetParent !== null : null; })(),
  }))));
  await page.locator('button.btn-back.btn-p-input').click();
  await page.waitForTimeout(1500);
  console.log('CONDBTN after click2:', JSON.stringify(await page.evaluate(() => ({ url: location.href }))));

  // ===== 8. RELOAD GIỮA CHỪNG: chọn AGI + kieu năm rồi reload =====
  await page.locator('#ma_dvi_sl').selectOption('AGI');
  await page.locator('#kieu_sl').selectOption({ label: 'Doanh thu theo năm' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);
  console.log('AFTER RELOAD:', JSON.stringify(await page.evaluate(() => ({
    dvi: document.getElementById('ma_dvi_sl')?.value,
    kieu: document.getElementById('kieu_sl')?.value,
    ngay: document.getElementById('ngay_ht')?.value,
    chartCats: (() => { const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt'); return c ? c.xAxis[0].categories : null; })(),
  }))));

  console.log('ALL ERRORS:', JSON.stringify(errors));
  await browser.close();
})();