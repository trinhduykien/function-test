// PROBE v9: phần còn thiếu — ngày rác, Enter, ObjectSearch đầy đủ, hành vi sau false-expired
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const log = (...a) => console.log(...a);

  async function freshPage() {
    const context = await browser.newContext({ storageState: 'd:/bore/13/.auth/uat.json', viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    return { context, page };
  }
  const modalState = (page) => page.evaluate(() => {
    const a = document.getElementById('alertBox');
    const p = a ? a.querySelector('.body-alert p') : null;
    return { display: a ? getComputedStyle(a).display : 'none-el', msg: p ? p.textContent.trim() : null };
  }).catch(() => ({ display: 'eval-fail', msg: null }));

  // ===== A. Search: ngày + Enter =====
  log('===== A. SEARCH =====');
  {
    const { context, page } = await freshPage();
    await page.goto('https://uat-capdon.pjico.com.vn/ClaimGeneral/Search', { waitUntil: 'domcontentloaded', timeout: 90000 });
    const sbtn = page.locator('button.btn-square.btn-p-input', { hasText: 'Tìm hồ sơ' }).first();
    const close = () => page.locator('#alertBox .close').dispatchEvent('click').catch(()=>{});

    await page.locator('#ngayd').fill('not-a-date');
    await page.mouse.move(400, 500);
    await sbtn.click({ timeout: 10000 }).catch(e=>log('click err', e.message.split('\n')[0]));
    await page.waitForTimeout(1300);
    log('[ngayd not-a-date] giữ value:', await page.locator('#ngayd').inputValue(), '| modal:', JSON.stringify(await modalState(page)));
    await close(); await page.waitForTimeout(400);

    await page.locator('#ngayd').fill('32/13/2025');
    await page.mouse.move(400, 500);
    await sbtn.click({ timeout: 10000 }).catch(()=>{});
    await page.waitForTimeout(1300);
    log('[ngayd 32/13/2025] giữ:', await page.locator('#ngayd').inputValue(), '| modal:', JSON.stringify(await modalState(page)));
    await close(); await page.waitForTimeout(400);
    await page.locator('#ngayd').fill('');

    await page.locator('#so_hd').fill('HĐ-123');
    await page.locator('#so_hd').press('Enter');
    await page.waitForTimeout(1500);
    log('[so_hd HĐ-123 + Enter] modal:', JSON.stringify(await modalState(page)));
    await close(); await page.waitForTimeout(400);
    await page.locator('#so_hd').fill('');

    // false-expired: sau đó trang có tự redirect?
    await page.locator('#so_hs').fill('<script>alert(1)</script>');
    await page.mouse.move(400, 500);
    await sbtn.click({ timeout: 10000 }).catch(()=>{});
    await page.waitForTimeout(1500);
    log('[script so_hs] modal:', JSON.stringify(await modalState(page)), '| URL:', page.url());
    await close(); await page.waitForTimeout(3000);
    log('[script so_hs +3s sau close] URL:', page.url());
    await page.mouse.move(400, 500);
    await sbtn.click({ timeout: 10000 }).catch(e=>log('click lại err', e.message.split('\n')[0]));
    await page.waitForTimeout(1500);
    log('[script so_hs, click lại] URL:', page.url(), '| modal:', JSON.stringify(await modalState(page)));
    await context.close();
  }

  // ===== B. ObjectSearch =====
  log('\n===== B. OBJECTSEARCH =====');
  {
    const { context, page } = await freshPage();
    await page.goto('https://uat-capdon.pjico.com.vn/ClaimGeneral/ObjectSearch', { waitUntil: 'domcontentloaded', timeout: 90000 });
    const tbtn = page.locator('button', { hasText: 'Tìm đối tượng' }).first();
    const close = () => page.locator('#alertBox .close').dispatchEvent('click').catch(()=>{});

    async function go(tag, fillFn) {
      await fillFn();
      await page.mouse.move(400, 500);
      await tbtn.click({ timeout: 10000 }).catch(e => log(tag, 'click err', e.message.split('\n')[0]));
      await page.waitForTimeout(1600);
      log(tag, '→ modal:', JSON.stringify(await modalState(page)), '| URL:', page.url().split('/').slice(-2).join('/'));
      await close(); await page.waitForTimeout(450);
    }

    // B1: rỗng → "Phải nhập số hợp đồng" + ESC
    await page.mouse.move(400, 500);
    await tbtn.click({ timeout: 10000 }).catch(()=>{});
    await page.waitForTimeout(1200);
    log('[B1 rỗng] modal:', JSON.stringify(await modalState(page)));
    await page.keyboard.press('Escape'); await page.waitForTimeout(700);
    log('[B1 sau ESC] alertBox display:', await page.evaluate(() => getComputedStyle(document.getElementById('alertBox')).display));
    await close(); await page.waitForTimeout(450);
    log('[B1 sau close] backdrop:', await page.$$eval('.modal-backdrop', e => e.length), '| bodyCls:', await page.evaluate(() => document.body.className));

    // B2: click lần 2
    await page.mouse.move(400, 500);
    await tbtn.click({ timeout: 10000 }).catch(()=>{});
    await page.waitForTimeout(1200);
    log('[B2 lần 2] modal:', JSON.stringify(await modalState(page)));
    await close(); await page.waitForTimeout(450);

    // B3-B7
    await go('[B3 SO_HD hợp lệ]', () => page.locator('#SO_HD').fill('HĐ-TEST-001'));
    await go('[B4 SO_HD !@#$]', () => page.locator('#SO_HD').fill("!@#$%^&*()'\"<>"));
    await go('[B5 SO_HD 500]', () => page.locator('#SO_HD').fill('C'.repeat(500)));
    await go('[B6 SO_HD emoji]', () => page.locator('#SO_HD').fill('🎉 日本語'));
    await go('[B7 SO_HD script]', () => page.locator('#SO_HD').fill('<script>alert(1)</script>'));

    // B8: ma_kh + ten đặc biệt, SO_HD hợp lệ
    await go('[B8 ma_kh/ten]', async () => {
      await page.locator('#SO_HD').fill('HD-001');
      await page.locator('#ma_kh').fill("KH'\"<>🎉");
      await page.locator('#ten').fill("Trần Văn A & <b>x</b>");
    });

    // B9: Enter trong SO_HD
    await page.locator('#SO_HD').fill('HD-ENTER-01');
    await page.locator('#SO_HD').press('Enter');
    await page.waitForTimeout(1600);
    log('[B9 Enter SO_HD] modal:', JSON.stringify(await modalState(page)));
    await close(); await page.waitForTimeout(400);

    // B10: trang còn nguyên? grid + input
    log('[B10] SO_HD count:', await page.locator('#SO_HD').count(), '| Gr_lke:', await page.locator('#Gr_lke').count(), '| title:', (await page.title()).slice(0,20));
    await context.close();
  }

  // session còn sống?
  {
    const { context, page } = await freshPage();
    await page.goto('https://uat-capdon.pjico.com.vn/ClaimGeneral/Search', { waitUntil: 'domcontentloaded', timeout: 90000 });
    log('\n[sanity cuối] session sống:', (await page.locator('#EMAIL').count()) === 0);
    await context.close();
  }
  await browser.close();
  log('\nDONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });