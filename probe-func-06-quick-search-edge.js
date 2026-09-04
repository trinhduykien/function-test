// PROBE 3: các ca biên còn lại
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    storageState: 'd:/bore/13/.auth/uat.json',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));

  await page.goto(BASE + '/Home/Index', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  const toggle = page.locator('#pjMenuSearchToggle');
  await toggle.waitFor({ state: 'visible', timeout: 30000 });
  for (let i = 0; i < 3; i++) {
    await toggle.click({ force: true }).catch(() => {});
    try { await page.locator('#pjMenuSearchInput').waitFor({ state: 'visible', timeout: 3000 }); break; } catch (e) {}
  }
  const input = page.locator('#pjMenuSearchInput');

  const q = async (text) => {
    await input.fill('');
    await input.fill(text);
    await page.waitForTimeout(600);
    return await page.evaluate(() => {
      const res = document.querySelector('#pjMenuSearchResults');
      const items = Array.from(res.querySelectorAll('a.pj-menu-search-result'));
      return { n: items.length, emptyMsg: res.textContent.trim().slice(0, 80), resVisible: res.offsetParent !== null, hiddenCls: res.className };
    });
  };

  console.log('special !@#$%^&*():', JSON.stringify(await q("!@#$%^&*()")));
  console.log("quote chars '\"<>:", JSON.stringify(await q("'\"<>&")));
  console.log('300 chars:', JSON.stringify(await q('x'.repeat(300))));
  console.log('spaces only:', JSON.stringify(await q('     ')));
  console.log('single space:', JSON.stringify(await q(' ')));
  console.log('mixed "đơn xe máy":', JSON.stringify(await q('đơn xe máy')));
  console.log('order sai "xe ô tô cấp đơn":', JSON.stringify(await q('xe ô tô cấp đơn')));
  console.log('substring "p đơn":', JSON.stringify(await q('p đơn')));

  // Enter khi KHÔNG có kết quả (gõ emoji)
  await input.fill('😀');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  console.log('Enter no-result URL:', page.url(), '| pageErrors:', errors.length);

  // Enter khi input rỗng
  await input.fill('');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  console.log('Enter empty URL:', page.url(), '| errors:', JSON.stringify(errors));

  // aria-expanded của toggle
  console.log('aria-expanded sau mở:', await toggle.getAttribute('aria-expanded'));
  await toggle.click({ force: true });
  await page.waitForTimeout(500);
  console.log('aria-expanded sau đóng:', await toggle.getAttribute('aria-expanded'));

  // Escape đóng panel?
  await toggle.click({ force: true });
  await input.waitFor({ state: 'visible', timeout: 3000 });
  await input.fill('cấp đơn');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  console.log('Sau Escape: input visible =', await input.isVisible());

  // dropdown có crash khi click item giữa nhiều kết quả? click result thứ 3
  if (await input.isVisible()) {
    await input.fill('cấp đơn');
    await page.waitForTimeout(600);
    const third = page.locator('#pjMenuSearchResults a.pj-menu-search-result').nth(2);
    console.log('Item 3 text:', (await third.textContent()).trim().slice(0, 50), 'href:', await third.getAttribute('href'));
    await third.click();
    await page.waitForTimeout(2000);
    console.log('URL sau click item 3:', page.url());
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });