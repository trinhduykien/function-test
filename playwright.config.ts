import { defineConfig, devices } from '@playwright/test';

// Nạp .env (nếu có) — không cần package ngoài
try { for (const _l of require('fs').readFileSync('.env', 'utf8').split(/\r?\n/)) { const _m = _l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (_m && !process.env[_m[1]]) process.env[_m[1]] = _m[2].replace(/^["']|["']$/g, ''); } } catch {}

/**
 * Playwright config — FUNCTIONAL test chi tiết UAT cấp đơn PJICO (project 13)
 * Session đăng nhập được lưu sẵn tại .auth/uat.json (tạo bằng: node scripts/save-auth.js)
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'https://uat-capdon.pjico.com.vn',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: '.auth/uat.json',
    actionTimeout: 30000,
    navigationTimeout: 90000,
    locale: 'vi-VN',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});