// PROBE 2 — Test hành vi biên trên form tìm kiếm /ContractCar/Search
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
  }

  async function clickSearch() {
    const respP = page.waitForResponse(SEARCH_API, { timeout: 20000 }).catch(() => null);
    await page.locator('#btn').click();
    const r = await respP;
    let status = r ? r.status() : 'NO-RESP';
    let body = '';
    if (r) body = (await r.text().catch(() => '')).slice(0, 300);
    return { status, body };
  }

  async function gridState() {
    return await page.evaluate(() => {
      const t = document.querySelector('#Gr_lke');
      const rows = t ? t.querySelectorAll('tbody tr').length : -1;
      const txt = t ? t.innerText.slice(0, 200) : 'NO TABLE';
      const alert = Array.from(document.querySelectorAll('.alert, .error, [class*=toast], .modal.show')).map(e => e.innerText.slice(0, 150)).filter(Boolean);
      return { rows, txt: txt.replace(/\s+/g, ' '), alert, bodyHasEmpty: document.body.innerText.includes('Không có dữ liệu') };
    });
  }

  try {
    await goSearch();
    console.log('--- CA 1: xoá hết ngày (trống toàn bộ) ---');
    await page.locator('#ngayd_timhd').fill('');
    await page.locator('#ngayc_timhd').fill('');
    let r = await clickSearch();
    console.log('status:', r.status, '| body:', r.body.slice(0, 200));
    await page.waitForTimeout(2500);
    console.log('grid:', JSON.stringify(await gridState()));
    console.log('pageErrors:', pageErrors.length);

    console.log('--- CA 2: ĐẾN TRƯỚC TỪ (10/08/2026 -> 01/08/2026) ---');
    await goSearch();
    await page.locator('#ngayd_timhd').fill('01/08/2026');
    await page.locator('#ngayc_timhd').fill('10/08/2026'); // đợi chút đã — đảo sau
    await page.locator('#ngayd_timhd').fill('10/08/2026');
    await page.locator('#ngayc_timhd').fill('01/08/2026');
    r = await clickSearch();
    console.log('status:', r.status, '| body:', r.body.slice(0, 200));
    await page.waitForTimeout(2500);
    console.log('grid:', JSON.stringify(await gridState()));

    console.log('--- CA 3: "abc" vào ô ngày ---');
    await goSearch();
    await page.locator('#ngayd_timhd').fill('abc');
    await page.locator('#ngayc_timhd').fill('xyz');
    r = await clickSearch();
    console.log('status:', r.status, '| body:', r.body.slice(0, 200));
    await page.waitForTimeout(2000);
    console.log('grid:', JSON.stringify(await gridState()));
    // giá trị ô sau khi bấm
    console.log('val ngayd sau tìm:', await page.locator('#ngayd_timhd').inputValue());
    console.log('pageErrors:', pageErrors.length);

    console.log('--- CA 4: ngày xa 2000/2100 ---');
    await goSearch();
    await page.locator('#ngayd_timhd').fill('01/01/2000');
    await page.locator('#ngayc_timhd').fill('31/12/2100');
    r = await clickSearch();
    console.log('status:', r.status, '| body:', r.body.slice(0, 150));
    await page.waitForTimeout(2500);
    console.log('grid:', JSON.stringify(await gridState()));

    console.log('--- CA 5: Số HĐ ký tự đặc biệt ---');
    await goSearch();
    await page.locator('#so_hd_tim').fill("!@#$%&*(), '\"><&");
    r = await clickSearch();
    console.log('status:', r.status, '| body:', r.body.slice(0, 200));
    await page.waitForTimeout(2000);
    console.log('grid:', JSON.stringify(await gridState()));
    // XSS check: chuỗi có bị render thành element không
    const xss = await page.evaluate(() => ({
      injected: !!document.querySelector('#Gr_lke') && document.querySelector('#Gr_lke').innerHTML.includes('<script'),
      bodyHasRaw: document.body.innerText.includes("!@#$%&*(), '\"><&") || document.body.innerText.includes('"><&'),
    }));
    console.log('xss-check:', JSON.stringify(xss));

    console.log('--- CA 6: Số HĐ 500 ký tự ---');
    await goSearch();
    await page.locator('#so_hd_tim').fill('A'.repeat(500));
    r = await clickSearch();
    console.log('status:', r.status);
    await page.waitForTimeout(2000);
    console.log('grid:', JSON.stringify(await gridState()));

    console.log('--- CA 7: Số HĐ unicode + emoji ---');
    await goSearch();
    await page.locator('#so_hd_tim').fill('HĐ-täo-🚗🚙-Tiếng Việt');
    r = await clickSearch();
    console.log('status:', r.status);
    await page.waitForTimeout(2000);
    console.log('grid:', JSON.stringify(await gridState()));

    console.log('--- CA 8: dropdown đơn vị cụ thể (TCT) ---');
    await goSearch();
    // selectpicker: thử select trực tiếp option TCT qua select native rồi bấm
    await page.locator('#dvi_qly_tim').selectOption('TCT');
    await page.waitForTimeout(300);
    console.log('val dvi:', await page.locator('#dvi_qly_tim').inputValue());
    r = await clickSearch();
    console.log('status:', r.status);
    await page.waitForTimeout(2500);
    console.log('grid:', JSON.stringify(await gridState()));

    console.log('--- CA 9: double-click nhanh ---');
    await goSearch();
    const respP1 = page.waitForResponse(SEARCH_API, { timeout: 20000 }).catch(() => null);
    await page.locator('#btn').dblclick();
    const r1 = await respP1;
    console.log('dblclick first resp:', r1 ? r1.status() : 'none');
    await page.waitForTimeout(3000);
    console.log('grid:', JSON.stringify(await gridState()));
    console.log('pageErrors tổng:', pageErrors);
    console.log('URL cuối:', page.url());
  } catch (e) {
    console.error('PROBE2 LỖI:', e.message);
  } finally {
    await browser.close();
  }
})();