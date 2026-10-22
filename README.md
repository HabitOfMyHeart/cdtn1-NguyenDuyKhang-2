# Smart CRM – Mekong Mobile

**Luồng L2:** Tiếp nhận và phân loại yêu cầu bảo hành  
**Track:** SE  
**Phiên bản:** 0.2 – Bài tập 2 (Buổi 8–12)  
**Sinh viên:** Nguyễn Duy Khang – MSSV 2374802010212

## 1. Giới thiệu

Đồ án xây dựng prototype cho module tiếp nhận bảo hành của Smart CRM – Mekong Mobile. Hệ thống cho phép nhân viên tra cứu khách hàng theo số điện thoại, tra cứu thiết bị theo Serial/IMEI, kiểm tra hạn bảo hành, tính hạn cam kết SLA và tạo phiếu ở trạng thái `MOI`. Sau khi tiếp nhận, phiếu đi qua vòng đời trạng thái một chiều theo QT-06; mọi bước chuyển đều được ghi vào `ticket_status_log`.

Phạm vi Bài tập 2 gồm:

- Backend Express/Mongoose chia ba lớp `routes → services → repositories`.
- Sáu collection đúng ERD: `customer`, `device`, `service_center`, `issue_category`, `ticket`, `ticket_status_log`.
- Seed dữ liệu mẫu idempotent từ `data/sample/`; dataset gốc không đưa lên Git.
- Hợp đồng `toTicketView()` đúng 14 khóa, che số điện thoại theo QT-15, giữ `conBaoHanh = null` khi chưa xác minh QT-05.
- Giao diện React SPA gồm ba màn hình: danh sách phiếu, tiếp nhận phiếu, chi tiết phiếu.
- Bộ test `node:test` chạy độc lập, không cần MongoDB.

Các quy tắc nghiệp vụ được triển khai: QT-01, QT-02, QT-03, QT-04, QT-05, QT-06, QT-13, QT-14 và QT-15.

## 2. Công nghệ và kiến trúc

### 2.1. Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js 20 trở lên |
| Web framework | Express 5 |
| Cơ sở dữ liệu | MongoDB 7 trở lên, Mongoose 8 |
| Xác thực | JWT demo, thư viện `jsonwebtoken` |
| Giao diện | React 18 UMD + `htm`, không cần bước build |
| Kiểm thử | `node:test` + `node:assert/strict` |
| Cấu hình | `dotenv`, `.env.example` |

### 2.2. Kiến trúc ba lớp

```text
Trình duyệt (React SPA)
        │  HTTP/JSON + Bearer JWT
        ▼
Routes        đọc req, gọi service, trả response
        ▼
Services      nghiệp vụ, tính SLA, kiểm tra bảo hành, hợp đồng 14 khóa
        ▼
Repositories  truy vấn Mongoose, không chứa nghiệp vụ
        ▼
MongoDB       6 collection
```

- Route không truy vấn Mongoose trực tiếp.
- Service không dùng `req`/`res`, không trả mã HTTP trực tiếp; lỗi nghiệp vụ dùng factory trong `src/services/errors.js`.
- Repository là nơi duy nhất làm việc với model Mongoose.
- `src/services/ticket.contract.js` là ranh giới chuyển dữ liệu nội bộ sang hợp đồng 14 khóa.
- `src/middlewares/error.middleware.js` chuẩn hóa mọi lỗi thành `{ error, message, fields }`; lỗi 500 chỉ trả mã tra cứu, không lộ stack hay chi tiết CSDL.

### 2.3. Cấu trúc thư mục

```text
src/
  config/          db.js – kết nối MongoDB
  models/          schemas.js – 6 Mongoose schema và index
  repositories/    customer, device, catalog, ticket
  services/        ticket, customer, warrantyCheck, category,
                   slaCalculator, ticket.contract, errors
  validators/      ticket.validator.js
  middlewares/     auth.middleware.js, error.middleware.js
  routes/          auth, customer, device, ticket
  public/          index.html, apiClient.js, app.js
migrations/        001_init_collections.js
seeds/             seed_l2_data.js
data/sample/       dữ liệu mẫu nhỏ đã trích từ dataset
db/schema.sql      DDL 6 bảng 3NF
tests/             3 tệp test + helper in-memory repository
docs/              SRS, hợp đồng API, nhật ký thiết kế, sơ đồ, AI disclosure
```

