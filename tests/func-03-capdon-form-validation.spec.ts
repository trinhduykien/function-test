/**
 * FUNCTIONAL TEST — Validation form tìm kiếm, phân hệ cấp đơn XE (/ContractCar/Search)
 * Slug: 03-capdon-form-validation
 *
 * CHIẾN LƯỢC: battery ca biên trên form tìm kiếm hợp đồng/GCN xe cơ giới.
 * Mọi test chỉ bấm nút "Tìm kiếm" (button.btn-blue, id #btn) — query read-only, an toàn.
 *
 * SỰ THẬT ĐÃ PROBE (đặc thù app, làm cơ sở kỳ vọng):
 * - Form có: #ngayd_timhd / #ngayc_timhd (dd/MM/yyyy, bootstrap-datepicker, mặc định 28/08/2026→04/09/2026),
 *   #dvi_qly_tim (select 67 mục, option đầu value='' text 'ALL | Tất cả', bootstrap-select UI),
 *   #so_hd_tim (Số HĐ), #bien_xe, #so_khung, #so_may (các ô nhập trong phần cơ bản),
 *   #ma_kh_tim ẨN (nằm trong panel "Thông tin tìm nâng cao" — không fill trong battery này).
 * - Nút tìm: #btn.btn-blue (onclick bhbt_XE_P_TIM), gọi POST /ContractPublic/SearchResult
 *   (payload mã hoá client-side) trả JSON {code, message, data, Total}.
 * - Tài khoản kientd.pjico KHÔNG có dữ liệu HĐ nào: MỌI query hợp lệ trả code "000", Total 0,
 *   grid #Gr_lke hiển thị "Không có dữ liệu". → Kỳ vọng chuẩn: HTTP 200 + code "000" + Total 0
 *   + grid "Không có dữ liệu" + KHÔNG pageerror + trang vẫn thao tác được.
 * - Khi search trả 0 kết quả, app mở modal #alertBox "Không tìm thấy" → test đóng bằng nút
 *   .close (×) — được phép, KHÔNG bấm nút khác trong modal.
 * - Ô ngày có datepicker; giá trị ngày không hợp lệ ("abc", "32/13/2026") bị chuẩn hoá lại
 *   về giá trị trước đó khi blur — không crash, chấp nhận là xử lý hợp lý.
 * - Đổi dropdown đơn vị có onchange = chính hàm search (auto-search) → kỳ vọng 1 request
 *   SearchResult 200 mỗi lần đổi.
 *
 * BUG ĐÃ XÁC NHẬN QUA PROBE (các test tương ứng sẽ FAIL — đây là finding, KHÔNG hạ kỳ vọng):
 * - B1: #so_hd_tim / #bien_xe / #so_may với chuỗi ~500 ký tự → server trả code "400" kèm lỗi
 *   Oracle thô "ORA-20105: ORA-06512: at UAT_KTTT.PBH_HD_GOC_TIM_WEB, line 163" hiển thị
 *   nguyên văn trong modal cho user (450 ký tự vẫn code "000"; #so_khung 500 ký tự vẫn ổn).
 *   → TC08/TC18 FAIL.
 * - B2: #so_hd_tim chứa "<script>1</script>" (viết thường) → HTTP 500 (trang lỗi HTML),
 *   app hiện modal "Hết phiên làm việc, đăng nhập lại và tiếp tục!" trong khi session
 *   vẫn còn nguyên (search ngay sau đó vẫn 200 code "000") — báo sai nguyên nhân.
 *   Biến thể "a<script b", "</script>", "<SCRIPT>1</SCRIPT>" lại KHÔNG gây lỗi → TC17 FAIL.
 *
 * BẢNG CA KIỂM THỬ:
 * | TC  | Ca kiểm thử                                        | Kỳ vọng (hành vi đúng của hệ thống chuẩn)              |
 * |-----+----------------------------------------------------+--------------------------------------------------------|
 * | 01  | Form trống toàn bộ (xoá cả ngày) → bấm Tìm         | HTTP 200, code 000, Total 0, grid "Không có dữ liệu"    |
 * | 02  | Đến ngày < Từ ngày (10/08→01/08/2026)              | HTTP ổn, không trả dữ liệu vô lý, không crash           |
 * | 03  | Ngày dạng chữ "abc"/"xyz" vào ô date                | Không crash; giá trị được chuẩn hoá/bỏ                  |
 * | 04  | Ngày không hợp lệ "32/13/2026"                     | Không crash; được chuẩn hoá về giá trị hợp lệ          |
 * | 05  | Datepicker mở khi click ô ngày, chọn ngày          | Widget hiện, chọn ngày → ô nhận giá trị dd/MM/yyyy     |
 * | 06  | Ngày xa: 01/01/2000 → 31/12/2100                   | HTTP 200, code 000, không crash                         |
 * | 07  | Số HĐ ký tự đặc biệt !@#$%&*(), '"><&             | HTTP 200, code 000, không crash, không render sai      |
 * | 08  | Số HĐ chuỗi 500 ký tự                               | HTTP 200, code 000 (không được phun lỗi ORA thô) [B1]   |
 * | 09  | Số HĐ unicode + emoji tiếng Việt                    | HTTP 200, code 000, không lỗi encoding                  |
 * | 10  | Số HĐ số hợp lệ "123456"                            | HTTP 200, code 000, Total 0, grid "Không có dữ liệu"    |
 * | 11  | Biển xe/số khung/số máy ký tự đặc biệt             | HTTP 200, code 000, grid nguyên vẹn                     |
 * | 12  | Dropdown đơn vị: chọn AGI qua UI → tìm → chọn ALL  | Mỗi lần đổi có SearchResult 200; giá trị select đúng    |
 * | 13  | XSS reflection: payload HTML (img/onerror)         | Không thực thi script, không inject element vào DOM    |
 * | 14  | Refresh (F5) sau khi tìm                            | Trang tải lại ổn, form dùng lại được (filter reset)     |
 * | 15  | Bấm Tìm 2 lần liên tiếp nhanh                      | Không crash, mọi request đều 200, trang còn sống        |
 * | 16  | Enter trong ô Số HĐ                                 | Trigger search ngay trong trang, KHÔNG navigation       |
 * | 17  | Số HĐ chứa "<script>1</script>"                    | Xử lý bình thường như chuỗi đặc biệt khác [B2]         |
 * | 18  | Biển xe + số máy chuỗi 500 ký tự                    | HTTP 200, code 000 (không phun lỗi ORA thô) [B1]        |
 */
import { test, expect, Page, Response, Locator } from '@playwright/test';

const SEARCH_URL = '**/ContractPublic/SearchResult';
const SEARCH_PATH = '/ContractPublic/SearchResult';

/** Vào trang tìm kiếm, chờ JS bind. Ném lỗi rõ ràng nếu session hết hạn. */
async function gotoSearch(page: Page) {
  await page.goto('/ContractCar/Search', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load');
  await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
  if (/login|Home\/Index/i.test(page.url())) {
    throw new Error('SESSION HẾT HẠN — chạy: node scripts/save-auth.js rồi chạy lại test');
  }
  await page.waitForTimeout(800); // chờ JS bind form (selectpicker/datepicker)
}

/** Thu thập pageerror để dò crash JS trong mỗi test. */
function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message.slice(0, 200)}`));
  return errors;
}

/** Đóng modal #alertBox "Không tìm thấy"/thông báo (nút .close — được phép), đưa chuột khỏi navbar. */
async function closeAlertBoxIfOpen(page: Page) {
  const box = page.locator('#alertBox');
  if (await box.isVisible().catch(() => false)) {
    await page.locator('#alertBox .close').first().click({ timeout: 5000 });
    await box.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.mouse.move(300, 600); // rời vùng hover navbar tránh mega-menu đè nút Tìm
    await page.waitForTimeout(300);
  }
}

/** Click an toàn: nếu bị modal alertBox / hover-menu đè thì dọn rồi thử lại. */
async function safeClick(page: Page, target: Locator, attempts = 4) {
  let lastErr = '';
  for (let i = 0; i < attempts; i++) {
    try {
      await target.click({ timeout: 6000 });
      return;
    } catch (e) {
      lastErr = (e as Error).message.split('\n')[0];
      await closeAlertBoxIfOpen(page);
      await page.mouse.move(300, 600);
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`Không click được sau ${attempts} lần thử: ${lastErr}`);
}

interface SearchOutcome {
  status: number;
  json: { code?: string; message?: string | null; Total?: number } | null;
  resp: Response | null;
}

/** Bấm nút Tìm (#btn, btn-blue), chờ response SearchResult, parse JSON. */
async function searchAndWait(page: Page, timeout = 25000): Promise<SearchOutcome> {
  const respP = page.waitForResponse(SEARCH_URL, { timeout }).catch(() => null);
  await safeClick(page, page.locator('#btn'));
  const resp = await respP;
  let json: SearchOutcome['json'] = null;
  if (resp) {
    const text = await resp.text().catch(() => '');
    try { json = JSON.parse(text); } catch { json = null; }
  }
  return { status: resp ? resp.status() : 0, json, resp };
}

/** Sau search 0-kết-quả, modal "Không tìm thấy" mở sau ~1s — dọn để thao tác tiếp. */
async function settleAndCleanModal(page: Page) {
  await page.waitForTimeout(1200);
  await closeAlertBoxIfOpen(page);
}

/** Grid #Gr_lke đang ở trạng thái rỗng "Không có dữ liệu". */
async function expectGridEmpty(page: Page) {
  await expect(page.locator('#Gr_lke')).toContainText('Không có dữ liệu', { timeout: 10000 });
}

test.describe('Validation form tìm kiếm — cấp đơn xe (/ContractCar/Search)', () => {

  test('TC01 — Form trống toàn bộ (xoá cả ngày) → bấm Tìm: HTTP 200, grid "Không có dữ liệu", không crash', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    // Xoá trắng mọi ô lọc ngày + số HĐ (các dropdown giữ nguyên mặc định)
    await page.locator('#ngayd_timhd').fill('');
    await page.locator('#ngayc_timhd').fill('');
    await page.locator('#so_hd_tim').fill('');

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    expect(out.json?.Total).toBe(0);
    await expectGridEmpty(page);
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC02 — Đến ngày TRƯỚC Từ ngày (10/08/2026 → 01/08/2026): không crash, không dữ liệu vô lý', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#ngayd_timhd').fill('10/08/2026');
    await page.locator('#ngayc_timhd').fill('01/08/2026');

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    // Khoảng đảo logic chứa 0 ngày → không được trả dữ liệu vô lý
    expect(out.json?.Total).toBe(0);
    await expectGridEmpty(page);
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC03 — Ngày dạng chữ "abc"/"xyz": không crash, giá trị được chuẩn hoá', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#ngayd_timhd').fill('abc');
    await page.locator('#ngayc_timhd').fill('xyz');

    const out = await searchAndWait(page);
    // Bấm tìm không được gây crash hay request lỗi 5xx
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);

    // Ô ngày phải được chuẩn hoá về giá trị hợp lệ (không còn "abc")
    const valD = await page.locator('#ngayd_timhd').inputValue();
    expect(valD.toLowerCase()).not.toContain('abc');
    await expectGridEmpty(page);
  });

  test('TC04 — Ngày không hợp lệ "32/13/2026": không crash, được chuẩn hoá về ngày hợp lệ', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#ngayd_timhd').fill('32/13/2026');
    // blur để datepicker chuẩn hoá
    await page.locator('#so_hd_tim').click();
    await page.waitForTimeout(500);

    const valD = await page.locator('#ngayd_timhd').inputValue();
    // Không giữ nguyên ngày rác — phải về dd/MM/yyyy hợp lệ
    expect(valD).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
    await expectGridEmpty(page);
  });

  test('TC05 — Datepicker: mở khi click ô ngày, chọn được ngày, ô nhận giá trị dd/MM/yyyy', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    // Click ô "Từ ngày" → widget datepicker hiện ra (app có datepicker thật)
    await page.locator('#ngayd_timhd').click();
    const widget = page.locator('.datepicker-dropdown');
    await expect(widget).toBeVisible({ timeout: 8000 });

    // Chọn 1 ngày hợp lệ trong tháng hiện tại (không phải ngày old/new)
    const aDay = widget.locator('.day:not(.old):not(.new)').first();
    await aDay.click();
    await page.waitForTimeout(400);

    const val = await page.locator('#ngayd_timhd').inputValue();
    expect(val).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    // Widget đóng sau khi chọn
    await expect(widget).toBeHidden({ timeout: 5000 });
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC06 — Ngày xa: 01/01/2000 → 31/12/2100: HTTP 200, không crash', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#ngayd_timhd').fill('01/01/2000');
    await page.locator('#ngayc_timhd').fill('31/12/2100');

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
    await expectGridEmpty(page);
  });

  test('TC07 — Số HĐ ký tự đặc biệt !@#$%&*(), \'"<&: không crash, không render sai', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    const special = `!@#$%&*(), '"><&`;
    await page.locator('#so_hd_tim').fill(special);

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
    // Grid không được vỡ layout/crash — vẫn ở trạng thái rỗng chuẩn
    await expectGridEmpty(page);
    // Giá trị ô nhập vẫn giữ nguyên chuỗi (form không tự biến dạng)
    await expect(page.locator('#so_hd_tim')).toHaveValue(special);
  });

  test('TC08 — Số HĐ chuỗi 500 ký tự: phải xử lý hoà bình, KHÔNG phun lỗi Oracle thô (B1)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#so_hd_tim').fill('A'.repeat(500));

    const out = await searchAndWait(page, 30000);
    // Hệ thống chuẩn: hoặc tìm bình thường (code 000), hoặc (tệ nhất) validate dài hơn
    // — tuyệt đối KHÔNG trả code "400" kèm thông điệp "ORA-20105 ... PBH_HD_GOC_TIM_WEB"
    expect(out.status).toBe(200);
    expect(out.json?.code, `Chuỗi 500 ký tự gây lỗi DB thô: ${out.json?.message}`).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC09 — Số HĐ unicode + emoji tiếng Việt: HTTP 200, không lỗi encoding', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    const uni = 'HĐ-täo-🚗🚙-Tiếng-Việt-Đà-Nẵng';
    await page.locator('#so_hd_tim').fill(uni);

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
    await expectGridEmpty(page);
    // Chuỗi unicode vẫn nằm nguyên vẹn trong ô (không bị mojibake)
    await expect(page.locator('#so_hd_tim')).toHaveValue(uni);
  });

  test('TC10 — Số HĐ số hợp lệ "123456": HTTP 200, Total 0, grid "Không có dữ liệu"', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#so_hd_tim').fill('123456');

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    expect(out.json?.Total).toBe(0);
    await expectGridEmpty(page);
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC11 — Biển xe/số khung/số máy với ký tự đặc biệt: HTTP 200, grid nguyên vẹn', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    // Chỉ các ô hiển thị trong phần tìm cơ bản (ma_kh_tim nằm trong panel nâng cao ẩn)
    await page.locator('#bien_xe').fill(`30A-123.45 !@#'`);
    await page.locator('#so_khung').fill('<b>&"x"</b>');
    await page.locator('#so_may').fill('🚗-ĐÀ-NẴNG');

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
    await expectGridEmpty(page);
  });

  test('TC12 — Dropdown đơn vị: chọn AGI qua UI (auto-search 200) → bấm Tìm 200 → chọn lại ALL | Tất cả', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    const unitWidget = page.locator('.bootstrap-select:has(#dvi_qly_tim)');
    const toggle = unitWidget.locator('button.dropdown-toggle').first();
    const menu = unitWidget.locator('.dropdown-menu.inner');

    // Mở menu đơn vị qua UI (đường người dùng thật)
    await safeClick(page, toggle);
    await expect(menu).toBeVisible({ timeout: 8000 });

    // Chọn đơn vị cụ thể AGI — onchange auto-trigger 1 lần search
    const autoRespP = page.waitForResponse(SEARCH_URL, { timeout: 20000 }).catch(() => null);
    await menu.locator('li', { hasText: 'AGI-An Giang' }).first().click();
    const autoResp = await autoRespP;
    expect(autoResp ? autoResp.status() : 0, 'Đổi đơn vị phải phản hồi search ổn (200)').toBe(200);
    await expect(page.locator('#dvi_qly_tim')).toHaveValue('AGI');

    // Dọn modal "Không tìm thấy" (kết quả 0) rồi bấm Tìm chủ động
    await settleAndCleanModal(page);
    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');

    // Chọn lại "ALL | Tất cả"
    await settleAndCleanModal(page);
    await safeClick(page, toggle);
    await expect(menu).toBeVisible({ timeout: 8000 });
    const allRespP = page.waitForResponse(SEARCH_URL, { timeout: 20000 }).catch(() => null);
    await menu.locator('li', { hasText: 'ALL | Tất cả' }).first().click();
    const allResp = await allRespP;
    expect(allResp ? allResp.status() : 0, 'Chọn lại Tất cả cũng phải phản hồi ổn (200)').toBe(200);
    await expect(page.locator('#dvi_qly_tim')).toHaveValue('');

    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC13 — XSS reflection: payload HTML (img/onerror) trong Số HĐ KHÔNG được thực thi/inject', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    const payload = `<img src=x onerror="window.__xssProbe=1"><b>XSSMARKER99</b>`;
    await page.locator('#so_hd_tim').fill(payload);

    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');

    // (e) Kiểm tra không có script nào được thực thi / element nào bị inject vào DOM
    const injection = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return {
        onerrorFired: w.__xssProbe === 1,
        injectedImg: document.querySelectorAll('img[src="x"]').length,
        injectedBold: document.querySelectorAll('#Gr_lke b').length,
      };
    });
    expect(injection.onerrorFired, 'onerror KHÔNG được chạy (XSS)').toBe(false);
    expect(injection.injectedImg, 'Không có <img src=x> bị inject vào DOM').toBe(0);
    expect(injection.injectedBold, 'Grid KHÔNG được render payload thành HTML <b>').toBe(0);

    // URL không được dính payload raw
    expect(page.url()).not.toContain('onerror');
    await expectGridEmpty(page);
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC14 — Refresh (F5) sau khi tìm: trang tải lại ổn, form dùng lại được (filter reset)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#so_hd_tim').fill('REFRESH-TEST-123');
    const out1 = await searchAndWait(page);
    expect(out1.status).toBe(200);
    expect(await page.locator('#so_hd_tim').inputValue()).toBe('REFRESH-TEST-123');

    // F5
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
    expect(page.url()).toContain('/ContractCar/Search');

    // Filter KHÔNG giữ sau refresh (app không lưu state) — ghi nhận hành vi thật
    const after = await page.locator('#so_hd_tim').inputValue();
    expect(after).toBe('');

    // Trang vẫn hoàn chỉnh: tìm lại được sau refresh
    await page.locator('#so_hd_tim').fill('AFTER-RELOAD-999');
    const out2 = await searchAndWait(page);
    expect(out2.status).toBe(200);
    expect(out2.json?.code).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC15 — Bấm Tìm 2 lần liên tiếp nhanh: không crash, mọi request đều 200, trang vẫn sống', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    const statuses: number[] = [];
    page.on('response', (r) => {
      if (r.url().includes(SEARCH_PATH)) statuses.push(r.status());
    });

    // 2 click liên tiếp — click thứ 2 có thể bị overlay loading/modal đón (bình thường),
    // quan trọng là KHÔNG crash và mọi request phát đi đều hợp lệ.
    const btn = page.locator('#btn');
    await Promise.all([
      btn.click({ timeout: 8000 }).then(() => 'ok').catch(() => 'blocked'),
      btn.click({ timeout: 8000 }).then(() => 'ok').catch(() => 'blocked'),
    ]);
    // Chờ các request phát đi hoàn tất
    await page.waitForTimeout(4000);

    expect(statuses.length, `Phải có ít nhất 1 request search (nhận: ${statuses.join(',')})`).toBeGreaterThanOrEqual(1);
    for (const s of statuses) expect(s, 'Mọi request search đều phải HTTP 200').toBe(200);

    // Trang vẫn sống sau double-click: dọn modal (nếu có) và search lại ổn
    await settleAndCleanModal(page);
    const out = await searchAndWait(page);
    expect(out.status).toBe(200);
    expect(out.json?.code).toBe('000');
    await expectGridEmpty(page);
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC16 — Enter trong ô Số HĐ: trigger search ngay trong trang, KHÔNG navigation lạ, không crash', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    const respP = page.waitForResponse(SEARCH_URL, { timeout: 20000 }).catch(() => null);
    await page.locator('#so_hd_tim').fill('ENTER-TEST-001');
    await page.locator('#so_hd_tim').press('Enter');
    const resp = await respP;

    // Enter trong ô tìm phải kích hoạt search (không phải submit form gây navigation)
    expect(resp ? resp.status() : 0, 'Enter phải trigger POST SearchResult 200').toBe(200);
    expect(page.url(), 'Không được navigate rời trang tìm kiếm').toContain('/ContractCar/Search');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
    await expectGridEmpty(page);
  });

  test('TC17 — Số HĐ chứa "<script>1</script>": phải xử lý như chuỗi đặc biệt khác, KHÔNG 500 / KHÔNG báo sai "Hết phiên" (B2)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#so_hd_tim').fill('<script>1</script>');

    const out = await searchAndWait(page);
    // Hệ thống chuẩn: các chuỗi đặc biệt khác (kể cả "<b>", "<img onerror>", "</script>",
    // "<SCRIPT>...") đều được xử lý hoà bình 200 code "000" — chuỗi này không thể là ngoại lệ
    expect(out.status, 'Không được trả HTTP 500 cho input search chứa thẻ script').toBe(200);
    expect(out.json?.code, `code phải là "000", nhận: ${out.json?.code} msg=${out.json?.message}`).toBe('000');

    // KHÔNG được hiển thị modal báo "Hết phiên làm việc" khi session vẫn còn nguyên
    const modalText = await page.evaluate(() => {
      const a = document.querySelector('#alertBox');
      return a && getComputedStyle(a).display === 'block' ? a.innerText : '';
    });
    expect(modalText, 'Không được báo sai "Hết phiên làm việc" cho lỗi server của ô tìm').not.toContain('Hết phiên');

    // Session phải vẫn còn: tìm lại bằng chuỗi thường phải ổn
    await page.locator('#so_hd_tim').fill('123');
    const out2 = await searchAndWait(page);
    expect(out2.status).toBe(200);
    expect(out2.json?.code).toBe('000');
    await expectGridEmpty(page);
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('TC18 — Biển xe + số máy chuỗi 500 ký tự: phải xử lý hoà bình, KHÔNG phun lỗi Oracle thô (B1)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = attachErrorCollector(page);
    await gotoSearch(page);

    await page.locator('#bien_xe').fill('D'.repeat(500));
    await page.locator('#so_may').fill('C'.repeat(500));

    const out = await searchAndWait(page, 30000);
    expect(out.status).toBe(200);
    expect(out.json?.code, `500 ký tự gây lỗi DB thô: ${out.json?.message}`).toBe('000');
    expect(errors, `Trang bị JS crash: ${errors.join(' | ')}`).toHaveLength(0);
    await expectGridEmpty(page);
  });

});