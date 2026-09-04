/**
 * PROBE 4 func-01-login-negative — xác nhận cuối:
 * 1) #alertBox hiển thị thật (isVisible theo Playwright) sau ca nonexistent;
 * 2) gõ email thật bằng bàn phím (pressSequentially) → giá trị có bị biến đổi không; Enter →DIV_LOGIN?
 * 3) nút ĐĂNG NHẬP selector chính xác.
 */
const { chromium } = require('playwright');
const BASE = 'https://uat-capdon.pjico.com.vn';
const NONEXIST = 'func.qa.khongtontai.8899@petrolimex.com.vn';
const REAL = 'kientd.pjico@petrolimex.com.vn';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'vi-VN' });
  const page = await context.newPage();
  await page.goto(BASE + '/?reason=expired', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('#EMAIL', { timeout: 15000 });

  // 1) nonexistent → modal visible theo Playwright?
  await page.fill('#EMAIL', NONEXIST);
  await page.click('#email_click .show-password');
  await page.waitForTimeout(2500);
  console.log('alertBox isVisible=' + await page.isVisible('#alertBox'));
  console.log('alertBox p text=' + JSON.stringify(await page.textContent('#alertBox .body-alert p')));
  console.log('alertBox style.display=' + await page.evaluate(() => getComputedStyle(document.querySelector('#alertBox')).display));
  console.log('backdrop exists=' + await page.evaluate(() => !!document.querySelector('.modal-backdrop')));
  // đóng bằng .close (×)
  await page.click('#alertBox .close');
  await page.waitForTimeout(800);
  console.log('after close, isVisible=' + await page.isVisible('#alertBox'));
  // #pas vẫn không hiện
  console.log('pas isVisible=' + await page.isVisible('#pas'));

  // 2) gõ bàn phím email thật + Enter
  const ctx2 = await browser.newContext({ locale: 'vi-VN' });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/?reason=expired', { waitUntil: 'load', timeout: 60000 });
  await p2.waitForSelector('#EMAIL', { timeout: 15000 });
  await p2.click('#EMAIL');
  await p2.locator('#EMAIL').pressSequentially(REAL, { delay: 10 });
  const val = await p2.inputValue('#EMAIL');
  console.log('\ntyped value=' + JSON.stringify(val));
  const divBefore = await p2.isVisible('#DIV_LOGIN');
  await p2.press('#EMAIL', 'Enter');
  await p2.waitForTimeout(2500);
  console.log('DIV_LOGIN before Enter=' + divBefore + ' after Enter=' + await p2.isVisible('#DIV_LOGIN'));
  console.log('pas visible=' + await p2.isVisible('#pas'));
  // nút ĐĂNG NHẬP
  const btn = p2.locator('button.btn-default.w100');
  console.log('ĐĂNG NHẬP count=' + await btn.count() + ' text=' + JSON.stringify((await btn.textContent() || '').trim()));

  // 3) sau khi DIV_LOGIN hiện, đổi email thành nonexistent rồi click mũi tên → có quay lại bước email + báo lỗi?
  await p2.fill('#EMAIL', NONEXIST);
  await p2.click('#email_click .show-password');
  await p2.waitForTimeout(2500);
  console.log('\nsau khi đổi email nonexistent + click: DIV_LOGIN=' + await p2.isVisible('#DIV_LOGIN') +
    ' alertBox visible=' + await p2.isVisible('#alertBox') +
    ' alertText=' + JSON.stringify(await p2.textContent('#alertBox .body-alert p')));

  await browser.close();
  console.log('PROBE4 DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });