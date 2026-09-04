/**
 * FUNC-06: Tìm nhanh chức năng — ca biên từ khóa (menu quick search trên /Home/Index)
 *
 * ĐỐI TƯỢNG: panel tìm nhanh mở bằng #pjMenuSearchToggle → ô nhập #pjMenuSearchInput,
 * kết quả render trong #pjMenuSearchResults dạng <a class="pj-menu-search-result" href="...">
 * (mỗi kết quả có .pj-menu-search-result-title + .pj-menu-search-result-meta + hint "Enter").
 *
 * HÀNH VI THẬT đã probe (probe-func-06-quick-search-edge.js, node trong d:/bore/13):
 *  - "cap don" KHÔNG dấu vẫn ra 10 kết quả như "cấp đơn" → app đã normalize dấu tiếng Việt.
 *  - "CẤP ĐƠN" in hoa ra kết quả như thường → case-insensitive.
 *  - Ký tự đặc biệt / chuỗi 300 ký tự / emoji / toàn khoảng trắng: 0 kết quả, KHÔNG crash, không pageerror.
 *  - "69" → 1 kết quả "Báo cáo doanh thu bảo hiểm CSSK (6901/6903)" (match substring hợp lý).
 *  - "  cấp   đơn  " khoảng trắng thừa vẫn ra 10 kết quả.
 *  - Xóa hết → 0 kết quả hiển thị trong dropdown.
 *  - Enter với kết quả đang chọn → điều hướng /ContractCar/Search; Enter khi 0 kết quả → ở lại trang.
 *  - Toggle: aria-expanded đổi true/false đúng; đóng xong mở lại được; Escape cũng đóng panel.
 *  - Tab từ ô nhập → focus vào kết quả đầu tiên (a.pj-menu-search-result).
 *
 * BẢNG CA KIỂM THỬ:
 *  | TC  | Từ khóa / hành động                      | Kỳ vọng (hệ thống chuẩn)                                 |
 *  | a   | "cap don" (không dấu)                    | Số kết quả == "cấp đơn" và >= 1 (không được 0 kết quả)  |
 *  | b1  | "CẤP ĐƠN" (in hoa)                       | Vẫn ra >= 1 kết quả, giống query thường                 |
 *  | b2  | "Cấp" (nửa trước)                        | >= 1 kết quả                                             |
 *  | b3  | "đơn" (nửa sau)                          | >= 1 kết quả                                             |
 *  | c1  | "!@#$%^&*()" (ký tự đặc biệt)            | 0 kết quả, không crash, không JS error                   |
 *  | c2  | Chuỗi 300 ký tự                          | 0 kết quả, không crash, không JS error                   |
 *  | c3  | Emoji "😀🚗🎯" + Enter                   | 0 kết quả; Enter không điều hướng, không crash           |
 *  | c4  | Số "69"                                  | Kết quả hợp lý (match "6901/6903"), không crash          |
 *  | c5  | "  cấp   đơn  " (khoảng trắng thừa)      | >= 1 kết quả như query sạch                              |
 *  | c6  | "xe ô tô cấp đơn" (đảo thứ tự từ)        | Vẫn match kết quả liên quan (>= 1)                      |
 *  | d   | Gõ rồi xóa hết                           | Dropdown 0 kết quả hiển thị, không giữ kết quả stale     |
 *  | e   | Click kết quả đầu → Back về trang chủ    | Điều hướng đúng /ContractCar/Search; sau Back ô trống/không stale |
 *  | f   | Toggle đóng panel → mở lại              | Đóng: input ẩn + aria-expanded=false; mở lại được        |
 *  | g1  | Enter với kết quả đang chọn              | Điều hướng đúng /ContractCar/Search                      |
 *  | g2  | Tab từ ô nhập                            | Focus vào kết quả đầu tiên, không nhảy control lạ       |
 *  | g3  | Enter khi 0 kết quả                      | Ở lại /Home/Index, không crash                           |
 *
 * KHÔNG bấm nút nghiệp vụ nào — chỉ tìm nhanh + điều hướng (click kết quả + Back là read-only navigation).
 */
import { expect, test, Page } from '@playwright/test';

const RESULTS = '#pjMenuSearchResults a.pj-menu-search-result';

/** Mở /Home/Index, bấm toggle mở ô tìm nhanh (retry click vì lần click đầu có thể bị nuốt). */
async function openQuickSearch(page: Page) {
  await page.goto('/Home/Index', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  const toggle = page.locator('#pjMenuSearchToggle');
  await toggle.waitFor({ state: 'visible', timeout: 30000 });
  const input = page.locator('#pjMenuSearchInput');
  for (let i = 0; i < 4; i++) {
    if (await input.isVisible()) return input;
    await toggle.click({ force: true }).catch(() => {});
    try {
      await input.waitFor({ state: 'visible', timeout: 2000 });
      return input;
    } catch { /* JS chưa bind — thử lại */ }
  }
  throw new Error('Không mở được ô tìm nhanh sau khi bấm #pjMenuSearchToggle');
}

/** Đếm kết quả đang hiển thị trong dropdown. */
async function visibleResultCount(page: Page) {
  return await page.locator(RESULTS).filter({ visible: true }).count();
}

/** Gõ từ khóa và chờ debounce (~500ms) cho kết quả render. */
async function typeQuery(page: Page, input: ReturnType<Page['locator']>, text: string) {
  await input.fill(text);
  await page.waitForTimeout(700);
}

test.beforeEach(() => { test.setTimeout(120000); });

test('a) "cap don" KHÔNG dấu ra kết quả tương đương có dấu', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'cấp đơn');
  const withAccent = await visibleResultCount(page);
  expect(withAccent).toBeGreaterThanOrEqual(1);

  await typeQuery(page, input, 'cap don');
  const withoutAccent = await visibleResultCount(page);
  // Kỳ vọng chuẩn: tìm kiếm phải xử lý dấu tiếng Việt — không dấu không được ra 0 kết quả
  expect(withoutAccent, '"cap don" không dấu ra 0 kết quả — search không normalize dấu tiếng Việt').toBeGreaterThanOrEqual(1);
  expect(withoutAccent).toBe(withAccent);
});

test('b1) "CẤP ĐƠN" IN HOA vẫn ra kết quả (case-insensitive)', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'CẤP ĐƠN');
  const n = await visibleResultCount(page);
  expect(n, 'Query in hoa ra 0 kết quả — search phân biệt hoa/thường').toBeGreaterThanOrEqual(1);
  await expect(page.locator(RESULTS).filter({ visible: true }).first())
    .toContainText('Cấp đơn xe ô tô');
});

test('b2) Từ khóa nửa trước "Cấp" ra kết quả', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'Cấp');
  expect(await visibleResultCount(page)).toBeGreaterThanOrEqual(1);
});

test('b3) Từ khóa nửa sau "đơn" ra kết quả', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'đơn');
  expect(await visibleResultCount(page)).toBeGreaterThanOrEqual(1);
});

test('c1) Ký tự đặc biệt !@#$%^&*() — 0 kết quả, không crash', async ({ page }) => {
  const jsErrors: string[] = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  const input = await openQuickSearch(page);
  await typeQuery(page, input, "!@#$%^&*()");
  expect(await visibleResultCount(page)).toBe(0);
  expect(jsErrors, 'App ném JS exception khi gõ ký tự đặc biệt').toEqual([]);
  // Trang vẫn sống: toggle vẫn phản hồi
  await expect(page.locator('#pjMenuSearchToggle')).toBeVisible();
});

test('c2) Chuỗi 300 ký tự — 0 kết quả, không crash', async ({ page }) => {
  const jsErrors: string[] = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'x'.repeat(300));
  expect(await visibleResultCount(page)).toBe(0);
  expect(jsErrors).toEqual([]);
});

test('c3) Emoji — 0 kết quả; Enter không điều hướng, không crash', async ({ page }) => {
  const jsErrors: string[] = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  const input = await openQuickSearch(page);
  await typeQuery(page, input, '😀🚗🎯');
  expect(await visibleResultCount(page)).toBe(0);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  // Không có kết quả đang chọn → Enter KHÔNG được điều hướng đi đâu cả
  expect(page.url()).toContain('/Home/Index');
  expect(jsErrors).toEqual([]);
});

test('c4) Số "69" — kết quả hợp lý (match 6901/6903), không crash', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, '69');
  const n = await visibleResultCount(page);
  expect(n).toBeGreaterThanOrEqual(1);
  await expect(page.locator(RESULTS).filter({ visible: true }).first()).toContainText('6901');
});

