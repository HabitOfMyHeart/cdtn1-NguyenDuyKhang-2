# Kiểm chứng Buổi 10 – Smart CRM Mekong Mobile (Luồng L2)

> **Hồ sơ lịch sử của phiên bản ngày 24/10/2026, không phải kết quả xác minh phiên bản hiện tại.** Mẫu cũ có 30 phiếu/99 log; mẫu hiện tại có 50 phiếu/192 log nguồn. Các CSDL tạm ghi dưới đây đã bị xóa. Ảnh và thao tác, kể cả bước kế tiếp hiển thị ở bản cũ, không chứng minh UI/API hiện tại; ảnh loading là mô phỏng. Không có bằng chứng clone remote sạch cho bản hiện tại. Test, E2E và kiểm chứng cuối cùng còn chờ chạy và ghi nhận thực tế.
>
> Kiểm tra xung đột sau đó trên CSDL chính ghi nhận 51 xung đột trường; người dùng chọn giữ dữ liệu hiện tại. Ngày 27/10/2026, sau khi sao lưu, CSDL chính chỉ được bổ sung 4 khách, 20 thiết bị, 20 phiếu và 85 log nguồn không xung đột; không bản ghi cũ nào bị sửa hoặc xóa. Xem [kiểm chứng dữ liệu cuối](kiem-chung-csdl.md), [README](../README.md) và [nguồn mẫu](../data/sample/README.md).

**Ngày kiểm chứng:** 24/10/2026  
**Người thực hiện:** Nguyễn Duy Khang – MSSV 2374802010212  
**Phạm vi:** Sprint 2 – tách lớp API giao diện, hoàn thiện trạng thái UI, kiểm chứng tích hợp MongoDB và quy trình cài từ bản sạch.  
**Mốc Git:** `cbdd9c599fabd3d2e12eb325ef14fe6232a5025b` (11 commit) + các thay đổi Buổi 10 **chưa commit** tại thời điểm chạy.

## 1. Môi trường

| Thành phần | Giá trị ghi nhận |
|---|---|
| Hệ điều hành | Windows |
| Node.js | v24.21.0 |
| npm | 11.19.0 |
| MongoDB Server | 9.0.2, service `MongoDB` đang `Running` |
| Trình duyệt kiểm chứng | Chromium tích hợp công cụ OpenCode |
| CSDL kiểm chứng E2E | `mekong_warranty_buoi10_20261024` (CSDL tạm, đã xóa sau khi lưu bằng chứng) |
| CSDL kiểm chứng bản sạch | `mekong_warranty_buoi10_copy_20261024` (CSDL tạm, đã xóa sau khi lưu log) |

Không sử dụng hoặc thay đổi CSDL `mekong_warranty` trong các lần chạy dưới đây. Các CSDL tạm chỉ chứa dữ liệu seed và phiếu kiểm thử, đã được xóa để tránh để lại nhiều database rác; số liệu và log vẫn được giữ trong thư mục `docs/evidence/buoi10/`.

## 2. Kết quả test tự động

Lệnh:

```powershell
npm test
```

Kết quả thực tế: **56/56 PASS, 0 fail** (log đầy đủ tại [`evidence/buoi10/npm-test.txt`](evidence/buoi10/npm-test.txt)).

| Tệp test | Số test | Nội dung chính |
|---|---:|---|
| `tests/api-client.test.js` | 21 | JWT/localStorage, 401 bảo vệ, 401 của request cũ, lỗi mạng, HTTP 422/403/503, response 204, `API_BASE_URL`, URL/verb/body của 7 thao tác phiếu |
| `tests/ticket.service.test.js` | 17 | Tạo/xem/sửa phiếu, QT-03/04/05/06/14, lỗi dữ liệu, log trạng thái |
| `tests/static-assets.test.js` | 10 | Hợp đồng 14 khóa, che SĐT, dữ liệu seed, cấu trúc 3 màn hình và thứ tự nạp script |
| `tests/ticket.contract.test.js` | 8 | Đúng 14 khóa, thứ tự khóa, ISO `+07:00`, `conBaoHanh = null` |

