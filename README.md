# Function Test — UAT Portal PJICO

Bộ functional test Playwright (8 spec) cho portal PJICO: login negative, quên mật khẩu, form validation (cấp đơn, claim), grid client filter, quick search edge cases, navigation state, dashboard UI.

## Chạy test

```bash
npm install
cp .env.example .env        # dien UAT_EMAIL / UAT_PASS (file .env khong commit)
node scripts/save-auth.js   # tạo .auth/uat.json (session — không commit)
npx playwright test
```

## Tài liệu

- Báo cáo UAT đầy đủ: [UAT-FUNCTIONAL-REPORT.md](UAT-FUNCTIONAL-REPORT.md)