test('c5) Khoảng trắng thừa "  cấp   đơn  " vẫn ra kết quả', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'cấp đơn');
  const clean = await visibleResultCount(page);
  await typeQuery(page, input, '  cấp   đơn  ');
  const messy = await visibleResultCount(page);
  expect(messy, 'Khoảng trắng thừa làm mất kết quả').toBeGreaterThanOrEqual(1);
  expect(messy).toBe(clean);
});

test('c6) Từ khóa đảo thứ tự "xe ô tô cấp đơn" vẫn match', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'xe ô tô cấp đơn');
  expect(await visibleResultCount(page)).toBeGreaterThanOrEqual(1);
});

test('d) Gõ rồi xóa hết — dropdown đóng/rỗng đúng, không stale', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'cấp đơn');
  expect(await visibleResultCount(page)).toBeGreaterThanOrEqual(1);

  await input.fill('');
  await page.waitForTimeout(700);
  expect(await visibleResultCount(page), 'Xóa hết từ khóa nhưng dropdown vẫn còn kết quả stale').toBe(0);
});

test('e) Click kết quả đầu điều hướng /ContractCar/Search; Back về trang chủ không stale', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'cấp đơn');
  const first = page.locator(RESULTS).filter({ visible: true }).first();
  await expect(first).toContainText('Cấp đơn xe ô tô');
  await first.click();
  await page.waitForURL(/ContractCar\/Search/, { timeout: 30000 });

  // Back về trang chủ — ô tìm nhanh không được giữ chữ cũ / kết quả stale
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.waitForTimeout(1200);

  const qsInput = page.locator('#pjMenuSearchInput');
  let visibleNow = false;
  try { visibleNow = await qsInput.isVisible(); } catch { visibleNow = false; }

  if (visibleNow) {
    // Panel còn mở sau Back → giá trị phải rỗng và không còn kết quả cũ
    expect(await qsInput.inputValue(), 'Sau Back ô tìm vẫn giữ từ khóa cũ → kết quả stale').toBe('');
    expect(await visibleResultCount(page)).toBe(0);
  } else {
    // Panel đóng sau Back → mở lại phải là ô trống, không hiện kết quả cũ
    const toggle = page.locator('#pjMenuSearchToggle');
    await toggle.click({ force: true }).catch(() => {});
    await qsInput.waitFor({ state: 'visible', timeout: 10000 });
    expect(await qsInput.inputValue()).toBe('');
    expect(await visibleResultCount(page)).toBe(0);
  }
});

test('f) Toggle đóng panel rồi mở lại được, aria-expanded đúng', async ({ page }) => {
  const input = await openQuickSearch(page);
  const toggle = page.locator('#pjMenuSearchToggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  // Đóng
  await toggle.click({ force: true });
  await input.waitFor({ state: 'hidden', timeout: 10000 });
  expect(await input.isVisible()).toBe(false);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  // Mở lại
  await toggle.click({ force: true });
  await input.waitFor({ state: 'visible', timeout: 10000 });
  expect(await input.isVisible()).toBe(true);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

test('g1) Enter với kết quả đang chọn điều hướng đúng', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'cấp đơn');
  expect(await visibleResultCount(page)).toBeGreaterThanOrEqual(1);
  await page.keyboard.press('Enter');
  await page.waitForURL(/ContractCar\/Search/, { timeout: 30000 });
});

test('g2) Tab từ ô tìm nhanh focus vào kết quả đầu tiên', async ({ page }) => {
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'cấp đơn');
  expect(await visibleResultCount(page)).toBeGreaterThanOrEqual(1);
  await page.locator('#pjMenuSearchInput').click();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  const active = await page.evaluate(() => ({
    cls: document.activeElement ? document.activeElement.className : '',
    tag: document.activeElement ? document.activeElement.tagName : '',
  }));
  // Kỳ vọng chuẩn: Tab từ ô nhập chuyển focus vào danh sách kết quả (mục đang chọn)
  expect(active.tag).toBe('A');
  expect(active.cls).toContain('pj-menu-search-result');
});

test('g3) Enter khi 0 kết quả — ở lại trang, không crash', async ({ page }) => {
  const jsErrors: string[] = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  const input = await openQuickSearch(page);
  await typeQuery(page, input, 'zzzz-khong-ton-tai-zzzz');
  expect(await visibleResultCount(page)).toBe(0);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  expect(page.url(), 'Enter với từ khóa không match vẫn điều hướng').toContain('/Home/Index');
  expect(jsErrors).toEqual([]);
});