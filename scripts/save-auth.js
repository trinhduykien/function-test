// Đăng nhập UAT một lần và lưu session (cookies) vào .auth/uat.json
// Chạy lại bất cứ lúc nào session hết hạn: node scripts/save-auth.js
const { chromium } = require('@playwright/test');
const fs = require('fs');

const LOGIN_URL = 'https://uat-capdon.pjico.com.vn/Home/Index';
// Nạp .env (nếu có) — không cần package ngoài
try { for (const _l of require('fs').readFileSync('.env', 'utf8').split(/\r?\n/)) { const _m = _l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (_m && !process.env[_m[1]]) process.env[_m[1]] = _m[2].replace(/^["']|["']$/g, ''); } } catch {}
const EMAIL = process.env.UAT_EMAIL;
const PASS = process.env.UAT_PASS;
if (!EMAIL || !PASS) { console.error('Thieu UAT_EMAIL / UAT_PASS — tao file .env (xem .env.example)'); process.exit(1); }


(async () => {
  fs.mkdirSync('.auth', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.goto(LOGIN_URL, { timeout: 90000, waitUntil: 'domcontentloaded' });
    await page.locator('#EMAIL').fill(EMAIL);
    await page.locator('#email_click .show-password').click();
    await page.locator('input[type=password]').first().fill(PASS);
    await page.getByRole('link', { name: /ĐĂNG NHẬP/i })
      .or(page.getByRole('button', { name: /ĐĂNG NHẬP/i })).first().click();
    await page.waitForURL(u => !/login/i.test(u.href), { timeout: 90000 });

    await page.waitForLoadState('networkidle').catch(() => {});
    await context.storageState({ path: '.auth/uat.json' });
    console.log('OK — session đã lưu vào .auth/uat.json, URL:', page.url());
  } catch (e) {
    console.error('LỖI đăng nhập:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();