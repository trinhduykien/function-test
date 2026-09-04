/**
 * ============================================================================
 * FUNCTIONAL TEST — func-05-grid-client-filter
 * Khu vực: Grid client-side + phân trang — Mã đơn vị (/CategorySystem/Unit)
 * App: UAT cấp đơn PJICO — https://uat-capdon.pjico.com.vn/CategorySystem/Unit
 *
 * BỐI CẢNH THỰC TẾ (đã xác minh bằng probe — probe-func-05-grid-client-filter.js):
 * - Server trả đủ 67 bản ghi "Mã đơn vị" (bootstrap-table, sidePagination client),
 *   client tự phân trang 10 dòng/trang; filter qua input.search-input, áp dụng khi Enter.
 * - Thanh phân trang: .fixed-table-pagination, .pagination-info "Showing X to Y of Z rows",
 *   li.page-item (số trang), li.page-pre (‹), li.page-next (›), class active đánh dấu trang hiện tại.
 * - Không match → tbody có 1 dòng "Không có dữ liệu".
 * - Hành vi ‹ › theo bootstrap-table mặc định (paginationLoop: true):
 *   › ở trang cuối wrap về trang 1, ‹ ở trang 1 wrap về trang cuối — kỳ vọng theo chuẩn thư viện.
 *
 * BẢNG CA KIỂM THỬ (một test = một ca):
 * | TC  | Ca kiểm thử | Kỳ vọng |
 * |-----|-------------|---------|
 * | TC01 | Load trang: 67 bản ghi, 10 dòng/trang | 10 dòng, info "Showing 1 to 10 of 67 rows", 7 trang, active=1 |
 * | TC02 | Filter khớp đúng 1 bản ghi ("AGI") → Enter | Grid còn đúng 1 dòng AGI-An Giang, info "of 1 rows"; xóa filter → đủ 10 dòng lại |
 * | TC03 | Filter không match ("ZZZNOPE...") | 1 dòng "Không có dữ liệu"; xóa → hồi phục 10 dòng |
 * | TC04 | Filter ký tự đặc biệt '"><& | Không crash, grid còn nguyên vẹn, "Không có dữ liệu"; xóa → hồi phục |
 * | TC05 | Filter emoji + unicode tiếng Việt | Không crash, xóa → hồi phục |
 * | TC06 | Filter chuỗi 500 ký tự | Không crash, grid không biến mất vĩnh viễn; xóa → hồi phục 10 dòng |
 * | TC07 | Click trang 2 | Dòng đầu trang 2 ≠ dòng đầu trang 1, active=2 |
 * | TC08 | Click trang cuối (7) | 7 dòng, info "Showing 61 to 67 of 67 rows", active=7 |
 * | TC09 | Nút › từ trang 1 → trang 2; nút ‹ quay lại | Trang đổi đúng, active theo |
 * | TC10 | Nút › ở trang cuối | Wrap về trang 1 (bootstrap-table paginationLoop mặc định) |
 * | TC11 | Filter tới 1 kết quả khi đang ở trang 5 | Phân trang thu gọn còn 1 trang duy nhất (không còn 7), active=1 |
 * | TC12 | Duyệt đủ 7 trang đếm bản ghi | 67 mã đơn vị duy nhất, không trùng, không mất |
 * | TC13 | Ổn định tổng số bản ghi giữa các lần load | Reload → vẫn "of 67 rows" |
 * | TC14 | F5 khi đang ở trang 3 | Grid còn đầy đủ 67 bản ghi, về trang 1 (phân trang client-side) |
 * | TC15 | Active state của page-item hiện tại | Trang nào đang xem → li tương ứng có class "active", các trang khác không |
 * | TC16 | Gõ KHÔNG Enter → không lọc; chuỗi chỉ khoảng trắng | Grid giữ nguyên 67 bản ghi |
 * | TC17 | Filter không phân biệt hoa/thường + bao quanh khoảng trắng | "agi" khớp AGI; " TNI " khớp TNI |
 *
 * AN TOÀN: toàn bộ test CHỈ-ĐỌC (filter/phân trang), không bấm "Tạo mới"/nút ghi dữ liệu nào.
 * ============================================================================
 */
import { test, expect, Page } from '@playwright/test';

const UNIT_URL = '/CategorySystem/Unit';

/** Bảng dữ liệu: bảng đầu tiên có tbody tr (bỏ qua bảng layout). */
async function getRows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const table = [...document.querySelectorAll('table')].find((t) => t.querySelector('tbody tr'));
    if (!table) return [];
    return [...table.querySelectorAll('tbody tr')].map((tr) =>
      (tr.textContent || '').replace(/\s+/g, ' ').trim(),
    );
  });
}

/** Text của ".pagination-info" vd "Showing 1 to 10 of 67 rows". */
function pollInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.pagination-info');
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  });
}

/** Số trang hiện tại đang active (text của li.page-item.active). */
function pollActivePage(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.fixed-table-pagination .pagination li.page-item.active');
    return el ? (el.textContent || '').trim() : '';
  });
}

/** Toàn bộ số nút trang (loại trừ ‹ ›). */
function pollPageNumbers(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.fixed-table-pagination .pagination li.page-item')]
      .map((li) => (li.textContent || '').trim())
      .filter((t) => /^\d+$/.test(t)),
  );
}

/** Vào trang Unit, chờ grid có dữ liệu thật (tbody > 1 dòng hoặc dòng có dữ liệu). */
async function gotoUnit(page: Page) {
  await page.goto(UNIT_URL, { waitUntil: 'load' });
  await expect
    .poll(
      async () => (await getRows(page)).filter((r) => r.length > 0 && !r.includes('Không có dữ liệu')).length,
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
}

/** Nhập filter + Enter, KHÔNG tự assertion — test tự assert với expect.poll. */
async function applyFilter(page: Page, value: string) {
  const inp = page.locator('input.search-input');
  await inp.fill('');
  await inp.fill(value);
  await inp.press('Enter');
}

/** Bấm nút số trang N (aria-label "to page N"). */
async function clickPage(page: Page, n: number) {
  await page
    .locator(`.fixed-table-pagination .pagination li.page-item a[aria-label="to page ${n}"]`)
    .click();
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000);
});

// ---------------------------------------------------------------------------
// TC01 — Load: 67 bản ghi, 10 dòng/trang, 7 trang, active=1
// ---------------------------------------------------------------------------
test('TC01: grid load 67 bản ghi, 10 dòng/trang, 7 trang, active=1', async ({ page }) => {
  await gotoUnit(page);

  const rows = await getRows(page);
  expect(rows.length, 'Trang 1 phải có đúng 10 dòng dữ liệu').toBe(10);
  // 67 bản ghi → 7 trang (ceil(67/10))
  await expect.poll(async () => pollPageNumbers(page), { timeout: 10_000 }).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  await expect.poll(async () => pollActivePage(page)).toBe('1');
  await expect
    .poll(async () => pollInfo(page))
    .toContain('Showing 1 to 10 of 67 rows');
});

// ---------------------------------------------------------------------------
// TC02 — Filter khớp đúng 1 bản ghi; xóa filter hồi phục
// ---------------------------------------------------------------------------
test('TC02: filter "AGI" khớp 1 bản ghi, xóa filter hồi phục đủ 10 dòng', async ({ page }) => {
  await gotoUnit(page);

  await applyFilter(page, 'AGI');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(1);
  const rows = await getRows(page);
  expect(rows[0], 'Dòng còn lại phải là bản ghi AGI-An Giang').toContain('AGI-An Giang');
  await expect.poll(async () => pollInfo(page)).toContain('Showing 1 to 1 of 1 rows');

  // Xóa filter → Enter → đủ 10 dòng lại
  await applyFilter(page, '');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(10);
  await expect.poll(async () => pollInfo(page)).toContain('Showing 1 to 10 of 67 rows');
});

// ---------------------------------------------------------------------------
// TC03 — Filter không match → "Không có dữ liệu"; xóa → hồi phục
// ---------------------------------------------------------------------------
test('TC03: filter không match hiển thị "Không có dữ liệu", xóa hồi phục', async ({ page }) => {
  await gotoUnit(page);

  await applyFilter(page, 'ZZZKHONGTONTAI999881');
  await expect.poll(async () => getRows(page), { timeout: 10_000 }).toEqual(['Không có dữ liệu']);

  await applyFilter(page, '');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(10);
});

// ---------------------------------------------------------------------------
// TC04 — Ký tự đặc biệt '"><& — không crash, hồi phục được
// ---------------------------------------------------------------------------
test('TC04: filter ký tự đặc biệt không crash grid, xóa là hồi phục', async ({ page }) => {
  await gotoUnit(page);

  await applyFilter(page, `'"><&`);
  // Grid không biến mất, không crash: tbody vẫn render (thông báo không có dữ liệu)
  await expect.poll(async () => getRows(page), { timeout: 10_000 }).toEqual(['Không có dữ liệu']);
  // Ô search vẫn còn và tương tác được
  await expect(page.locator('input.search-input')).toBeVisible();

  // Xóa → hồi phục
  await applyFilter(page, '');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(10);
});

// ---------------------------------------------------------------------------
// TC05 — Emoji + unicode tiếng Việt — không crash, hồi phục
// ---------------------------------------------------------------------------
test('TC05: filter emoji/unicode không crash, xóa là hồi phục', async ({ page }) => {
  await gotoUnit(page);

  await applyFilter(page, '🎉 Đơn vị kiểm toán ★');
  await expect.poll(async () => getRows(page), { timeout: 10_000 }).toEqual(['Không có dữ liệu']);

  await applyFilter(page, '');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(10);
});

// ---------------------------------------------------------------------------
// TC06 — Chuỗi 500 ký tự — không crash, grid không biến mất vĩnh viễn
// ---------------------------------------------------------------------------
test('TC06: filter chuỗi 500 ký tự không crash, xóa là hồi phục', async ({ page }) => {
  await gotoUnit(page);

  await applyFilter(page, 'a'.repeat(500));
  await expect.poll(async () => getRows(page), { timeout: 10_000 }).toEqual(['Không có dữ liệu']);
  // Grid container vẫn tồn tại trong DOM
  expect(await page.locator('.fixed-table-pagination').count()).toBeGreaterThan(0);

  await applyFilter(page, '');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(10);
});

// ---------------------------------------------------------------------------
// TC07 — Click trang 2: dòng thay đổi, active=2
// ---------------------------------------------------------------------------
test('TC07: click trang 2 → dữ liệu đổi, active=2', async ({ page }) => {
  await gotoUnit(page);
  const firstRowPage1 = (await getRows(page))[0];

  await clickPage(page, 2);
  await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe('2');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(10);
  const firstRowPage2 = (await getRows(page))[0];
  expect(firstRowPage2, 'Dòng đầu trang 2 phải khác dòng đầu trang 1').not.toBe(firstRowPage1);

  // về trang 1
  await clickPage(page, 1);
  await expect.poll(async () => pollActivePage(page)).toBe('1');
  expect((await getRows(page))[0]).toBe(firstRowPage1);
});

// ---------------------------------------------------------------------------
// TC08 — Trang cuối (7): 7 dòng, info đúng, active=7
// ---------------------------------------------------------------------------
test('TC08: trang cuối (7) có 7 dòng, info "Showing 61 to 67 of 67 rows"', async ({ page }) => {
  await gotoUnit(page);

  await clickPage(page, 7);
  await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe('7');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(7);
  await expect.poll(async () => pollInfo(page)).toContain('Showing 61 to 67 of 67 rows');
});

// ---------------------------------------------------------------------------
// TC09 — Nút › từ trang 1 → trang 2; nút ‹ → về trang 1
// ---------------------------------------------------------------------------
test('TC09: nút ‹ › chuyển trang đúng chiều, active theo', async ({ page }) => {
  await gotoUnit(page);

  await page.locator('.fixed-table-pagination .pagination li.page-next a').click();
  await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe('2');

  await page.locator('.fixed-table-pagination .pagination li.page-pre a').click();
  await expect.poll(async () => pollActivePage(page)).toBe('1');
});

