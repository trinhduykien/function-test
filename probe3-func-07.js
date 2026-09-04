const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: '.auth/uat.json', viewport: { width: 1680, height: 950 } });
  const page = await ctx.newPage();
  await page.goto('https://uat-capdon.pjico.com.vn/ClaimGeneral/Search', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const info = await page.evaluate(() => ({
    btnSquare: document.querySelectorAll('button.btn-square.btn-p-input').length,
    timHoSo: Array.from(document.querySelectorAll('button')).map(b => (b.innerText || '').trim()).filter(t => /hồ sơ/i.test(t)).slice(0, 5),
    bodyLen: (document.body.innerText || '').length,
  }));
  console.log('ClaimGeneral after reload:', JSON.stringify(info));
  await page.goto('https://uat-capdon.pjico.com.vn/CategorySystem/Unit', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const rows = await page.evaluate(() => ({
    rows: document.querySelectorAll('table tbody tr').length,
    bodyLen: (document.body.innerText || '').length,
  }));
  console.log('Unit after reload:', JSON.stringify(rows));
  // quick check: ContractCar junk 500-char + emoji
  const junk = 'x=' + '!@#$%&*()'.repeat(20) + '&e=🎉🎉&vn=' + encodeURIComponent('Tìm kiếm "đơn" <b>x</b>');
  const r = await page.goto('https://uat-capdon.pjico.com.vn/ContractCar/Search?' + junk.slice(0, 600), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dropdown-toggle.name-menu--item', { timeout: 15000 });
  const j = await page.evaluate(() => ({ inputs: document.querySelectorAll('input').length, bodyLen: (document.body.innerText || '').length, url: location.href.length }));
  console.log('junk 500+emoji status:', r.status(), JSON.stringify(j));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });