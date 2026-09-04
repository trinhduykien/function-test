// PROBE 8 — Pinpoint các input gây HTTP 500: độ dài Số HĐ, từng trường đặc biệt, payload XSS
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();

  async function trySearch(label, fillFn) {
    await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);
    await fillFn();
    const respP = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 25000 }).catch(() => null);
    await page.locator('#btn').click();
    const r = await respP;
    let body = '';
    if (r) body = (await r.text().catch(() => '')).slice(0, 250);
    // UI sau lỗi: modal? grid?
    await page.waitForTimeout(1500);
    const ui = await page.evaluate(() => ({
      alertBox: document.querySelector('#alertBox') ? getComputedStyle(document.querySelector('#alertBox')).display : 'none',
      alertText: (document.querySelector('#alertBox')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
      grid: (document.querySelector('#Gr_lke')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
    }));
    console.log(`[${label}] status=${r ? r.status() : 'NO-RESP'} body=${body.replace(/\n/g, ' ')}`);
    console.log(`    UI: ${JSON.stringify(ui)}`);
    // dọn modal
    if (ui.alertBox === 'block') {
      await page.locator('#alertBox .close').first().click().catch(() => {});
      await page.waitForTimeout(300);
      await page.mouse.move(300, 600);
    }
  }

  // 1. Độ dài Số HĐ
  for (const n of [100, 200, 255, 256, 300, 500]) {
    await trySearch(`so_hd_tim ${n} 'A'`, () => page.locator('#so_hd_tim').fill('A'.repeat(n)));
  }
  // 2. Từng trường đặc biệt
  await trySearch("so_hd_tim '<b>&x</b>'", () => page.locator('#so_hd_tim').fill('<b>&x</b>'));
  await trySearch("so_hd_tim '<script>1</script>'", () => page.locator('#so_hd_tim').fill('<script>1</script>'));
  await trySearch('so_hd_tim img-onerror', () => page.locator('#so_hd_tim').fill('<img src=x onerror="window.__a=1">'));
  await trySearch("bien_xe \"30A-123.45 !@#'\"", () => page.locator('#bien_xe').fill("30A-123.45 !@#'"));
  await trySearch('so_khung <b>&"x"</b>', () => page.locator('#so_khung').fill('<b>&"x"</b>'));
  await trySearch('so_may emoji+200X', () => page.locator('#so_may').fill('🚗' + 'X'.repeat(200)));
  await trySearch("ma_kh_tim đặc biệt", () => page.locator('#ma_kh_tim').fill("!@#$%&*(), '\"><&"));
  await browser.close();
}
run().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
