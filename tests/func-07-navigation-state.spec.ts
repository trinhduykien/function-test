/**
 * FUNC-07 — ĐIỀU HƯỚNG & TRẠNG THÁI TRÌNH DUYỆT (Back/Forward/Reload/Deep-link)
 * App UAT cấp đơn PJICO — https://uat-capdon.pjico.com.vn (session .auth/uat.json)
 *
 * CHIẾN LƯỢC (kết quả probe probe-func-07-navigation-state.js, probe2/3/4-func-07.js):
 * - Menu top render BẰNG JS sau load (~200-1100ms sau domcontentloaded) → mọi test phải
 *   waitForSelector('.dropdown-toggle.name-menu--item') thay vì count ngay.
 * - Menu cần viewport >= 1600x900 → test.use viewport 1680x950.
 * - Vào ContractCar/Search qua MENU THẬT: hover top "CẤP ĐƠN" → panel mở → click
 *   a[href="/ContractCar/Search"] (text "Cấp đơn xe ô tô"). Click đầu có thể bị nuốt
 *   nếu JS chưa bind → retry tối đa 3 lần.
 * - Trang lỗi: MỌI path lạ → rewrite về /ErrorHandler/Index, HTTP 200 (soft-404),
 *   HTML 188 byte chỉ chứa chữ "Trang thông báo lỗi", KHÔNG nút/link quay về,
 *   KHÔNG stack trace, title "Index". Back của trình duyệt vẫn hoạt động.
 * - Bảng /CategorySystem/Unit sau reload: fill 10 dòng ~1s SAU khi menu hiện
 *   (transient 1 dòng "Không có dữ liệu") → poll số dòng, không sleep cứng.
 *
 * BẢNG CA KIỂM TRA:
 * | TC  | Ca kiểm thử                                                        | Kỳ vọng (chuẩn) |
 * |-----|--------------------------------------------------------------------|-----------------|
 * | TC01| Menu điều hướng Home → /ContractCar/Search                         | URL đúng, trang render đầy (nút Tìm kiếm, input, menu) |
 * | TC02| goBack() từ trang tìm kiếm                                         | Về đúng /Home/Index, dashboard còn nguyên (chart, menu, title) |
 * | TC03| goForward() quay lại trang tìm kiếm                                | URL đúng, trang KHÔNG trắng (nút Tìm kiếm + menu + nội dung) |
 * | TC04| F5 reload /ContractCar/Search                                      | Render đầy, menu top xuất hiện sau JS |
 * | TC05| F5 reload /ClaimGeneral/Search                                    | Render đầy, nút "Tìm hồ sơ" xuất hiện |
 * | TC06| F5 reload /CategorySystem/Unit                                    | Render đầy, bảng có dữ liệu (10 dòng) sau khi JS load xong |
 * | TC07| Deep-link query rác /ContractCar/Search?xyz=1&test=<b>abc</b>       | 200, KHÔNG crash, KHÔNG render HTML từ query (không có <b>abc</b> trong DOM) |
 * | TC08| Query rác unicode/emoji/ký tự đặc biệt + reload giữ nguyên URL     | Vẫn render đầy; query được bảo toàn qua reload |
 * | TC09| URL không tồn tại (3 biến thể) → ErrorHandler                      | Trang thông báo lỗi, KHÔNG stack trace |
 * | TC10| Trang lỗi phải thân thiện: có nút/link quay về trang chủ          | Có ít nhất 1 link/nút đưa người dùng về app |
 * | TC11| HTTP status của URL không tồn tại                                 | Đúng chuẩn phải là 404 |
 * | TC12| goBack() từ trang lỗi                                              | Quay về trang app trước đó, render đầy |
 * | TC13| /Home/Index?foo=bar (query thừa)                                   | Dashboard render bình thường |
 * | TC14| Đổi hash #tab3 (in-page + goto trực tiếp)                          | Không reload/không phá trang; ghi nhận trạng thái tab |
 * | TC15| Deep-link thẳng /CategorySystem/Unit (không qua menu)              | Session còn → render đầy menu + dữ liệu |
 *
 * Lưu ý: app luôn có console.error do script src=/ErrorHandler/Index (finding cũ,
 * đã có spec riêng) → spec này KHÔNG fail theo console error.
 */
import { test, expect, type Page } from '@playwright/test';

const MENU_TOGGLE = '.dropdown-toggle.name-menu--item';
const WAIT_MENU = { timeout: 20000 };

test.use({ viewport: { width: 1680, height: 950 } });

/** Mở trang và chờ menu top render xong (menu render bằng JS sau load). */
async function openAndWaitMenu(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);
}

/** Điều hướng qua MENU THẬT: Home → hover "CẤP ĐƠN" → click link ContractCar/Search.
 *  Click đầu có thể bị nuốt nếu JS chưa bind → retry tối đa 3 lần. */
async function navToContractCarViaMenu(page: Page) {
  await openAndWaitMenu(page, '/Home/Index');
  const capDon = page.locator(MENU_TOGGLE, { hasText: 'CẤP ĐƠN' }).first();
  await expect(capDon).toBeVisible();
  const link = page.locator('a[href="/ContractCar/Search"]').first();
  for (let i = 0; i < 3; i++) {
    await capDon.hover();
    try {
      await link.click({ timeout: 8000 });
      await page.waitForURL('**/ContractCar/Search', { timeout: 8000 });
      break;
    } catch {
      // click bị nuốt / panel đóng — thử lại
    }
  }
  // nếu cả 3 lần fail → throw rõ ràng ở đây
  await expect(page).toHaveURL(/\/ContractCar\/Search/, { timeout: 10000 });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);
}

/** Chờ bảng có dữ liệu (bảng Unit fill ~1s SAU khi menu hiện — không sleep cứng). */
async function waitForGridRows(page: Page, minRows = 5) {
  await expect
    .poll(async () => page.locator('table tbody tr').count(), { timeout: 20000 })
    .toBeGreaterThanOrEqual(minRows);
}

// ---------------------------------------------------------------- TC01
test('TC01 — Menu điều hướng Home → /ContractCar/Search: URL đúng + trang render đầy', async ({ page }) => {
  test.setTimeout(120000);
  await navToContractCarViaMenu(page);

  await expect(page).toHaveURL(/\/ContractCar\/Search\/?$/);
  // render đầy: nút Tìm kiếm (btn-blue), có input, menu top, nội dung không trắng
  await expect(page.locator('button.btn-blue').first()).toBeVisible();
  const inputCount = await page.locator('input').count();
  expect(inputCount).toBeGreaterThan(0);
  const menuCount = await page.locator(MENU_TOGGLE).count();
  expect(menuCount).toBeGreaterThanOrEqual(5);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(300);
});

// ---------------------------------------------------------------- TC02
test('TC02 — goBack() từ trang tìm kiếm: về đúng trang chủ, dashboard còn nguyên', async ({ page }) => {
  test.setTimeout(120000);
  await navToContractCarViaMenu(page);

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);

  await expect(page).toHaveURL(/\/Home\/Index/);
  await expect(page).toHaveTitle(/Dashboard/);
  // dashboard còn nguyên: chart + tab + menu
  await expect(page.locator('#bar-chart-dt')).toBeAttached();
  await expect(page.locator('#tab3')).toBeAttached();
  const menuCount = await page.locator(MENU_TOGGLE).count();
  expect(menuCount).toBeGreaterThanOrEqual(5);
});

// ---------------------------------------------------------------- TC03
test('TC03 — goForward() quay lại trang tìm kiếm: render đầy, KHÔNG trắng trang', async ({ page }) => {
  test.setTimeout(120000);
  await navToContractCarViaMenu(page);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);

  await page.goForward({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);

  await expect(page).toHaveURL(/\/ContractCar\/Search/);
  await expect(page.locator('button.btn-blue').first()).toBeVisible();
  const inputCount = await page.locator('input').count();
  expect(inputCount).toBeGreaterThan(0);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(300);
  const menuCount = await page.locator(MENU_TOGGLE).count();
  expect(menuCount).toBeGreaterThanOrEqual(5);
});

// ---------------------------------------------------------------- TC04
test('TC04 — F5 reload /ContractCar/Search: render đầy, menu top xuất hiện', async ({ page }) => {
  test.setTimeout(120000);
  await openAndWaitMenu(page, '/ContractCar/Search');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);

  await expect(page).toHaveURL(/\/ContractCar\/Search/);
  await expect(page.locator('button.btn-blue').first()).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(300);
});

// ---------------------------------------------------------------- TC05
test('TC05 — F5 reload /ClaimGeneral/Search: render đầy, nút "Tìm hồ sơ" xuất hiện', async ({ page }) => {
  test.setTimeout(120000);
  await openAndWaitMenu(page, '/ClaimGeneral/Search');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);

  await expect(page).toHaveURL(/\/ClaimGeneral\/Search/);
  await expect(page.locator('button', { hasText: 'Tìm hồ sơ' }).first()).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(300);
});

