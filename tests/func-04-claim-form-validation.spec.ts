/**
 * FUNC-04 — VALIDATION FORM BỒI THƯỜNG + MODAL LỖI QUYỀN
 * Trang: /ClaimGeneral/Search và /ClaimGeneral/ObjectSearch (UAT cấp đơn PJICO)
 *
 * CHIẾN LƯỢC (từ probe probe-func-04-claim-form-validation.js):
 *  - Tài khoản kientd.pjico KHÔNG có quyền "Xử lý bồi thường":
 *    bấm "Tìm hồ sơ" trên /ClaimGeneral/Search luôn hiện modal #alertBox
 *    "Thông báo" với message lỗi quyền — hành vi ĐÚNG của UI.
 *  - Modal #alertBox: .modal-header (title "Thông báo" + nút × button.close[data-dismiss=modal]),
 *    nội dung trong .body-alert p (KHÔNG có .modal-body chuẩn bootstrap).
 *  - /ClaimGeneral/ObjectSearch: bấm "Tìm đối tượng" (button.btn-square.btn-sec) —
 *    form rỗng → "Phải nhập số hợp đồng" (validation client, đúng);
 *    SO_HD có giá trị → gọi API tìm và báo "Khong tim thay theo dieu kien tim kiem".
 *  - LƯU Ý ỔN ĐỊNH: hover chuột qua navbar sẽ mở pj-menu-panel chặn pointer events
 *    → trước mỗi lần bấm nút tìm, di chuột về giữa trang (400,500) để panel hover-out đóng lại.
 *
 * BẢNG CA KIỂM THỬ:
 * ── /ClaimGeneral/Search (tiền tố s) ──
 *  s01  Form hiển thị đủ các ô (#so_hs, #so_hd, #ngayd, #ngayc, select #ttrang/#dvi_sl/#ma_nv) + nút "Tìm hồ sơ"
 *  s02  Bấm "Tìm hồ sơ" form RỖNG → modal "Thông báo" hiện + message lỗi quyền (hành vi đúng)
 *  s03  Nội dung message lỗi quyền KHÔNG bị cắt (scrollHeight/scrollWidth ≤ client)
 *  s04  ESC phải đóng modal (chuẩn bootstrap) — app không đóng → FAIL = finding
 *  s05  Đóng modal bằng × → modal ẩn, .modal-backdrop bị remove hết (không overlay mờ chặn trang)
 *  s06  Sau khi đóng, bấm "Tìm hồ sơ" lần 2 → modal mở lại với cùng thông báo
 *  s07  Ký tự đặc biệt lành (!@#$%&*(), '"><, dấu tiếng Việt) vào #so_hd + #so_hs → modal quyền, không crash
 *  s08  500 ký tự vào #so_hd + #so_hs → input giữ đủ 500 ký tự, modal quyền, không crash
 *  s09  Emoji + unicode (Nhật, Hy Lạp) → modal quyền, không crash
 *  s10  Chuỗi "<script>alert(1)</script>" vào #so_hs → KỲ VỌNG modal quyền như mọi giá trị khác
 *       — app lại báo sai "Hết phiên làm việc" rồi redirect /Home/Login → FAIL = finding nghiêm trọng
 *  s11  Ngày rác ("not-a-date", "32/13/2025") vào #ngayd → không crash, modal quyền hiện
 *  s12  Enter vào #so_hd có giá trị → không crash, trang vẫn ở Search (không redirect)
 * ── /ClaimGeneral/ObjectSearch (tiền tố o) ──
 *  o01  Form hiển thị đủ các ô (#SO_HD, #ma_kh, #ten, #ngayd, #ngayc, #dvi_qly, #ma_nv) + nút "Tìm đối tượng" + 2 grid
 *  o02  Bấm "Tìm đối tượng" RỖNG → modal "Phải nhập số hợp đồng" (validation đúng)
 *  o03  ESC phải đóng modal này (chuẩn bootstrap) — app không đóng → FAIL = finding
 *  o04  Đóng × sạch backdrop; bấm lần 2 → modal mở lại cùng thông báo
 *  o05  Ký tự đặc biệt vào #SO_HD → không crash, modal thông báo tìm kiếm (không "Hết phiên")
 *  o06  500 ký tự vào #SO_HD (và #ma_kh, #ten) → không crash, modal thông báo
 *  o07  "<script>alert(1)</script>" vào #SO_HD → kỳ vọng như o05; app báo "Hết phiên" → FAIL = finding
 *  o08  #ma_kh + #ten đặc biệt cùng #SO_HD hợp lệ → không crash, modal thông báo
 *  o09  Enter vào #SO_HD có giá trị → không crash, trang sống, không redirect
 * ── Điều hướng (tiền tố n) ──
 *  n01  Reload giữa chừng /ClaimGeneral/Search → trang tải lại, không redirect login
 *  n02  Reload giữa chừng /ClaimGeneral/ObjectSearch → trang tải lại, không redirect login
 *  n03  Back/forward giữa 2 trang Search ↔ ObjectSearch → không lỗi, không redirect login
 */
import { test, expect, Page } from '@playwright/test';

const URL_SEARCH = '/ClaimGeneral/Search';
const URL_OBJECT = '/ClaimGeneral/ObjectSearch';

/** Regex message lỗi quyền (không dấu như server trả: "Chua duoc cap quyen ... chua co quyen") */
const RE_QUYEN = /chua duoc cap quyen/i;
const RE_BOI_THUONG = /bồi thường/i;

/** Di chuột về giữa trang để pj-menu-panel (mở do hover navbar) tự đóng, không chặn click */
async function diChuotRaGiuaTrang(page: Page) {
  await page.mouse.move(400, 500);
}

/** Chờ modal #alertBox mở và trả về locator chứa message */
async function choModalMo(page: Page, timeout = 15000) {
  const modal = page.locator('#alertBox');
  await expect(modal).toBeVisible({ timeout });
  return page.locator('#alertBox .body-alert p');
}

/** Đóng modal #alertBox bằng nút × (dùng dispatchEvent để chuột không bay qua navbar) */
async function dongModalBangX(page: Page) {
  await page.locator('#alertBox .close').dispatchEvent('click');
  await expect(page.locator('#alertBox')).not.toBeVisible({ timeout: 5000 });
}

/** Đảm bảo không bị đá về trang login (session thực tế còn sống) */
async function khongBiRedirectLogin(page: Page) {
  await expect(page.locator('#EMAIL')).toHaveCount(0);
}

test.describe.configure({ mode: 'parallel' });

// ─────────────────────────────────────────────────────────────────────────────
// /ClaimGeneral/Search — form + modal lỗi quyền
// ─────────────────────────────────────────────────────────────────────────────

test('s01 — Form Search hiển thị đủ các ô tìm và nút "Tìm hồ sơ"', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await khongBiRedirectLogin(page);

  // Các ô tìm chính hiện diện và nhìn thấy
  for (const id of ['so_hs', 'so_hd', 'ngayd', 'ngayc']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  // Select tiêu chí
  await expect(page.locator('#ttrang')).toBeVisible();
  await expect(page.locator('#dvi_sl')).toBeVisible();
  await expect(page.locator('#ma_nv')).toBeVisible();
  // Nút "Tìm hồ sơ"
  const btn = page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' });
  await expect(btn).toHaveCount(1);
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
});

test('s02 — Bấm "Tìm hồ sơ" form rỗng → modal "Thông báo" hiện message lỗi quyền', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await khongBiRedirectLogin(page);

  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();

  // Modal hiện, header "Thông báo", có nút × (button.close data-dismiss=modal)
  const modal = page.locator('#alertBox');
  await expect(modal).toBeVisible({ timeout: 15000 });
  await expect(modal.locator('.modal-title')).toContainText('Thông báo');
  const closeBtn = modal.locator('button.close[data-dismiss="modal"]');
  await expect(closeBtn).toBeVisible();

  // Message lỗi quyền đầy đủ: nêu nghiệp vụ bị từ chối
  const msg = modal.locator('.body-alert p');
  await expect(msg).toBeVisible();
  const text = (await msg.innerText()).trim();
  expect(text, `Message phải chứa thông báo chưa cấp quyền, thực tế: "${text}"`).toMatch(RE_QUYEN);
  expect(text, `Message phải nêu nghiệp vụ bồi thường, thực tế: "${text}"`).toMatch(RE_BOI_THUONG);
});

