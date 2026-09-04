/**
 * FUNCTIONAL TEST 02 — Luồng "Quên mật khẩu" trên trang login UAT cấp đơn PJICO
 * =============================================================================
 * KẾT QUẢ PROBE (hành vi thật, xem probe-func-02-quen-mat-khau.js):
 * - /Home/Index với phiên TRỐNG redirect về /?reason=expired (trang login 2 bước).
 * - Link "Quên mật khẩu" là <a href="#" target="_blank" onclick="return changePassToBaoHiem();">
 *   nằm trong #DIV_LOGIN (khối bước 2 — mật khẩu) → ẢN cho tới khi người dùng nhập
 *   email hợp lệ + bấm mũi tên (#email_click .show-password).
 * - changePassToBaoHiem() = window.open($("#url_baohiem").val() + "&email=" + $("#EMAIL").val(), "_blank").focus()
 *   với #url_baohiem = "https://uat-baohiem.pjico.com.vn?type=KTTT" → mở tab mới sang PORTAL NGOÀI
 *   "PJICO Selling Platform" (trang login hệ thống khác). App capdon KHÔNG có form quên mật khẩu riêng.
 * - Hàm KHÔNG return false → default action của anchor (href="#" + target="_blank") cũng chạy →
 *   mỗi lần bấm mở THÊM 1 tab login trùng lặp (/?reason=expired#) ← BUG, bắt tại tc04.
 * - Nếu người dùng SỬA ô email (rỗng / ký tự đặc biệt / email khác) rồi bấm link bằng CHUỘT THẬT:
 *   onchange=login_P_KTRA('EMAIL') re-validate → DIV_LOGIN ẩn + hiện #alertBox thông báo
 *   "Liên hệ ban Phát triển..." → link KHÔNG mở portal (chặn ổn định 3/3 lần probe).
 *
 * AN TOÀN (quy tắc tuyệt đối):
 * - TUYỆT ĐỐI KHÔNG submit email thật sang portal ngoài: mọi lần bấm link đều đặt email GIẢ
 *   vào ô #EMAIL trước, và bấm qua JS click (không kích hoạt onchange — mô phỏng người dùng
 *   bấm link mà không sửa email sau bước 1).
 * - Email thật kientd.pjico@... chỉ được ĐIỀN vào #EMAIL để mở bước 2 — KHÔNG BAO GIỜ submit mật khẩu.
 * - KHÔNG thao tác gì trên portal ngoài (uat-baohiem) ngoài việc xác nhận nó mở + load.
 *
 * ÁN XẠ CÁC CA TRONG CHIẾN LƯỢC:
 * - (b) submit form RỖNG, (c) sai định dạng, (d) email không tồn tại: KHÔNG áp dụng được —
 *   capdon không có form quên mật khẩu; portal ngoài có luồng riêng (ngoài phạm vi, không thao tác).
 *   Hành vi gần nhất (chặn khi ô email không hợp lệ) được phủ ở tc06/tc10.
 * - (e) không submit email thật: áp dụng cho mọi test (xem AN TOÀN).
 * - (f)/(g) đóng/quay lại: không có modal — thay bằng đóng tab portal (tc09), trang login
 *   nguyên vẹn sau khi bấm (tc05), đóng alertBox bằng nút × và phục hồi luồng (tc06).
 *
 * BẢNG CA KIỂM THỬ:
 * | tc  | Ca kiểm thử                                        | Kỳ vọng ĐÚNG |
 * |-----|----------------------------------------------------|--------------|
 * | tc01| (a) Link tồn tại, ẩn trước bước 1, cấu trúc chuẩn | link duy nhất, ẩn, href#/target_blank/onclick changePassToBaoHiem, #url_baohiem đúng portal |
 * | tc02| (a) Qua bước 1 hợp lệ → link hiển thị              | #DIV_LOGIN + link visible |
 * | tc03| (a) Bấm link (email giả, JS click) → portal mở     | tab mới đúng URL ?type=KTTT&email=<giả>, portal load OK |
 * | tc04| (a) 1 click chỉ được mở 1 tab                     | CHỈ tab portal — KHÔNG mở thêm tab login trùng lặp (thực tế mở thêm → FAIL = finding) |
 * | tc05| (f/g) Trang login chính nguyên vẹn sau khi bấm    | URL không đổi, #DIV_LOGIN + ô mật khẩu còn, không lỗi JS |
 * | tc06| (h) Sửa email thành ký tự đặc biệt + click thật    | bị chặn bởi re-validation, KHÔNG crash, đóng alertBox bằng ×, phục hồi được bước 2 |
 * | tc07| (h) Email unicode tiếng Việt + emoji (JS click)    | portal mở với email đã URL-encode, không crash |
 * | tc08| (h) Email 500 ký tự (JS click)                    | portal mở, không crash |
 * | tc09| (f) Đóng tab portal → login còn nguyên            | trang chính vẫn bước 2, nhập mật khẩu tiếp được |
 * | tc10| (b) Ô email RỖNG khi bấm (JS click)               | portal mở với &email= rỗng, không crash — ghi nhận thiếu guard trong changePassToBaoHiem (xem notes) |
 * =============================================================================
 */
