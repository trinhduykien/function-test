// PROBE 08d: phần còn lại — ALL+năm, ngay invalid + apply, DGT null option, tab-slider chi tiết, legend sau apply
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
  // apply an toan: scroll top roi click; neu bi navbar chan thi click via JS
  const apply = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    try {
      await page.locator('button.btn-back.btn-p-input').click({ timeout: 8000 });
    } catch (e) {
      console.log('  (apply: click intercepted -> JS click)');
      await page.evaluate(() => document.querySelector('button.btn-back.btn-p-input').click());
    }
    await page.waitForTimeout(3000);
  };
  const modalRows = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('button.btn-filter-update').click();
    await page.waitForTimeout(2200);
    const r = await page.evaluate(() => {
      const m = document.querySelector('#modal_MonthlyRevenue');
      const t = document.querySelector('#modal_MonthlyRevenue #table-dt1');
      return { open: m.classList.contains('in'), title: m.querySelector('h4,.modal-title')?.textContent?.trim(), rowCount: t ? t.querySelectorAll('tbody tr').length : 0, units: t ? Array.from(t.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim()?.slice(0, 25)) : [] };
    });
    await page.locator('#modal_MonthlyRevenue .close').first().click();
    await page.waitForTimeout(900);
    return r;
  };

  // ===== C. ALL + kieu nam =====
  await page.locator('#ma_dvi_sl').selectOption('ALL');
  await page.locator('#kieu_sl').selectOption('BHTT_Y');
  await apply();
  console.log('C. ALL nam CHART:', JSON.stringify(await chartState()));
  console.log('C. ALL nam MODAL:', JSON.stringify(await modalRows()));
  await page.locator('#kieu_sl').selectOption('BHTT_M');
  await apply();
  console.log('restore thang CHART:', JSON.stringify(await chartState()).slice(0, 300));

  // ===== D. ngay invalid + apply =====
  for (const c of ['32/13/2026', '"><&!@#', '', 'abc', '01/01/2099']) {
    await page.locator('#ngay_ht').fill(c);
    await apply();
    const st = await chartState();
    console.log('D. ngay="' + c + '" CHART:', JSON.stringify(st).slice(0, 280));
    console.log('D. ngay="' + c + '" MODAL:', JSON.stringify(await modalRows()));
    console.log('D. errors:', JSON.stringify(errors.slice(-2)));
  }
  await page.locator('#ngay_ht').fill('04/09/2026');
  await apply();

  // ===== E. option DGT / HHO (nhan null?) =====
  const opts = await page.evaluate(() => Array.from(document.getElementById('ma_dvi_sl').options).map(o => ({ v: o.value, t: (o.textContent || '').trim(), vis: o.offsetParent !== null })));
  console.log('E. options null-label:', JSON.stringify(opts.filter(o => !o.t)));
  await page.locator('#ma_dvi_sl').selectOption('DGT');
  await apply();
  console.log('E. DGT CHART:', JSON.stringify(await chartState()).slice(0, 280));
  console.log('E. DGT MODAL:', JSON.stringify(await modalRows()));
  await page.locator('#ma_dvi_sl').selectOption('ALL');
  await apply();

  // ===== F. tab-slider chi tiết =====
  const sliderInfo = await page.evaluate(() => {
    const nav = document.querySelector('.tab-slider--nav');
    const cont = document.querySelector('.tab-slider--container');
    const tabs = Array.from(document.querySelectorAll('[id^="tab"]')).map(e => e.id + '|' + e.tagName + '|vis:' + (e.offsetParent !== null));
    return {
      navHTML: nav.outerHTML.slice(0, 250),
      navOnclick: nav.getAttribute('onclick'),
      contCls: cont.className,
      allTabs: tabs.slice(0, 10),
      navVisibleText: (nav.textContent || '').trim(),
    };
  });
  console.log('F. SLIDER:', JSON.stringify(sliderInfo, null, 1));
  // jQuery events?
  console.log('F. jqEvents nav:', await page.evaluate(() => { try { return Object.keys(jQuery._data(document.querySelector('.tab-slider--nav'), 'events') || {}); } catch (e) { return 'none'; } }));
  console.log('F. jqEvents document click count:', await page.evaluate(() => { try { return (jQuery._data(document, 'events').click || []).length; } catch (e) { return 'none'; } }));
  await page.locator('.tab-slider--nav').click({ force: true });
  await page.waitForTimeout(1200);
  console.log('F. after force click:', JSON.stringify(await page.evaluate(() => {
    const cont = document.querySelector('.tab-slider--container');
    return { contCls: cont.className, vis: cont.offsetParent !== null, h: cont.getBoundingClientRect().height, navCls: document.querySelector('.tab-slider--nav').className };
  })));

  // ===== G. legend sau apply =====
  console.log('G. legend items:', await page.locator('.highcharts-legend-item').count());
  const lg = page.locator('.highcharts-legend-item');
  await lg.first().click();
  await page.waitForTimeout(600);
  console.log('G. sau click legend 1:', JSON.stringify((await chartState()).s.map(x => x.n + ':' + x.v)));
  await lg.first().click();
  await page.waitForTimeout(500);

  // ===== H. tooltip sau khi da apply ALL (mac dinh) =====
  const pts = await page.evaluate(() => {
    const c = Highcharts.charts.filter(Boolean).find(ch => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    return c.series[0].points.map(p => ({ cat: p.category, x: p.plotX, y: p.plotY }));
  });
  const cRect = await page.evaluate(() => { const r = document.getElementById('bar-chart-dt').getBoundingClientRect(); return { left: r.left, top: r.top }; });
  if (pts.length) {
    const p1 = pts[1];
    await page.mouse.move(cRect.left + p1.x, cRect.top + p1.y + 30, { steps: 10 });
    await page.waitForTimeout(1400);
    const tip = await page.evaluate(() => {
      const tips = Array.from(document.querySelectorAll('.highcharts-tooltip')).filter(t => t.textContent.trim());
      return tips.map(t => (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 250));
    });
    console.log('H. TIP cat ' + p1.cat + ':', JSON.stringify(tip));
  }

  console.log('ERRORS CUOI:', JSON.stringify(errors));
  await browser.close();
})();