test('s03 — Message lỗi quyền hiển thị đầy đủ, không bị cắt', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();
  const msg = await choModalMo(page);

  // Nội dung không bị cắt ngang/cắt dọc (word-wrap break-word phải wrap, không tràn)
  const dims = await msg.evaluate((e: HTMLElement) => ({
    sh: e.scrollHeight, ch: e.clientHeight, sw: e.scrollWidth, cw: e.clientWidth,
  }));
  // cho phép sai số 2px
  expect(dims.sh, `Message bị cắt dọc: scrollHeight=${dims.sh} > clientHeight=${dims.ch}`).toBeLessThanOrEqual(dims.ch + 2);
  expect(dims.sw, `Message bị cắt ngang: scrollWidth=${dims.sw} > clientWidth=${dims.cw}`).toBeLessThanOrEqual(dims.cw + 2);

  // Backdrop phải tồn tại khi modal mở (chuẩn bootstrap) và phủ toàn trang
  const backdrop = page.locator('.modal-backdrop');
  await expect(backdrop).toHaveCount(1);
  await expect(backdrop).toBeVisible();
});

test('s04 — ESC phải đóng modal Thông báo (chuẩn bootstrap)', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();
  await choModalMo(page);

  // Modal bootstrap chuẩn: keyboard ESC phải đóng modal (#alertBox là .modal có backdrop)
  await page.keyboard.press('Escape');
  await expect(page.locator('#alertBox'), 'ESC phải đóng modal Thông báo như modal bootstrap chuẩn')
    .not.toBeVisible({ timeout: 3000 });

  // Dọn dẹp nếu app không đóng
  await dongModalBangX(page).catch(() => {});
});

test('s05 — Đóng modal bằng × : modal ẩn, backdrop remove hết, không overlay mờ chặn trang', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();
  await choModalMo(page);

  // Bấm × bằng chuột (hành vi người dùng thật)
  await page.locator('#alertBox .close').click();
  await expect(page.locator('#alertBox')).not.toBeVisible({ timeout: 5000 });

  // Backdrop bị remove khỏi DOM (không để lại overlay mờ)
  await expect(page.locator('.modal-backdrop')).toHaveCount(0, { timeout: 5000 });
  // Body không còn khóa scroll (class modal-open của bootstrap bị bỏ)
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);
  await khongBiRedirectLogin(page);
});

test('s06 — Sau khi đóng modal, bấm "Tìm hồ sơ" lần 2 → modal mở lại với cùng thông báo', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  const btn = page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' });

  // Mở lần 1
  await diChuotRaGiuaTrang(page);
  await btn.click();
  const msg1 = await choModalMo(page);
  const text1 = (await msg1.innerText()).trim();
  expect(text1).toMatch(RE_QUYEN);

  // Đóng bằng × bằng chuột thật (giống người dùng)
  await page.locator('#alertBox .close').click();
  await expect(page.locator('#alertBox')).not.toBeVisible({ timeout: 5000 });

  // Mở lần 2 — di chuột về giữa trang trước để menu hover-panel không chặn click
  await diChuotRaGiuaTrang(page);
  await btn.click();
  const msg2 = await choModalMo(page);
  const text2 = (await msg2.innerText()).trim();
  expect(text2, 'Modal lần 2 phải hiện lại cùng thông báo lỗi quyền').toBe(text1);
});

test('s07 — Ký tự đặc biệt lành vào #so_hd + #so_hs → modal quyền, không crash', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#so_hd').fill(`!@#$%&*()'"><HĐ-001`);
  await page.locator('#so_hs').fill(`HS'."<>&%$#`);
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();

  const msg = await choModalMo(page);
  const text = (await msg.innerText()).trim();
  expect(text, `Nhập ký tự đặc biệt phải vẫn ra thông báo lỗi quyền, thực tế: "${text}"`).toMatch(RE_QUYEN);
  await khongBiRedirectLogin(page);
});

test('s08 — 500 ký tự vào #so_hd + #so_hs → giữ đủ, modal quyền, không crash', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#so_hd').fill('A'.repeat(500));
  await page.locator('#so_hs').fill('B'.repeat(500));
  await expect(page.locator('#so_hd')).toHaveValue('A'.repeat(500));
  await expect(page.locator('#so_hs')).toHaveValue('B'.repeat(500));

  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();
  const msg = await choModalMo(page);
  expect((await msg.innerText()).trim()).toMatch(RE_QUYEN);
  await khongBiRedirectLogin(page);
});

test('s09 — Emoji + unicode đa ngôn ngữ → modal quyền, không crash', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#so_hd').fill('🎉🎈 日本語 ελληνικά');
  await page.locator('#so_hs').fill('🎉 Trường hợp bồi thường — tiếng Việt 🎈');
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();

  const msg = await choModalMo(page);
  expect((await msg.innerText()).trim()).toMatch(RE_QUYEN);
  await khongBiRedirectLogin(page);
});

test('s10 — Chuỗi "<script>" vào #so_hs: kỳ vọng modal lỗi quyền như mọi giá trị khác', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#so_hs').fill('<script>alert(1)</script>');
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();

  // KỲ VỌNG ĐÚNG: với MỌI giá trị input, tài khoản không có quyền thì app phải báo
  // lỗi quyền (như các ca s07-s09). App chuẩn không được phép hiểu nhầm input đặc biệt
  // là "hết phiên" và đá người dùng về login trong khi session vẫn còn hiệu lực.
  const msg = await choModalMo(page);
  const text = (await msg.innerText()).trim();
  expect(text, `Kỳ vọng message lỗi quyền; app báo sai "${text}"`).toMatch(RE_QUYEN);
});

test('s11 — Ngày tháng rác ("not-a-date", "32/13/2025") vào #ngayd → không crash, modal quyền hiện', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#ngayd').fill('not-a-date');
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();
  const msg1 = await choModalMo(page);
  expect((await msg1.innerText()).trim()).toMatch(RE_QUYEN);
  await dongModalBangX(page);

  // Ngày không tồn tại trong lịch: 32/13/2025
  await page.locator('#ngayd').fill('32/13/2025');
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();
  const msg2 = await choModalMo(page);
  expect((await msg2.innerText()).trim(), 'Ngày rác không được làm crash app').toMatch(RE_QUYEN);
  await khongBiRedirectLogin(page);
});

test('s12 — Enter vào #so_hd có giá trị → không crash, trang vẫn ở Search', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#so_hd').fill('HĐ-123');
  await page.locator('#so_hd').press('Enter');
  // cho phép app một khoảng bounded ngắn để xử lý
  await page.waitForTimeout(1000);

  // Không crash: không redirect login, vẫn ở trang Search
  await expect(page).toHaveURL(/ClaimGeneral\/Search/);
  await khongBiRedirectLogin(page);
  // Input không mất giá trị, không crash trang
  await expect(page.locator('#so_hd')).toHaveValue('HĐ-123');
  await expect(page.locator('#so_hd')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// /ClaimGeneral/ObjectSearch — form tìm đối tượng
// ─────────────────────────────────────────────────────────────────────────────

test('o01 — Form ObjectSearch hiển thị đủ các ô tìm + nút "Tìm đối tượng" + grid', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await khongBiRedirectLogin(page);

  for (const id of ['SO_HD', 'ma_kh', 'ten', 'ngayd', 'ngayc']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator('#dvi_qly')).toBeVisible();
  await expect(page.locator('#ma_nv')).toBeVisible();

  const btn = page.locator('button', { hasText: 'Tìm đối tượng' });
  await expect(btn).toHaveCount(1);
  await expect(btn).toBeVisible();

  // 2 grid kết quả theo probe: #Gr_lke hiện sẵn;
  // #Gr_tthd_lke (thông tin hợp đồng) có trong DOM nhưng ẩn đến khi chọn bản ghi
  // → kỳ vọng đúng: tồn tại trong DOM (attached), không đòi visible
  await expect(page.locator('#Gr_tthd_lke')).toBeAttached();
});

test('o02 — Bấm "Tìm đối tượng" RỖNG → modal "Phải nhập số hợp đồng"', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await diChuotRaGiuaTrang(page);
  await page.locator('button', { hasText: 'Tìm đối tượng' }).click();

  const msg = await choModalMo(page);
  await expect(msg).toContainText('Phải nhập số hợp đồng');
  await khongBiRedirectLogin(page);
});

