/**
 * PROBE func-07-navigation-state — Điều hướng & trạng thái trình duyệt
 * Back/Forward/Reload/deep-link trên UAT PJICO.
 * Khám phá: (a) back/forward, (b) reload, (c) query rác, (d) 404,
 * (e) query không dùng trên /Home/Index, (f) hash, (g) deep-link thẳng.
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE = 'https://uat-capdon.pjico.com.vn';
const STATE = '.auth/uat.json';
const OUT = 'probe-func-07-navigation-state';

function log(...a) { console.log(...a); }
async function shot(page, name) {
  try { await page.screenshot({ path: `${OUT}-${name}.png`, fullPage: false }); log(`  [shot] ${name}`); } catch (e) { log(`  [shot FAIL] ${name}: ${e.message}`); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1680, height: 950 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)));

  // ---------- (a) back/forward /Home/Index -> /ContractCar/Search ----------
  log('\n=== (a) back/forward ===');
  await page.goto(BASE + '/Home/Index', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  log('Home URL:', page.url());
  log('Home title:', await page.title());
  // menu top?
  const menuTop = await page.locator('.dropdown-toggle.name-menu--item').count();
  log('Home .dropdown-toggle.name-menu--item count:', menuTop);
  await shot(page, 'a1-home');

  // Điều hướng menu tới ContractCar/Search — tìm link trong menu
  const contractLink = page.locator('a[href*="ContractCar/Search"]').first();
  const cnt = await page.locator('a[href*="ContractCar/Search"]').count();
  log('a[href*=ContractCar/Search] count:', cnt);
  if (cnt > 0) {
    await contractLink.click();
    await page.waitForLoadState('load');
  } else {
    log('! Không tìm thấy link ContractCar/Search — goto trực tiếp');
    await page.goto(BASE + '/ContractCar/Search', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
  }
  log('After nav URL:', page.url());
  const searchVisible = await page.locator('input').first().isVisible().catch(() => null);
  log('Search page has visible input:', searchVisible);
  const menuOnSearch = await page.locator('.dropdown-toggle.name-menu--item').count();
  log('Search menu count:', menuOnSearch);
  await shot(page, 'a2-search');

  // goBack
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  log('After goBack URL:', page.url());
  const backMenu = await page.locator('.dropdown-toggle.name-menu--item').count();
  log('After goBack menu count:', backMenu);
  const bodyLen = (await page.locator('body').innerText().catch(() => '')).length;
  log('After goBack body text length:', bodyLen);
  await shot(page, 'a3-back');

  // goForward
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  log('After goForward URL:', page.url());
  const fwdMenu = await page.locator('.dropdown-toggle.name-menu--item').count();
  log('After goForward menu count:', fwdMenu);
  const fwdBody = (await page.locator('body').innerText().catch(() => '')).length;
  log('After goForward body text length:', fwdBody);
  await shot(page, 'a4-forward');

  // ---------- (b) reload trên 3 trang ----------
  log('\n=== (b) reload /ContractCar/Search ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  try {
    await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
    log('reload ContractCar: menu OK');
  } catch { log('reload ContractCar: MENU KHÔNG XUẤT HIỆN sau 15s'); }
  const rBody = (await page.locator('body').innerText().catch(() => '')).length;
  log('reload ContractCar body len:', rBody, 'URL:', page.url());
  await shot(page, 'b1-reload-contractcar');

  for (const p of ['/ClaimGeneral/Search', '/CategorySystem/Unit']) {
    log(`\n=== (b) reload ${p} ===`);
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    const before = (await page.locator('body').innerText().catch(() => '')).length;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    let menuOk = true;
    try { await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 }); } catch { menuOk = false; }
    const after = (await page.locator('body').innerText().catch(() => '')).length;
    log(`reload ${p}: menu=${menuOk} bodyBefore=${before} bodyAfter=${after} URL=${page.url()}`);
    await shot(page, 'b-reload-' + p.replace(/\//g, '_'));
  }

  // ---------- (c) query rác ----------
  log('\n=== (c) query rác ===');
  const junkUrl = BASE + '/ContractCar/Search?xyz=1&test=%3Cb%3Eabc%3C%2Fb%3E';
  const resp = await page.goto(junkUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  log('junk status:', resp && resp.status(), 'URL:', page.url());
  const html = await page.content();
  const renderedB = html.includes('<b>abc</b>');
  log('HTML chứa chuỗi <b>abc</b> được render thô:', renderedB);
  const junkMenu = await page.locator('.dropdown-toggle.name-menu--item').count().catch(() => -1);
  log('junk menu count:', junkMenu);
  await shot(page, 'c1-junk-query');

  // body có hiển thị "abc" như text?
  const bodyTxt = await page.locator('body').innerText().catch(() => '');
  log('body contains "abc":', bodyTxt.includes('abc'));

  // ---------- (d) URL không tồn tại ----------
  log('\n=== (d) 404 ===');
  const resp404 = await page.goto(BASE + '/KhongTonTai999/Action', { waitUntil: 'domcontentloaded' }).catch(e => { log('goto err:', e.message); return null; });
  await page.waitForLoadState('load').catch(() => {});
  log('404 status:', resp404 && resp404.status(), 'URL:', page.url());
  const html404 = await page.content();
  log('404 has stack trace (".cs", "Exception", "StackTrace"):', ['.cs', 'Exception', 'StackTrace'].map(s => html404.includes(s)));
  log('404 has link/button to home (href*="Home" or quay lại):', /Home|Quay|Trang chủ|quay lại/i.test(html404));
  log('404 body text (first 400):', (await page.locator('body').innerText().catch(() => '')).slice(0, 400));
  await shot(page, 'd1-404');
  // Sau 404, back có hoạt động?
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(e => log('back from 404 err:', e.message));
  await page.waitForLoadState('load').catch(() => {});
  log('back from 404 URL:', page.url());

  // ---------- (e) /Home/Index?foo=bar ----------
  log('\n=== (e) /Home/Index?foo=bar ===');
  const respE = await page.goto(BASE + '/Home/Index?foo=bar', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  log('foo=bar status:', respE && respE.status(), 'URL:', page.url());
  try {
    await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
    log('foo=bar: menu OK');
  } catch { log('foo=bar: menu KHÔNG xuất hiện'); }
  const tabs = await page.locator('#tab3, [id^="tab"]').count();
  log('foo=bar tab count:', tabs);
  await shot(page, 'e1-home-foo');

  // ---------- (f) hash ----------
  log('\n=== (f) hash #tab3 ===');
  await page.evaluate(() => { window.location.hash = '#tab3'; });
  await page.waitForTimeout(1500);
  log('after hash URL:', page.url());
  // hashchange có reload?
  log('page still loaded (menu count):', await page.locator('.dropdown-toggle.name-menu--item').count());
  // hash ngay trong URL goto
  const respF = await page.goto(BASE + '/Home/Index#tab3', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  log('goto with hash status:', respF && respF.status(), 'URL:', page.url());
  const menuF = await page.locator('.dropdown-toggle.name-menu--item').count();
  log('goto hash menu count:', menuF);
  // tab3 có được active không?
  const tab3Active = await page.evaluate(() => {
    const el = document.querySelector('#tab3');
    if (!el) return 'no-#tab3';
    return el.className || 'present';
  });
  log('tab3 state:', tab3Active);
  await shot(page, 'f1-hash');

  // ---------- (g) deep-link thẳng /CategorySystem/Unit ----------
  log('\n=== (g) deep-link /CategorySystem/Unit ===');
  const page2 = await ctx.newPage();
  const respG = await page2.goto(BASE + '/CategorySystem/Unit', { waitUntil: 'domcontentloaded' });
  await page2.waitForLoadState('load');
  log('deep-link status:', respG && respG.status(), 'URL:', page2.url());
  try {
    await page2.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
    log('deep-link: menu OK');
  } catch { log('deep-link: MENU KHÔNG XUẤT HIỆN'); }
  // dữ liệu bảng?
  await page2.waitForTimeout(2000);
  const rows = await page2.locator('table tbody tr').count();
  log('deep-link table rows:', rows);
  await page2.screenshot({ path: `${OUT}-g1-deeplink-unit.png` });
  const txt = await page2.locator('body').innerText().catch(() => '');
  log('deep-link body len:', txt.length, 'login form?', /EMAIL|ĐĂNG NHẬP/i.test(txt.slice(0, 500)));
  await page2.close();

  log('\n=== console errors (unique, top 15) ===');
  const uniq = [...new Set(consoleErrors)];
  uniq.slice(0, 15).forEach(e => log(' CE:', e));

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });