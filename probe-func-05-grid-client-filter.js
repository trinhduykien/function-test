/**
 * PROBE func-05-grid-client-filter — khám phá hành vi thật của /CategorySystem/Unit
 * - Grid client-side: 67 bản ghi, 10 dòng/trang, filter input.search-input (Enter)
 * - Quan sát: cấu trúc grid, phân trang, filter khớp 1 / không khớp, ký tự đặc biệt,
 *   F5 giữa chừng, aria-current, API responses.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await ctx.newPage();

  const apiHits = [];
  page.on('response', r => {
    const u = r.url();
    if (/Unit|CategorySystem/i.test(u) && !/\.(js|css|png|jpg|svg|woff|ico)/i.test(u)) {
      apiHits.push(`${r.status()} ${r.request().method()} ${u}`);
    }
  });

  await page.goto('https://uat-capdon.pjico.com.vn/CategorySystem/Unit', { waitUntil: 'load', timeout: 90000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());

  // --- HTML tổng quan ---
  const overview = await page.evaluate(() => {
    const input = document.querySelector('input.search-input');
    const tables = [...document.querySelectorAll('table')];
    const pag = document.querySelector('.pagination, [class*=pagination], [class*=pager]');
    return {
      hasSearchInput: !!input,
      searchInputHTML: input ? input.outerHTML.slice(0, 300) : null,
      tableCount: tables.length,
      firstTableClass: tables[0] ? tables[0].className : null,
      paginationHTML: pag ? pag.outerHTML.slice(0, 1500) : 'NO-PAGINATION-CONTAINER',
      bodyHasKhongCoDuLieu: document.body.innerText.includes('Không có dữ liệu'),
    };
  });
  console.log('OVERVIEW:', JSON.stringify(overview, null, 2));

  // --- Grid rows ---
  const getRows = () => page.evaluate(() => {
    // chọn bảng có tbody tr thực (bỏ qua bảng layout)
    const table = [...document.querySelectorAll('table')].find(t => t.querySelector('tbody tr'));
    if (!table) return null;
    const rows = [...table.querySelectorAll('tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim().slice(0, 120));
    return rows;
  });
  await page.waitForSelector('table tbody tr', { timeout: 20000 });
  let rows = await getRows();
  console.log('ROWS page1 count:', rows ? rows.length : 'null');
  console.log('ROWS page1[0..2]:', JSON.stringify(rows && rows.slice(0, 3)));
  console.log('ROWS page1 last:', JSON.stringify(rows && rows[rows.length - 1]));

  // --- Pagination chi tiết ---
  const pagInfo = await page.evaluate(() => {
    const el = document.querySelector('.pagination, [class*=pagination], [class*=pager]');
    if (!el) return null;
    const items = [...el.querySelectorAll('li, a, button, span')].map(n => ({
      tag: n.tagName, cls: n.className, text: (n.textContent || '').trim().slice(0, 20),
      aria: n.getAttribute('aria-current') || n.getAttribute('aria-label'),
    }));
    return { containerCls: el.className, items };
  });
  console.log('PAGINATION:', JSON.stringify(pagInfo, null, 2));

  // --- Tất cả page-item trên trang (có thể pagination không trong container trên) ---
  const pageItems = await page.evaluate(() =>
    [...document.querySelectorAll('.page-item, [class*=page-item], [class*=page-link]')].map(n => ({
      tag: n.tagName, cls: n.className, text: (n.textContent || '').trim().slice(0, 20),
      ariaCurrent: n.getAttribute('aria-current'), ariaLabel: n.getAttribute('aria-label'),
    }))
  );
  console.log('PAGE-ITEMS:', JSON.stringify(pageItems, null, 2));

  // --- Filter khớp 1 bản ghi ---
  const firstRowCells = await page.evaluate(() => {
    const table = [...document.querySelectorAll('table')].find(t => t.querySelector('tbody tr'));
    const tr = table ? table.querySelector('tbody tr') : null;
    return tr ? [...tr.querySelectorAll('td,th')].map(td => td.innerText.trim().slice(0, 60)) : null;
  });
  console.log('FIRST ROW CELLS:', JSON.stringify(firstRowCells));

  // lấy 1 mã đơn vị từ hàng đầu để filter
  const code = firstRowCells && (firstRowCells[1] || firstRowCells[0]);
  console.log('FILTER CODE tried:', code);

  async function tryFilter(value) {
    const inp = page.locator('input.search-input');
    await inp.fill('');
    await inp.fill(value);
    await inp.press('Enter');
    await page.waitForTimeout(600);
    const r = await getRows();
    const p = await page.evaluate(() =>
      [...document.querySelectorAll('.page-item, [class*=page-link]')].map(n => (n.textContent || '').trim() + (n.getAttribute('aria-current') ? '*' : '')).filter(Boolean)
    );
    return { rows: r, pag: p };
  }

  if (code) {
    const res = await tryFilter(code);
    console.log(`FILTER "${code}" → rows:`, JSON.stringify(res.rows && res.rows.length), JSON.stringify(res.rows && res.rows.slice(0, 2)));
    console.log('  pagination after filter:', JSON.stringify(res.pag));
  }

  // --- Filter không khớp ---
  const res2 = await tryFilter('ZZZKHONGCO12345689');
  console.log('FILTER nomatch → rows:', JSON.stringify(res2.rows));
  const emptyMsg = await page.evaluate(() => document.body.innerText.includes('Không có dữ liệu'));
  console.log('  has "Không có dữ liệu":', emptyMsg);

  // --- Xóa filter hồi phục ---
  const res3 = await tryFilter('');
  console.log('FILTER cleared → rows count:', res3.rows ? res3.rows.length : res3.rows);
  console.log('  pagination after clear:', JSON.stringify(res3.pag));

  // --- Ký tự đặc biệt ---
  for (const v of ["'\"<>&", '🎉🎉', 'Đơn vị kiểm toán ★']) {
    const r = await tryFilter(v);
    const gridVisible = await page.evaluate(() => !!document.querySelector('table'));
    console.log(`FILTER ${JSON.stringify(v)} → rows:`, JSON.stringify(r.rows && r.rows.length), 'grid still present:', gridVisible);
  }

  // --- 500 ký tự ---
  const long = 'a'.repeat(500);
  const r500 = await tryFilter(long);
  console.log('FILTER 500 chars → grid present:', await page.evaluate(() => !!document.querySelector('table')), 'rows:', JSON.stringify(r500.rows && r500.rows.length));

  // hồi phục sau 500 ký tự
  const rClear = await tryFilter('');
  console.log('After clear → rows:', rClear.rows ? rClear.rows.length : rClear.rows);

  // --- Click trang 2 ---
  const page2 = page.locator('.page-item, [class*=page-item]').filter({ hasText: /^2$/ }).first();
  const row1p1 = (await getRows())[0];
  await page2.click();
  await page.waitForTimeout(600);
  let rows2 = await getRows();
  const row1p2 = rows2 ? rows2[0] : null;
  console.log('PAGE2 first row:', JSON.stringify(row1p2), '| differs from page1 first:', row1p1 !== row1p2);
  const activeAfter2 = await page.evaluate(() =>
    [...document.querySelectorAll('.page-item, [class*=page-item]')].map(n => ({
      text: (n.textContent || '').trim().slice(0, 6), cls: n.className, aria: n.getAttribute('aria-current'),
    }))
  );
  console.log('PAGE-ITEMS after page2 click:', JSON.stringify(activeAfter2, null, 1));

  // --- F5 ở trang 2 (hoặc 3) ---
  // click trang 3 nếu có
  const p3 = page.locator('.page-item, [class*=page-item]').filter({ hasText: /^3$/ }).first();
  if (await p3.count()) {
    await p3.click().catch(e => console.log('p3 click err:', e.message));
    await page.waitForTimeout(400);
  }
  const rowsBeforeF5 = await getRows();
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('table tbody tr', { timeout: 30000 });
  const rowsAfterF5 = await getRows();
  const activeAfterF5 = await page.evaluate(() =>
    [...document.querySelectorAll('.page-item, [class*=page-item]')].map(n => ({
      text: (n.textContent || '').trim().slice(0, 6), cls: n.className,
    }))
  );
  console.log('F5: rowsBefore[0]:', JSON.stringify(rowsBeforeF5 && rowsBeforeF5[0]));
  console.log('F5: rowsAfter[0]:', JSON.stringify(rowsAfterF5 && rowsAfterF5[0]));
  console.log('F5: pagination active after reload:', JSON.stringify(activeAfterF5));

  // --- Click trang cuối ---
  const lastPage = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.page-item, [class*=page-item], [class*=page-link]')].map(n => (n.textContent || '').trim()).filter(t => /^\d+$/.test(t));
    return items.length ? Math.max(...items.map(Number)) : null;
  });
  console.log('LAST PAGE NUMBER:', lastPage);
  if (lastPage) {
    const lastBtn = page.locator('.page-item, [class*=page-item]').filter({ hasText: new RegExp(`^${lastPage}$`) }).first();
    await lastBtn.click();
    await page.waitForTimeout(600);
    const rowsLast = await getRows();
    console.log('LAST PAGE rows count:', rowsLast ? rowsLast.length : rowsLast);
    console.log('LAST PAGE rows:', JSON.stringify(rowsLast && rowsLast.slice(0, 2)));
    const activeLast = await page.evaluate(() =>
      [...document.querySelectorAll('.page-item, [class*=page-item]')].filter(n => /active|current/i.test(n.className)).map(n => (n.textContent || '').trim())
    );
    console.log('ACTIVE page on last:', JSON.stringify(activeLast));
  }

  // --- Nút ‹ › ---
  const navBtns = await page.evaluate(() =>
    [...document.querySelectorAll('.pagination li, .page-item, [class*=page-item]')].map(n => ({
      cls: n.className, text: (n.textContent || '').trim().slice(0, 10), aria: n.getAttribute('aria-label'),
    }))
  );
  console.log('NAV BTNS:', JSON.stringify(navBtns, null, 1));

  // --- API hits ---
  console.log('API HITS:', JSON.stringify(apiHits, null, 1));

  await browser.close();
})().catch(e => { console.error('PROBE ERROR:', e); process.exit(1); });