test('o03 — ESC phải đóng modal "Phải nhập số hợp đồng" (chuẩn bootstrap)', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await diChuotRaGiuaTrang(page);
  await page.locator('button', { hasText: 'Tìm đối tượng' }).click();
  await choModalMo(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('#alertBox'), 'ESC phải đóng modal như modal bootstrap chuẩn')
    .not.toBeVisible({ timeout: 3000 });

  await dongModalBangX(page).catch(() => {});
});

test('o04 — Đóng × sạch backdrop; bấm "Tìm đối tượng" lần 2 → modal mở lại', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  const btn = page.locator('button', { hasText: 'Tìm đối tượng' });

  await diChuotRaGiuaTrang(page);
  await btn.click();
  await choModalMo(page);

  // Đóng bằng × (chuột thật như người dùng)
  await page.locator('#alertBox .close').click();
  await expect(page.locator('#alertBox')).not.toBeVisible({ timeout: 5000 });
  await expect(page.locator('.modal-backdrop')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);

  // Bấm lần 2 → modal mở lại
  await diChuotRaGiuaTrang(page);
  await btn.click();
  const msg = await choModalMo(page);
  await expect(msg).toContainText('Phải nhập số hợp đồng');
});

test('o05 — Ký tự đặc biệt vào #SO_HD → không crash, modal thông báo tìm kiếm (không "Hết phiên")', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#SO_HD').fill(`!@#$%^&*()'\"<>HĐ 🎉`);
  await diChuotRaGiuaTrang(page);
  await page.locator('button', { hasText: 'Tìm đối tượng' }).click();

  const msg = await choModalMo(page, 20000);
  const text = (await msg.innerText()).trim();
  // Kỳ vọng: app thực hiện tìm và báo kết quả (không match → "Khong tim thay ..."),
  // tuyệt đối KHÔNG báo "Hết phiên làm việc" với input lành
  expect(text, `Kỳ vọng thông báo tìm kiếm, thực tế: "${text}"`).not.toMatch(/hết phiên/i);
  expect(text, 'Ký tự đặc biệt không được làm crash — phải có thông báo phản hồi')
    .toMatch(/tim thay|tìm thấy|kết quả/i);
  await khongBiRedirectLogin(page);
});

test('o06 — 500 ký tự vào #SO_HD/#ma_kh/#ten → không crash, có thông báo', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#SO_HD').fill('C'.repeat(500));
  await page.locator('#ma_kh').fill('D'.repeat(500));
  await page.locator('#ten').fill('E'.repeat(500));
  await expect(page.locator('#SO_HD')).toHaveValue('C'.repeat(500));

  await diChuotRaGiuaTrang(page);
  await page.locator('button', { hasText: 'Tìm đối tượng' }).click();

  const msg = await choModalMo(page, 20000);
  const text = (await msg.innerText()).trim();
  expect(text, `500 ký tự không được crash app, thực tế: "${text}"`).not.toMatch(/hết phiên/i);
  await khongBiRedirectLogin(page);
});

