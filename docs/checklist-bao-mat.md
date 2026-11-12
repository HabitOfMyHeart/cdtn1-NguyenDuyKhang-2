# Checklist bảo mật — BT3

**Phạm vi:** Smart CRM – Mekong Mobile, track SE, luồng L2; bản Docker chạy local.
**Ngày rà soát:** 12/11/2026. Đây là tự đánh giá, không phải chứng nhận an toàn hoặc pentest.

| # | Mục theo đề | Kết quả | Minh chứng và giới hạn |
|---|---|---|---|
| 1 | Không có secret thật trong repo | **ĐÃ LÀM** | `.gitignore` chặn `.env`/`.env.*` trừ mẫu; `git log --all --format='%h %s' -- .env '.env.*' ':!.env.example'` không có kết quả. Docker dùng allowlist và không COPY `.env`. Các khóa test/tài khoản demo được công khai là mẫu, không dùng production. Kiểm tra này không phải bảo đảm tuyệt đối rằng mọi dạng secret trong toàn lịch sử đều đã được phát hiện. |
| 2 | Dữ liệu vào được kiểm ở tầng ứng dụng | **ĐÃ LÀM** | `src/validators/primitives.js`, `ticket.validator.js` và service kiểm kiểu, ngày lịch, độ dài, tham chiếu; `tests/intake-boundary.test.js` có HTTP thật từ chối ngày/kiểu sai bằng 422 kèm field. Kết quả kiểm lại và Docker smoke được ghi trong hồ sơ 2.4/2.5, không suy từ chỉ đọc code. |
| 3 | Kiểm soát truy cập theo chủ sở hữu/phạm vi | **CHƯA LÀM** | Phiếu có kiểm trung tâm ở `src/services/ticket.service.js` và test QT-14; nhưng hồ sơ khách/thiết bị dùng chung, chưa có mô hình sở hữu theo trung tâm. Không đánh dấu đạt toàn hệ thống chỉ vì một test phiếu PASS. |
| 4 | Mật khẩu và dữ liệu nhạy cảm được băm hoặc mã hóa | **CHƯA LÀM** | `src/routes/auth.routes.js` so sánh mật khẩu demo dạng rõ từ cấu hình, không có collection tài khoản/password hash; dữ liệu hồ sơ mẫu không mã hóa ở tầng ứng dụng. Che SĐT trên UI không phải mã hóa. S3 của BT3 chưa đạt; bổ sung băm/lưu tài khoản là thay đổi riêng, không được giả ghi đã làm. |
| 5 | Thông báo lỗi không lộ cấu trúc bên trong | **ĐÃ LÀM** | `src/middlewares/error.middleware.js` chuẩn hóa lỗi, không trả raw stack/URI CSDL, thêm mã tra cứu; `tests/infrastructure-error.test.js` kiểm mapping 400/401/403/404/409/413/422/500/503 và che lỗi nội bộ. Không dùng response giả làm minh chứng mới. |
| 6 | Nhật ký không ghi secret hoặc PII không cần thiết | **ĐÃ LÀM** | `src/logger.js` chỉ giữ metadata hữu hạn, loại body/query/header và chuỗi tự do; `tests/infrastructure-logger.test.js` kiểm secret, PII và Error causes. Bootstrap Docker chỉ ghi trạng thái khởi tạo/tên bước và số bản ghi; smoke chỉ ghi tên phép kiểm và ID phiếu kỹ thuật. |
| 7 | Phụ thuộc được ghim và đã kiểm cảnh báo lỗ hổng cơ bản | **CHƯA LÀM** | Có `package-lock.json`, Docker dùng `npm ci` và image ghim digest; đã chạy `npm audit` ngày 12/11/2026 nhưng còn **2 cảnh báo High** (`body-parser`, `mongoose`). Chưa xử lý và kiểm lại bản nâng cấp; không dùng `npm audit fix --force` hoặc tuyên bố audit sạch. |

## Phân biệt các mục đã kiểm với phần còn thiếu

- **Giới hạn local:** HTTP chỉ publish `127.0.0.1:3001`; MongoDB không publish
  cổng và chỉ ở mạng `demo` internal; app ở cả mạng `demo` và `web` để publish
  HTTP (không tuyên bố app bị chặn outbound). App chạy user `node`, read-only filesystem,
  bỏ Linux capabilities và bật `no-new-privileges`. Không có auth MongoDB trong
  mạng demo riêng này; người có quyền Docker vẫn có thể truy cập CSDL.
- **JWT:** khóa lấy từ môi trường lúc chạy, không nằm trong image. Mẫu local
  không phải khóa bí mật; không đổi khóa `.env` hiện tại để làm bài. JWT phía
  trình duyệt vẫn nằm trong localStorage; chưa refresh/thu hồi token hay rate limit.
- **Dữ liệu nguồn:** mẫu case study có thông tin hồ sơ; xem
  [ghi chú dữ liệu](../data/sample/README.md). Không khẳng định dữ liệu là giả hoặc
  đã được phép công khai. Không deploy bộ mẫu này lên Render trước khi xử lý quyền
  sử dụng/ẩn danh dữ liệu và các giới hạn bảo mật.
- **Log MongoDB:** log vận hành có thể chứa namespace CSDL; đây không phải API
  response. Không công khai nguyên log hoặc ảnh chứa PII/secret.
- **Audit:** phân loại cảnh báo dựa trên công cụ, chưa đánh giá khả năng khai thác
  từng advisory trong phạm vi đồ án; 2 cảnh báo High không tự đồng nghĩa đã có
  hai bug sản phẩm được chứng minh. Không thêm chúng vào Bug Log khi chưa tái lập.

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
| Dựng bằng hai lệnh | exit `0`; app và db `healthy` | `docs/evidence/bt3/final-build.txt`, `compose-ps.txt` |
| Health qua cổng 3001 | HTTP `200`, `status=ok`, `database=connected` | `docs/evidence/bt3/host-health.json` |
| Test trong container | 130 tổng, 129 PASS, 0 FAIL, 1 SKIP | `docs/evidence/bt3/container-tests.txt` |
| Live smoke | PASS 8/8, phiếu `TCK0032` | `docs/evidence/bt3/docker-smoke.txt` |
| Restart | phiếu mới còn nguyên sau restart | `docs/evidence/bt3/restart-persistence.txt` |
| Runtime | non-root, read-only root, `cap_drop: ALL`, loopback-only | `docs/evidence/bt3/app-runtime-inspect.txt` |
| Guard trên host | từ chối trước khi gửi request, exit `1` | `docs/evidence/bt3/host-smoke-refusal.txt` |
| `npm audit` | 2 High, chưa xử lý | `docs/evidence/bt3/dependency-audit.json` |

Các mục 3, 4 và 7 vẫn **CHƯA LÀM**. Chưa xác nhận bản nộp từ tag `v1.0` vì tag
chưa được tạo/push; phép thử clone sạch từ tag phải chạy riêng sau khi người nộp
cho phép.
