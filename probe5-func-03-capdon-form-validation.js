// PROBE 5 — Enter trong ô Số HĐ + UI bootstrap-select chọn đơn vị (auto-search) + các ô khác với ký tự đặc biệt
const { chromium } = require('@playwright/test');

const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message.slice(0, 200)));

  async function goSearch() {
    await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);
  }

  try {
    console.log('=== P5.1: Enter trong ô Số HĐ — có trigger search? navigation? ===');
    await goSearch();
    let searchFired = 0;
    page.on('response', r => { if (r.url().includes('SearchResult')) searchFired++; });
    await page.locator('#so_hd_tim').fill('ENTER-TEST-001');
    await page.locator('#so_hd_tim').press('Enter');
    await page.waitForTimeout(3000);
    console.log('searchFired:', searchFired, '| URL:', page.url(), '| pageErrors:', pageErrors.length);
    const val = await page.locator('#so_hd_tim').inputValue();
    console.log('val so_hd sau Enter:', JSON.stringify(val));

    console.log('=== P5.2: UI bootstrap-select chọn AGI → auto-search? ===');
    await goSearch();
    const toggle = page.locator('.bootstrap-select:has(#dvi_qly_tim) button.dropdown-toggle').first();
    console.log('toggle count:', await page.locator('.bootstrap-select:has(#dvi_qly_tim) button.dropdown-toggle').count());
    await toggle.click();
    await page.waitForTimeout(600);
    let fired = 0;
    const respP = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 15000 }).catch(() => null);
    const li = page.locator('.bootstrap-select:has(#dvi_qly_tim) li', { hasText: 'AGI-An Giang' }).first();
    console.log('li AGI count:', await page.locator('.bootstrap-select:has(#dvi_qly_tim) li').count());
    await li.click();
    const r = await respP;
    fired = r ? 1 : 0;
    console.log('auto-search fired:', fired, r ? r.status() : '', '| select val:', await page.locator('#dvi_qly_tim').inputValue());
    await page.waitForTimeout(1500);
    const ab = await page.evaluate(() => {
      const a = document.querySelector('#alertBox');
      return a ? { display: getComputedStyle(a).display, text: a.innerText.replace(/\s+/g, ' ').slice(0, 120) } : null;
    });
    console.log('alertBox:', JSON.stringify(ab));
    // đóng modal, bấm search chủ động
    const closeBtn = page.locator('#alertBox .close');
    if (await closeBtn.count() && ab && ab.display === 'block') {
      await closeBtn.first().click();
      await page.waitForTimeout(600);
      console.log('đã đóng alertBox');
    }
    const respP2 = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 15000 }).catch(() => null);
    await page.locator('#btn').click();
    const r2 = await respP2;
    console.log('search sau chọn AGI:', r2 ? r2.status() : 'none');
    await page.waitForTimeout(1500);

    // chọn lại ALL | Tất cả qua UI
    await toggle.click();
    await page.waitForTimeout(600);
    const respP3 = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 15000 }).catch(() => null);
    await page.locator('.bootstrap-select:has(#dvi_qly_tim) li', { hasText: 'ALL | Tất cả' }).first().click();
    const r3 = await respP3;
    console.log('chọn lại ALL:', r3 ? r3.status() : 'none', '| val:', JSON.stringify(await page.locator('#dvi_qly_tim').inputValue()));

    console.log('=== P5.3: các ô khác (bien_xe, so_khung, so_may, ma_kh_tim) ký tự đặc biệt ===');
    await goSearch();
    await page.locator('#bien_xe').fill("30A-123.45 !@#'");
    await page.locator('#so_khung').fill('<b>&"x"</b>');
    await page.locator('#so_may').fill('🚗' + 'X'.repeat(200));
    await page.locator('#ma_kh_tim').fill("!@#$%&*(), '\"><&");
    const respP4 = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 20000 }).catch(() => null);
    await page.locator('#btn').click();
    const r4 = await respP4;
    console.log('search:', r4 ? r4.status() : 'none');
    await page.waitForTimeout(1500);
    const g = await page.evaluate(() => document.querySelector('#Gr_lke').innerText.replace(/\s+/g, ' ').slice(0, 120));
    console.log('grid:', g);
    console.log('pageErrors:', pageErrors.length, pageErrors);

    console.log('=== P5.4: sau search 0-kết-quả, đóng alertBox → grid vẫn "Không có dữ liệu"? ===');
    console.log('body empty text:', await page.evaluate(() => document.body.innerText.includes('Không có dữ liệu')));
  } catch (e) {
    console.error('PROBE5 LỖI:', e.message);
  } finally {
    await browser.close();
  }
})();