// ---------------------------------------------------------------------------
// TC10 — › ở trang cuối: bootstrap-table mặc định paginationLoop=true → wrap về trang 1
// (Ghi nhận như observation UX: hành vi chuẩn của thư viện, không phải bug app)
// ---------------------------------------------------------------------------
test('TC10: nút › ở trang cuối wrap về trang 1 (paginationLoop bootstrap-table)', async ({ page }) => {
  await gotoUnit(page);

  await clickPage(page, 7);
  await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe('7');

  await page.locator('.fixed-table-pagination .pagination li.page-next a').click();
  await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe('1');
  // Grid vẫn nguyên vẹn 67 bản ghi sau wrap
  await expect.poll(async () => pollInfo(page)).toContain('Showing 1 to 10 of 67 rows');
});

// ---------------------------------------------------------------------------
// TC11 — Filter tới 1 kết quả khi đang ở trang 5 → phân trang thu gọn còn 1 trang
// ---------------------------------------------------------------------------
test('TC11: filter 1 kết quả khi ở trang 5 → phân trang thu còn đúng 1 trang', async ({ page }) => {
  await gotoUnit(page);

  await clickPage(page, 5);
  await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe('5');

  await applyFilter(page, 'AGI');
  // Không còn 7 trang — chỉ còn 1 trang số, active=1
  await expect.poll(async () => pollPageNumbers(page), { timeout: 10_000 }).toEqual(['1']);
  await expect.poll(async () => pollActivePage(page)).toBe('1');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(1);
  await expect.poll(async () => pollInfo(page)).toContain('Showing 1 to 1 of 1 rows');

  // xóa filter → 7 trang trở lại
  await applyFilter(page, '');
  await expect.poll(async () => pollPageNumbers(page), { timeout: 10_000 }).toEqual(['1', '2', '3', '4', '5', '6', '7']);
});

// ---------------------------------------------------------------------------
// TC12 — Duyệt đủ 7 trang: 67 mã đơn vị duy nhất, không trùng, không mất
// ---------------------------------------------------------------------------
test('TC12: duyệt 7 trang đủ 67 bản ghi duy nhất, không trùng lặp', async ({ page }) => {
  await gotoUnit(page);

  const codes: string[] = [];
  for (let p = 1; p <= 7; p++) {
    await clickPage(page, p);
    await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe(String(p));
    const rows = await getRows(page);
    const expectedCount = p < 7 ? 10 : 7; // 6 trang x 10 + trang cuối 7 = 67
    expect(rows.length, `Trang ${p} phải có ${expectedCount} dòng`).toBe(expectedCount);
    rows.forEach((r) => codes.push(r.split(' ')[0]));
  }
  expect(new Set(codes).size, '67 bản ghi duy nhất, không trùng, không mất').toBe(67);
});

// ---------------------------------------------------------------------------
// TC13 — Ổn định tổng số bản ghi giữa các lần load
// ---------------------------------------------------------------------------
test('TC13: tổng 67 bản ghi ổn định qua lần load thứ hai (reload)', async ({ page }) => {
  await gotoUnit(page);
  await expect.poll(async () => pollInfo(page), { timeout: 10_000 }).toContain('of 67 rows');

  await page.reload({ waitUntil: 'load' });
  await expect
    .poll(
      async () => (await getRows(page)).filter((r) => r.length > 0 && !r.includes('Không có dữ liệu')).length,
      { timeout: 30_000 },
    )
    .toBe(10);
  await expect.poll(async () => pollInfo(page), { timeout: 10_000 }).toContain('Showing 1 to 10 of 67 rows');
});