import { test, expect, Page } from '@playwright/test';

// Mọi test dùng PHIÊN TRỐNG (không load storageState đã đăng nhập)
test.use({ storageState: { cookies: [], origins: [] } });

const LOGIN_PATH = '/Home/Index';
const REAL_EMAIL = process.env.UAT_EMAIL || ''; // CHỈ ĐIỀN để mở bước 2 — KHÔNG BAO GIỜ submit mật khẩu
const FAKE_EMAIL = 'test.quen.matkhau@example.com'; // email giả an toàn cho mọi lần bấm link
const PORTAL_HOST = 'uat-baohiem.pjico.com.vn';
const PORTAL_URL_PREFIX = 'https://uat-baohiem.pjico.com.vn/?type=KTTT&email=';

/** Vào trang login (phiên trống) và chờ ô email bước 1 sẵn sàng */
async function gotoLogin(page: Page) {
  await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect(page.locator('#EMAIL')).toBeVisible();
}

/** Mở bước 2: điền email (chỉ điền!), bấm mũi tên → #DIV_LOGIN hiện. KHÔNG submit mật khẩu. */
async function openStep2(page: Page) {
  await page.locator('#EMAIL').fill(REAL_EMAIL);
  await page.locator('#email_click .show-password').click();
  await expect(page.locator('#DIV_LOGIN')).toBeVisible({ timeout: 30000 });
}

/**
 * Bấm link "Quên mật khẩu" bằng JS click.
 * Lý do: (1) an toàn — cho phép đặt email GIẢ vào ô trước khi bấm mà không kích hoạt
 * onchange re-validation, mô phỏng người dùng bấm link mà không sửa email sau bước 1;
 * (2) click chuột thật khi ô email vừa bị sửa sẽ bị onchange chặn (xem tc06) —
 * hai đường này cần được test riêng.
 */
async function jsClickForgot(page: Page) {
  await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a')).find(
      (x) => (x.textContent || '').indexOf('Quên') >= 0
    ) as HTMLElement | undefined;
    if (!a) throw new Error('Không tìm thấy link "Quên mật khẩu"');
    a.click();
  });
}

/** Thu thép các tab mới mở của context sau thời điểm gọi */
function collectNewPages(page: Page): Page[] {
  const opened: Page[] = [];
  page.context().on('page', (p) => opened.push(p));
  return opened;
}

/** Tìm tab portal ngoài (uat-baohiem) trong các tab đã mở — poll chờ URL xác định */
async function findPortal(opened: Page[]): Promise<Page> {
  let portal: Page | undefined;
  await expect
    .poll(
      async () => {
        portal = opened.find((p) => {
          try {
            return p.url().includes(PORTAL_HOST);
          } catch {
            return false;
          }
        });
        return portal !== undefined;
      },
      { timeout: 20000 }
    )
    .toBe(true);
  return portal!;
}

/**
 * Chờ danh sách tab mới "ổn định": không còn tab nào mới xuất hiện thêm trong settleMs.
 * Cần vì các event 'page' đến BẤT ĐỒNG BỘ vài ms sau khi click (portal trước, tab trùng
 * lặp sau) — assert ngay khi thấy tab đầu tiên sẽ bỏ sót tab thứ hai (race).
 */
