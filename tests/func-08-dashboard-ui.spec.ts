/**
 * FUNC-08 — FUNCTIONAL TEST: Dashboard UI — tabs (tab-slider), filter đơn vị, chart legend, modal dữ liệu
 * Trang: /Home/Index (viewport 1600x900). Chart #bar-chart-dt nằm trong #tab3 (Highcharts),
 * dữ liệu từ POST /Dashboard/GeneratedRevenue. Bộ lọc: #kieu_sl (Kiểu số liệu: BHTT_M tháng /
 * BHTT_Y năm), #ngay_ht (Đến ngày), #ma_dvi_sl (Đơn vị quản lý: ALL/TCT/AGI/...).
 * Nút "Theo điều kiện chọn" (button.btn-back.btn-p-input, onclick=DashboardHome_P_CHART('L'))
 * = nút APPLY bộ lọc (gửi POST và vẽ lại chart). Nút "Xem chi tiết các tháng"
 * (button.btn-filter-update) mở modal #modal_MonthlyRevenue chứa bảng #table-dt1.
 * Modal đóng bằng .close (×) — Escape đã biết KHÔNG đóng (finding cũ, không test lại).
 *
 * BẢNG CA KIỂM THỬ (kỳ vọng theo hành vi ĐÚNG của hệ thống chuẩn):
 * | #  | Ca kiểm thử | Kỳ vọng đúng | Kết quả probe |
 * | T01 | Cấu trúc dashboard: #tab3 + chart 3 series + table-dt2 + legend 3 item | Render đủ, không pageerror | PASS |
 * | T02 | Bấm biểu tượng mũi tên .tab-slider--nav (caret thu gọn panel) | Panel bộ lọc đổi trạng thái (thu gọn/mở lại) | FAIL — nút chết, không có handler |
 * | T03 | Mở/đóng/mở lại modal mặc định (ALL): heading + header bảng + số dòng | Title "Chi tiết doanh thu theo từng tháng", header Đơn vị + Tháng 1..12, ≥1 dòng; đóng × sạch backdrop | PASS |
 * | T04 | Chọn AGI (chưa apply) → "Xem chi tiết các tháng" | Modal hiện bảng có dòng dữ liệu, heading đúng | PASS (nhưng modal KHÔNG lọc theo đơn vị đã chọn — note) |
 * | T05 | AGI có doanh thu ở view "Tất cả" → chọn AGI + apply → modal phải có dữ liệu AGI | Modal ≥1 dòng (drill-down phải khớp rollup) | FAIL — modal 0 dòng, chart toàn 0 (LXU/TCH) |
 * | T06 | Chọn TCT + apply → drill-down phòng ban | Chart đổi danh mục, modal ≥1 dòng phòng ban TCT | PASS |
 * | T07 | Đổi "Kiểu số liệu" sang "Doanh thu theo năm" + apply | Series đổi tên "Doanh thu năm trước/nay", chart/modal vẫn hoạt động | PASS |
 * | T08 | Modal khi xem theo NĂM: mọi dòng phải có tên đơn vị | Không có dòng tên đơn vị rỗng | FAIL — có dòng tên rỗng "" |
 * | T09 | Legend: click "Doanh thu tháng trước" → ẩn/hiện series | Toggle ẩn rồi hiện lại đúng chuẩn Highcharts | PASS |
 * | T10 | Hover cột chart → tooltip | Tooltip chứa đúng tên đơn vị đang hover (AGI/TCT) + giá trị series | PASS |
 * | T11 | Dropdown "Đơn vị quản lý": mọi option phải có nhãn hợp lệ | Không option nào rỗng/null | FAIL — DGT & HHO hiển thị chữ "null" |
 * | T12 | Ngày vô hiệu "32/13/2026" + apply | Không crash, không trắng chart im lặng (giữ dữ liệu hoặc báo lỗi) | PASS (chart giữ nguyên, nhưng im lặng — note) |
 * | T13 | Ngày RỖNG + apply → sửa lại ngày hợp lệ + apply | Phải báo lỗi ngày rỗng và sau khi sửa ngày chart phải KHÔI PHỤC dữ liệu | FAIL — chart trắng vĩnh viễn, các lần apply sau vẫn rỗng, phải F5 |
 * | T14 | Refresh giữa chừng (đã chọn AGI + năm) | Về mặc định ALL/tháng, chart có dữ liệu | PASS |
 *
 * Không bấm "Chấp nhận"/"Hủy" trong modal nào; chỉ đóng bằng ×.
 */
import { test, expect, Page } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 900 } });

// ============ HELPERS ============

interface ChartInfo {
  cats: string[];
  series: { name: string; visible: boolean; data: (number | null)[] }[];
}

async function chartInfo(page: Page): Promise<ChartInfo> {
  return page.evaluate(() => {
    const c = (window as any).Highcharts.charts
      .filter(Boolean)
      .find((ch: any) => ch.renderTo && ch.renderTo.id === 'bar-chart-dt');
    if (!c) return null;
    return {
      cats: (c.xAxis[0].categories || []) as string[],
      series: c.series.map((s: any) => ({
        name: s.name as string,
        visible: s.visible as boolean,
        data: s.data.map((d: any) => (typeof d.y === 'number' ? d.y : null)),
      })),
    };
  });
}

async function gotoDashboard(page: Page) {
  await page.goto('/Home/Index', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  // chờ Highcharts vẽ xong chart doanh thu (có dữ liệu ban đầu)
  await page.waitForFunction(() => {
    const c = (window as any).Highcharts?.charts?.filter(Boolean).find((ch: any) => ch.renderTo?.id === 'bar-chart-dt');
    return c && c.series[0] && c.series[0].data.length > 0;
  }, null, { timeout: 45000 });
  await page.waitForTimeout(500);
}

/** Bấm "Theo điều kiện chọn" (APPLY). Nút nằm dưới navbar fixed — cuộn lên đầu,
 *  nếu vẫn bị navbar che thì click qua JS (onclick handler vẫn chạy đúng). */
async function applyFilters(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  try {
    await page.locator('button.btn-back.btn-p-input').click({ timeout: 8000 });
  } catch {
    await page.evaluate(() => document.querySelector('button.btn-back.btn-p-input').click());
  }
  await page.waitForTimeout(3500);
}

interface ModalInfo {
  open: boolean;
  title: string;
  headers: string[];
  allHeadCells: string[];
  rowCount: number;
  units: string[];
  rows: string[][];
}

async function openModal(page: Page): Promise<ModalInfo> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('button.btn-filter-update').click();
  await page.waitForFunction(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    return m && m.classList.contains('in') && getComputedStyle(m).display === 'block';
  }, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  return modalInfo(page);
}

async function modalInfo(page: Page): Promise<ModalInfo> {
  return page.evaluate(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    const t = m.querySelector('#table-dt1');
    return {
      open: m.classList.contains('in') && getComputedStyle(m).display === 'block',
      title: (m.querySelector('h4, .modal-title')?.textContent || '').trim(),
      headers: Array.from(t.querySelectorAll('thead tr:first-child td, thead tr:first-child th')).map(x => x.textContent.trim()),
      allHeadCells: Array.from(t.querySelectorAll('thead td, thead th')).map(x => x.textContent.trim()),
      rowCount: t.querySelectorAll('tbody tr').length,
      units: Array.from(t.querySelectorAll('tbody tr')).map(tr => (tr.querySelector('td')?.textContent || '').trim()),
      rows: Array.from(t.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())),
    };
  });
}

async function closeModal(page: Page) {
  await page.locator('#modal_MonthlyRevenue .close').first().click();
  await page.waitForFunction(() => {
    const m = document.querySelector('#modal_MonthlyRevenue');
    return !m.classList.contains('in') && getComputedStyle(m).display === 'none';
  }, null, { timeout: 10000 });
  await page.waitForTimeout(600);
}

/** Thu thập pageerror + console.error (loại trừ script /ErrorHandler/Index đã biết). */
function watchErrors(page: Page) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 200)));
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('/ErrorHandler/Index')) errs.push('CONSOLE: ' + m.text().slice(0, 200));
  });
  return errs;
}

// ============ TESTS ============

test.describe('FUNC-08 Dashboard UI — tabs, filter đơn vị, legend, modal dữ liệu', () => {
  test.beforeEach(() => { test.setTimeout(120000); });

  test('T01: cấu trúc dashboard — #tab3, chart 3 series, table-dt2, legend, không pageerror', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    // tab-slider chỉ có MỘT tab pane (#tab3) chứa chart — pane hiển thị, không bị che
    const structure = await page.evaluate(() => ({
      tab3: !!document.getElementById('tab3'),
      tab3Visible: document.getElementById('tab3').offsetParent !== null,
      chartDiv: !!document.getElementById('bar-chart-dt'),
      chartInTab3: !!document.getElementById('tab3').querySelector('#bar-chart-dt'),
      table2Visible: (() => { const t = document.getElementById('table-dt2'); return t ? t.offsetParent !== null : false; })(),
      kieu: document.getElementById('kieu_sl')?.value,
      ngay: document.getElementById('ngay_ht')?.value,
      dvi: document.getElementById('ma_dvi_sl')?.value,
      dviLabelText: Array.from(document.querySelectorAll('label')).some(l => (l.textContent || '').includes('Đơn vị quản lý')),
      condbtn: !!document.querySelector('button.btn-back.btn-p-input'),
      detailBtn: !!document.querySelector('button.btn-filter-update'),
      legendItems: document.querySelectorAll('#bar-chart-dt .highcharts-legend-item').length,
    }));
    expect(structure.tab3, 'phải có pane #tab3').toBe(true);
    expect(structure.tab3Visible, '#tab3 phải hiển thị').toBe(true);
    expect(structure.chartInTab3, 'chart #bar-chart-dt phải nằm trong #tab3').toBe(true);
    expect(structure.table2Visible, 'bảng tổng hợp #table-dt2 phải hiển thị').toBe(true);
    expect(structure.dviLabelText, 'phải có nhãn "Đơn vị quản lý"').toBe(true);
    expect(structure.condbtn, 'phải có nút "Theo điều kiện chọn"').toBe(true);
    expect(structure.detailBtn, 'phải có nút "Xem chi tiết các tháng"').toBe(true);
    expect(structure.dvi, 'đơn vị mặc định phải là ALL (Tất cả)').toBe('ALL');
    expect(structure.kieu, 'kiểu mặc định phải là theo tháng').toBe('BHTT_M');

    const info = await chartInfo(page);
    expect(info.series.length, 'chart phải có 3 series').toBe(3);
    expect(info.cats.length, 'chart phải có ≥1 danh mục đơn vị').toBeGreaterThan(0);
    expect(structure.legendItems, 'legend phải có 3 item').toBe(3);

    // (g) không pageerror/console-error mới (đã loại trừ /ErrorHandler/Index)
    expect(errs, 'không được có pageerror/console-error mới').toEqual([]);
  });

  test('T02: biểu tượng mũi tên tab-slider (.tab-slider--nav) phải thu gọn/mở lại panel bộ lọc', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    const state = () => page.evaluate(() => {
      const cont = document.querySelector('.tab-slider--container');
      const nav = document.querySelector('.tab-slider--nav');
      return {
        navCls: nav.className,
        contCls: cont.className,
        contVisible: cont.offsetParent !== null,
        contHeight: Math.round(cont.getBoundingClientRect().height),
      };
    });
    const before = await state();
    await page.locator('.tab-slider--nav').click();
    await page.waitForTimeout(1200);
    const after1 = await state();
    const changed =
      after1.navCls !== before.navCls ||
      after1.contCls !== before.contCls ||
      after1.contVisible !== before.contVisible ||
      Math.abs(after1.contHeight - before.contHeight) > 2;
    // Kỳ vọng đúng: bấm nút thu gọn phải LÀM GÌ ĐÓ (đổi trạng thái panel)
    expect(changed, `bấm .tab-slider--nav không thay đổi gì: before=${JSON.stringify(before)} after=${JSON.stringify(after1)}`).toBe(true);

    // bấm lần 2 phải trở lại trạng thái ban đầu
    await page.locator('.tab-slider--nav').click();
    await page.waitForTimeout(1200);
    const after2 = await state();
    expect(after2.contVisible, 'panel phải mở lại sau lần bấm thứ 2').toBe(before.contVisible);
    expect(errs).toEqual([]);
  });

  test('T03: modal mặc định (Tất cả) — heading, header bảng, có dòng dữ liệu, đóng ×, mở lại', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    const m1 = await openModal(page);
    expect(m1.open, 'modal phải mở').toBe(true);
    expect(m1.title, 'heading modal phải đúng').toBe('Chi tiết doanh thu theo từng tháng');
    // Hàng header 1: Đơn vị + Tháng 1..12 (13 cột); "Tổng cộng" nằm ở hàng thead thứ 2
    expect(m1.headers.length, 'hàng header 1 phải có Đơn vị + 12 tháng (13 cột)').toBeGreaterThanOrEqual(13);
    expect(m1.headers[0], 'cột đầu tiên phải là "Đơn vị"').toBe('Đơn vị');
    expect(m1.headers[1]).toBe('Tháng 1');
    expect(m1.headers[12]).toBe('Tháng 12');
    expect(m1.allHeadCells.some(h => h === 'Tổng cộng'), 'thead phải có dòng/cột "Tổng cộng"').toBe(true);
    expect(m1.rowCount, 'bảng phải có dòng dữ liệu (không rỗng)').toBeGreaterThan(0);
    expect(m1.units.filter(u => u.length > 0).length, 'mọi dòng phải có tên đơn vị').toBe(m1.rowCount);

    // đóng bằng ×: phải sạch hoàn toàn (class in, backdrop, body)
    await closeModal(page);
    const closed = await page.evaluate(() => ({
      in: document.querySelector('#modal_MonthlyRevenue').classList.contains('in'),
      display: getComputedStyle(document.querySelector('#modal_MonthlyRevenue')).display,
      backdrop: document.querySelectorAll('.modal-backdrop').length,
      bodyModalOpen: document.body.classList.contains('modal-open'),
    }));
    expect(closed.in, 'sau khi đóng ×, class "in" phải được gỡ').toBe(false);
    expect(closed.display, 'modal phải display:none').toBe('none');
    expect(closed.backdrop, 'backdrop phải được dọn').toBe(0);
    expect(closed.bodyModalOpen, 'body không còn class modal-open').toBe(false);

    // mở lại: vẫn có dữ liệu
    const m2 = await openModal(page);
    expect(m2.open, 'mở lại modal lần 2 phải thành công').toBe(true);
    expect(m2.rowCount, 'bảng sau khi mở lại vẫn phải có dòng dữ liệu').toBeGreaterThan(0);
    await closeModal(page);
    expect(errs).toEqual([]);
  });

  test('T04: chọn đơn vị AGI (chưa apply) → "Xem chi tiết các tháng" — modal có dòng dữ liệu, heading đúng', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    await page.locator('#ma_dvi_sl').selectOption('AGI');
    await page.waitForTimeout(600);
    const m = await openModal(page);
    expect(m.open).toBe(true);
    expect(m.title, 'heading modal phải đúng').toBe('Chi tiết doanh thu theo từng tháng');
    // theo đề: chọn AGI → modal phải hiện bảng CÓ DÒNG DỮ LIỆU (không rỗng)
    expect(m.rowCount, 'modal phải có dòng dữ liệu khi đã chọn đơn vị AGI').toBeGreaterThan(0);
    expect(m.units.some(u => u.includes('An Giang')), 'bảng phải chứa dòng đơn vị An Giang').toBe(true);
    await closeModal(page);

    // chọn lại "Tất cả" → modal vẫn có nhiều dòng đơn vị
    await page.locator('#ma_dvi_sl').selectOption('ALL');
    await page.waitForTimeout(600);
    const mAll = await openModal(page);
    expect(mAll.rowCount, 'modal với "Tất cả" phải có ≥2 dòng đơn vị').toBeGreaterThanOrEqual(2);
    await closeModal(page);
    expect(errs).toEqual([]);
  });

  test('T05: AGI có doanh thu ở view "Tất cả" — chọn AGI + "Theo điều kiện chọn" → modal phải có dữ liệu AGI', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    // BƯỚC 1: chứng minh AGI có doanh thu trong view "Tất cả" (bảng chi tiết mặc định)
    const mAll = await openModal(page);
    const agiRow = mAll.rows.find(r => (r[0] || '').includes('An Giang'));
    expect(agiRow, 'view "Tất cả" phải có dòng PJICO An Giang').toBeTruthy();
    const agiHasRevenue = agiRow!.slice(1).some(v => v !== '' && v !== '0');
    expect(agiHasRevenue, 'dòng AGI phải có ít nhất một giá trị doanh thu khác 0').toBe(true);
    await closeModal(page);

    // BƯỚC 2: chọn đúng đơn vị AGI + bấm "Theo điều kiện chọn" (apply)
    await page.locator('#ma_dvi_sl').selectOption('AGI');
    await applyFilters(page);

    const chart = await chartInfo(page);
    expect(chart.cats.length, 'chart sau khi chọn AGI phải còn render danh mục').toBeGreaterThan(0);

    // BƯỚC 3: mở modal chi tiết — phải có dữ liệu của AGI (drill-down phải khớp rollup)
    const mAgi = await openModal(page);
    expect(mAgi.title, 'heading modal vẫn phải đúng').toBe('Chi tiết doanh thu theo từng tháng');
    expect(mAgi.rowCount,
      `chọn AGI + apply → modal phải có ≥1 dòng dữ liệu (view "Tất cả" cho thấy AGI có doanh thu), thực tế ${mAgi.rowCount} dòng, chart cats=${JSON.stringify(chart.cats)}`)
      .toBeGreaterThan(0);
    await closeModal(page);
    expect(errs).toEqual([]);
  });

  test('T06: chọn TCT + apply → drill-down phòng ban TCT hoạt động', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    await page.locator('#ma_dvi_sl').selectOption('TCT');
    await applyFilters(page);

    const chart = await chartInfo(page);
    expect(chart.cats.length, 'chart phải hiển thị danh mục drill-down của TCT').toBeGreaterThan(0);
    // drill-down TCT là các phòng ban — không được trùng danh mục top-5 đơn vị cũ
    const tctDetail = chart.cats.some(c => !['TCT', 'AGI', 'BNI', 'BPH', 'HNO'].includes(c));
    expect(tctDetail, 'chart phải đổi sang danh mục chi tiết (phòng ban) của TCT').toBe(true);

    const m = await openModal(page);
    expect(m.rowCount, 'modal drill-down TCT phải có ≥1 dòng phòng ban').toBeGreaterThan(0);
    expect(m.units.filter(u => u.length > 0).length, 'mọi dòng phải có tên phòng ban').toBe(m.rowCount);
    await closeModal(page);

    // trở lại "Tất cả"
    await page.locator('#ma_dvi_sl').selectOption('ALL');
    await applyFilters(page);
    const chartAll = await chartInfo(page);
    expect(chartAll.cats, 'trở lại "Tất cả" phải có danh mục đơn vị (TCT...)').toContain('TCT');
    expect(errs).toEqual([]);
  });

  test('T07: đổi "Kiểu số liệu" sang "Doanh thu theo năm" + apply → chart/modal chuyển chế độ năm', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    await page.locator('#kieu_sl').selectOption('BHTT_Y');
    await applyFilters(page);

    const chart = await chartInfo(page);
    expect(chart.series.length, 'chart năm vẫn phải có 3 series').toBe(3);
    expect(chart.series.some(s => s.name.includes('năm trước')), 'phải có series "Doanh thu năm trước": ' + JSON.stringify(chart.series.map(s => s.name))).toBe(true);
    expect(chart.series.some(s => s.name.includes('năm nay')), 'phải có series "Doanh thu năm nay"').toBe(true);
    expect(chart.cats.length, 'chart năm phải có danh mục').toBeGreaterThan(0);

    const m = await openModal(page);
    expect(m.open, 'modal vẫn phải mở được khi xem theo năm').toBe(true);
    expect(m.title).toBe('Chi tiết doanh thu theo từng tháng');
    await closeModal(page);

    // trở lại theo tháng
    await page.locator('#kieu_sl').selectOption('BHTT_M');
    await applyFilters(page);
    const chartBack = await chartInfo(page);
    expect(chartBack.series.some(s => s.name.includes('tháng trước')), 'trở lại chế độ tháng phải có series "Doanh thu tháng trước"').toBe(true);
    expect(errs).toEqual([]);
  });

  test('T08: modal khi xem theo NĂM — không được có dòng nào rỗng tên đơn vị', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    await page.locator('#kieu_sl').selectOption('BHTT_Y');
    await applyFilters(page);

    const m = await openModal(page);
    expect(m.open).toBe(true);
    expect(m.rowCount, 'modal năm phải có dòng dữ liệu').toBeGreaterThan(0);
    const emptyNames = m.units.filter(u => u === '');
    expect(emptyNames.length,
      `mọi dòng bảng phải hiển thị tên đơn vị — thực tế có ${emptyNames.length} dòng tên rỗng: ${JSON.stringify(m.units)}`)
      .toBe(0);
    await closeModal(page);
    expect(errs).toEqual([]);
  });

  test('T09: legend chart — click ẩn/hiện series "Doanh thu tháng trước"', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    const items = page.locator('#bar-chart-dt .highcharts-legend-item');
    await expect(items).toHaveCount(3);

    const before = await chartInfo(page);
    expect(before.series[0].visible, 'series "Doanh thu tháng trước" phải hiển thị ban đầu').toBe(true);

    // click legend item 0 → ẩn series
    await items.nth(0).click();
    await page.waitForTimeout(800);
    const hidden = await chartInfo(page);
    expect(hidden.series[0].visible, 'click legend phải ẨN series "Doanh thu tháng trước"').toBe(false);
    expect(hidden.series[1].visible, 'series "Doanh thu tháng hiện tại" vẫn hiển thị').toBe(true);
    expect(hidden.series[2].visible, 'series "Tỷ lệ tăng trưởng" vẫn hiển thị').toBe(true);

    // click lần 2 → hiện lại
    await items.nth(0).click();
    await page.waitForTimeout(800);
    const restored = await chartInfo(page);
    expect(restored.series[0].visible, 'click legend lần 2 phải HIỆN LẠI series').toBe(true);
    expect(errs).toEqual([]);
  });

  test('T10: hover cột chart — tooltip hiện đúng đơn vị đang hover', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const pts = await page.evaluate(() => {
      const c = (window as any).Highcharts.charts.filter(Boolean).find((ch: any) => ch.renderTo?.id === 'bar-chart-dt');
      const r = document.getElementById('bar-chart-dt').getBoundingClientRect();
      return c.series[0].points.map((p: any) => ({ cat: p.category, x: r.left + p.plotX, y: r.top + p.plotY }));
    });
    expect(pts.length).toBeGreaterThan(0);

    const hoverAndRead = async (cat: string) => {
      const p = pts.find(q => q.cat === cat);
      const y = p ? p.y : pts[0].y;
      const x = p ? p.x : pts[0].x;
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      await page.mouse.move(x, y + 30, { steps: 10 });
      await page.waitForTimeout(1400);
      return page.evaluate(() =>
        Array.from(document.querySelectorAll('#bar-chart-dt .highcharts-tooltip'))
          .map(t => (t.textContent || '').trim().replace(/\s+/g, ' '))
          .join(' | ').slice(0, 300));
    };

    const agiTip = await hoverAndRead('AGI');
    expect(agiTip, 'tooltip khi hover cột AGI phải có nội dung').not.toBe('');
    expect(agiTip.includes('An Giang'), `tooltip phải chứa tên đơn vị đang hover (AGI): "${agiTip}"`).toBe(true);
    expect(agiTip.includes('Doanh thu'), 'tooltip phải chứa giá trị series Doanh thu').toBe(true);

    const tctTip = await hoverAndRead('TCT');
    expect(tctTip.includes('Tổng Công ty') || tctTip.includes('TCT'), `tooltip hover TCT phải chứa "Tổng Công ty": "${tctTip}"`).toBe(true);
    expect(errs).toEqual([]);
  });

  test('T11: dropdown "Đơn vị quản lý" — không option nào hiển thị nhãn rỗng/"null"', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    const bad = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ma_dvi_sl option'))
        .map(o => ({ value: o.value, label: (o.textContent || '').trim() }))
        .filter(o => o.label === '' || o.label.toLowerCase() === 'null'));
    expect(bad, `dropdown không được có option nhãn rỗng/"null": ${JSON.stringify(bad)}`).toEqual([]);

    // chọn lần lượt TCT/AGI/BGI (đơn vị mẫu) phải đặt giá trị đúng
    for (const v of ['TCT', 'AGI', 'BGI']) {
      await page.locator('#ma_dvi_sl').selectOption(v);
      expect(await page.locator('#ma_dvi_sl').inputValue(), 'giá trị dropdown phải cập nhật theo lựa chọn').toBe(v);
    }
    await page.locator('#ma_dvi_sl').selectOption('ALL');
    expect(errs).toEqual([]);
  });

  test('T12: ngày vô hiệu "32/13/2026" + apply — không crash, không trắng chart im lặng', async ({ page }) => {
    const errs = watchErrors(page);
    const dialogs: string[] = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    await gotoDashboard(page);

    await page.locator('#ngay_ht').fill('32/13/2026');
    await applyFilters(page);

    const info = await chartInfo(page);
    expect(info, 'chart vẫn phải tồn tại sau ngày vô hiệu').toBeTruthy();
    // Kỳ vọng đúng: app phải BÁO LỖI hoặc giữ nguyên dữ liệu — không được trắng chart im lặng
    const hasData = info.cats.length > 0 && info.series[0].data.length > 0;
    const hasErrorShown = dialogs.length > 0;
    expect(hasData || hasErrorShown,
      `ngày vô hiệu "32/13/2026": app phải giữ dữ liệu hoặc báo lỗi — thực tế cats=${JSON.stringify(info?.cats)} dataLen=${info ? info.series[0].data.length : -1}`)
      .toBe(true);
    // modal vẫn phải mở được sau ca này
    const m = await openModal(page);
    expect(m.open).toBe(true);
    await closeModal(page);
    expect(errs).toEqual([]);
  });

  test('T13: ngày RỖNG + apply → sửa lại ngày hợp lệ + apply → chart phải KHÔI PHỤC dữ liệu', async ({ page }) => {
    const errs = watchErrors(page);
    const dialogs: string[] = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    await gotoDashboard(page);

    const defaultDate = await page.locator('#ngay_ht').inputValue();
    expect(defaultDate, 'trường "Đến ngày" phải có giá trị mặc định (dd/MM/yyyy)').toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    // BƯỚC 1: xóa trống ngày rồi bấm "Theo điều kiện chọn"
    await page.locator('#ngay_ht').fill('');
    await applyFilters(page);
    const blank = await chartInfo(page);
    const blankHasData = blank.cats.length > 0 && blank.series[0].data.length > 0;
    // Kỳ vọng đúng: ngày rỗng phải bị chặn/báo lỗi; nếu app vẫn vẽ lại chart thì không được trắng im lặng
    expect(blankHasData || dialogs.length > 0,
      `ngày rỗng + apply: phải có dữ liệu hoặc có thông báo lỗi — thực tế cats=${JSON.stringify(blank?.cats)}`)
      .toBe(true);

    // BƯỚC 2 (khôi phục): nhập lại ngày hợp lệ + apply — chart phải có dữ liệu trở lại
    await page.locator('#ngay_ht').fill(defaultDate);
    await applyFilters(page);
    const recovered = await chartInfo(page);
    const recoveredHasData = recovered.cats.length > 0 && recovered.series[0].data.length > 0;
    expect(recoveredHasData,
      `sau khi sửa lại ngày hợp lệ "${defaultDate}" và apply, chart phải khôi phục dữ liệu — thực tế cats=${JSON.stringify(recovered?.cats)} (chỉ F5 mới hết)`)
      .toBe(true);
    expect(errs).toEqual([]);
  });

  test('T14: refresh giữa chừng (đã chọn AGI + kiểu năm) — trang phải về mặc định an toàn', async ({ page }) => {
    const errs = watchErrors(page);
    await gotoDashboard(page);

    await page.locator('#ma_dvi_sl').selectOption('AGI');
    await page.locator('#kieu_sl').selectOption('BHTT_Y');
    await page.waitForTimeout(500);
    expect(await page.locator('#ma_dvi_sl').inputValue()).toBe('AGI');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForFunction(() => {
      const c = (window as any).Highcharts?.charts?.filter(Boolean).find((ch: any) => ch.renderTo?.id === 'bar-chart-dt');
      return c && c.series[0] && c.series[0].data.length > 0;
    }, null, { timeout: 45000 });

    const state = await page.evaluate(() => ({
      dvi: document.getElementById('ma_dvi_sl')?.value,
      kieu: document.getElementById('kieu_sl')?.value,
      ngay: document.getElementById('ngay_ht')?.value,
    }));
    expect(state.dvi, 'sau F5 filter đơn vị phải về mặc định ALL').toBe('ALL');
    expect(state.kieu, 'sau F5 kiểu số liệu phải về mặc định theo tháng').toBe('BHTT_M');
    expect(state.ngay, 'sau F5 "Đến ngày" phải về ngày hiện tại').toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    const info = await chartInfo(page);
    expect(info.cats.length, 'chart sau F5 phải có dữ liệu').toBeGreaterThan(0);
    expect(errs).toEqual([]);
  });
});