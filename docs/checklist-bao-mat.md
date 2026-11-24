# Checklist bảo mật — BT3

**Phạm vi:** Smart CRM – Mekong Mobile, track SE, luồng L2; Docker local và bản deploy thử Render/Atlas.
**Ngày rà soát:** 22/11/2026 (bổ sung S2/S3, audit sau nâng cấp). Đây là tự đánh giá, không phải chứng nhận an toàn hoặc pentest.

| # | Mục theo đề | Kết quả | Minh chứng và giới hạn |
|---|---|---|---|
| 1 | Không có secret thật trong repo | **ĐÃ LÀM** | `.gitignore` chặn `.env`/`.env.*` trừ mẫu; `git log --all --format='%h %s' -- .env '.env.*' ':!.env.example'` không có kết quả. Docker dùng allowlist và không COPY `.env`. Các khóa test/tài khoản demo được công khai là mẫu, không dùng production. Kiểm tra này không phải bảo đảm tuyệt đối rằng mọi dạng secret trong toàn lịch sử đều đã được phát hiện. |
| 2 | Dữ liệu vào được kiểm ở tầng ứng dụng | **ĐÃ LÀM** | `src/validators/primitives.js`, `ticket.validator.js` và service kiểm kiểu, ngày lịch, độ dài, tham chiếu; `tests/intake-boundary.test.js` có HTTP thật từ chối ngày/kiểu sai bằng 422 kèm field. Kết quả kiểm lại và Docker smoke được ghi trong hồ sơ 2.4/2.5, không suy từ chỉ đọc code. |
| 3 | Kiểm soát truy cập theo chủ sở hữu/phạm vi | **ĐẠT — phạm vi phiếu** | [tests/auth-hardening.test.js](../tests/auth-hardening.test.js) dựng Express thật và JWT cho hai nhân viên khác trung tâm: `GET` chi tiết, `GET` lịch sử, `PUT`, `DELETE` phiếu của trung tâm kia đều trả **403** `KHONG_DU_QUYEN`; cùng trung tâm trả 200; ẩn danh trả 401; dữ liệu phiếu không đổi sau các request bị từ chối. Đây là test theo chủ sở hữu/phạm vi mà mục S2 trước đây thiếu. **Giới hạn:** khách/thiết bị vẫn dùng chung, chưa có mô hình sở hữu theo trung tâm; không suy rộng thành toàn hệ thống. |
| 4 | Mật khẩu và dữ liệu nhạy cảm được băm hoặc mã hóa | **ĐẠT — mật khẩu cấu hình** | `src/config/index.js` chỉ nhận `DEMO_STAFF_PASSWORD_HASH` (bcrypt cost 10–15), từ chối hash mẫu khi `NODE_ENV=production`; `src/routes/auth.routes.js` dùng `bcrypt.compare`, bỏ hoàn toàn so sánh plaintext/SHA-256. `tests/auth-hardening.test.js` kiểm đúng mật khẩu nhận token, sai mật khẩu nhận 401, và biến `DEMO_STAFF_PASSWORD` cũ bị bỏ qua. **Giới hạn:** chưa có collection tài khoản/đăng ký; dữ liệu hồ sơ mẫu không mã hóa ở tầng ứng dụng; che SĐT trên UI không phải mã hóa. |
| 5 | Thông báo lỗi không lộ cấu trúc bên trong | **ĐÃ LÀM** | `src/middlewares/error.middleware.js` chuẩn hóa lỗi, không trả raw stack/URI CSDL, thêm mã tra cứu; `tests/infrastructure-error.test.js` kiểm mapping 400/401/403/404/409/413/422/500/503 và che lỗi nội bộ. Không dùng response giả làm minh chứng mới. |
| 6 | Nhật ký không ghi secret hoặc PII không cần thiết | **ĐÃ LÀM** | `src/logger.js` chỉ giữ metadata hữu hạn, loại body/query/header và chuỗi tự do; `tests/infrastructure-logger.test.js` kiểm secret, PII và Error causes. Bootstrap Docker chỉ ghi trạng thái khởi tạo/tên bước và số bản ghi; smoke chỉ ghi tên phép kiểm và ID phiếu kỹ thuật. |
| 7 | Phụ thuộc được ghim và đã kiểm cảnh báo lỗ hổng cơ bản | **ĐÃ LÀM** | Có `package-lock.json`, Docker dùng `npm ci` và image ghim digest. Ngày 22/11/2026 chạy `npm audit fix` **không dùng `--force`**: `body-parser` lên 2.4.0 (qua `express` 5.3.0), `mongoose` lên 8.24.10; `npm audit` trả **0 lỗ hổng**. Chạy lại `npm test`: 133 phát hiện, 132 PASS, 0 FAIL, 1 SKIP. Không tuyên bố audit sạch cho mọi môi trường ngoài lockfile này. |