// ---------------------------------------------------------------- TC06
test('TC06 — F5 reload /CategorySystem/Unit: render đầy, bảng có dữ liệu', async ({ page }) => {
  test.setTimeout(120000);
  await openAndWaitMenu(page, '/CategorySystem/Unit');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);

  await expect(page).toHaveURL(/\/CategorySystem\/Unit/);
  await waitForGridRows(page, 5);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(300);
});

// ---------------------------------------------------------------- TC07
test('TC07 — Deep-link query rác ?xyz=1&test=<b>abc</b>: không crash, không render HTML từ query', async ({ page }) => {
  test.setTimeout(120000);
  const resp = await page.goto('/ContractCar/Search?xyz=1&test=%3Cb%3Eabc%3C/b%3E', { waitUntil: 'domcontentloaded' });
  expect(resp).not.toBeNull();
  expect(resp!.status()).toBe(200);
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);

  // query không được render thô thành markup: không có phần tử <b>abc</b> trong DOM
  const rawBold = await page.locator('b', { hasText: 'abc' }).count();
  expect(rawBold, 'query test=<b>abc</b> bị render thành markup thật').toBe(0);
  const html = await page.content();
  expect(html, 'server phản hồi markup thô từ query').not.toContain('<b>abc</b>');
  // trang vẫn render đầy đủ
  await expect(page.locator('button.btn-blue').first()).toBeVisible();
  const inputCount = await page.locator('input').count();
  expect(inputCount).toBeGreaterThan(0);
});

// ---------------------------------------------------------------- TC08
test('TC08 — Query unicode/emoji/ký tự đặc biệt + reload: query bảo toàn, trang render đầy', async ({ page }) => {
  test.setTimeout(120000);
  const junkVal = encodeURIComponent('🎉 Tìm kiếm "đơn bảo hiểm" \'"><!@#$%&*()');
  const longVal = '!@#$%&*()'.repeat(25); // ~225 ký tự đặc biệt
  const path = `/ContractCar/Search?q=${junkVal}&long=${encodeURIComponent(longVal)}&vn=${encodeURIComponent('Tiếng Việt có dấu')}`;

  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(resp).not.toBeNull();
  expect(resp!.status()).toBe(200);
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);
  await expect(page.locator('button.btn-blue').first()).toBeVisible();

  // reload giữ nguyên query (so sánh giá trị DECODED — browser có thể re-encode) + vẫn render
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);
  const u = new URL(page.url());
  expect(u.pathname).toBe('/ContractCar/Search');
  expect(u.searchParams.get('q')).toBe('🎉 Tìm kiếm "đơn bảo hiểm" \'"><!@#$%&*()');
  expect(u.searchParams.get('long')).toBe(longVal);
  expect(u.searchParams.get('vn')).toBe('Tiếng Việt có dấu');
  await expect(page.locator('button.btn-blue').first()).toBeVisible();
  const inputCount = await page.locator('input').count();
  expect(inputCount).toBeGreaterThan(0);
});

// ---------------------------------------------------------------- TC09
test('TC09 — URL không tồn tại (3 biến thể) → ErrorHandler: có thông báo lỗi, KHÔNG stack trace', async ({ page }) => {
  test.setTimeout(120000);
  for (const p of ['/KhongTonTai999/Action', '/Home/KhongTonTai', '/xyzzy']) {
    await page.goto(p, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    // rơi vào trang thông báo lỗi (không phải trang trắng, không phải YSOD)
    await expect(page).toHaveURL(/ErrorHandler\/Index/);
    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length, `path ${p}: body không được trắng trơn`).toBeGreaterThan(0);
    expect(bodyText, `path ${p}: phải có thông báo lỗi`).toContain('thông báo lỗi');
    // KHÔNG lộ stack trace / chi tiết exception
    const html = (await page.content()).toLowerCase();
    for (const marker of ['stack trace', 'exception', 'server error', '.cs', 'at system.']) {
      expect(html, `path ${p}: không được lộ "${marker}"`).not.toContain(marker);
    }
  }
});

// ---------------------------------------------------------------- TC10
test('TC10 — Trang lỗi phải thân thiện: có nút/link quay về trang chủ', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/KhongTonTai999/Action', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect(page).toHaveURL(/ErrorHandler\/Index/);

  // Kỳ vọng chuẩn: người dùng bị mắc kẹt ở trang lỗi phải có đường quay về app
  // (link về trang chủ, nút "Quay lại"...) — bất kỳ link hay button nào cũng được.
  const links = await page.locator('a[href]').count();
  const buttons = await page.locator('button, input[type=button], input[type=submit]').count();
  expect(links + buttons, 'trang lỗi phải có ít nhất 1 nút/link để quay về app').toBeGreaterThan(0);
});

// ---------------------------------------------------------------- TC11
test('TC11 — HTTP status của URL không tồn tại phải là 404', async ({ page }) => {
  test.setTimeout(120000);
  const resp = await page.goto('/KhongTonTai999/Action', { waitUntil: 'domcontentloaded' });
  expect(resp).not.toBeNull();
  // Chuẩn HTTP: resource không tồn tại → 404 (giúp trình duyệt/monitor/API client
  // phân biệt được lỗi thay vì trả 200 "thành công" cho trang rác).
  expect(resp!.status()).toBe(404);
});

// ---------------------------------------------------------------- TC12
test('TC12 — goBack() từ trang lỗi: quay về trang app trước đó và render đầy', async ({ page }) => {
  test.setTimeout(120000);
  await openAndWaitMenu(page, '/ContractCar/Search');
  const urlBefore = page.url();

  await page.goto('/KhongTonTai999/Action', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/ErrorHandler\/Index/);

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);
  await expect(page).toHaveURL(/\/ContractCar\/Search/);
  expect(page.url()).toBe(urlBefore);
  await expect(page.locator('button.btn-blue').first()).toBeVisible();
});

// ---------------------------------------------------------------- TC13
test('TC13 — /Home/Index?foo=bar (query không dùng): dashboard render bình thường', async ({ page }) => {
  test.setTimeout(120000);
  const resp = await page.goto('/Home/Index?foo=bar', { waitUntil: 'domcontentloaded' });
  expect(resp).not.toBeNull();
  expect(resp!.status()).toBe(200);
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);

  await expect(page).toHaveURL(/\/Home\/Index\?foo=bar/);
  await expect(page).toHaveTitle(/Dashboard/);
  await expect(page.locator('#bar-chart-dt')).toBeAttached();
  await expect(page.locator('#tab3')).toBeAttached();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(300);
});

// ---------------------------------------------------------------- TC14
test('TC14 — Đổi hash #tab3: không phá trang; ghi nhận trạng thái tab', async ({ page }) => {
  test.setTimeout(120000);
  await openAndWaitMenu(page, '/Home/Index');

  // (f1) đổi hash in-page: KHÔNG reload, KHÔNG phá trang
  await page.evaluate(() => { window.location.hash = '#tab3'; });
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/Home\/Index#tab3/);
  await expect(page.locator(MENU_TOGGLE).first()).toBeVisible();
  const bodyAfterHash = await page.locator('body').innerText();
  expect(bodyAfterHash.trim().length).toBeGreaterThan(300);

  // ghi nhận: hash có kích hoạt tab #tab3 không?
  const tab3StateInPage = await page.evaluate(() => {
    const el = document.querySelector('#tab3');
    return el ? el.className : 'MISSING';
  });
  console.log('[GH I NHẬN] sau hash in-page, #tab3 className =', tab3StateInPage);

  // (f2) goto trực tiếp URL có hash — phải qua trang khác trước, vì goto cùng path
  // chỉ thêm hash là same-document navigation (response null, không reload)
  await openAndWaitMenu(page, '/CategorySystem/Unit');
  const resp = await page.goto('/Home/Index#tab3', { waitUntil: 'domcontentloaded' });
  expect(resp).not.toBeNull();
  expect(resp!.status()).toBe(200);
  await page.waitForSelector(MENU_TOGGLE, WAIT_MENU);
  await expect(page).toHaveTitle(/Dashboard/);
  const tab3StateDirect = await page.evaluate(() => {
    const el = document.querySelector('#tab3');
    return el ? el.className : 'MISSING';
  });
  console.log('[GH I NHẬN] goto /Home/Index#tab3, #tab3 className =', tab3StateDirect);
});

// ---------------------------------------------------------------- TC15
test('TC15 — Deep-link thẳng /CategorySystem/Unit (không qua menu): session còn → render đầy', async ({ page }) => {
  test.setTimeout(120000);
  await openAndWaitMenu(page, '/CategorySystem/Unit');

  await expect(page).toHaveURL(/\/CategorySystem\/Unit/);
  const menuCount = await page.locator(MENU_TOGGLE).count();
  expect(menuCount).toBeGreaterThanOrEqual(5);
  await waitForGridRows(page, 5);
  // không bị đá về login
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.slice(0, 300)).not.toMatch(/EMAIL|ĐĂNG NHẬP/);
});