Bộ test dùng repository in-memory và fetch giả; không cần MongoDB, không cần khởi động server.

Ba test bổ sung cho lỗi transport đã được kiểm tra riêng:

- Request cũ trả 401 không xóa phiên vừa đăng nhập lại.
- HTTP 200 nhưng body không phải JSON hợp lệ trả `PHAN_HOI_KHONG_HOP_LE`, không giả thành danh sách rỗng.
- HTTP 200 nhưng `Content-Type` không phải JSON cũng trả lỗi đọc dữ liệu.

## 3. Kiểm chứng E2E trên MongoDB

### 3.1. Chuẩn bị dữ liệu

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/mekong_warranty_buoi10_20261024'
npm run db:migrate
npm run db:seed
npm run db:seed
```

Lệnh trên chỉ dùng cho lần kiểm chứng đã ghi; CSDL tạm đã được xóa. Không chạy lại nếu không muốn tạo database kiểm chứng mới.

- Migration tạo đủ 6 collection và đồng bộ index.
- Seed lần 1: `service_center=6`, `issue_category=6`, `customer=30`, `device=30`, `ticket=30`, `ticket_status_log=99`.
- Seed lần 2: toàn bộ `matched`, `upserted=0`, tổng số bản ghi không đổi.

### 3.2. Luồng giao diện thật

Đăng nhập `nhanvien / nhanvien123`, sau đó:

1. Mở danh sách phiếu của TTBH Quận 10.
2. Tra cứu khách hàng `0945883117` → `CUS0022` (Võ Thị Cường).
3. Tra cứu thiết bị `SN353496038427` → `DEV0022` (Apple Pro Max 11).
4. Chọn nhóm sự cố `SAC`, ưu tiên `TRUNG_BINH`, nhập mô tả lỗi, phụ kiện `SAC,HOP` và tình trạng ngoại quan.
5. Lưu phiếu, hệ thống sinh `TCK0031` / `BH-000097/2026`, trạng thái `MOI`, hạn cam kết `2026-10-28T14:15:23+07:00`.

Kết quả đối chiếu API và MongoDB (chi tiết trong [`evidence/buoi10/e2e-result.json`](evidence/buoi10/e2e-result.json)):

| Hạng mục | Giá trị thực tế |
|---|---|
| Mã phiếu | `TCK0031` – `BH-000097/2026` |
| Khách hàng / thiết bị | `CUS0022` / `DEV0022` |
| SĐT hiển thị | `0945***117` (đã che theo QT-15) |
| Nhóm sự cố / ưu tiên | `SAC` / `TRUNG_BINH` |
| Trạng thái | `MOI` |
| Hạn cam kết | `2026-10-28T14:15:23+07:00` |
| Hợp đồng chi tiết | Đúng **14 khóa**, không thêm khóa lịch sử vào object `ticket` |
| Phụ kiện | `["SAC", "HOP"]` |
| Log khởi tạo | `LOG000100`, `fromStatus = null → MOI`, người đổi `nhanvien` |
| Bước kế tiếp hợp lệ | `DA_PHAN_CONG`, `DANG_XU_LY` |

Sau khi tải lại trang, phiếu `TCK0031` vẫn xuất hiện trong danh sách và mở được chi tiết; log khởi tạo vẫn còn trong `ticket_status_log`.

Số bản ghi sau E2E trên CSDL kiểm chứng: `30 khách hàng / 30 thiết bị / 6 trung tâm / 6 nhóm / 31 phiếu / 100 log`. Việc tăng 1 phiếu và 1 log là do phiếu `TCK0031` được tạo thật, không phải seed sai.

### 3.3. Ảnh minh chứng

| Ảnh | Nội dung | Loại bằng chứng |
|---|---|---|
| [`01-danh-sach.png`](screenshots/buoi10/01-danh-sach.png) | Danh sách phiếu có dữ liệu thật | Luồng thật |
| [`02-tiep-nhan.png`](screenshots/buoi10/02-tiep-nhan.png) | Màn tiếp nhận, danh mục trung tâm/nhóm tải từ API | Luồng thật |
| [`03-tao-phieu-thanh-cong.png`](screenshots/buoi10/03-tao-phieu-thanh-cong.png) | Chi tiết `TCK0031` sau khi lưu | Luồng thật |
| [`04-loading.png`](screenshots/buoi10/04-loading.png) | `DataState` loading | **Chế độ mô phỏng** trên thanh kiểm chứng UI |
| [`05-empty-filter.png`](screenshots/buoi10/05-empty-filter.png) | Empty do bộ lọc không khớp | Bộ lọc thật trên dữ liệu đã tải |
| [`06-error.png`](screenshots/buoi10/06-error.png) | Lỗi khi server đang tắt | **Sự cố thật**, không dùng nút mô phỏng |
| [`07-phien-het-han.png`](screenshots/buoi10/07-phien-het-han.png) | Về màn đăng nhập sau khi token bị vô hiệu | **401 thật** |

Biên bản thao tác trình duyệt: [`evidence/buoi10/manual-ui-check.txt`](evidence/buoi10/manual-ui-check.txt).

### 3.4. Kiểm tra mất kết nối và nút “Thử lại”

1. Giữ tab đang mở danh sách đã tải dữ liệu.
2. Dừng tiến trình Express trên cổng `3000`.
3. Bấm mở một phiếu có sẵn trong danh sách. Ứng dụng gọi API thật và hiển thị `DataState` lỗi “Chưa tải được chi tiết phiếu”, kèm mã tra cứu `238A-27` (ảnh `06-error.png`).
4. Khởi động lại Express với đúng CSDL kiểm chứng và cổng `3000`.
5. Bấm **Thử lại** trên màn hình lỗi; chi tiết `TCK0023` tải được, hiển thị `0372***442`, trạng thái `DA_DONG`, lịch sử 5 bước.

Như vậy nút “Thử lại” thực hiện request mới và phục hồi dữ liệu, không chỉ đổi trạng thái cục bộ.

### 3.5. Kiểm tra 401 thật

1. Trong tab đang đăng nhập, thay token trong `localStorage` bằng một chuỗi không hợp lệ.
2. Mở lại danh sách để phát sinh request được bảo vệ.
3. Server trả `401`; ứng dụng xóa `mekong_crm_token` và `mekong_crm_user`, phát sự kiện đăng xuất và quay về màn đăng nhập (ảnh `07-phien-het-han.png`).
4. Đăng nhập lại bằng `nhanvien`; danh sách tải lại bình thường.

Kiểm tra trực tiếp trong trình duyệt sau bước 3: cả hai khóa đều trả `null`; sau bước 4 token mới được lưu và danh sách có 6 dòng.

### 3.6. Kiểm tra lại trên CSDL chính sau khi dọn

Sau khi xóa các CSDL tạm, ứng dụng được khởi động lại bằng `.env` của dự án (`mekong_warranty`) và kiểm tra **chỉ đọc**:

- `/health`: `status=ok`, `database=connected`.
- Đăng nhập `nhanvien`: danh mục 6 trung tâm/6 nhóm, danh sách 5 phiếu của trung tâm 1.
- Chi tiết `TCK0023`: đúng 14 khóa, SĐT `0372***442`.
- Không tạo, sửa hoặc xóa bản ghi nào; số liệu CSDL chính vẫn là 31 khách hàng/30 thiết bị/30 phiếu/103 log.

## 4. Kiểm chứng bản sạch

### 4.1. Phương pháp

Tại thời điểm chạy, các thay đổi Sprint 2 **chưa được commit/push**, nên chưa thể clone bản mới từ GitHub. Thay vào đó, một bản sao sạch của working tree được tạo tại:

`C:\Users\ACER\AppData\Local\Temp\opencode\buoi10-working-copy-20261024`

Bản sao loại trừ `node_modules`, `.git`, `.env`; sau đó cài lại từ `package-lock.json` và cấu hình CSDL riêng.

### 4.2. Kết quả

| Bước | Kết quả |
|---|---|
| `npm ci` | Thành công, cài 103 thư mục package từ lockfile |
| `.env` | `PORT=3001`, `MONGODB_URI` trỏ CSDL tạm `mekong_warranty_buoi10_copy_20261024` (đã xóa sau kiểm chứng) |
| `npm run db:migrate` | Tạo đủ 6 collection, đồng bộ index |
| `npm run db:seed` lần 1 | `6/6/30/30/30/99` |
| `npm run db:seed` lần 2 | Toàn bộ `matched`, `upserted=0`, tổng không đổi |
| `npm test` | **56/56 PASS** – log tại [`evidence/buoi10/clean-copy-npm-test.txt`](evidence/buoi10/clean-copy-npm-test.txt) |
| `/health` | `status=ok`, `database=connected` |
| Đăng nhập + danh sách | `nhanvien` đăng nhập được, thấy 5 phiếu của trung tâm 1 |
| Danh mục | 6 trung tâm, 6 nhóm sự cố |
| Chi tiết phiếu | `TCK0023`, đúng 14 khóa, SĐT `0372***442`, 5 log |
| Số bản ghi CSDL bản sạch | `30/30/6/6/30/99` |

Log smoke test: [`evidence/buoi10/clean-copy-smoke.txt`](evidence/buoi10/clean-copy-smoke.txt).

### 4.3. Giới hạn cần hoàn tất sau khi commit

- Chưa thể ghi SHA của bản nộp cuối cùng vì các tệp `src/api/`, `tests/api-client.test.js`, ảnh và tài liệu đang là thay đổi chưa commit.
- Sau khi commit/push, cần chạy lại đúng mục 3.3 của README từ một thư mục trống bằng `git clone` thật, ghi SHA đã clone và lặp lại các bước migration/seed/test/health.
- Bản sao sạch hiện tại chứng minh dependency, migration, seed, test và server chạy được từ cây mã đầy đủ; nó **không** thay thế bằng chứng clone remote.

## 5. Tổng hợp trạng thái

| Hạng mục | Trạng thái |
|---|---|
| 6 schema, hợp đồng 14 khóa | Đạt |
| 3 màn hình, `DataState` loading/empty/error | Đạt |
| Tách `client.js` / `ticket.api.js` / facade | Đạt, có test tĩnh và test transport |
| Test độc lập MongoDB | Đạt, 56/56 |
| E2E MongoDB thật | Đạt, `TCK0031` |
| Ảnh minh chứng | Đủ 7 ảnh, có ghi rõ ảnh mô phỏng |
| Mất kết nối + Retry | Đạt |
| 401 + xóa phiên | Đạt |
| Bản sạch `npm ci` + migrate + seed + test + health | Đạt (bản sao working tree) |
| Clone remote bản mới | **Chưa thể chạy** do chưa commit/push |
| Peer review thật ≥ 3 góp ý | **Chưa có**, không tạo bằng chứng giả |
| ≥ 8 commit | Đạt mốc cũ 11 commit; commit Buổi 10 do người dùng thực hiện sau |

## 6. Tái kiểm chứng phiên bản hiện tại

Dùng quy trình đích sạch được phép trong [README](../README.md); migration và seed có thể thay đổi CSDL. Ghi SHA, kết quả test, E2E và ảnh mới nếu thực sự thực hiện; không dùng lại số liệu trên làm kết quả hiện tại. Clone remote sau khi có bản nộp và peer review thật vẫn là việc cần hoàn tất.
