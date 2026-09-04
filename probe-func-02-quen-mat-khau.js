// PROBE 02g: lặp lại CHÍNH XÁC chuỗi thao tác của spec — context.on('page') + JS click, đếm tab
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'vi-VN' });
  const page = await context.newPage();
  const opened = [];
  context.on('page', p => {
    opened.push(p);
    console.log('[page event]', p.url());
  });
  try {
    await page.goto('https://uat-capdon.pjico.com.vn/Home/Index', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('load');
    await page.locator('#EMAIL').fill('kientd.pjico@petrolimex.com.vn');
    await page.locator('#email_click .show-password').click();
    await page.locator('#DIV_LOGIN').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#EMAIL').fill('test.quen.matkhau@example.com');
    console.log('focus đang ở đâu:', await page.evaluate(() => document.activeElement && document.activeElement.id));
    await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a')).find(
        (x) => (x.textContent || '').indexOf('Quên') >= 0
      );
      if (!a) throw new Error('Không tìm thấy link "Quên mật khẩu"');
      a.click();
    });
    console.log('Ngay sau evaluate: opened.length =', opened.length);
    await page.waitForTimeout(5000);
    console.log('Sau 5s: opened.length =', opened.length);
    console.log('Context pages:', context.pages().map(p => p.url().slice(0, 70)));
  } catch (e) {
    console.error('LỖI:', e.message);
  } finally {
    await browser.close();
  }
})();