// PROBE 10 — Sau <script> 500: client có hỏng không? reload cứu được không? lặp lại để xác định
const { chromium } = require('@playwright/test');
const BASE = 'https://uat-capdon.pjico.com.vn';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message.slice(0, 150)));

  async function go() {
    await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);
  }
  async function doSearch(label) {
    const respP = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 25000 }).catch(() => null);
    await page.locator('#btn').click();
    const r = await respP;
    let body = '';
    if (r) body = (await r.text().catch(() => ''));
    const alert = await page.evaluate(() => {
      const a = document.querySelector('#alertBox');
      return a && getComputedStyle(a).display === 'block' ? a.innerText.replace(/\s+/g, ' ').slice(0, 100) : '';
    });
    console.log(`[${label}] status=${r ? r.status() : 'NO-RESP'} bodyLen=${body.length} body=${body.replace(/\s+/g, ' ').slice(0, 150)} | alert="${alert}"`);
    await page.waitForTimeout(1000);
    if (await page.locator('#alertBox').isVisible().catch(() => false)) {
      await page.locator('#alertBox .close').first().click().catch(() => {});
      await page.waitForTimeout(250);
      await page.mouse.move(300, 600);
    }
    return r;
  }

  await go();
  console.log('--- LẦN 1: <script>1</script> ---');
  await page.locator('#so_hd_tim').fill('<script>1</script>');
  await doSearch('script-500 lần 1');
  console.log('jsErrors:', jsErrors.length ? jsErrors : 'không có');

  console.log('--- Search lại ngay không reload ---');
  await page.locator('#so_hd_tim').fill('123');
  await doSearch('search "123" ngay sau 500');

  console.log('--- Search lần 2 nữa không reload ---');
  await doSearch('search "123" lần 2 sau 500');

  console.log('--- RELOAD rồi search ---');
  await go();
  await page.locator('#so_hd_tim').fill('123');
  await doSearch('search "123" sau reload');

  console.log('--- Lặp lại <script>1</script> lần 2 (xác định) ---');
  await page.locator('#so_hd_tim').fill('<script>1</script>');
  await doSearch('script-500 lần 2');

  console.log('--- <script> trong bien_xe ---');
  await go();
  await page.locator('#bien_xe').fill('<script>1</script>');
  await doSearch('bien_xe <script>');
  await browser.close();
}
run().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