// ---------------------------------------------------------------------------
// TC14 — F5 khi đang ở trang 3: grid còn đầy đủ dữ liệu, về trang 1
// (phân trang client-side không lưu state — kỳ vọng hợp lý: reset về trang 1,
//  quan trọng là KHÔNG mất dữ liệu / KHÔNG trắng grid)
// ---------------------------------------------------------------------------
test('TC14: F5 ở trang 3 → về trang 1, grid vẫn đủ 67 bản ghi', async ({ page }) => {
  await gotoUnit(page);

  await clickPage(page, 3);
  await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe('3');

  await page.reload({ waitUntil: 'load' });
  // Grid KHÔNG trắng: dữ liệu quay lại đầy đủ (không kẹt "Không có dữ liệu")
  await expect
    .poll(
      async () => (await getRows(page)).filter((r) => r.length > 0 && !r.includes('Không có dữ liệu')).length,
      { timeout: 30_000 },
    )
    .toBe(10);
  await expect.poll(async () => pollInfo(page), { timeout: 10_000 }).toContain('Showing 1 to 10 of 67 rows');
  await expect.poll(async () => pollActivePage(page)).toBe('1');
});

// ---------------------------------------------------------------------------
// TC15 — Active state của page-item hiện tại
// ---------------------------------------------------------------------------
test('TC15: page-item hiện tại có class active, các trang khác không', async ({ page }) => {
  await gotoUnit(page);

  await clickPage(page, 3);
  await expect.poll(async () => pollActivePage(page), { timeout: 10_000 }).toBe('3');

  const state = await page.evaluate(() =>
    [...document.querySelectorAll('.fixed-table-pagination .pagination li.page-item')].map((li) => ({
      text: (li.textContent || '').trim(),
      active: li.classList.contains('active'),
    })),
  );
  const numbers = state.filter((s) => /^\d+$/.test(s.text));
  expect(numbers.filter((s) => s.active), 'Đúng 1 trang active là trang 3').toEqual([{ text: '3', active: true }]);
});

// ---------------------------------------------------------------------------
// TC16 — Gõ KHÔNG Enter → không lọc; chuỗi chỉ khoảng trắng → không lọc
// ---------------------------------------------------------------------------
test('TC16: gõ không Enter thì grid không lọc; chuỗi chỉ khoảng trắng coi như không filter', async ({ page }) => {
  await gotoUnit(page);

  // Gõ từ khóa mà kết quả KHÔNG nằm trong 10 dòng đầu (TNI ở trang 5) nhưng KHÔNG Enter
  await page.locator('input.search-input').fill('TNI');
  await page.waitForTimeout(1200); // chờ xem có auto-filter không
  expect((await getRows(page)).length, 'Không Enter → grid vẫn 10 dòng (chưa lọc)').toBe(10);
  await expect.poll(async () => pollInfo(page)).toContain('Showing 1 to 10 of 67 rows');

  // Chuỗi chỉ khoảng trắng + Enter → không lọc (không match rỗng, không trắng grid)
  await applyFilter(page, '   ');
  await expect
    .poll(async () => (await getRows(page)).length, { timeout: 10_000 })
    .toBe(10);
  await expect.poll(async () => pollInfo(page)).toContain('Showing 1 to 10 of 67 rows');
});

// ---------------------------------------------------------------------------
// TC17 — Filter không phân biệt hoa/thường, trim khoảng trắng bao quanh
// ---------------------------------------------------------------------------
test('TC17: filter hoa/thường khớp nhau, khoảng trắng bao quanh được trim', async ({ page }) => {
  await gotoUnit(page);

  // "agi" thường phải khớp bản ghi "AGI-An Giang" (tìm kiếm client không phân biệt hoa/thường)
  // Poll theo NỘI DUNG dòng (không chỉ đếm — tránh pass nhờ dữ liệu filter cũ chưa kịp thay đổi)
  await applyFilter(page, 'agi');
  await expect
    .poll(async () => (await getRows(page))[0] || '', { timeout: 10_000 })
    .toContain('AGI-An Giang');
  expect((await getRows(page)).length).toBe(1);

  // " TNI " có khoảng trắng 2 đầu vẫn khớp
  await applyFilter(page, ' TNI ');
  await expect
    .poll(async () => (await getRows(page))[0] || '', { timeout: 10_000 })
    .toContain('TNI-Tây Ninh');
  expect((await getRows(page)).length).toBe(1);
});