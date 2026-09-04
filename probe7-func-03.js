// PROBE 7 — ALL đơn vị + bỏ trống ngày: có dữ liệu nào trả về không?
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();
  await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  // đổi đơn vị sang ALL qua native select (trigger auto-search), rồi bỏ trống ngày, bấm tìm
  const r0 = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 15000 }).catch(() => null);
  await page.locator('#dvi_qly_tim').selectOption('');
  const rr0 = await r0;
  console.log('auto-search khi đổi ALL:', rr0 ? rr0.status() : 'none', '| val:', JSON.stringify(await page.locator('#dvi_qly_tim').inputValue()));
  await page.waitForTimeout(1500);
  // đóng alertBox nếu mở
  if (await page.locator('#alertBox').isVisible().catch(() => false)) {
    await page.locator('#alertBox .close').first().click();
    await page.waitForTimeout(400);
  }
  await page.mouse.move(300, 600);
  await page.locator('#ngayd_timhd').fill('');
  await page.locator('#ngayc_timhd').fill('');
  const rp = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 20000 }).catch(() => null);
  await page.locator('#btn').click();
  const r = await rp;
  const body = r ? await r.text() : '';
  console.log('ALL + trống ngày → status:', r && r.status(), 'body:', body.slice(0, 200));
  await page.waitForTimeout(2000);
  console.log('grid:', (await page.evaluate(() => document.querySelector('#Gr_lke').innerText.replace(/\s+/g, ' ').slice(0, 200))));
  await browser.close();
})();
