// PROBE 6 — Tìm cách đóng mega-panel nav an toàn sau khi đóng alertBox, để click #btn ổn định
const { chromium } = require('@playwright/test');

const BASE = 'https://uat-capdon.pjico.com.vn';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1700, height: 1000 } });
  const page = await context.newPage();

  async function panelState() {
    return await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.pj-menu-panel--mega').forEach(p => {
        if (getComputedStyle(p).display === 'block') out.push(p.parentElement.className.slice(0, 60));
      });
      return out;
    });
  }

  try {
    await page.goto(BASE + '/ContractCar/Search', { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.locator('#so_hd_tim').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    console.log('=== P6.1: panels mở ban đầu:', JSON.stringify(await panelState()));

    // trigger search 0-kết-quả → alertBox mở
    const respP = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 20000 }).catch(() => null);
    await page.locator('#btn').click();
    await respP;
    await page.waitForTimeout(1500);
    console.log('alertBox visible:', await page.locator('#alertBox').isVisible());

    // click ×
    await page.locator('#alertBox .close').first().click();
    await page.waitForTimeout(300);
    await page.locator('#alertBox').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    console.log('P6.2: sau đóng modal, panels mở:', JSON.stringify(await panelState()));

    // đưa chuột về giữa trang
    await page.mouse.move(300, 600);
    await page.waitForTimeout(500);
    console.log('P6.3: sau mouse.move(300,600), panels mở:', JSON.stringify(await panelState()));

    // thử click #btn
    let clicked = true;
    try {
      const rp = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 15000 }).catch(() => null);
      await page.locator('#btn').click({ timeout: 8000 });
      const r = await rp;
      console.log('P6.4: click #btn OK, search:', r ? r.status() : 'none');
    } catch (e) {
      clicked = false;
      console.log('P6.4: click #btn bị chặn:', e.message.split('\n')[0]);
    }

    if (!clicked) {
      // đóng mega panel: click vào pj-top-item đang mở panel
      const info = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('.pj-menu-panel--mega').forEach(p => {
          if (getComputedStyle(p).display === 'block') {
            const top = p.closest('.pj-top-item, .item.dropdown');
            out.push({ panelCls: p.className.slice(0, 60), topCls: top ? top.className.slice(0, 80) : null, topId: top ? top.id : null, topText: top ? top.textContent.trim().slice(0, 30) : null });
          }
        });
        return out;
      });
      console.log('P6.5 panel info:', JSON.stringify(info));
      // click toggle top-item tương ứng
      await page.mouse.move(30, 30); // về vùng nav trước
      await page.waitForTimeout(300);
      const topItem = page.locator('.pj-top-item').filter({ has: page.locator('.pj-menu-panel--mega') });
      const n = await topItem.count();
      console.log('pj-top-item count có panel:', n);
      // click top item có panel display block
      const idx = await page.evaluate(() => {
        let i = 0, found = -1;
        document.querySelectorAll('.pj-top-item').forEach(el => {
          const p = el.querySelector('.pj-menu-panel--mega');
          if (p && getComputedStyle(p).display === 'block') found = i;
          i++;
        });
        return found;
      });
      console.log('index top-item mở panel:', idx);
      if (idx >= 0) {
        await page.locator('.pj-top-item').nth(idx).click({ timeout: 5000 });
        await page.waitForTimeout(600);
        console.log('P6.6 sau click toggle, panels mở:', JSON.stringify(await panelState()));
        const rp2 = page.waitForResponse('**/ContractPublic/SearchResult', { timeout: 15000 }).catch(() => null);
        await page.locator('#btn').click({ timeout: 8000 });
        const r2 = await rp2;
        console.log('P6.7 click #btn sau đóng panel, search:', r2 ? r2.status() : 'none');
      }
    }
  } catch (e) {
    console.error('PROBE6 LỖI:', e.message);
  } finally {
    await browser.close();
  }
})();