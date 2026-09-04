# Báo cáo functional test UAT — PJICO cấp đơn (vòng 1)

## 1. Thông tin kiểm thử

- **Ngày thực hiện:** 2026-09-03
- **Môi trường:** UAT — https://uat-capdon.pjico.com.vn
- **Tài khoản:** kientd.pjico (email thật chỉ dùng để mở bước 2 của login và đăng nhập; **không lần nào** submit mật khẩu sai ngoài ca gate `QA_WRONG_PW=1` đã tự skip — quota 1 lần đã dùng ở vòng trước)
- **Phạm vi:** Functional / negative testing — vòng 1 (khác với vòng smoke đã chạy ở `d:/bore/12`)
- **Spec & probe:** `d:/bore/13/tests/func-01…func-08` (8 spec, 129 test); probe files `d:/bore/13/probe-func-*.js`
- **An toàn đã tuân thủ:** không đụng rate limit, không tạo hồ sơ, không submit form ngoài phạm vi, email thật không bao giờ được gửi sang portal ngoài trong luồng Quên mật khẩu (mọi lần bấm link đều đặt email giả).

## 2. Tổng quan

| Chỉ số | Giá trị |
|---|---|
| Tổng số test đã viết / đã chạy | **129** |
| PASS | **106** (82,2%) |
| FAIL | **22** (17,0%) |
| SKIP | **1** (func-01 test "d" — email thật + sai mật khẩu, gate `QA_WRONG_PW=1`, quota đã dùng) |
| Số finding (bug xác nhận) | **20** |
| Suite | **NOT GREEN** |

- Toàn suite chạy **2 vòng liên tiếp**: kết quả y hệt cả hai lần (cùng test fail, cùng thông điệp lỗi, cùng số liệu) → **không có fail nào là flaky / test-bug / env-issue**. Mọi failure đều là hành vi thật của app, spec giữ nguyên, không hạ assertion.
- Phân bổ 22 fail theo khu vực: login-negative 7, quên-mật-khẩu 1, cấp-đơn validation 3, bồi-thường validation 4, navigation-state 2, dashboard 5. Hai khu vực **func-05 (grid Mã đơn vị)** và **func-06 (tìm nhanh chức năng)** xanh hoàn toàn (0 finding).
- 20 finding thực chất tập trung về vài **lỗi gốc hệ thống**: (1) hàm `form_P_LOI()` chỉ có 1 thông báo cứng cho mọi ca login sai; (2) wrapper fetch map mọi response không parse được JSON (500/HTML) thành "Hết phiên làm việc" — kể cả khi session còn sống, xảy ra ở 3 phân hệ khác nhau; (3) modal bootstrap không đóng bằng ESC ở mọi nơi; (4) dashboard chết vĩnh viễn sau 1 lần xóa nhầm ngày; (5) lỗi Oracle thô lộ ra UI.

## 3. Bảng kết quả theo 8 khu vực

| # | Khu vực | Spec | Số test | Pass | Fail | Số finding |
|---|---|---|---|---|---|---|
| 1 | Login negative — mọi cách nhập sai email/mật khẩu (trang /Home/Index, phiên trống) | `tests/func-01-login-negative.spec.ts` | 15 | 7 | 7 | 4 |
| 2 | Luồng "Quên mật khẩu" — quan sát + validation | `tests/func-02-quen-mat-khau.spec.ts` | 10 | 9 | 1 | 3 |
| 3 | Validation form tìm kiếm — phân hệ cấp đơn xe (/ContractCar/Search) | `tests/func-03-capdon-form-validation.spec.ts` | 18 | 15 | 3 | 2 |
| 4 | Validation form bồi thường + modal lỗi quyền (/ClaimGeneral/Search, /ClaimGeneral/ObjectSearch) | `tests/func-04-claim-form-validation.spec.ts` | 24 | 20 | 4 | 4 |
| 5 | Grid client-side + phân trang — Mã đơn vị (/CategorySystem/Unit) | `tests/func-05-grid-client-filter.spec.ts` | 17 | 17 | 0 | 0 |
| 6 | Tìm nhanh chức năng — ca biên từ khóa (quick search menu /Home/Index) | `tests/func-06-quick-search-edge.spec.ts` | 16 | 16 | 0 | 0 |
| 7 | Điều hướng & trạng thái trình duyệt — Back/Forward/Refresh/deep-link | `tests/func-07-navigation-state.spec.ts` | 15 | 13 | 2 | 2 |
| 8 | Dashboard UI — tabs, filter đơn vị, chart legend, modal dữ liệu (/Home/Index) | `tests/func-08-dashboard-ui.spec.ts` | 14 | 9 | 5 | 5 |
| | **Tổng** | | **129** | **106** | **22** | **20** |