test('o07 — "<script>alert(1)</script>" vào #SO_HD: kỳ vọng báo tìm kiếm không match, không đá về login', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#SO_HD').fill('<script>alert(1)</script>');
  await diChuotRaGiuaTrang(page);
  await page.locator('button', { hasText: 'Tìm đối tượng' }).click();

  // KỲ VỌNG ĐÚNG: giá trị tìm kiếm bất kỳ (dù chứa thẻ script) cũng chỉ là chuỗi tìm kiếm —
  // app phải xử lý như o05 (báo không tìm thấy) và KHÔNG được hiểu nhầm là hết phiên
  const msg = await choModalMo(page, 20000);
  const text = (await msg.innerText()).trim();
  expect(text, `Kỳ vọng thông báo tìm kiếm như input thường; app báo sai "${text}"`).not.toMatch(/hết phiên/i);
});

test('o08 — #ma_kh + #ten ký tự đặc biệt, #SO_HD hợp lệ → không crash, có thông báo', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#SO_HD').fill('HD-TEST-001');
  await page.locator('#ma_kh').fill(`KH'"<>🎉`);
  await page.locator('#ten').fill(`Trần Văn A & <b>x</b> " '`);
  await diChuotRaGiuaTrang(page);
  await page.locator('button', { hasText: 'Tìm đối tượng' }).click();

  const msg = await choModalMo(page, 20000);
  const text = (await msg.innerText()).trim();
  expect(text, `Kỳ vọng thông báo tìm kiếm, thực tế: "${text}"`).not.toMatch(/hết phiên/i);
  // XSS không được render thành element thật
  await expect(page.locator('b:has-text("x")', { exact: true })).toHaveCount(0);
  await khongBiRedirectLogin(page);
});

test('o09 — Enter vào #SO_HD có giá trị → không crash, trang sống, không redirect', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#SO_HD').fill('HD-ENTER-01');
  await page.locator('#SO_HD').press('Enter');
  await page.waitForTimeout(1000);

  await expect(page).toHaveURL(/ClaimGeneral\/ObjectSearch/);
  await khongBiRedirectLogin(page);
  await expect(page.locator('#SO_HD')).toHaveValue('HD-ENTER-01');
  // Trang vẫn phản hồi sau Enter
  await expect(page.locator('button', { hasText: 'Tìm đối tượng' })).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Điều hướng: reload giữa chừng, back/forward
// ─────────────────────────────────────────────────────────────────────────────

test('n01 — Reload giữa chừng /ClaimGeneral/Search → tải lại OK, không redirect login', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  // Đang "giữa chừng": đã điền dữ liệu và mở modal 1 lần
  await page.locator('#so_hd').fill('HĐ-RELOAD-01');
  await diChuotRaGiuaTrang(page);
  await page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).click();
  await choModalMo(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect(page).toHaveURL(/ClaimGeneral\/Search/);
  await khongBiRedirectLogin(page);
  await expect(page.locator('#so_hd')).toBeVisible();
});

test('n02 — Reload giữa chừng /ClaimGeneral/ObjectSearch → tải lại OK, không redirect login', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await page.locator('#SO_HD').fill('HD-RELOAD-02');
  await diChuotRaGiuaTrang(page);
  await page.locator('button', { hasText: 'Tìm đối tượng' }).click();
  await choModalMo(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect(page).toHaveURL(/ClaimGeneral\/ObjectSearch/);
  await khongBiRedirectLogin(page);
  await expect(page.locator('#SO_HD')).toBeVisible();
});

test('n03 — Back/forward giữa Search ↔ ObjectSearch → không lỗi, không redirect login', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL_SEARCH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.goto(URL_OBJECT, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  // Back: ObjectSearch → Search
  await page.goBack();
  await page.waitForLoadState('load');
  await expect(page).toHaveURL(/ClaimGeneral\/Search/);
  await khongBiRedirectLogin(page);
  await expect(page.locator('#so_hd')).toBeVisible();

  // Forward: Search → ObjectSearch
  await page.goForward();
  await page.waitForLoadState('load');
  await expect(page).toHaveURL(/ClaimGeneral\/ObjectSearch/);
  await khongBiRedirectLogin(page);
  await expect(page.locator('#SO_HD')).toBeVisible();
});