## 3. Cài đặt và chạy

### 3.1. Yêu cầu môi trường

- Node.js 20 trở lên và npm 10 trở lên.
- MongoDB 7 trở lên đang chạy tại địa chỉ trong `MONGODB_URI`.
- Cổng mặc định: `3000`.

### 3.2. Các bước chạy

```powershell
# 1. Cài dependency
npm install

# 2. Tạo tệp môi trường từ mẫu
Copy-Item .env.example .env

# 3. Tạo 6 collection và đồng bộ index
npm run db:migrate

# 4. Nạp dữ liệu mẫu (có thể chạy lặp)
npm run db:seed

# 5. Khởi động ứng dụng
npm start
```

Mở `http://localhost:3000`. Kiểm tra sức khỏe hệ thống:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Kết quả mong đợi có `status = ok` và `database = connected`.

Có thể dùng `npm run dev` để chạy với `node --watch`. Hai lệnh `npm run migrate` và `npm run seed` là alias tương thích của `db:migrate` và `db:seed`.

### 3.3. Tài khoản demo

| Tài khoản | Mật khẩu | Vai trò | Trung tâm |
|---|---|---|---|
| `nhanvien` | `nhanvien123` | Nhân viên tiếp nhận | `1` – TTBH Quận 10 |
| `quanly` | `quanly123` | Quản lý | Xem được mọi trung tâm |

Tài khoản được khai báo trong `.env`; đây là tài khoản prototype, không dùng cho môi trường thật.

### 3.4. Dữ liệu seed

`npm run db:seed` đọc từ `data/sample/` và upsert theo khóa nghiệp vụ:

| Collection | Số bản ghi |
|---|---:|
| `service_center` | 6 |
| `issue_category` | 6 |
| `customer` | 30 |
| `device` | 30 |
| `ticket` | 30 |
| `ticket_status_log` | 99 |

- Seed chạy lần hai không nhân đôi dữ liệu: các bản ghi đã có được `matched`, `upserted = 0`.
- Dataset gốc nằm ngoài repo và bị chặn bởi `.gitignore`; chỉ mẫu nhỏ trong `data/sample/` được commit.
- Bộ 30 phiếu có đủ 6 trạng thái, 15 phiếu còn bảo hành, 9 phiếu hết bảo hành và 6 phiếu chưa xác minh vì thiếu `purchase_date`.
- `purchase_date` của một số thiết bị được tổng hợp để bổ sung cho dataset gốc còn thiếu cột này; các trường hợp cố ý để `null` dùng để kiểm thử QT-05.
- `due_date` trong seed được tính lại theo QT-04; log khởi tạo của phiếu `MOI` có `from_status = null`.

Nếu MongoDB chưa chạy, giao diện vẫn mở được nhưng API trả lỗi 500 kèm mã tra cứu để màn hình hiển thị đúng trạng thái lỗi.

## 4. API, dữ liệu và giao diện

### 4.1. Nhóm endpoint

| Nhóm | Endpoint chính |
|---|---|
| Xác thực | `POST /api/auth/login`, `GET /api/auth/me` |
| Khách hàng | `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/:id` |
| Thiết bị | `GET /api/devices/lookup`, `GET/POST /api/devices`, `GET/PUT/DELETE /api/devices/:id` |
| Danh mục | `GET /api/catalogs`, `GET /api/catalogs/categories/:id/suggest` |
| Phiếu | `POST /api/tickets/preview`, `GET/POST /api/tickets`, `GET/PUT/DELETE /api/tickets/:id` |
| Trạng thái | `PATCH/PUT /api/tickets/:id/status`, `GET /api/tickets/:id/history` |

Mọi endpoint `/api/*` (trừ đăng nhập) yêu cầu `Authorization: Bearer <JWT>`. Chi tiết request/response, mã lỗi và ví dụ nằm trong [`docs/api-contract.md`](docs/api-contract.md).

### 4.2. Định dạng lỗi

```json
{
  "error": "DU_LIEU_KHONG_HOP_LE",
  "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
  "fields": {
    "issue_desc": "Mô tả lỗi phải có ít nhất 10 ký tự."
  }
}
```

| HTTP | Mã lỗi |
|---:|---|
| `400`, `422` | `DU_LIEU_KHONG_HOP_LE` |
| `401` | `CHUA_DANG_NHAP` |
| `403` | `KHONG_DU_QUYEN` |
| `404` | `KHONG_TIM_THAY` |
| `409` | `PHIEU_DANG_MO`, `TRUNG_DU_LIEU`, `CHUYEN_TRANG_THAI_KHONG_HOP_LE` |
| `500` | `LOI_HE_THONG` kèm `fields.maTraCuu` |

### 4.3. Hợp đồng 14 khóa

`toTicketView()` trả đúng 14 khóa, không thêm lịch sử hay mô tả lỗi vào object này:

`ticketId`, `ticketCode`, `tenKhach`, `sdtHienThi`, `tenThietBi`, `serialNo`, `nhomSuCo`, `mucUuTien`, `trangThai`, `conBaoHanh`, `ketLuanBaoHanh`, `hanCamKet`, `ngayTiepNhan`, `trungTam`.

- `sdtHienThi` luôn được che 3 chữ số giữa, ví dụ `0901***567` (QT-15).
- `conBaoHanh = null` nghĩa là **chưa xác minh** do thiếu ngày mua, không phải hết bảo hành (QT-05).
- `hanCamKet` và `ngayTiepNhan` là ISO 8601 kèm `+07:00`.
- Mô tả lỗi, phụ kiện, ngoại quan, lý do ưu tiên và lịch sử trạng thái nằm ngoài `ticket` trong envelope `data` của API chi tiết.

### 4.4. Giao diện

Giao diện chạy tại `http://localhost:3000`, dùng React 18 UMD và `htm` được phục vụ từ `node_modules` (có fallback CDN trong `index.html`). Không cần `npm run build`.

Ba màn hình:

1. **Danh sách phiếu** – số liệu tổng quan, bộ lọc trạng thái/nhóm sự cố/mức ưu tiên, tìm kiếm, bảng phiếu và ngữ cảnh SLA.
2. **Tiếp nhận phiếu mới** – tra cứu khách hàng bằng SĐT, tra cứu thiết bị bằng serial, kiểm tra bảo hành, nhập mô tả/phụ kiện/ngoại quan, xem trước hạn cam kết và lưu phiếu `MOI`.
3. **Chi tiết phiếu** – 14 khóa hợp đồng, mô tả lỗi, lịch sử trạng thái, ngữ cảnh SLA và các bước chuyển trạng thái hợp lệ.

Mọi lời gọi API đi qua `src/public/apiClient.js`; `app.js` không tự dùng `fetch` hay `axios`. Component `DataState` có ba trạng thái loading/empty/error; empty phân biệt “chưa có dữ liệu” với “bộ lọc không khớp”. Thanh “Kiểm chứng trạng thái giao diện” cho phép xem nhanh loading, hai loại empty, error và quay về dữ liệu thật.

## 5. Kiểm thử và kiểm chứng

### 5.1. Chạy test

```powershell
npm test
```

Bộ test chạy bằng `node:test`, không cần MongoDB và không cần khởi động server. Kết quả hiện tại: **35/35 test PASS**.

| Tệp | Nội dung chính |
|---|---|
| `tests/ticket.contract.test.js` | Đúng 14 khóa, thứ tự khóa, che SĐT, ISO `+07:00`, `conBaoHanh = null` |
| `tests/ticket.service.test.js` | Happy path tạo/xem/sửa phiếu, lọc danh sách, QT-04, QT-05, QT-06, QT-14, lỗi dữ liệu và xung đột |
| `tests/static-assets.test.js` | UI chỉ gọi qua `apiClient`, `DataState`, 3 màn hình, seed đủ số lượng/trạng thái, `due_date` và `is_warranty` khớp QT-04/QT-05 |

Test dùng repository in-memory trong `tests/helpers/inMemoryRepositories.js`, được inject vào service qua factory. Nhờ vậy test kiểm tra được nghiệp vụ và hợp đồng mà không phụ thuộc trạng thái MongoDB.

### 5.2. Kiểm chứng thủ công đã thực hiện

- `npm run db:migrate`: tạo đủ 6 collection và đồng bộ index.
- `npm run db:seed` hai lần: lần đầu upsert 6/6/30/30/30/99; lần hai `matched` toàn bộ, `upserted = 0`, tổng số bản ghi không đổi.
- `GET /health`: `status = ok`, `database = connected`.
- Đăng nhập `nhanvien` và `quanly`: token hợp lệ; nhân viên thấy 5 phiếu của trung tâm 1, quản lý thấy 30 phiếu.
- `POST /api/tickets/preview` với Thứ Bảy `24/10/2026`, ưu tiên `CAO`: hạn trả là Thứ Hai `26/10/2026`, 24 giờ làm việc.
- Tạo phiếu thật `TCK0031`, đổi ưu tiên sang `CAO` có lý do (hạn đổi từ 24/10 sang 22/10), chuyển `MOI → DA_PHAN_CONG → DANG_XU_LY → HOAN_TAT → DA_DONG`, kiểm tra 5 log rồi xóa bản ghi kiểm thử.
- Giao diện: kiểm tra màn hình đăng nhập, danh sách, tiếp nhận, chi tiết; tạo phiếu `TCK0031` trực tiếp từ màn hình tiếp nhận với khách `CUS0022`/thiết bị `DEV0022`, kiểm tra 14 khóa, phụ kiện, ngoại quan và log khởi tạo; kiểm tra loading, empty chưa có dữ liệu, empty bộ lọc, error có mã tra cứu và nút “Thử lại”.
- Sau kiểm chứng, dữ liệu được dọn về đúng 30 khách hàng/30 thiết bị/6 trung tâm/6 nhóm/30 phiếu/99 log.

## 6. Tài liệu, giới hạn và trạng thái

### 6.1. Tài liệu

- [`docs/srs.md`](docs/srs.md) – SRS rút gọn của Luồng L2.
- [`docs/api-contract.md`](docs/api-contract.md) – hợp đồng API đầy đủ, ví dụ request/response và mã lỗi.
- [`docs/thay-doi-thiet-ke.md`](docs/thay-doi-thiet-ke.md) – nhật ký TD-01…TD-04 sau phản hồi Bài tập 1.
- [`docs/ai-disclosure.md`](docs/ai-disclosure.md) – khai báo sử dụng OpenCode.
- [`docs/Usecase.drawio`](docs/Usecase.drawio) – sơ đồ use case đã sửa actor và nhãn.
- [`docs/erd.drawio`](docs/erd.drawio) – ERD 6 bảng, quan hệ 1..N, nhãn thuần văn bản.
- [`docs/architecture-thuc-te.drawio`](docs/architecture-thuc-te.drawio) – kiến trúc thực tế ba lớp.
- [`docs/wireframe.drawio`](docs/wireframe.drawio) – wireframe ba màn hình.
- [`db/schema.sql`](db/schema.sql) – DDL 6 bảng 3NF.

### 6.2. Giới hạn của prototype

- Xác thực dùng tài khoản demo khai báo trong `.env`, JWT lưu ở `localStorage`; chưa có refresh token, thu hồi token hay rate limiting.
- Phân quyền chi tiết theo từng endpoint chưa hoàn thiện; phạm vi trung tâm được kiểm tra ở service cho nhân viên, quản lý xem được mọi trung tâm.
- Danh sách phiếu chưa phân trang vì dataset mẫu có 30 phiếu.
- Test tự động tập trung vào service/hợp đồng và kiểm tra tĩnh giao diện; API được kiểm chứng thêm bằng smoke test thủ công.
- `purchase_date` của một số thiết bị là dữ liệu tổng hợp do dataset gốc thiếu cột; các bản ghi `null` là cố ý để kiểm thử QT-05.
- Với các phiếu `MOI` suy ra từ lịch sử dataset, chỉ giữ log khởi tạo vì nguồn `tickets_history.csv` không có trạng thái `MOI`.

### 6.3. Trạng thái bài nộp

- [x] 6 Mongoose schema, index và DDL 3NF.
- [x] Backend ba lớp routes – services – repositories.
- [x] CRUD khách hàng, thiết bị, phiếu; chuyển trạng thái QT-06.
- [x] Migration và seed idempotent.
- [x] Hợp đồng `toTicketView()` đúng 14 khóa.
- [x] Giao diện 3 màn hình và `DataState` loading/empty/error.
- [x] Bộ test 35/35 PASS, không cần MongoDB.
- [x] Tài liệu API, nhật ký thiết kế, AI disclosure và sơ đồ.