## 4. Danh sách finding chi tiết

> Severity của toàn bộ 20 finding: **bug-có-thể** (app hành xử sai kỳ vọng, tái lập ổn định, chưa chặn go-live nhưng cần xử lý trước production).

### Khu vực 1 — Login negative (4 finding, 7 test fail)

> Gốc rễ chung: hàm `form_P_LOI()` chỉ có **một thông báo cứng** cho MỌI ca đăng nhập sai (rỗng / sai định dạng / không tồn tại / sai mật khẩu).

**F1.1 — Bỏ trống ô email rồi bấm mũi tên (và ca paste rồi xóa trắng rồi bấm)**
- Ca kiểm thử: `func-01 a` (bỏ trống, bấm `#email_click .show-password`) và `func-01 i` (paste rồi xóa trắng) — 2 test fail.
- Kỳ vọng đúng: thông báo "Vui lòng nhập email", không gọi server.
- Hành vi thật: app KHÔNG có phản hồi gắn với nguyên nhân — chỉ hiện modal `#alertBox` với thông báo CỐ ĐỊNH không liên quan: *"Liên hệ ban Phát triển và Vận hành Ứng dụng Công nghệ thông tin đê được hỗ trợ (Dichvu_UDCNTT.pjico@Petrolimex.com.vn)"*. Không có validate client-side: giá trị rỗng được POST thẳng `/Home/VertifyObject` lên server. Người dùng chỉ bỏ trống ô nhập nhưng bị hướng liên hệ IT.
- Severity: bug-có-thể.
- Gợi ý dev: thêm check rỗng ở client trước khi POST (block event, focus lại ô email, hiện "Vui lòng nhập email"); phân nhánh thông báo theo mã lỗi server trả về thay vì một message cứng trong `form_P_LOI()`.

**F1.2 — Không kiểm tra định dạng email ở bất kỳ đâu (client lẫn server)**
- Ca kiểm thử: `func-01 b1–b4` — 4 biến thể: `"abc"`, `"abc@"`, `"@petrolimex.com.vn"`, `"a b@c.vn"` (chứa khoảng trắng) — 4 test fail.
- Kỳ vọng đúng: báo "Sai định dạng email!" ngay ở client, không cần gọi server.
- Hành vi thật: cả 4 biến thể đều được POST thẳng server rồi nhận cùng thông báo chung chung "Liên hệ ban Phát triển…". Bản thân app CÓ sẵn message "Sai định dạng email!" (dùng ở form đăng ký) nhưng không áp dụng cho login. Điểm tốt: ô mật khẩu không hiện cho các giá trị này.
- Severity: bug-có-thể.
- Gợi ý dev: tái sử dụng regex + message "Sai định dạng email!" đã có ở form đăng ký, áp cho ô `#EMAIL` trước khi POST; bổ sung validate tương tự ở server.

**F1.3 — Email đúng định dạng nhưng KHÔNG tồn tại**
- Ca kiểm thử: `func-01 c` — `func.qa.khongtontai.8899@petrolimex.com.vn`.
- Kỳ vọng đúng: thông báo gắn với đăng nhập, vd "Email/tài khoản không hợp lệ" — để người dùng tự kiểm tra lại email.
- Hành vi thật: hiện modal với thông báo sai bản chất "Liên hệ ban Phát triển và Vận hành Ứng dụng Công nghệ thông tin đê được hỗ trợ…" — người dùng gõ nhầm email sẽ tưởng phải liên hệ IT. Ô mật khẩu không hiện (chống enumeration ở UI là đúng).
- Severity: bug-có-thể.
- Gợi ý dev: server trả mã lỗi riêng cho "email không tồn tại"; `form_P_LOI()` hiển thị message tương ứng (thông báo trung tính, không xác nhận email có/không để giữ chống enumeration).

**F1.4 — Email thật + SAI MẬT KHẨU (kết quả từ quota 1 lần, ghi trong comment spec)**
- Ca kiểm thử: `func-01 d` (gate `QA_WRONG_PW=1`; ở vòng suite này tự skip, kết quả lấy từ lần chạy quota đã dùng).
- Kỳ vọng đúng: thông báo chỉ rõ "Sai mật khẩu/tài khoản", giữ form ở bước mật khẩu để nhập lại.
- Hành vi thật: server trả HTTP 302 → `/?reason=expired`, wrapper fetch hiển thị modal "Hết phiên làm việc, đăng nhập lại và tiếp tục!" — thông báo SAI BẢN CHẤT (hết phiên ≠ sai mật khẩu), sau đó `location.reset` toàn trang về bước email, mất cả giá trị email đã nhập. Kèm thêm lỗi chính tả hiển thị: "đê được hỗ trợ" thay vì "để được hỗ trợ".
- Severity: bug-có-thể.
- Gợi ý dev: server trả mã lỗi đăng nhập sai riêng (không redirect `reason=expired`); client giữ state bước mật khẩu, hiện "Sai mật khẩu, vui lòng thử lại"; sửa chính tả "đê" → "để" trong chuỗi message dùng chung.

### Khu vực 2 — Luồng "Quên mật khẩu" (3 finding, 1 test fail)

> Cấu trúc thật: app capdon KHÔNG có form/modal quên mật khẩu riêng. Link "Quên mật khẩu" (`<a href="#" target="_blank" onclick="return changePassToBaoHiem();">`) nằm trong `#DIV_LOGIN`, ẩn tới khi nhập email hợp lệ; bấm nó mở TAB MỚI sang portal ngoài "PJICO Selling Platform" (`https://uat-baohiem.pjico.com.vn/?type=KTTT&email=<email>`, URL lấy từ hidden input `#url_baohiem`). Portal ngoài có luồng quên mật khẩu riêng nhưng ngoài phạm vi.

**F2.1 — Một click vào "Quên mật khẩu" mở 2 tab mới thay vì 1**
- Ca kiểm thử: `func-02 tc04` — 1 test fail (test kỳ vọng ĐÚNG bị fail có chủ đích để фикс finding; đã chạy 2 vòng + probe 5/5, hoàn toàn ổn định, KHÔNG flaky).
- Kỳ vọng đúng: chỉ mở 1 tab — portal ngoài.
- Hành vi thật: mở 2 tab: tab đúng ý định (portal ngoài) + một tab TRÙNG LẶP trang login `https://uat-capdon.pjico.com.vn/?reason=expired#`. Nguyên nhân: hàm `changePassToBaoHiem()` (trong `/Include/ht/login0.js`) mở portal bằng `window.open` nhưng KHÔNG `return false` → trình duyệt vẫn thực hiện default action của anchor (mở `href="#"` trong tab mới do `target=_blank`).
- Severity: bug-có-thể.
- Gợi ý dev: sửa hàm `changePassToBaoHiem()` thành `return false` sau khi `window.open` (hoặc đổi `onclick="changePassToBaoHiem(); return false;"`, hoặc `e.preventDefault()`).

**F2.2 — `changePassToBaoHiem()` KHÔNG có validation nào trước khi mở portal ngoài**
- Ca kiểm thử: probe `func-02` — email rỗng, ký tự đặc biệt `!@#$%^&*()<>'"`, unicode tiếng Việt/emoji, chuỗi 500 ký tự đều được nối thẳng query param gửi sang portal ngoài.
- Kỳ vọng đúng: validate email hợp lệ trước khi mở portal; không gửi giá trị rác sang hệ thống khác.
- Hành vi thật: ô email rỗng vẫn mở portal với `&email=` rỗng; mọi chuỗi rác chỉ được browser URL-encode, không crash. Qua UI thật, đường chặn duy nhất là `onchange login_P_KTRA` re-validate — tức guard chỉ là **tác dụng phụ của luồng login**, không phải của chính luồng quên mật khẩu (bypass được nếu onchange chưa kích hoạt).
- Severity: bug-có-thể.
- Gợi ý dev: thêm validate email (regex + rỗng) ngay đầu hàm `changePassToBaoHiem()` trước khi `window.open`; encode giá trị email trước khi nối URL.

**F2.3 — Thông báo modal trong luồng quên mật khẩu sai chính tả và sai ngữ cảnh**
- Ca kiểm thử: phủ qua `func-02 tc06/tc10` (chặn khi ô email không hợp lệ/không tồn tại).
- Kỳ vọng đúng: thông báo đề cập việc đặt lại mật khẩu, viết đúng chính tả.
- Hành vi thật: modal `#alertBox` hiển thị "…đê được hỗ trợ (Dichvu_UDCNTT.pjico@Petrolimex.com.vn)" — sai chính tả ("đê" thay "để"), nội dung không nhắc gì tới đặt lại mật khẩu dù xuất hiện trong luồng quên mật khẩu.
- Severity: bug-có-thể.
- Gợi ý dev: sửa chính tả toàn chuỗi (xem F1.4); viết message riêng cho ngữ cảnh quên mật khẩu hoặc message chung gắn với đăng nhập.

### Khu vực 3 — Validation form tìm kiếm cấp đơn xe (2 finding, 3 test fail)

**F3.1 — Thiếu validation độ dài input, lỗi Oracle THỒ lộ ra UI**
- Ca kiểm thử: `func-03 TC08` (ô "Số HĐ" 500 ký tự) và `TC18` (ô "Biển xe" + "Số máy" 500 ký tự) — 2 test fail.
- Kỳ vọng đúng: search trả code "000" hoà bình (như chuỗi 450 ký tự) hoặc thông báo lỗi thân thiện.
- Hành vi thật: server trả code "400" kèm thông điệp lỗi DB nguyên văn trong modal Thông báo cho user: `ORA-20105: ORA-06512: at "UAT_KTTT.PBH_HD_GOC_TIM_WEB", line 163ORA-06512: at line 1` — lộ chi tiết internals DB (schema `UAT_KTTT`, tên stored procedure, số dòng) ra người dùng cuối. Probe xác định: 450 ký tự xử lý bình thường (code "000", Total 0), ô "Số khung" 500 ký tự lại KHÔNG lỗi → không có maxlength/kiểm tra dài phía client và các field bị lỗi không nhất quán.
- Severity: bug-có-thể.
- Gợi ý dev: đặt `maxlength` phù hợp trên các ô input (khớp giới hạn cột DB / stored procedure); thêm server-side validate độ dài; bắt exception Oracle ở tầng service và trả message thân thiện — không bao giờ đổ lỗi DB thô ra response cho UI.

**F3.2 — HTTP 500 + thông báo sai "Hết phiên làm việc" khi search chuỗi `<script>1</script>`**
- Ca kiểm thử: `func-03 TC17` — 1 test fail.
- Kỳ vọng đúng: xử lý hoà bình như các chuỗi đặc biệt khác (HTTP 200, code "000"), không 500, không báo sai session.
- Hành vi thật: chuỗi `<script>1</script>` (viết thường) vào ô "Số HĐ" → server trả HTTP 500 kèm trang lỗi HTML đầy đủ (không phải JSON), app mở modal "Hết phiên làm việc, đăng nhập lại và tiếp tục!" — nhưng session THỰC SỰ còn nguyên (search ngay sau bằng chuỗi thường vẫn 200 code "000", test đã xác nhận). Đáng chú ý: các biến thể `'a<script b'`, `'</script>'`, `'<SCRIPT>1</SCRIPT>'`, `'<img src=x onerror=...>'`, `'<b>&x</b>'` đều KHÔNG gây lỗi — hành vi lệch nhau vô lý giữa các chuỗi tương tự.
- Severity: bug-có-thể.
- Gợi ý dev: rà xử lý server cho chuỗi chứa `<script>` (nghiêng về lỗi parse/encode ở backend hoặc stored procedure); sửa wrapper fetch: chỉ báo "hết phiên" khi xác nhận được session hết (vd response có cờ/mã riêng), không map mặc định mọi response non-JSON thành hết phiên.

### Khu vực 4 — Validation form bồi thường + modal (4 finding, 4 test fail)

**F4.1 — `<script>alert(1)</script>` vào ô Số hồ sơ gây báo sai "hết phiên" + FORCE-LOGOUT**
- Ca kiểm thử: `func-04 s10` — `#so_hs` + bấm "Tìm hồ sơ".
- Kỳ vọng đúng: chuỗi tìm kiếm chỉ là chuỗi — app phải báo lỗi quyền (như mọi input khác) hoặc trả kết quả tìm, tuyệt đối không được coi là hết phiên và force-logout.
- Hành vi thật: app KHÔNG báo lỗi quyền "chua duoc cap quyen nghiep vu [Xử ly bồi thường]" như MỌI giá trị input khác, mà báo sai "Hết phiên làm việc, đăng nhập lại và tiếp tục!" — trong khi session thực tế còn hiệu lực. Khoảng 3 giây sau khi đóng modal, trang còn TỰ điều hướng về `/Home/Login`, đá người dùng ra ngoài. Đã tách từng ký tự: `' " < > & </textarea> emoji` đều xử lý đúng; riêng chuỗi `<script>...</script>` mới kích hoạt lỗi.
- Severity: bug-có-thể (nghiêm trọng nhất khu vực này — user input hợp lệ gây force-logout).
- Gợi ý dev: fix xử lý server với chuỗi `<script>` (xem F3.2 — cùng lỗi hệ thống); bỏ auto-redirect `/Home/Login` sau modal; wrapper fetch xác nhận session thật trước khi báo hết phiên.

**F4.2 — Cùng lỗi trên trang ObjectSearch (`#SO_HD` + "Tìm đối tượng")**
- Ca kiểm thử: `func-04 o07`.
- Kỳ vọng đúng: trả "Khong tim thay theo dieu kien tim kiem" như các input đặc biệt khác trên cùng ô.
- Hành vi thật: báo sai "Hết phiên làm việc, đăng nhập lại và tiếp tục!" rồi điều hướng `/Home/Login`, dù session thật còn sống. Đối chiếu: `!@#$%&*()'<>'`, emoji, 500 ký tự trên cùng ô đều trả thông báo đúng, không crash.
- Severity: bug-có-thể.
- Gợi ý dev: cùng fix với F4.1/F3.2 (lỗi hệ thống của wrapper fetch + server parse `<script>`).

**F4.3 — Modal Thông báo (`#alertBox`) KHÔNG đóng khi nhấn Escape**
- Ca kiểm thử: `func-04 s04` — modal sau khi bấm "Tìm hồ sơ".
- Kỳ vọng đúng: modal bootstrap chuẩn (`keyboard: true` mặc định) phải đóng bằng ESC.
- Hành vi thật: modal có đủ cấu trúc bootstrap (class `modal in`, backdrop, nút × `data-dismiss=modal`) nhưng ESC xong modal vẫn `display:block` — người dùng chỉ thoát được bằng nút ×. Trùng pattern với finding cũ của modal `#modal_MonthlyRevenue` trên Dashboard → **lỗi hệ thống modal chung của app**.
- Severity: bug-có-thể.
- Gợi ý dev: rà cấu hình bootstrap modal toàn app (không tắt `keyboard`); kiểm tra script nào gọi `modal({keyboard:false})` hoặc chặn keydown ESC.

**F4.4 — Modal validation "Phải nhập số hợp đồng" cũng KHÔNG đóng bằng Escape**
- Ca kiểm thử: `func-04 o03` — modal `#alertBox` hiện khi bấm "Tìm đối tượng" với form rỗng.
- Kỳ vọng / hành vi thật / gợi ý dev: giống F4.3 — cùng pattern ESC-không-đóng, fix một lần cho toàn bộ modal của app.

### Khu vực 5 — Grid client-side + phân trang Mã đơn vị (0 finding)

Không tìm thấy bug — grid/filter/phân trang hoạt động đúng chuẩn bootstrap-table client-side qua mọi ca. Xem Quan sát §5.

### Khu vực 6 — Tìm nhanh chức năng — ca biên (0 finding)

App hành xử ĐÚNG ở mọi ca biên đã test (normalize dấu tiếng Việt, case-insensitive, ký tự đặc biệt/emoji/300 ký tự không crash, keyboard hỗ trợ tốt: Tab/ArrowDown/Enter/Escape). Xem Quan sát §5.

### Khu vực 7 — Điều hướng & trạng thái trình duyệt (2 finding, 2 test fail)

**F7.1 — Trang lỗi gần như TRỐNG TRƠN, người dùng bị MẮC KẸT**
- Ca kiểm thử: `func-07 TC10` — mọi URL lạ (`/KhongTonTai999/Action`, `/Home/KhongTonTai`, `/ContractCar/KhongTonTai`, `/xyzzy`) đều rewrite về `/ErrorHandler/Index`.
- Kỳ vọng đúng: trang lỗi thân thiện phải có nút/link quay về trang chủ.
- Hành vi thật: trang chỉ chứa đúng 1 dòng chữ "Trang thông báo lỗi" — HTML toàn trang 188 byte, title vô nghĩa ("Index"), **0 link, 0 button**. Người dùng không có cách nào quay lại app ngoài nút Back của trình duyệt (TC12 xác nhận Back vẫn hoạt động). Điểm tốt: không lộ stack trace.
- Severity: bug-có-thể.
- Gợi ý dev: bổ sung nội dung trang lỗi: message thân thiện + nút/link "Về trang chủ" (`/Home/Index`), title có ý nghĩa (vd "404 — Không tìm thấy trang").

**F7.2 — SOFT-404: URL không tồn tại trả HTTP 200 thay vì 404**
- Ca kiểm thử: `func-07 TC11` — `page.goto('/KhongTonTai999/Action')` trả status 200; probe xác nhận lại với 4 path lạ khác nhau — tất cả đều 200.
- Kỳ vọng đúng: resource không tồn tại phải trả 404 để trình duyệt, monitoring, API client và công cụ tìm kiếm phân biệt trang rác vs trang thật.
- Hành vi thật: mọi URL lạ đều "thành công" theo HTTP → giám sát UAT không thể đếm được lỗi 404, mọi link chết trong app đều im lặng.
- Severity: bug-có-thể.
- Gợi ý dev: controller `ErrorHandler` trả `Response.StatusCode = 404` (giữ trang thân thiện theo F7.1, chỉ đổi status code).

### Khu vực 8 — Dashboard UI (5 finding, 5 test fail)

**F8.1 — Xóa trống "Đến ngày" + apply làm dashboard CHẾT VĨNH VIỄN đến khi F5**
- Ca kiểm thử: `func-08 T13` — xóa trống `#ngay_ht` rồi bấm "Theo điều kiện chọn".
- Kỳ vọng đúng: báo lỗi validation (vd "Vui lòng nhập Đến ngày") hoặc tự điền lại ngày mặc định; chart không được trắng vĩnh viễn.
- Hành vi thật: app KHÔNG báo lỗi, chart `#bar-chart-dt` trắng hoàn toàn (series rỗng, categories = []). Nghiêm trọng hơn: sau đó nhập lại NGÀY HỢP LỆ và bấm apply liên tục — server vẫn trả `b_dt_2="null"`, chart KHÔNG bao giờ khôi phục, phải F5 mới hết (đã bắt response POST `/Dashboard/GeneratedRevenue` xác nhận). User chỉ cần xóa nhầm ngày 1 lần là dashboard chết đến khi refresh.
- Severity: bug-có-thể (nghiêm trọng — state lỗi "dính" vĩnh viễn).
- Gợi ý dev: validate bắt buộc ngày client trước khi apply; server từ chối request thiếu ngày với mã lỗi rõ ràng; rà state filter phía client — reset giá trị rỗng sau mỗi lần apply thay vì để "null" bám theo các request sau.

**F8.2 — Drill-down AGI mâu thuẫn hoàn toàn với rollup "Tất cả"**
- Ca kiểm thử: `func-08 T05` — chọn "Đơn vị quản lý" = AGI + "Theo điều kiện chọn".
- Kỳ vọng đúng: drill-down AGI hiển thị số doanh thu của AGI (rollup view "Tất cả" cho thấy AGI CÓ doanh thu: modal chi tiết dòng AGI 42.386.500 / 24.631.000).
- Hành vi thật: chart hiển thị 2 danh mục lạ LXU, TCH với TOÀN GIÁ TRỊ 0; modal "Xem chi tiết các tháng" có 0 dòng dữ liệu (bảng rỗng). So sánh: drill-down TCT hoạt động đúng (8 phòng ban có số liệu, modal 6 dòng).
- Severity: bug-có-thể (sai dữ liệu nghiệp vụ dashboard).
- Gợi ý dev: rà câu query/param lọc theo đơn vị của endpoint `/Dashboard/GeneratedRevenue` — nghiêng về lỗi mapping mã đơn vị hoặc dữ liệu đơn vị AGI; đối chiếu drill-down vs rollup phải khớp.

**F8.3 — Dropdown "Đơn vị quản lý" có 2 option hiển thị nhãn literal "null"**
- Ca kiểm thử: `func-08 T11` — dropdown `#ma_dvi_sl`, các option DGT và HHO.
- Kỳ vọng đúng: option hiển thị tên đơn vị hoặc bị loại khỏi danh sách.
- Hành vi thật: 2 dòng chữ "null" xuất hiện trong danh sách đơn vị mà user thấy; chọn DGT rồi apply cũng cho chart trắng im lặng.
- Severity: bug-có-thể.
- Gợi ý dev: rà dữ liệu nguồn danh sách đơn vị (bản ghi DGT/HHO thiếu tên); render fallback (vd mã đơn vị) hoặc loại option tên null; xem thêm F8.1 cho trường hợp apply trắng im lặng.

**F8.4 — Biểu tượng mũi tên `.tab-slider--nav` (caret thu gọn panel bộ lọc) là NÚT CHẾT**
- Ca kiểm thử: `func-08 T02`.
- Kỳ vọng đúng: bấm caret thu gọn/mở rộng panel bộ lọc.
- Hành vi thật: bấm không thay đổi BẤT KỲ trạng thái nào (class nav, class container, visibility, height giữ nguyên 826px). Không có onclick, không có jQuery handler gắn trực tiếp — chức năng thu gọn panel không hoạt động.
- Severity: bug-có-thể.
- Gợi ý dev: hoặc gắn handler toggle cho `.tab-slider--nav`, hoặc ẩn control nếu tính năng chưa triển khai (tránh UI element chết gây hiểu nhầm).

**F8.5 — Modal "Xem chi tiết các tháng" khi xem THEO NĂM có dòng tên đơn vị RỖNG**
- Ca kiểm thử: `func-08 T08` — kieu_sl=BHTT_Y + apply, mở modal `#modal_MonthlyRevenue`.
- Kỳ vọng đúng: mọi dòng đều hiển thị tên đơn vị tương ứng.
- Hành vi thật: modal có 1 dòng mà ô tên đơn vị RỖNG (units = `["Văn phòng Tổng Công ty (TCT)", "PJICO Hà Nội (HNO)", "PJICO Thăng Long (TLO)", "PJICO Vũng Tàu (VTA)", ""]`) — user thấy 1 dòng chỉ toàn số không, không biết là đơn vị nào.
- Severity: bug-có-thể.
- Gợi ý dev: rà dataset chế độ theo năm — 1 bản ghi thiếu tên đơn vị; thêm fallback hiển thị mã đơn vị nếu tên rỗng, hoặc lọc bản ghi tên rỗng.

## 5. Các quan sát đáng chú ý (hành vi lạ, chưa chắc là bug)

1. **Mojibake trên trang login:** tiêu đề "Ðăng nhập hệ thống" dùng ký tự Ð (U+00D0) thay vì Đ (U+0110) — lỗi encoding text (có thể thuộc vòng login-area, ghi nhận lại cho rõ).
2. **Email truyền sang portal ngoài qua query param plaintext** (luồng Quên mật khẩu) — nằm trong history/logs của browser và các hệ thống giữa đường (lưu ý privacy).
3. **Link "Quên mật khẩu" chỉ truy cập được SAU bước 1 với email HỢP LỆ** — người dùng quên mật khẩu phải nhớ chính xác email; nếu gõ email không tồn tại/sửa ô rồi bấm link bằng chuột thật, onchange re-validate chặn: `#DIV_LOGIN` ẩn + `#alertBox` hiện, portal KHÔNG mở, không crash, luồng phục hồi ổn định 3/3 probe.
4. **Enter trong ô tìm kiếm của ClaimGeneral (cả `#so_hd` và `#SO_HD`) KHÔNG kích hoạt tìm kiếm** — không crash nhưng user buộc bấm nút (riêng ô Số HĐ của ContractCar thì Enter có trigger search — lệch nhau giữa 2 phân hệ).
5. **Ô ngày "lặng lẽ" normalize ngày rác:** ClaimGeneral `#ngayd` đổi 'not-a-date', '32/13/2025' thành ngày hiện tại 01/09/2026 không báo gì; ContractCar datepicker cũng âm thầm chuẩn hoá 'abc', '32/13/2026' khi blur — user có thể tìm với ngày sai mà không biết.
6. **Message không nhất quán:** "Khong tim thay theo dieu kien tim kiem" (ObjectSearch) viết KHÔNG dấu, lệch với các thông báo có dấu khác của app.
7. **Tài khoản kientd.pjico KHÔNG có dữ liệu HĐ nào** — mọi query hợp lệ trả code "000", Total 0, grid "Không có dữ liệu" → không thể xác minh lọc dữ liệu đúng/sai ở ContractCar, chỉ xác minh no-crash/xử lý lỗi.
8. **Transient "Không có dữ liệu" sau reload:** bảng /CategorySystem/Unit hiện 1 dòng "Không có dữ liệu" ~1 giây TRƯỚC khi 10 dòng fill vào (async loading bình thường) — đáng cân nhắc skeleton/loading thay vì thông báo sai tạm thời.
9. **Menu top render bằng JS** (~200–1100ms sau domcontentloaded) — mọi spec phải waitForSelector, không đếm ngay; menu panel hover (mega-menu) tự đóng khi hover-out và chặn pointer trong lúc mở — mang tính design, không phải bug.
10. **Nút apply dashboard nằm dưới navbar fixed** — click thật bị navbar chặn pointer-interception khi ở vị trí cuộn nhất định; user thật ở đầu trang không bị.
11. **Filter dashboard CHỈ tác dụng sau bấm "Theo điều kiện chọn"** — chọn đơn vị rồi bấm thẳng "Xem chi tiết các tháng" (chưa apply) vẫn hiện dữ liệu TẤT CẢ — dễ gây hiểu nhầm nhưng có thể chủ đích.
12. **Số liệu chế độ "theo năm" kỳ cục:** TCT "Doanh thu năm nay" = 77.082 (tỷ?) so với ~0,178 ở chế độ tháng; "Tỷ lệ tăng trưởng" tới 3.293.371,8% — mang tính data, chỉ note.
13. **Modal title luôn là "Chi tiết doanh thu theo từng tháng"** kể cả khi đang xem theo năm; dòng "Tổng cộng" nằm trong thead (hàng 2).
14. **Phân trang Mã đơn vị có wraparound** (› ở trang cuối nhảy về trang 1) — là mặc định `paginationLoop:true` của bootstrap-table, đã lock bằng test TC10; UX bất thường nhưng theo chuẩn library. Thanh phân trang KHÔNG đặt `aria-current` (minor a11y); bộ chọn rows-per-page (10/25/50/100) tồn tại nhưng bị CSS ẩn — user không đổi được số dòng/trang.
15. **Quick search:** 0 kết quả thì dropdown rỗng im lặng, KHÔNG có thông báo "Không tìm thấy chức năng nào" (minor UX); danh sách kết quả dường như bị giới hạn 10 mục — không rõ có chức năng match nào bị che khuất không (minor UX). Điểm tốt: Escape đóng panel được (khác modal Dashboard).
16. **Hash KHÔNG có routing:** `#tab3` in-page lẫn goto trực tiếp đều KHÔNG kích hoạt tab, nhưng trang không bị phá, menu nguyên vẹn — app đơn thuần không hỗ trợ deep-link theo hash.
17. **Điểm tốt đã xác nhận:** Back/Forward chuẩn (dashboard giữ nguyên chart/tabs/title; forward không trắng trang); reload giữ nguyên query string kể cả query rác unicode/emoji/225 ký tự; `?test=<b>abc</b>` KHÔNG bị render thành markup (không thấy reflection XSS thô); KHÔNG tìm thấy XSS reflection/execution ở ContractCar (payload HTML không render thành element, không thực thi, không dính URL); modal đóng bằng × sạch backdrop; input giữ đủ 500 ký tự/258 ký tự/emoji, không HTML-inject ở login.

## 6. Đề xuất vòng functional 2 (các góc chưa lục)

1. **Upload file:** chưa test bất kỳ control upload nào (đính kèm hồ sơ/giấy tờ ở phân hệ cấp đơn, bồi thường) — negative: file rỗng 0 byte, đuôi sai, đuôi đổi bằng tay, tên unicode/ký tự đặc biệt, file quá tải, double-submit khi đang upload.
2. **In ấn:** mọi luồng in (nếu có) — preview, nút in, layout trang, hành vi khi 0 bản ghi được chọn, ESC/Cancel dialog in.
3. **Export Excel/CSV:** xuất dữ liệu grid (ContractCar, ClaimGeneral, CategorySystem/Unit) — file rỗng khi 0 dòng, tiếng Việt có dấu trong cell, ký tự đặc biệt, export số lượng lớn, hành vi khi session hết giữa chừng.
4. **Multi-tab / multi-window:** mở 2+ tab app song song — session state chia sẻ, logout tab này ảnh hưởng tab kia thế nào, race condition giữa các request search/apply đồng thời.
5. **Iframe:** các trang có/khể nhúng iframe — click bên trong, ESC, focus trap, tương tác giữa iframe và trang cha.
6. **Panel "Thông tin tìm nâng cao" (btnAdvance)** — các ô ẩn `#ma_kh_tim/#ma_dl/#ma_phong_tim/#ma_cb_tim` chưa cover (vòng 1 không bấm nút khác ngoài Tìm).
7. **Hết phiên THẬT:** để session hết tự nhiên rồi thao tác — kiểm tra wrapper "Hết phiên làm việc" có đúng nguyên nhân thật không (vòng 1 chỉ thấy nó báo SAI).
8. **Portal ngoài (PJICO Selling Platform):** luồng quên mật khẩu của portal `uat-baohiem` (`login_P_QUEN_PAS`) — ngoài phạm vi vòng 1, cần spec riêng.
9. **Drill-down dashboard các đơn vị còn lại:** vòng 1 mới test TCT (đúng) và AGI (sai) — nên quét hết danh sách đơn vị so khớp rollup vs drill-down (kể cả 2 option "null" DGT/HHO sau khi fix).
10. **Bám sát fix các finding hệ thống:** sau khi dev sửa `form_P_LOI()`, wrapper fetch non-JSON → "hết phiên", ESC-không-đóng-modal, soft-404 — cần regression đúng các test fail của vòng 1 (giữ nguyên assertion, không hạ).

## 7. Phụ lục

- Test files: `D:\bore\13\tests\func-01-login-negative.spec.ts`, `func-02-quen-mat-khau.spec.ts`, `func-03-capdon-form-validation.spec.ts`, `func-04-claim-form-validation.spec.ts`, `func-05-grid-client-filter.spec.ts`, `func-06-quick-search-edge.spec.ts`, `func-07-navigation-state.spec.ts`, `func-08-dashboard-ui.spec.ts`
- Probe files: `D:\bore\13\probe-func-01-login-negative.js`, `probe-func-02-quen-mat-khau.js`, `probe-func-03-capdon-form-validation.js` (+ probe2..10), `probe-func-04-claim-form-validation.js`, `probe-func-05-grid-client-filter.js`, `probe-func-07-navigation-state.js` (+ probe2..4, output probe07-out.txt, probe2-07-out.txt, probe3-07-out.txt), `probe-func-08…probe7` (output probe08*-final.txt)
- Session làm mới qua `scripts/save-auth.js` trước khi chạy suite. Suite chạy 2 vòng: 22 fail y hệt cả hai lần → 0 flaky.