## Phân biệt các mục đã kiểm với phần còn thiếu

- **Giới hạn local:** HTTP chỉ publish `127.0.0.1:3001`; MongoDB không publish
  cổng và chỉ ở mạng `demo` internal; app ở cả mạng `demo` và `web` để publish
  HTTP (không tuyên bố app bị chặn outbound). App chạy user `node`, read-only filesystem,
  bỏ Linux capabilities và bật `no-new-privileges`. Không có auth MongoDB trong
  mạng demo riêng này; người có quyền Docker vẫn có thể truy cập CSDL.
- **JWT:** khóa lấy từ môi trường lúc chạy, không nằm trong image. Mẫu local
  không phải khóa bí mật; không đổi khóa `.env` hiện tại để làm bài. JWT phía
  trình duyệt vẫn nằm trong localStorage; chưa refresh/thu hồi token hay rate limit.
- **Mật khẩu demo:** hash mẫu trong `.env.example` tương ứng mật khẩu công khai
  `nhanvien123`; đây là hash của mật khẩu mẫu, không phải bí mật. Production từ
  chối đúng hash mẫu này. Compose phải viết `$$` trước mỗi `$` của hash để
  Compose không nội suy; cấu hình đã sửa ngày 22/11/2026.
- **Dữ liệu nguồn:** mẫu case study có thông tin hồ sơ; xem
  [ghi chú dữ liệu](../data/sample/README.md). Không khẳng định dữ liệu là giả hoặc
   đã được phép công khai. Ngày 12/11 đã đưa bản Docker lên Atlas theo yêu cầu của
   người nộp; thao tác thành công **không phải** bằng chứng đã có quyền công khai
   hay đã ẩn danh. Rủi ro quyền sử dụng/PII vẫn chưa được giải quyết; không dùng
   demo để vận hành hồ sơ khách hàng thật.
- **Log MongoDB:** log vận hành có thể chứa namespace CSDL; đây không phải API
  response. Không công khai nguyên log hoặc ảnh chứa PII/secret.
- **Audit:** phân loại cảnh báo dựa trên công cụ. Hai cảnh báo High của lần chạy
  12/11 đã được xử lý bằng nâng cấp trong phạm vi semver và kiểm lại bằng
  `npm audit` 0 lỗ hổng ngày 22/11/2026; không thêm chúng vào Bug Log vì chưa
  tái lập khai thác trong phạm vi đồ án.

## Cách kiểm chứng lại

Các lệnh chỉ áp dụng cho checkout/môi trường được cho phép:

```powershell
git check-ignore .env
```

```powershell
git log --all --format='%h %s' -- .env '.env.*' ':!.env.example'
```

```powershell
docker compose config --quiet
```

Không chạy `docker compose config` không có `--quiet` để chụp minh chứng:
kết quả có thể hiển thị khóa JWT đã nội suy.

```powershell
npm audit
```

Lệnh audit có thể exit khác 0 khi còn cảnh báo; ghi đúng kết quả. Để kiểm suite
không cần Node.js trên host, dùng một lệnh trong container:

```powershell
docker compose exec -T app npm test
```

Chạy smoke theo [Deployment Guide](deployment-guide.md) chỉ trên CSDL Docker
demo riêng; smoke tạo fixture mới và thay đổi số bản ghi. Guard hiện từ chối
chạy ngoài container trước khi gửi request; log tại
`docs/evidence/bt3/host-smoke-refusal.txt`.

## Minh chứng thực thi ngày 12/11/2026

| Hạng mục | Kết quả thật | Tệp |
|---|---|---|
| Clone sạch từ `main` `7d51189` | hai lệnh, exit `0`; app và db `healthy`; seed 34/50/50/192 | `docs/evidence/bt3/clean-clone/` |
| Dựng bằng hai lệnh | exit `0`; app và db `healthy` | `docs/evidence/bt3/final-build.txt`, `compose-ps.txt` |
| Health qua cổng 3001 | HTTP `200`, `status=ok`, `database=connected` | `docs/evidence/bt3/host-health.json` |
| Test trong container | 130 tổng, 129 PASS, 0 FAIL, 1 SKIP | `docs/evidence/bt3/container-tests.txt` |
| Live smoke | PASS 8/8, phiếu `TCK0032` | `docs/evidence/bt3/docker-smoke.txt` |
| Restart | phiếu mới còn nguyên sau restart | `docs/evidence/bt3/restart-persistence.txt` |
| Runtime | non-root, read-only root, `cap_drop: ALL`, loopback-only | `docs/evidence/bt3/app-runtime-inspect.txt` |
| Guard trên host | từ chối trước khi gửi request, exit `1` | `docs/evidence/bt3/host-smoke-refusal.txt` |
| `npm audit` | 2 High, chưa xử lý (mốc 12/11) | `docs/evidence/bt3/dependency-audit.json` |
| `npm audit` sau nâng cấp | 0 lỗ hổng; `body-parser` 2.4.0, `mongoose` 8.24.10 (22/11/2026) | `docs/evidence/bt3/dependency-audit-after-fix.txt` |
| Test S2/S3 | 3/3 PASS: 403 theo trung tâm, bcrypt đúng/sai, production bắt buộc hash | `tests/auth-hardening.test.js`; log `docs/evidence/bt3/auth-hardening-tests.txt` |
| Render/Atlas | 338 document, 30 index khớp; 0 lỗi quan hệ; health HTTPS 200; 6 kiểm tra hosted chỉ đọc PASS | `docs/evidence/bt3/render/` |

### Giới hạn bảo mật của bản hosted

- URI Atlas chỉ ở Render Environment, không ghi vào repo hay ảnh; tên đích đã
  đọc lại là `mekong_bt3_render`. Atlas dùng TLS và Network Access; chỉ thêm IP
  máy chuyển dữ liệu, giữ các CIDR hiện có, không mở `0.0.0.0/0`.
- Render vẫn `NODE_ENV=development`; JWT secret và mật khẩu demo hiện có không
  đạt validation production của `src/config/index.js`, được giữ nguyên chứ không
  tự xoay khóa/đổi tài khoản. HTTPS không làm các mục 3/4/7 trở thành ĐÃ LÀM.
- Tài khoản Atlas được kiểm tra có quyền `atlasAdmin@admin`: quá rộng cho runtime.
  Cần tài khoản ứng dụng chỉ `readWrite` trên database đích khi harden; chưa đổi
  quyền hoặc tài khoản trong lần chuyển dữ liệu này.

Mục 3 đạt trong **phạm vi phiếu**, mục 4 đạt trong **phạm vi mật khẩu cấu hình**,
mục 7 đạt trên lockfile hiện tại. Phần chưa đạt của mục 3 là quyền sở hữu
khách/thiết bị toàn hệ thống; phần chưa đạt của mục 4 là mã hóa dữ liệu hồ sơ và
collection tài khoản. Phép thử clone từ tag `v1.0` đã chạy ngày 22/11/2026 và
được ghi ở Mục 7 của báo cáo; clone `main` mới nhất được chạy bổ sung để đối
chiếu số test sau thay đổi.
