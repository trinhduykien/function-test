// PROBE 3 — Điều tra #alertBox sau khi đổi đơn vị, bootstrap-select UI, refresh, double-click
const { chromium } = require('@playwright/test');

const BASE = 'https://uat-capdon.pjico.com.vn';
const SEARCH_API = '**/ContractPublic/SearchResult';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message.slice(0, 200)));

  async function goSearch() {
    await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);
  }

  try {
    console.log('=== P3.1: selectOption native → alertBox nội dung gì? ===');
    await goSearch();
    const alertBoxBefore = await page.evaluate(() => {
      const a = document.querySelector('#alertBox');
      return a ? { cls: a.className, display: getComputedStyle(a).display, text: a.innerText.slice(0, 300) } : 'NO #alertBox';
    });
    console.log('alertBox TRƯỚC select:', JSON.stringify(alertBoxBefore));
    await page.locator('#dvi_qly_tim').selectOption('TCT');
    await page.waitForTimeout(1500);
    const alertBoxAfter = await page.evaluate(() => {
      const a = document.querySelector('#alertBox');
      return a ? { cls: a.className, display: getComputedStyle(a).display, text: a.innerText.slice(0, 400), html: a.outerHTML.slice(0, 600) } : 'NO #alertBox';
    });
    console.log('alertBox SAU select:', JSON.stringify(alertBoxAfter, null, 1));

    // Nếu modal mở → đóng bằng nút .close
    const closeBtn = page.locator('#alertBox .close');
    if (await closeBtn.count()) {
      console.log('close trong alertBox:', await closeBtn.count());
      await closeBtn.first().click().catch(e => console.log('click close err:', e.message.slice(0, 100)));
      await page.waitForTimeout(800);
    }

    console.log('=== P3.2: đổi đơn vị QUA UI bootstrap-select (đường user thật) ===');
    await goSearch();
    // tìm button dropdown-toggle có text chứa TCT (đơn vị)
    const dviBtn = page.locator('button.dropdown-toggle', { hasText: /TCT\s*\|/ }).first();
    console.log('dvi button visible:', await dviBtn.count());
    await dviBtn.click();
    await page.waitForTimeout(800);
    // liệt kê item trong dropdown mở
    const items = await page.evaluate(() => {
      const open = document.querySelector('.bootstrap-select .dropdown-menu.show, .dropdown-menu.show');
      if (!open) return 'NO OPEN MENU';
      return Array.from(open.querySelectorAll('li a, li span, .dropdown-item')).slice(0, 8).map(e => e.textContent.trim().slice(0, 60));
    });
    console.log('dropdown items:', JSON.stringify(items));
    // chọn item "AGI | AGI-An Giang"
    const item = page.locator('.dropdown-menu.show').getByText('AGI', { exact: false }).first();
    if (await page.locator('.dropdown-menu.show').count()) {
      await page.locator('.dropdown-menu.show li', { hasText: 'AGI' }).first().click();
      await page.waitForTimeout(1000);
      console.log('val dvi sau chọn AGI:', await page.locator('#dvi_qly_tim').inputValue());
      const ab = await page.evaluate(() => {
        const a = document.querySelector('#alertBox');
        return a ? { cls: a.className, text: a.innerText.slice(0, 200) } : null;
      });
      console.log('alertBox sau UI-select:', JSON.stringify(ab));
      // bấm tìm
      const respP = page.waitForResponse(SEARCH_API, { timeout: 20000 }).catch(() => null);
      await page.locator('#btn').click({ force: false }).catch(e => console.log('click btn err:', e.message.slice(0, 150)));
      const r = await respP;
      console.log('search resp:', r ? r.status() : 'none');
      await page.waitForTimeout(2000);
      console.log('grid:', (await page.evaluate(() => document.querySelector('#Gr_lke').innerText.replace(/\s+/g, ' ').slice(0, 150))));
    }

    console.log('=== P3.3: refresh sau khi tìm — filter giữ hay mất? ===');
    await goSearch();
    await page.locator('#so_hd_tim').fill('REFRESH-TEST-123');
    const respP2 = page.waitForResponse(SEARCH_API, { timeout: 20000 }).catch(() => null);
    await page.locator('#btn').click();
    await respP2;
    await page.waitForTimeout(1000);
    console.log('val trước refresh:', await page.locator('#so_hd_tim').inputValue());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    console.log('val sau refresh:', JSON.stringify(await page.locator('#so_hd_tim').inputValue()));
    console.log('URL:', page.url());

    console.log('=== P3.4: double-click nhanh 2 lần TÌM ===');
    await goSearch();
    const responses = [];
    page.on('response', r => { if (r.url().includes('SearchResult')) responses.push(r.status()); });
    await page.locator('#btn').click();
    await page.locator('#btn').click();
    await page.waitForTimeout(4000);
    console.log('responses:', responses, '| pageErrors:', pageErrors);
    console.log('grid:', (await page.evaluate(() => document.querySelector('#Gr_lke').innerText.replace(/\s+/g, ' ').slice(0, 100))));

    console.log('=== P3.5: datepicker có tồn tại? click ô ngày ===');
    await goSearch();
    await page.locator('#ngayd_timhd').click();
    await page.waitForTimeout(800);
    const dp = await page.evaluate(() => {
      const d = document.querySelector('.datepicker, .bootstrap-datetimepicker-widget, #ui-datepicker-div, .daterangepicker');
      return d ? { cls: d.className.slice(0, 80), visible: getComputedStyle(d).display !== 'none' } : 'NO DATEPICKER WIDGET';
    });
    console.log('datepicker widget:', JSON.stringify(dp));
    // blur với giá trị "32/13/2026"
    await page.locator('#ngayd_timhd').fill('32/13/2026');
    await page.locator('#ngayc_timhd').click(); // trigger blur
    await page.waitForTimeout(500);
    console.log('val "32/13/2026" sau blur:', await page.locator('#ngayd_timhd').inputValue());
  } catch (e) {
    console.error('PROBE3 LỖI:', e.message);
  } finally {
    await browser.close();
  }
})();