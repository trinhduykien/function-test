// PROBE 9 — Ngưỡng độ dài ORA error, <script> 500 body, các field khác 500 ký tự, session còn sống không
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();

  async function go() {
    await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);
  }
  async function trySearch(label, fillFn) {
    const respP = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 25000 }).catch(() => null);
    await page.locator('#btn').click();
    const r = await respP;
    let body = '';
    if (r) body = (await r.text().catch(() => ''));
    console.log(`[${label}] status=${r ? r.status() : 'NO-RESP'} body=${body.replace(/\s+/g, ' ').slice(0, 300)}`);
    await page.waitForTimeout(1200);
    if (await page.locator('#alertBox').isVisible().catch(() => false)) {
      await page.locator('#alertBox .close').first().click().catch(() => {});
      await page.waitForTimeout(250);
      await page.mouse.move(300, 600);
    }
    return r;
  }

  await go();
  // 1. Ngưỡng độ dài
  for (const n of [350, 400, 420, 450]) {
    await page.locator('#so_hd_tim').fill('A'.repeat(n));
    await trySearch(`so_hd_tim ${n} 'A'`);
  }
  // 2. Các field khác 500 ký tự
  await go();
  await page.locator('#so_khung').fill('B'.repeat(500));
  await trySearch('so_khung 500');
  await page.locator('#so_may').fill('C'.repeat(500));
  await trySearch('so_may 500');
  await page.locator('#bien_xe').fill('D'.repeat(500));
  await trySearch('bien_xe 500');

  // 3. <script> — body 500 đầy đủ + sau đó session còn sống?
  await go();
  await page.locator('#so_hd_tim').fill('<script>alert(1)</script>');
  const r = await trySearch('so_hd_tim <script>alert(1)</script>');
  if (r) {
    const body = await r.text().catch(() => '');
    console.log('--- 500 BODY (1200 ký tự đầu):');
    console.log(body.replace(/\r/g, '').slice(0, 1200));
  }
  // session thật sự còn? search lại sau đó
  await page.locator('#so_hd_tim').fill('123');
  await trySearch('search lại sau 500 (session sống?)');

  // 4. các biến thể tag
  await go();
  await page.locator('#so_hd_tim').fill('a<script b');
  await trySearch('so_hd_tim "a<script b"');
  await page.locator('#so_hd_tim').fill('</script>');
  await trySearch('so_hd_tim "</script>"');
  await page.locator('#so_hd_tim').fill('<SCRIPT>1</SCRIPT>');
  await trySearch('so_hd_tim uppercase <SCRIPT>');
  await browser.close();
}
run().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
