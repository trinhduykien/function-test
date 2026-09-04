// PROBE — Khám phá form tìm kiếm /ContractCar/Search trước khi viết spec
// Khu vực: Validation form tìm kiếm — phân hệ cấp đơn xe (slug 03-capdon-form-validation)
const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();

  const respLog = [];
  page.on('response', r => {
    const u = r.url();
    if (u.includes('ErrorHandler')) return;
    respLog.push(`${r.status()} ${r.request().method()} ${u.slice(0, 160)}`);
  });
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push('CONSOLE: ' + m.text().slice(0, 200)); });

  try {
    // 1. Vào trang
    const resp = await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
    console.log('== HTTP status /ContractCar/Search:', resp.status());
    await page.waitForLoadState('load');
    console.log('== URL sau goto:', page.url());
    if (page.locator('#EMAIL').count()) console.log('!! SESSION HẾT HẠN — thấy ô #EMAIL');

    await page.waitForTimeout(3000);

    // 2. Liệt kê input/select trong vùng form
    const fields = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('input, select, textarea').forEach(el => {
        out.push({
          tag: el.tagName, type: el.type, id: el.id, name: el.name || null,
          cls: (el.className || '').toString().slice(0, 80),
          placeholder: el.placeholder || null,
          val: (el.value || '').slice(0, 40),
          options: el.tagName === 'SELECT' ? Array.from(el.options).slice(0, 5).map(o => o.value + '|' + o.text) : undefined,
          optCount: el.tagName === 'SELECT' ? el.options.length : undefined,
        });
      });
      return out;
    });
    console.log('== FIELDS:');
    fields.forEach(f => console.log(JSON.stringify(f)));

    // 3. Liệt kê các nút bấm
    const buttons = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, a.btn, input[type=submit], input[type=button]').forEach(el => {
        out.push({ tag: el.tagName, id: el.id, cls: (el.className || '').toString().slice(0, 100), text: (el.textContent || '').trim().slice(0, 40), type: el.type || null });
      });
      return out;
    });
    console.log('== BUTTONS:');
    buttons.forEach(b => console.log(JSON.stringify(b)));

    // 4. Tìm bảng/grid + text "Không có dữ liệu"
    const gridInfo = await page.evaluate(() => {
      const out = { tables: [], emptyTexts: [] };
      document.querySelectorAll('table').forEach(t => out.tables.push({ id: t.id, cls: (t.className || '').slice(0, 80), rows: t.rows.length }));
      const w = document.body.innerText.includes('Không có dữ liệu');
      out.emptyTexts.push('body chứa "Không có dữ liệu": ' + w);
      return out;
    });
    console.log('== GRID:', JSON.stringify(gridInfo));

    // 5. Datepicker? kiểm tra thuộc tính input date
    const dateAttrs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).filter(i => /date|ngay|ngày/i.test(i.id + ' ' + i.name + ' ' + i.className)).map(i => ({
        id: i.id, name: i.name, cls: (i.className || '').slice(0, 100), hasDatepicker: !!i.getAttribute('data-datepicker') || i.className.includes('datepicker')
      }));
    });
    console.log('== DATE-ISH INPUTS:', JSON.stringify(dateAttrs));

    // 6. Thử bấm TÌM với form trống — bắt response
    const btn = page.locator('button.btn-blue').first();
    console.log('== button.btn-blue count:', await page.locator('button.btn-blue').count());
    console.log('== button.btn-blue text:', JSON.stringify(await btn.textContent()));

    respLog.length = 0;
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
    ]);
    const clickP = btn.click();
    await clickP;
    await page.waitForTimeout(4000);
    console.log('== RESPONSES sau bấm TÌM (form trống):');
    respLog.forEach(r => console.log('   ', r));

    const afterEmpty = await page.evaluate(() => ({
      hasEmptyText: document.body.innerText.includes('Không có dữ liệu'),
      total: (document.body.innerText.match(/Tổng[\s\S]{0,30}/g) || []).slice(0, 3),
      bodySnippet: document.body.innerText.slice(0, 500),
    }));
    console.log('== SAU TÌM TRỐNG:', JSON.stringify(afterEmpty, null, 1).slice(0, 1200));

    // 7. Thử ngày đảo: fill vào ô date (nếu có) — cần biết selector trước. Tạm dừng probe ở đây.
    console.log('== PAGE URL cuối:', page.url());
    console.log('== Console errors (bỏ qua ErrorHandler):', consoleErrors.filter(e => !e.includes('ErrorHandler')).length);
    consoleErrors.filter(e => !e.includes('ErrorHandler')).slice(0, 5).forEach(e => console.log('   ', e.slice(0, 200)));

    // dump HTML form để xem cấu trúc
    const formHtml = await page.evaluate(() => {
      const f = document.querySelector('form') || document.querySelector('.search-form, .form-search, [class*=search]');
      return f ? f.outerHTML.slice(0, 3000) : 'NO FORM FOUND';
    });
    fs.writeFileSync('probe-form-dump.html', formHtml);
    console.log('== Đã dump form HTML vào probe-form-dump.html');
  } catch (e) {
    console.error('PROBE LỖI:', e.message);
  } finally {
    await browser.close();
  }
})();