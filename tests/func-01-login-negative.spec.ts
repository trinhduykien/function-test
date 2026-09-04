/**
 * FUNCTIONAL TEST — func-01-login-negative
 * Khu vực: LOGIN NEGATIVE — mọi cách nhập sai email/mật khẩu trên trang /Home/Index (phiên TRỐNG).
 *
 * BỐI CẢNH THẬT (đã khảo sát bằng probe — xem probe-func-01-login-negative.js):
 * - /Home/Index với phiên trống → redirect về "/?reason=expired" — trang login 2 bước:
 *   #EMAIL → bấm mũi tên (#email_click .show-password) → POST /Home/VertifyObject
 *   → nếu email hợp lệ & tồn tại (kq_dvi>0): #DIV_LOGIN hiện (input#pas + nút "ĐĂNG NHẬP" button.btn-default.w100).
 * - KHÔNG có validate định dạng email phía client: MỌI giá trị (rỗng, "abc", "abc@", "@domain",
 *   chứa khoảng trắng, >255 ký tự, unicode/emoji, ký tự đặc biệt) đều được POST thẳng lên server.
 * - Khi server không tìm thấy email (kq_dvi=0): #DIV_LOGIN ẩn và form_P_LOI() hiện modal #alertBox
 *   (.body-alert p) với thông báo CỐ ĐỊNH "Liên hệ ban Phát triển và Vận hành Ứng dụng Công nghệ
 *   thông tin đê được hỗ trợ (Dichvu_UDCNTT.pjico@Petrolimex.com.vn)".
 * - Nhập email có CHỮ HOA (tài khoản thật): server tra cứu được → #DIV_LOGIN hiện (case-insensitive).
 * - Enter trong ô email (vsmart keydown handler) có tác dụng tương đương bấm mũi tên.
 * - Bấm mũi tên lần 2 khi đã hiện ô mật khẩu: verify lại (không phải toggle về bước email) — giữ nguyên trạng thái.
 * - window.alert bị override → modal #alertBox; đóng bằng nút .close (×).
 *
 * BẢNG CA KIỂM THỬ (mỗi ca 1 test, mỗi test 1 page mới, phiên trống):
 * | #  | Ca                                                              | Kỳ vọng hành vi ĐÚNG của hệ thống chuẩn                                                                        |
 * | a  | Bỏ trống email → bấm mũi tên                                      | Có phản hồi lỗi RÕ RÀNG trên UI: modal hiện + nội dung GẮN VỚI nguyên nhân (nhắc nhập email), không im lặng   |
 * | b1 | "abc" (thiếu @) → bấm mũi tên                                     | Báo lỗi định dạng email (app tự có sẵn msg "Sai định dạng email!" ở form đăng ký), KHÔNG hiện ô mật khẩu       |
 * | b2 | "abc@" (thiếu domain)                                             | Như b1                                                                                                         |
 * | b3 | "@petrolimex.com.vn" (thiếu local-part)                           | Như b1                                                                                                         |
 * | b4 | "a b@c.vn" (chứa khoảng trắng)                                   | Như b1                                                                                                         |
 * | c  | Email đúng định dạng nhưng KHÔNG tồn tại                          | Có phản hồi lỗi rõ ràng gắn với việc đăng nhập (email/tài khoản), ô mật khẩu KHÔNG hiện (chống enumeration)    |
 * | d  | Email THẬT + SAI MẬT KHẨU (QUOTA 1 lần — chỉ chạy khi QA_WRONG_PW=1) | Thông báo lỗi chỉ rõ SAI MẬT KHẨU trên UI, giữ form; app thật: 302→reason=expired → modal "Hết phiên làm việc" (sai bản chất) + reset |
 * | e1 | Email quá dài (258 ký tự)                                         | KHÔNG crash, có phản hồi, giá trị input không bị cắt sai                                                       |
 * | e2 | Email có unicode/emoji                                            | KHÔNG crash, có phản hồi, input giữ nguyên giá trị                                                             |
 * | e3 | Email có ký tự đặc biệt '"><&                                    | KHÔNG crash, KHÔNG bị HTML-inject, input giữ nguyên giá trị                                                    |
 * | f  | Email thật viết HOA TOÀN BỘ                                       | Tra cứu được → hiện ô mật khẩu (case-insensitive) — ghi nhận hành vi                                          |
 * | g  | Gõ email thật bằng bàn phím rồi Enter (thay vì bấm mũi tên)       | Enter advance sang bước mật khẩu như bấm mũi tên                                                              |
 * | h  | Đã hiện ô mật khẩu → bấm mũi tên lần 2                            | KHÔNG crash, trạng thái hợp lệ (verify lại — thiết kế không toggle về bước email, ghi nhận)                   |
 * | h2 | Đã hiện ô mật khẩu → đổi email thành không tồn tại → bấm mũi tên   | #DIV_LOGIN phải ẨN lại (verify lại email mới) + có phản hồi lỗi                                               |
 * | i  | Paste email xong rồi XÓA TRẮNG rồi bấm mũi tên                    | Có phản hồi lỗi rõ ràng gắn với nguyên nhân (như ca a), không im lặng                                          |
 *
 * LƯU Ý QUOTA/AN TOÀN:
 * - Ca (d) chỉ chạy khi đặt env QA_WRONG_PW=1 — đúng 1 lần sai mật khẩu trên toàn suite, các vòng chạy
 *   debug không đặt env này. Mọi ca khác dùng email không tồn tại/giả.
 * - KHÔNG test rate limit/brute force. Link "Quên mật khẩu" không test ở spec này.
 */
import { test, expect, type Page } from '@playwright/test';

const NONEXIST = 'func.qa.khongtontai.8899@petrolimex.com.vn';
const REAL_EMAIL = process.env.UAT_EMAIL || ''; // chỉ dùng để CHECK TỒN TẠI (VertifyObject), KHÔNG bao giờ submit mật khẩu của tài khoản này
const ARROW = '#email_click .show-password';
const ALERT_BOX = '#alertBox';
const ALERT_TEXT = '#alertBox .body-alert p';

// Toàn bộ spec chạy với phiên TRỐNG
test.use({ storageState: { cookies: [], origins: [] } });

/** Mở trang login: /Home/Index (phiên trống) → phải về trang login có ô #EMAIL. */
async function openLoginPage(page: Page) {
  // alert() của app bị override thành modal, nhưng phòng hờ native dialog
  page.on('dialog', async d => { await d.dismiss().catch(() => {}); });
  await page.goto('/Home/Index', { waitUntil: 'load' });
  await expect(page.locator('#EMAIL')).toBeVisible({ timeout: 30000 });
  // Ban đầu khối mật khẩu phải ẩn — chỉ hiện sau khi email được xác thực
  await expect(page.locator('#DIV_LOGIN')).toBeHidden({ timeout: 10000 });
  return page;
}

/** Regex "thông báo gắn với nguyên nhân": chuẩn hệ thống phải nhắc người dùng sửa lỗi liên quan email/đăng nhập. */
const RELEVANT_MSG = /email|nhập|định dạng|tài khoản|mật khẩu|đăng nhập|không tồn tại|sai/i;

async function expectFeedbackVisible(page: Page) {
  // Kỳ vọng 1 (tối thiểu): KHÔNG im lặng — phải có phản hồi trên UI (modal #alertBox)
  await expect(page.locator(ALERT_BOX)).toBeVisible({ timeout: 15000 });
}

// ---------------------------------------------------------------------------
// (a) Bỏ trống email → bấm mũi tên
// ---------------------------------------------------------------------------
test('a: bỏ trống email rồi bấm mũi tên — phải có thông báo lỗi rõ ràng, gắn với nguyên nhân', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  await page.click(ARROW);

  // Phản hồi phải hiển thị (không im lặng)
  await expectFeedbackVisible(page);
  // Nội dung phải hướng người dùng sửa lỗi (nhắc nhập email) — hệ thống chuẩn không bảo người dùng "liên hệ IT" khi đơn giản là bỏ trống ô nhập
  const msg = (await page.textContent(ALERT_TEXT) || '').trim();
  expect(msg, 'Thông báo phải gắn với nguyên nhân (bỏ trống ô email), không phải thông báo chung "liên hệ hỗ trợ"').toMatch(RELEVANT_MSG);
  // Ô mật khẩu không được hiện khi email chưa hợp lệ
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();
});

// ---------------------------------------------------------------------------
// (b) Email sai định dạng — 4 biến thể, mỗi biến thể 1 test
// ---------------------------------------------------------------------------
const badFormats: Array<[string, string]> = [
  ['b1: "abc" (thiếu @)', 'abc'],
  ['b2: "abc@" (thiếu domain)', 'abc@'],
  ['b3: "@petrolimex.com.vn" (thiếu local-part)', '@petrolimex.com.vn'],
  ['b4: "a b@c.vn" (chứa khoảng trắng)', 'a b@c.vn'],
];

for (const [label, badEmail] of badFormats) {
  test(`b: email sai định dạng ${label} — phải báo lỗi định dạng, không hiện ô mật khẩu`, async ({ page }) => {
    test.setTimeout(120000);
    await openLoginPage(page);

    await page.fill('#EMAIL', badEmail);
    await page.click(ARROW);

    await expectFeedbackVisible(page);
    // Thông báo phải chỉ ra lỗi định dạng email (chính app có sẵn msg "Sai định dạng email!" ở form đăng ký)
    const msg = (await page.textContent(ALERT_TEXT) || '').trim();
    expect(msg, 'Thông báo phải nêu lỗi định dạng email, không phải thông báo chung "liên hệ hỗ trợ"').toMatch(/định dạng|email|nhập/i);
    // Email sai định dạng tuyệt đối không được chuyển sang bước mật khẩu
    await expect(page.locator('#DIV_LOGIN')).toBeHidden();
  });
}

// ---------------------------------------------------------------------------
// (c) Email đúng định dạng nhưng KHÔNG tồn tại
// ---------------------------------------------------------------------------
test('c: email không tồn tại — phải có phản hồi lỗi rõ ràng, ô mật khẩu không hiện', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  await page.fill('#EMAIL', NONEXIST);
  await page.click(ARROW);

  await expectFeedbackVisible(page);
  // Phản hồi phải gắn với vấn đề đăng nhập (email/tài khoản không hợp lệ) — không phải thông báo IT chung
  const msg = (await page.textContent(ALERT_TEXT) || '').trim();
  expect(msg, 'Thông báo phải gắn với nguyên nhân đăng nhập, không phải thông báo chung "liên hệ hỗ trợ"').toMatch(RELEVANT_MSG);
  // Chống enumeration: email không tồn tại → không được lọt sang bước mật khẩu
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();
  await expect(page.locator('#pas')).toBeHidden();
});

// ---------------------------------------------------------------------------
// (d) EMAIL THẬT + SAI MẬT KHẨU — QUOTA 1 lần duy nhất (chỉ chạy khi QA_WRONG_PW=1)
// ---------------------------------------------------------------------------
test('d: email thật + sai mật khẩu — phải có thông báo lỗi đăng nhập rõ ràng trên UI', async ({ page }) => {
  test.setTimeout(120000);
  // Chỉ chạy đúng 1 lần trên toàn suite — quota sai mật khẩu cho tài khoản thật
  test.skip(!process.env.QA_WRONG_PW, 'QUOTA: chỉ chạy khi đặt env QA_WRONG_PW=1 (1 lần sai mật khẩu duy nhất trên toàn suite)');
  await openLoginPage(page);

  await page.fill('#EMAIL', REAL_EMAIL);
  await page.click(ARROW);
  // Bước 2 hiện ra: ô mật khẩu + nút ĐĂNG NHẬP
  await expect(page.locator('#DIV_LOGIN')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#pas')).toBeVisible();

  const loginRespPromise = page.waitForResponse(r => r.url().includes('/Home/Login'), { timeout: 30000 });
  await page.fill('#pas', 'SaiMatKhau!2026@QATest'); // mật khẩu SAI — dùng đúng 1 lần
  await page.locator('button.btn-default.w100').click(); // nút ĐĂNG NHẬP
  await loginRespPromise;

  // Kỳ vọng của hệ thống chuẩn: thông báo lỗi phải chỉ rõ SAI MẬT KHẨU/tài khoản trên UI.
  // KẾT QUẢ QUAN SÁT THẬT (lần chạy quota duy nhất, 2026-09-04): server trả HTTP 302 → /?reason=expired
  // cho sai mật khẩu (fetch theo redirect) → wrapper fetchPostData hiện modal
  // "Hết phiên làm việc, đăng nhập lại và tiếp tục!" (SAI BẢN CHẤT cho ca sai mật khẩu)
  // rồi location.replace('/Home/Login') reset cả form + throw Error('SESSION_EXPIRED').
  await expect(page.locator(ALERT_BOX)).toBeVisible({ timeout: 15000 });
  const msg = (await page.textContent(ALERT_TEXT) || '').trim();
  expect(msg, 'Phải báo lỗi SAI MẬT KHẨU/tài khoản, không được báo "hết phiên làm việc"')
    .toMatch(/sai mật|mật khẩu|tài khoản|không đúng/i);
  // Thông báo không được sai bản chất (hết phiên ≠ sai mật khẩu)
  expect(msg, 'Ca nhập sai mật khẩu không được nhận thông báo "hết phiên"').not.toMatch(/hết phiên|phiên làm việc/i);
  // Sau khi nhập sai mật khẩu 1 lần, form phải GIỮ trạng thái bước mật khẩu để người dùng nhập lại
  // (không được reset toàn trang về bước email)
  await page.waitForTimeout(3000);
  await expect(page.locator('#DIV_LOGIN')).toBeVisible();
  await expect(page.locator('#pas')).toBeVisible();
});

// ---------------------------------------------------------------------------
// (e1) Email quá dài (258 ký tự > 255)
// ---------------------------------------------------------------------------
test('e1: email quá dài (258 ký tự) — không crash, có phản hồi, input không bị cắt sai', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  const longEmail = 'x'.repeat(240) + '@petrolimex.com.vn'; // 258 ký tự
  await page.fill('#EMAIL', longEmail);
  await page.click(ARROW);

  // Không crash (test vẫn còn chạy tới đây là chưa có page error nghiêm trọng) — phải có phản hồi lỗi
  await expectFeedbackVisible(page);
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();
  // Giá trị input phải được giữ nguyên (không cắt giữa chừng làm lệch dữ liệu người dùng gõ)
  const val = await page.inputValue('#EMAIL');
  expect(val, 'Giá trị input phải giữ nguyên 258 ký tự đã nhập').toBe(longEmail);
});

// ---------------------------------------------------------------------------
// (e2) Email có unicode/tiếng Việt + emoji
// ---------------------------------------------------------------------------
test('e2: email có unicode/emoji — không crash, có phản hồi, input giữ nguyên giá trị', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  const weird = 'nguyễn.văn.🎉@petrolimex.com.vn';
  await page.fill('#EMAIL', weird);
  await page.click(ARROW);

  await expectFeedbackVisible(page);
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();
  expect(await page.inputValue('#EMAIL'), 'Input phải giữ nguyên ký tự unicode/emoji').toBe(weird);
  // Sau khi đóng modal, trang vẫn hoạt động (không treo)
  await page.click(`${ALERT_BOX} .close`);
  await expect(page.locator(ALERT_BOX)).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#EMAIL')).toBeVisible();
});

// ---------------------------------------------------------------------------
// (e3) Email có ký tự đặc biệt '"><& — không crash, không HTML-inject
// ---------------------------------------------------------------------------
test('e3: email có ký tự đặc biệt \'"><& — không crash, không render sai DOM, input giữ nguyên', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  const scriptCountBefore = await page.evaluate(() => document.querySelectorAll('script').length);
  const evil = `'<&">abc@petrolimex.com.vn`;
  await page.fill('#EMAIL', evil);
  await page.click(ARROW);

  await expectFeedbackVisible(page);
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();
  // Giá trị phải được giữ nguyên (được escape đúng, không bị biến đổi)
  expect(await page.inputValue('#EMAIL')).toBe(evil);
  // Không có node mới bị chèn vào DOM (HTML-inject)
  const scriptCountAfter = await page.evaluate(() => document.querySelectorAll('script').length);
  expect(scriptCountAfter, 'Không được chèn thêm node script vào DOM').toBe(scriptCountBefore);
  // Thông báo trong modal là text thuần — không chứa markup bị render thô
  const msgHtml = await page.evaluate(() => document.querySelector('#alertBox .body-alert p')?.innerHTML || '');
  expect(msgHtml, 'Modal chỉ được hiển thị text, không render markup từ input').not.toMatch(/<(script|img|input)\b/i);
  // Trang vẫn hoạt động sau đó
  await page.click(`${ALERT_BOX} .close`);
  await expect(page.locator(ALERT_BOX)).toBeHidden({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// (f) Email thật viết HOA toàn bộ — ghi nhận case-insensitivity
// ---------------------------------------------------------------------------
test('f: email thật viết HOA TOÀN BỘ — hệ thống phải tra cứu được và hiện ô mật khẩu (case-insensitive)', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  await page.fill('#EMAIL', REAL_EMAIL.toUpperCase());
  await page.click(ARROW);

  // Email hợp lệ (dù viết hoa) phải qua được bước xác thực → hiện ô mật khẩu
  await expect(page.locator('#DIV_LOGIN')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#pas')).toBeVisible();
  // KHÔNG submit mật khẩu — dừng lại ở bước mật khẩu
});

// ---------------------------------------------------------------------------
// (g) Enter thay vì bấm mũi tên
// ---------------------------------------------------------------------------
test('g: gõ email hợp lệ bằng bàn phím rồi Enter — phải advance sang bước mật khẩu như bấm mũi tên', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  // Gõ từng phím (không fill) — chỉ khi nhấn Enter thì mới đổi focus → onchange → verify
  await page.locator('#EMAIL').click();
  await page.locator('#EMAIL').pressSequentially(REAL_EMAIL, { delay: 15 });
  // Trước Enter: vẫn ở bước email (chưa blur, chưa verify)
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();

  await page.locator('#EMAIL').press('Enter');

  // Enter phải đưa sang bước mật khẩu
  await expect(page.locator('#DIV_LOGIN')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#pas')).toBeVisible();
  // KHÔNG submit mật khẩu — dừng lại ở bước mật khẩu
});

// ---------------------------------------------------------------------------
// (h) Đã hiện ô mật khẩu → bấm mũi tên lần 2
// ---------------------------------------------------------------------------
test('h: đã hiện ô mật khẩu rồi bấm mũi tên lần 2 — không crash, trạng thái còn hợp lệ', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  await page.fill('#EMAIL', REAL_EMAIL);
  await page.click(ARROW);
  await expect(page.locator('#DIV_LOGIN')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#pas')).toBeVisible();

  // Bấm mũi tên lần 2 (ghi nhận: nút verify lại email, không phải toggle về bước email)
  await page.click(ARROW);
  await page.waitForTimeout(1500);

  // Kỳ vọng hợp lý: hệ thống không crash, verify lại và giữ trạng thái bước mật khẩu hợp lệ
  await expect(page.locator('#DIV_LOGIN')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#pas')).toBeVisible();
  // Không có thông báo lỗi bất thường
  await expect(page.locator(ALERT_BOX)).toBeHidden();
  // Input email không bị xáo trộn
  expect(await page.inputValue('#EMAIL')).toBe(REAL_EMAIL);
});

// ---------------------------------------------------------------------------
// (h2) Đã hiện ô mật khẩu → đổi email thành email KHÔNG tồn tại → bấm mũi tên
// ---------------------------------------------------------------------------
test('h2: đổi email thành email không tồn tại sau khi hiện ô mật khẩu — phải ẩn ô mật khẩu và báo lỗi', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  await page.fill('#EMAIL', REAL_EMAIL);
  await page.click(ARROW);
  await expect(page.locator('#DIV_LOGIN')).toBeVisible({ timeout: 15000 });

  // Đổi sang email không tồn tại rồi verify lại
  await page.fill('#EMAIL', NONEXIST);
  await page.click(ARROW);

  // Hợp lý: khối mật khẩu phải ẨN lại (email mới không hợp lệ) + có phản hồi lỗi
  await expect(page.locator('#DIV_LOGIN')).toBeHidden({ timeout: 15000 });
  await expectFeedbackVisible(page);
});

// ---------------------------------------------------------------------------
// (i) Paste email xong rồi XÓA TRẮNG rồi bấm mũi tên
// ---------------------------------------------------------------------------
test('i: paste email rồi xóa trắng rồi bấm mũi tên — phải có phản hồi lỗi rõ ràng, gắn với nguyên nhân', async ({ page }) => {
  test.setTimeout(120000);
  await openLoginPage(page);

  await page.fill('#EMAIL', NONEXIST);
  await page.fill('#EMAIL', ''); // xóa trắng
  await page.click(ARROW);

  await expectFeedbackVisible(page);
  // Thông báo phải nhắc người dùng nhập lại email (bỏ trống) — như ca (a)
  const msg = (await page.textContent(ALERT_TEXT) || '').trim();
  expect(msg, 'Thông báo phải gắn với nguyên nhân (ô email trống), không phải thông báo chung "liên hệ hỗ trợ"').toMatch(RELEVANT_MSG);
  await expect(page.locator('#DIV_LOGIN')).toBeHidden();
});