async function settleNewPages(page: Page, opened: Page[], settleMs = 2000, maxMs = 20000) {
  const start = Date.now();
  let lastCount = -1;
  let lastChange = Date.now();
  while (Date.now() - start < maxMs) {
    if (opened.length !== lastCount) {
      lastCount = opened.length;
      lastChange = Date.now();
    }
    if (opened.length > 0 && Date.now() - lastChange >= settleMs) return;
    await page.waitForTimeout(100);
  }
}

/** Chờ mọi tab mới có URL xác định (không còn about:blank) rồi trả về danh sách URL */
async function waitUrlsStable(opened: Page[]): Promise<string[]> {
  await expect
    .poll(
      async () => {
        const urls: string[] = [];
        for (const p of opened) {
          try {
            const u = p.url();
            if (u && u !== 'about:blank') urls.push(u);
          } catch {
            /* bỏ qua tab đã đóng */
          }
        }
        return urls.length;
      },
      { timeout: 15000 }
    )
    .toBe(opened.length);
  const urls: string[] = [];
  for (const p of opened) {
    try {
      urls.push(p.url());
    } catch {
      urls.push('<closed>');
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// tc01 — (a) Link "Quên mật khẩu" tồn tại trên trang login, ẩn trước bước 1, cấu trúc chuẩn
// ---------------------------------------------------------------------------
test('tc01 — Link "Quên mật khẩu" tồn tại, ẩn trước bước 1, cấu trúc chuẩn (href/target/onclick/#url_baohiem)', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);

  const link = page.locator('a:has-text("Quên mật khẩu")');
  await expect(link).toHaveCount(1);
  // Link nằm trong #DIV_LOGIN (khối bước 2) → ẩn trước khi qua bước 1
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();
  await expect(link).toBeHidden();

  const attrs = await link.evaluate((a) => ({
    href: a.getAttribute('href'),
    target: a.getAttribute('target'),
    onclick: a.getAttribute('onclick'),
  }));
  expect(attrs.href).toBe('#');
  expect(attrs.target).toBe('_blank');
  expect(attrs.onclick).toContain('changePassToBaoHiem');

  // URL portal ngoài nằm trong hidden input #url_baohiem — phải trỏ đúng portal KTTT
  const urlBaohiem = await page.locator('#url_baohiem').inputValue();
  expect(urlBaohiem).toContain('https://uat-baohiem.pjico.com.vn');
  expect(urlBaohiem).toContain('type=KTTT');
});

// ---------------------------------------------------------------------------
// tc02 — (a) Qua bước 1 với email hợp lệ → link "Quên mật khẩu" hiển thị
// ---------------------------------------------------------------------------
test('tc02 — Sau bước 1 với email hợp lệ, link "Quên mật khẩu" hiển thị trong #DIV_LOGIN', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page); // email thật CHỈ ĐIỀN — không submit mật khẩu

  await expect(page.locator('input[type=password]').first()).toBeVisible();
  await expect(page.locator('a:has-text("Quên mật khẩu")')).toBeVisible();
});

// ---------------------------------------------------------------------------
// tc03 — (a) Bấm "Quên mật khẩu" (email GIẢ) → mở tab portal ngoài đúng URL
// KHÔNG thao tác gì thêm trên portal ngoài — chỉ xác nhận nó mở + load.
// ---------------------------------------------------------------------------
test('tc03 — Bấm "Quên mật khẩu" mở tab portal ngoài đúng URL ?type=KTTT&email=<email đã nhập>', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page);
  // Đặt email GIẢ trước khi bấm — TUYỆT ĐỐI KHÔNG gửi email thật sang portal ngoài
  await page.locator('#EMAIL').fill(FAKE_EMAIL);

  const opened = collectNewPages(page);
  await jsClickForgot(page);

  const portal = await findPortal(opened);
  await portal.waitForLoadState('domcontentloaded', { timeout: 60000 });
  await expect(portal).toHaveURL(PORTAL_URL_PREFIX + FAKE_EMAIL);
  const title = await portal.title();
  expect(title).toContain('PJICO Selling Platform');
});

