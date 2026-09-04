/**
 * PROBE2 func-07 — chuyên sâu:
 * A. Điều hướng qua MENU THẬT (hover CẤP ĐƠN -> click a[href=/ContractCar/Search])
 * B. Render signals trang /ContractCar/Search (inputs, buttons, form)
 * C. Trang lỗi ErrorHandler: DOM đầy đủ (innerText, outerHTML slice, links, buttons) x 3 path lạ
 * D. Reload trên URL có query rác — query còn giữ? trang còn render?
 * E. Sau goBack về /Home/Index: chart #bar-chart-dt, tab3, menu
 * F. Thời gian menu xuất hiện sau reload (ms)
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';
const STATE = '.auth/uat.json';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1680, height: 950 } });
  const page = await ctx.newPage();

  // ---------- A. menu that ----------
  console.log('=== A. Menu navigation Home -> ContractCar/Search ===');
  await page.goto(BASE + '/Home/Index', { waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 20000 });
  console.log('menu appeared after', Date.now() - t0, 'ms (from domcontentloaded+wfs)');

  // hover top menu CẤP ĐƠN
  const capDon = page.locator('.dropdown-toggle.name-menu--item', { hasText: 'CẤP ĐƠN' }).first();
  console.log('CẤP ĐƠN count:', await page.locator('.dropdown-toggle.name-menu--item', { hasText: 'CẤP ĐƠN' }).count());
  await capDon.hover();
  await page.waitForTimeout(800);
  const link = page.locator('a[href="/ContractCar/Search"]').first();
  const linkVisible = await link.isVisible().catch(() => false);
  console.log('a[href=/ContractCar/Search] visible after hover:', linkVisible);
  // parent panel?
  const linkInfo = await page.evaluate(() => {
    const a = document.querySelector('a[href="/ContractCar/Search"]');
    if (!a) return null;
    const r = a.getBoundingClientRect();
    let anc = [];
    let p = a.parentElement;
    while (p && anc.length < 5) { anc.push(p.tagName + '.' + (p.className || '').slice(0, 50)); p = p.parentElement; }
    return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, text: a.innerText, ancestors: anc };
  });
  console.log('link info:', JSON.stringify(linkInfo, null, 1));
  await link.click();
  await page.waitForLoadState('load');
  console.log('after menu-click URL:', page.url());

  // ---------- B. render signals ContractCar/Search ----------
  console.log('\n=== B. Render signals /ContractCar/Search ===');
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const signals = await page.evaluate(() => {
    const vis = sel => { const e = document.querySelector(sel); if (!e) return 'MISSING'; const r = e.getBoundingClientRect(); return e.offsetParent !== null || r.width > 0; };
    return {
      inputs: document.querySelectorAll('input').length,
      selects: document.querySelectorAll('select').length,
      buttons: Array.from(document.querySelectorAll('button')).map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 12),
      btnBlue: !!document.querySelector('button.btn-blue'),
      forms: document.querySelectorAll('form').length,
      tables: document.querySelectorAll('table').length,
      bodyTextLen: (document.body.innerText || '').length,
      bodyHead: (document.body.innerText || '').slice(0, 300).replace(/\n+/g, ' | '),
      menuCount: document.querySelectorAll('.dropdown-toggle.name-menu--item').length,
      visibleInput: vis('input'),
    };
  });
  console.log('signals:', JSON.stringify(signals, null, 1));

  // ---------- E. goBack -> Home check ----------
  console.log('\n=== E. goBack -> Home ===');
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  console.log('URL:', page.url());
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const homeAfterBack = await page.evaluate(() => ({
    chartBar: !!document.querySelector('#bar-chart-dt'),
    tab3: !!document.querySelector('#tab3'),
    tabs: Array.from(document.querySelectorAll('[id^="tab"]')).map(e => e.id).slice(0, 10),
    bodyTextLen: (document.body.innerText || '').length,
    title: document.title,
  }));
  console.log('home after back:', JSON.stringify(homeAfterBack, null, 1));

  // goForward -> search again
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const fwd = await page.evaluate(() => ({
    url: location.href,
    inputs: document.querySelectorAll('input').length,
    btnBlue: !!document.querySelector('button.btn-blue'),
    bodyTextLen: (document.body.innerText || '').length,
  }));
  console.log('goForward again:', JSON.stringify(fwd, null, 1));

  // ---------- D. reload giu query rac ----------
  console.log('\n=== D. reload junk query ===');
  await page.goto(BASE + '/ContractCar/Search?xyz=1&test=%3Cb%3Eabc%3C/b%3E', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const before = await page.evaluate(() => ({ url: location.href, inputs: document.querySelectorAll('input').length }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const after = await page.evaluate(() => ({ url: location.href, inputs: document.querySelectorAll('input').length, bodyTextLen: (document.body.innerText || '').length }));
  console.log('before:', JSON.stringify(before), 'after:', JSON.stringify(after));

  // ---------- C. trang loi ----------
  console.log('\n=== C. Error pages ===');
  for (const p of ['/KhongTonTai999/Action', '/Home/KhongTonTai', '/ContractCar/KhongTonTai', '/xyzzy']) {
    const r = await page.goto(BASE + p, { waitUntil: 'domcontentloaded' }).catch(e => ({ err: e.message }));
    await page.waitForLoadState('load').catch(() => {});
    const info = await page.evaluate(() => ({
      title: document.title,
      bodyText: (document.body.innerText || '').trim().slice(0, 600),
      links: Array.from(document.querySelectorAll('a')).map(a => ({ href: a.getAttribute('href'), text: (a.innerText || '').trim().slice(0, 30) })).slice(0, 10),
      buttons: Array.from(document.querySelectorAll('button, input[type=button], input[type=submit]')).length,
      bodyChildNodes: document.body ? document.body.childNodes.length : -1,
    })).catch(e => ({ evalErr: e.message }));
    console.log(p, '=> status:', r && r.status ? r.status() : JSON.stringify(r));
    console.log('  final URL:', page.url());
    console.log('  info:', JSON.stringify(info, null, 1));
  }

  // outerHTML cua trang loi dau tien
  await page.goto(BASE + '/KhongTonTai999/Action', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => {});
  const html = await page.content();
  console.log('\nerror page HTML length:', html.length);
  console.log('error page HTML slice 2000:', html.slice(0, 2000));

  // ---------- F. reload menu timing ----------
  console.log('\n=== F. reload menu timing ===');
  for (const p of ['/ContractCar/Search', '/ClaimGeneral/Search', '/CategorySystem/Unit']) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    const s = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    const tDom = Date.now();
    try {
      await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
      console.log(p, 'menu appeared', Date.now() - tDom, 'ms after reload-domcontentloaded');
    } catch {
      console.log(p, 'MENU KHONG XUAT HIEN sau reload 15s!');
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });