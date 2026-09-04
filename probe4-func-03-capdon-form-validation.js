// PROBE 4 — Xác định nguồn alertBox "Không tìm thấy": do select change hay do search 0-kết-quả?
const { chromium } = require('@playwright/test');

const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();

  async function goSearch() {
    await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);
  }

  try {
    console.log('=== P4.1: handler của #dvi_qly_tim + alertBox trên trang ===');
    await goSearch();
    const info = await page.evaluate(() => {
      const s = document.querySelector('#dvi_qly_tim');
      const inline = s.getAttribute('onchange');
      let jq = null;
      try {
        const evs = window.jQuery ? jQuery._data(s, 'events') : null;
        jq = evs ? Object.keys(evs) : null;
      } catch (e) { jq = 'err ' + e.message; }
      // alertBox default text
      const a = document.querySelector('#alertBox');
      return { inline, jqEvents: jq, alertHtml: a ? a.outerHTML.slice(0, 800) : 'none' };
    });
    console.log(JSON.stringify(info, null, 1));

    console.log('=== P4.2: selectOption → log mọi request trong 3s ===');
    const reqs = [];
    page.on('request', r => reqs.push(r.method() + ' ' + r.url().replace(BASE, '') + ' [' + (r.postData() || '').slice(0, 80) + ']'));
    page.on('response', r => { const i = reqs.findIndex(x => x.includes(r.url().replace(BASE, ''))); });
    await page.locator('#dvi_qly_tim').selectOption('AGI');
    await page.waitForTimeout(3000);
    console.log('requests sau selectOption:');
    reqs.slice(-15).forEach(x => console.log('  ', x));
    const ab = await page.evaluate(() => {
      const a = document.querySelector('#alertBox');
      return { display: getComputedStyle(a).display, text: a.innerText.replace(/\s+/g, ' ').slice(0, 150) };
    });
    console.log('alertBox sau selectOption AGI:', JSON.stringify(ab));

    console.log('=== P4.3: single search 0-kết-quả → alertBox có mở không? ===');
    await goSearch();
    const respP = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 20000 }).catch(() => null);
    await page.locator('#btn').click();
    const r = await respP;
    console.log('search status:', r && r.status());
    await page.waitForTimeout(3000);
    const ab2 = await page.evaluate(() => {
      const a = document.querySelector('#alertBox');
      return { display: getComputedStyle(a).display, text: a.innerText.replace(/\s+/g, ' ').slice(0, 150) };
    });
    console.log('alertBox sau search Total=0:', JSON.stringify(ab2));
    const grid = await page.evaluate(() => document.querySelector('#Gr_lke').innerText.replace(/\s+/g, ' ').slice(0, 120));
    console.log('grid:', grid);

    console.log('=== P4.4: datepicker widget khi click ô ngày ===');
    await goSearch();
    await page.locator('#ngayd_timhd').click();
    await page.waitForTimeout(1000);
    const dp = await page.evaluate(() => {
      const cands = ['.datepicker', '.bootstrap-datepicker-widget', '.bootstrap-datetimepicker-widget', '#ui-datepicker-div', '.daterangepicker', '.datepicker-dropdown'];
      const found = [];
      cands.forEach(c => { const el = document.querySelector(c); if (el) found.push(c + ' → display:' + getComputedStyle(el).display); });
      return found.length ? found : 'KHÔNG thấy widget datepicker nào';
    });
    console.log('datepicker:', JSON.stringify(dp));
    // blur với "32/13/2026"
    await page.locator('#ngayd_timhd').fill('32/13/2026');
    await page.locator('#so_hd_tim').click();
    await page.waitForTimeout(600);
    console.log('val "32/13/2026" sau blur:', JSON.stringify(await page.locator('#ngayd_timhd').inputValue()));
    console.log('val ngayc default:', JSON.stringify(await page.locator('#ngayc_timhd').inputValue()));

    console.log('=== P4.5: bootstrap-select UI — cấu trúc menu khi mở ===');
    await goSearch();
    await page.locator('button.dropdown-toggle', { hasText: /TCT\s*\|/ }).first().click();
    await page.waitForTimeout(800);
    const menuInfo = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.dropdown-menu').forEach(m => {
        const st = getComputedStyle(m);
        out.push({ cls: m.className.slice(0, 80), display: st.display, parentCls: (m.parentElement.className || '').slice(0, 60), items: Array.from(m.querySelectorAll('li')).slice(0, 4).map(li => li.innerText.trim().slice(0, 40)) });
      });
      return out;
    });
    console.log(JSON.stringify(menuInfo, null, 1).slice(0, 2000));
  } catch (e) {
    console.error('PROBE4 LỖI:', e.message);
  } finally {
    await browser.close();
  }
})();