// ---------------------------------------------------------------------------
// tc04 — (a) [FINDING] Một click "Quên mật khẩu" chỉ được mở ĐÚNG 1 tab mới (portal ngoài)
// Kỳ vọng đúng: link mở 1 tab duy nhất — tab portal ngoài.
// Thực tế (probe): onclick changePassToBaoHiem không return false → default action của
// <a href="#" target="_blank"> cũng chạy → mở THÊM 1 tab login trùng lặp → test FAIL = finding.
// ---------------------------------------------------------------------------
test('tc04 — [FINDING] Bấm link chỉ được mở 1 tab (portal) — không mở thêm tab login trùng lặp', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page);
  await page.locator('#EMAIL').fill(FAKE_EMAIL);

  const opened = collectNewPages(page);
  await jsClickForgot(page);

  // Chờ đủ các tab được mở (portal + mọi tab ngoài ý muốn) trước khi đếm — tránh race event
  await settleNewPages(page, opened);
  expect(opened.length).toBeGreaterThanOrEqual(1);
  const urls = await waitUrlsStable(opened);

  const nonPortal = urls.filter((u) => !u.includes(PORTAL_HOST));
  expect(
    nonPortal,
    `Link "Quên mật khẩu" chỉ được mở 1 tab portal ngoài — phát hiện thêm tab trùng lặp: ${JSON.stringify(nonPortal)}`
  ).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// tc05 — (f/g) Trang login chính nguyên vẹn sau khi bấm "Quên mật khẩu"
// (portal mở ở TAB MỚI — trang chính không được điều hướng/mất trạng thái bước 2)
// ---------------------------------------------------------------------------
test('tc05 — Trang login chính nguyên vẹn sau khi bấm (URL không đổi, bước 2 còn nguyên, không lỗi JS)', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page);
  await page.locator('#EMAIL').fill(FAKE_EMAIL);

  const jsErrors: string[] = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  const urlBefore = page.url();

  const opened = collectNewPages(page);
  await jsClickForgot(page);
  await expect.poll(() => opened.length, { timeout: 15000 }).toBeGreaterThanOrEqual(1);

  // Trang chính KHÔNG điều hướng (không thêm '#' vào URL), form bước 2 còn nguyên
  await expect(page).toHaveURL(urlBefore);
  await expect(page.locator('#DIV_LOGIN')).toBeVisible();
  await expect(page.locator('input[type=password]').first()).toBeVisible();
  expect(jsErrors, 'Không được có lỗi JS khi bấm "Quên mật khẩu"').toHaveLength(0);
});

// ---------------------------------------------------------------------------
// tc06 — (h) Sửa ô email thành chuỗi ký tự đặc biệt rồi bấm "Quên mật khẩu" (CLICK CHUỘT THẬT)
// Kỳ vọng: hệ thống re-validate (onchange) → chặn, hiện modal thông báo (#alertBox),
// KHÔNG mở portal với email rác, KHÔNG crash. Đóng thông báo bằng nút × (.close)
// và luồng phải phục hồi được (nhập lại email hợp lệ → bước 2 hiện lại).
// ---------------------------------------------------------------------------
test('tc06 — Sửa email thành ký tự đặc biệt + click chuột thật → bị chặn, không crash, đóng × được, phục hồi được', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page);

  const special = `test!@#$%^&*()<>'"`;
  await page.locator('#EMAIL').fill(special);

  const jsErrors: string[] = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  const opened = collectNewPages(page);

  await page.locator('a:has-text("Quên mật khẩu")').first().click();

  // Re-validation chặn: hiện modal thông báo, khối bước 2 ẩn
  await expect(page.locator('#alertBox')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();
  // KHÔNG tab nào được mở (portal không nhận email rác) — chờ settle chống race event
  await settleNewPages(page, opened);
  expect(opened, 'Không tab nào được mở khi luồng bị re-validation chặn').toHaveLength(0);
  expect(jsErrors, 'Không được có lỗi JS khi email chứa ký tự đặc biệt').toHaveLength(0);

  // Đóng modal thông báo bằng nút × (.close) — KHÔNG bấm nút nào khác
  await page.locator('#alertBox .close').click();
  await expect(page.locator('#alertBox')).toBeHidden();

  // Luồng phục hồi được: nhập lại email hợp lệ → bước 2 hiện lại
  await page.locator('#EMAIL').fill(REAL_EMAIL);
  await page.locator('#email_click .show-password').click();
  await expect(page.locator('#DIV_LOGIN')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('a:has-text("Quên mật khẩu")')).toBeVisible();
});

// ---------------------------------------------------------------------------
// tc07 — (h) Email unicode tiếng Việt + emoji → portal mở với email đã URL-encode, không crash
// ---------------------------------------------------------------------------
test('tc07 — Email unicode tiếng Việt + emoji: portal mở với email đã encode, không crash', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page);

  const weird = 'nguyễn.tem.🔐@example.com';
  await page.locator('#EMAIL').fill(weird);

  const jsErrors: string[] = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  const opened = collectNewPages(page);
  await jsClickForgot(page);

  const portal = await findPortal(opened);
  await portal.waitForLoadState('domcontentloaded', { timeout: 60000 });
  // URL portal chứa email đã encode (decode ra phải khớp chuỗi gốc) — không crash, không méo
  expect(decodeURIComponent(portal.url())).toContain(weird);
  expect(jsErrors, 'Không được có lỗi JS với email unicode/emoji').toHaveLength(0);
});

// ---------------------------------------------------------------------------
// tc08 — (h) Email 500 ký tự → portal mở, không crash
// ---------------------------------------------------------------------------
test('tc08 — Email 500 ký tự: portal mở, không crash', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page);

  const longEmail = 'a'.repeat(480) + '@example.com';
  await page.locator('#EMAIL').fill(longEmail);

  const jsErrors: string[] = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  const opened = collectNewPages(page);
  await jsClickForgot(page);

  const portal = await findPortal(opened);
  await portal.waitForLoadState('domcontentloaded', { timeout: 60000 });
  expect(portal.url()).toContain(longEmail);
  expect(jsErrors, 'Không được có lỗi JS với email 500 ký tự').toHaveLength(0);
});

// ---------------------------------------------------------------------------
// tc09 — (f) Đóng tab portal → trang login chính vẫn ở bước 2, tiếp tục nhập mật khẩu được
// ---------------------------------------------------------------------------
test('tc09 — Đóng tab portal: trang login chính vẫn ở bước 2, nhập mật khẩu tiếp được', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page);
  await page.locator('#EMAIL').fill(FAKE_EMAIL);

  const opened = collectNewPages(page);
  await jsClickForgot(page);
  const portal = await findPortal(opened);
  await portal.waitForLoadState('domcontentloaded', { timeout: 60000 });

  // "Đóng form" của luồng này = đóng tab portal
  await portal.close();

  await expect(page.locator('#DIV_LOGIN')).toBeVisible();
  await expect(page.locator('input[type=password]').first()).toBeVisible();
  await expect(page.locator('a:has-text("Quên mật khẩu")')).toBeVisible();
});

// ---------------------------------------------------------------------------
// tc10 — (b) Ô email RỖNG khi bấm "Quên mật khẩu" (JS click — bỏ qua onchange)
// Ghi nhận hành vi thật: changePassToBaoHiem KHÔNG có guard — vẫn mở portal với
// &email= rỗng, không crash. (Qua UI thật, onchange sẽ chặn trước; việc hàm mở portal
// mà không kiểm tra gì là thiếu hụt validation — xem notes trong kết quả.)
// ---------------------------------------------------------------------------
test('tc10 — Ô email rỗng khi bấm (JS click): portal mở với &email= rỗng, không crash', async ({ page }) => {
  test.setTimeout(120000);
  await gotoLogin(page);
  await openStep2(page);
  await page.locator('#EMAIL').fill('');

  const jsErrors: string[] = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  const opened = collectNewPages(page);
  await jsClickForgot(page);

  const portal = await findPortal(opened);
  await portal.waitForLoadState('domcontentloaded', { timeout: 60000 });
  await expect(portal).toHaveURL(PORTAL_URL_PREFIX); // &email= rỗng
  expect(jsErrors, 'Không được có lỗi JS khi email rỗng').toHaveLength(0);
});