# Hợp đồng API – Smart CRM Mekong Mobile

**Luồng:** L2 – Tiếp nhận và phân loại yêu cầu bảo hành  
**Track:** SE  
**Phiên bản:** 0.2 (Bài tập 2 – cập nhật 28/10/2026)
**Căn cứ:** SRS rút gọn, case study QT-01…QT-15 và mã nguồn trong `src/`.

Tài liệu này mô tả API hiện tại. L2 kết thúc khi tạo phiếu `MOI`; trạng thái và lịch sử có sẵn chỉ để đọc, không có endpoint chuyển trạng thái và không hỗ trợ vai trò quản lý. Các ví dụ dưới đây chỉ minh họa hình dạng response, ID và giá trị không bảo đảm khớp mẫu hiện tại; xem nguồn và cách ánh xạ ID tại `data/sample/README.md`.

---

## 1. Quy ước chung

| Hạng mục | Quy ước |
|---|---|
| Base URL | `http://localhost:3000` |
| Định dạng | JSON, UTF-8 |
| Header gửi dữ liệu | `Content-Type: application/json` |
| Xác thực | `Authorization: Bearer <JWT>` cho mọi endpoint `/api/*` trừ `POST /api/auth/login` |
| Tên trường đầu vào | `snake_case` |
| Tên trường của hợp đồng phiếu | `camelCase` đúng 14 khóa của `toTicketView()` |
| Thời gian | ISO 8601. `hanCamKet` và `ngayTiepNhan` luôn có múi giờ `+07:00` |
| Khóa nghiệp vụ | Chuỗi; mẫu giữ một số ID cũ như `CUSxxxx`, `DEVxxxx`, `TCKxxxx`, `LOGxxxxxx`, các ID nguồn khác dùng tiền tố `SRC-`; trung tâm/nhóm sự cố dùng `"1"`…`"6"` |
| Xóa | Xóa mềm bằng `is_deleted = true`, không xóa vật lý (QT-13) |
| Bao response | Mọi response thành công của `/api/*` đều có `data`; danh sách có thêm `total` |

Body phải là object JSON; các trường văn bản không nhận object/mảng/số. Ngày phải tồn tại trong lịch (ví dụ `2026-02-30` bị từ chối). Ngày mua có thể là `YYYY-MM-DD` hoặc null; ngày giờ tiếp nhận dùng ISO 8601 kèm `Z` hoặc offset, ví dụ `2026-10-28T09:00:00+07:00`. Lỗi trả 422 với tên trường; không tự ép object thành mô tả hay tự đổi ngày sai sang tháng sau.

### 1.1. Vai trò và phạm vi dữ liệu

| Vai trò | Quyền trong prototype |
|---|---|
| `NHAN_VIEN` | Tra cứu khách hàng/thiết bị, tạo phiếu và xem phiếu cùng trung tâm; chỉ sửa/xóa mềm phiếu `MOI` cùng trung tâm |

Giới hạn hiện tại: khách hàng/thiết bị là hồ sơ dùng chung, các API CRUD hỗ trợ chưa kiểm tra trung tâm sở hữu; không tuyên bố đáp ứng toàn bộ QT-14. SĐT trong view phiếu và kết quả hiển thị hồ sơ trên UI được che; API hồ sơ vẫn trả số đầy đủ để phục vụ tiếp nhận.

Đây là giới hạn prototype BT2, không phải chính sách dùng chung đã được giảng viên phê duyệt. `requireAuth` xác thực người dùng nhưng không giới hạn hồ sơ khách/thiết bị theo trung tâm; nhân viên đã đăng nhập có thể tra cứu và dùng CRUD hỗ trợ với hồ sơ dùng chung. Chưa sử dụng API này cho vận hành dữ liệu thật đa trung tâm; mở rộng QT-14 cần chốt mô hình sở hữu và quyền hồ sơ trước.

Tài khoản demo lấy từ `.env`:

- `nhanvien / nhanvien123` – trung tâm `1`.

Chỉ hỗ trợ vai trò `NHAN_VIEN` theo phiếu phạm vi L2. Token của vai trò khác hoặc thiếu trung tâm bị từ chối với HTTP 401; bộ lọc `center_id` không cho phép vượt trung tâm được gán.

---

## 2. Danh sách endpoint

| # | Method | Endpoint | Mục đích | Mã thành công | Mã lỗi thường gặp |
|---:|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | Đăng nhập, nhận JWT | `200` | `401`, `422` |
| 2 | GET | `/api/auth/me` | Xem người dùng của token | `200` | `401` |
| 3 | GET | `/api/customers` | Danh sách/tra cứu khách hàng theo `q` hoặc `phone` | `200` | `401`, `404`, `422` |
| 4 | POST | `/api/customers` | Tạo khách hàng mới (QT-01, QT-02) | `201` | `401`, `409`, `422` |
| 5 | GET | `/api/customers/:id` | Xem hồ sơ khách hàng | `200` | `401`, `404` |
| 6 | PUT | `/api/customers/:id` | Cập nhật hồ sơ khách hàng | `200` | `401`, `404`, `409`, `422` |
| 7 | DELETE | `/api/customers/:id` | Xóa mềm khách hàng | `200` | `401`, `404` |
| 8 | GET | `/api/devices/lookup` | Tra cứu thiết bị theo serial và kết luận bảo hành (QT-03, QT-05) | `200` | `401`, `404`, `422` |
| 9 | GET | `/api/devices` | Danh sách thiết bị theo khách hàng/từ khóa | `200` | `401` |
| 10 | GET | `/api/devices/:id` | Xem thiết bị kèm kết luận bảo hành | `200` | `401`, `404` |
| 11 | POST | `/api/devices` | Tạo thiết bị mới (QT-03, QT-05) | `201` | `401`, `404`, `409`, `422` |
| 12 | PUT | `/api/devices/:id` | Cập nhật thiết bị | `200` | `401`, `404`, `409`, `422` |
| 13 | DELETE | `/api/devices/:id` | Xóa mềm thiết bị | `200` | `401`, `404` |
| 14 | GET | `/api/catalogs` | Lấy 6 trung tâm và 6 nhóm sự cố đang hoạt động | `200` | `401` |
| 15 | GET | `/api/catalogs/categories/:id/suggest` | Gợi ý ưu tiên và số giờ SLA của nhóm sự cố | `200` | `401`, `404` |
| 16 | POST | `/api/tickets/preview` | Xem trước hạn cam kết, không lưu phiếu (QT-04) | `200` | `401`, `422` |
| 17 | GET | `/api/tickets` | Danh sách phiếu 14 khóa, lọc và sắp theo hạn cam kết | `200` | `401` |
| 18 | POST | `/api/tickets` | Tạo phiếu `MOI`, sinh mã, tính SLA, ghi log (QT-04, QT-06) | `201` | `401`, `403`, `404`, `409`, `422` |
| 19 | GET | `/api/tickets/:id` | Chi tiết phiếu và lịch sử | `200` | `401`, `403`, `404` |
| 20 | PUT | `/api/tickets/:id` | Cập nhật thông tin tiếp nhận của phiếu `MOI` | `200` | `401`, `403`, `404`, `409`, `422` |
| 21 | GET | `/api/tickets/:id/history` | Chỉ lấy lịch sử trạng thái | `200` | `401`, `403`, `404` |
| 22 | DELETE | `/api/tickets/:id` | Xóa mềm phiếu `MOI` (QT-13) | `200` | `401`, `403`, `404`, `409` |

---

## 3. Xác thực

### 3.1. POST `/api/auth/login`

**Request**

```json
{
  "username": "nhanvien",
  "password": "nhanvien123"
}
```

**Response 200**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "username": "nhanvien",
      "fullName": "Nguyễn Duy Khang",
      "role": "NHAN_VIEN",
      "center_id": "1"
    }
  }
}
```

Token chứa `sub`, `role`, `center_id`, `fullName`; hết hạn theo `JWT_EXPIRES_IN` (mặc định `8h`). Sai tài khoản/mật khẩu trả `401 CHUA_DANG_NHAP`. Thiếu trường trả `422 DU_LIEU_KHONG_HOP_LE`.

### 3.2. GET `/api/auth/me`

Trả `{ "data": { "username", "role", "center_id", "fullName" } }` của token hiện tại.

---

## 4. Khách hàng

### 4.1. GET `/api/customers`

Query:

| Tên | Bắt buộc | Mô tả |
|---|---|---|
| `phone` | Không | Tra cứu chính xác theo SĐT; được chuẩn hóa `+84`, `0084`, khoảng trắng, dấu chấm (QT-02) |
| `q` | Không | Tìm gần đúng theo mã khách hàng, họ tên hoặc SĐT |

Nếu có `phone`, service trả mảng một phần tử hoặc `404` nếu không thấy. Nếu không có `phone`, trả toàn bộ khách hàng chưa xóa mềm.

**Response 200**

```json
{
  "data": [
    {
      "customer_id": "CUS0022",
      "full_name": "Võ Thị Cường",
      "phone": "0945883117",
      "email": "cuong63@yahoo.com",
      "address": "194 Trần Hưng Đạo, Quận Tân Bình",
      "segment": "THUONG",
      "created_at": "2026-02-18T17:00:00.000Z",
      "is_deleted": false
    }
  ],
  "total": 1
}
```

### 4.2. POST `/api/customers`

**Request**

```json
{
  "full_name": "Lê Văn Cường",
  "phone": "+84 93 765 4321",
  "email": "cuong@example.com",
  "address": "12 Nguyễn Huệ, Quận 1",
  "segment": "MOI"
}
```

- `full_name`: bắt buộc, tối đa 120 ký tự.
- `phone`: bắt buộc; được chuẩn hóa về `0xxxxxxxxx` và phải là duy nhất (QT-01, QT-02).
- `email`: không bắt buộc, phải đúng định dạng nếu có.
- `segment`: `VIP`, `THUONG`, `MOI`; mặc định `THUONG`.

**Response 201:** `{ "data": { ...khách hàng vừa tạo... } }`.

**Lỗi:** `409 TRUNG_DU_LIEU` khi trùng SĐT; `422 DU_LIEU_KHONG_HOP_LE` kèm `fields.phone`, `fields.full_name`…

### 4.3. GET/PUT/DELETE `/api/customers/:id`

- `GET` trả hồ sơ hoặc `404 KHONG_TIM_THAY`.
- `PUT` nhận các trường `full_name`, `phone`, `email`, `address`, `segment`; kiểm tra lại SĐT duy nhất.
- `DELETE` trả `{ "data": { "customerId": "CUS0022", "deleted": true } }`.

---

## 5. Thiết bị và bảo hành

### 5.1. GET `/api/devices/lookup`

Query:

| Tên | Bắt buộc | Mô tả |
|---|---|---|
| `serial_no` | Có | Serial/IMEI; được trim, bỏ khoảng trắng, chuyển chữ hoa (QT-03) |
| `received_at` | Không | Ngày tiếp nhận dự kiến để xét bảo hành; mặc định hiện tại |

**Response 200**

```json
{
  "data": {
    "device": {
      "device_id": "DEV0022",
      "customer_id": "CUS0022",
      "product_id": 226,
      "product_code": "AP0226",
      "product_name": "Apple Pro Max 11",
      "serial_no": "SN353496038427",
      "purchase_date": "2026-05-23T00:00:00.000Z",
      "warranty_months": 12,
      "is_deleted": false
    },
    "customer": {
      "customer_id": "CUS0022",
      "full_name": "Võ Thị Cường",
      "phone": "0945883117"
    },
    "conBaoHanh": true,
    "ketLuanBaoHanh": "Còn bảo hành",
    "ngayHetHan": "2027-05-23T00:00:00.000Z"
  }
}
```

`conBaoHanh` có ba giá trị:

- `true` – còn bảo hành.
- `false` – hết bảo hành.
- `null` – **chưa xác minh** vì thiếu `purchase_date` (QT-05); không được hiểu là hết bảo hành.

**QT-05 — tiếp nhận không phải phê duyệt:** thiếu ngày mua vẫn được gọi `POST /api/tickets` để tạo `MOI` nếu các điều kiện khác hợp lệ; phiếu lưu `is_warranty = null` và view trả `conBaoHanh = null`, “Chưa xác minh bảo hành”. Không suy diễn thành còn/hết bảo hành, không xác nhận miễn phí hoặc quản lý đã duyệt. Không có vai trò/endpoint/trạng thái phê duyệt trong bản L2; yêu cầu quản lý phê duyệt của case study/BT1/SRS còn chưa hiện thực. Cờ bảo hành phiếu lịch sử giữ theo nguồn, không phải kết quả phê duyệt của API hiện tại. Đây là đáp ứng một phần QT-05, không phải miễn yêu cầu gốc.

`ngayHetHan` là `Date` do Express chuyển thành ISO UTC. Chỉ hợp đồng phiếu mới bắt buộc chuỗi `+07:00`.

### 5.2. Các endpoint thiết bị còn lại

- `GET /api/devices?customer_id=CUS0022&q=Apple` – danh sách thiết bị chưa xóa mềm.
- `GET /api/devices/:id` – thiết bị kèm kết luận bảo hành.
- `POST /api/devices`:

```json
{
  "customer_id": "CUS0022",
  "product_id": 226,
  "product_code": "AP0226",
  "product_name": "Apple Pro Max 11",
  "serial_no": "sn 3534 9603 8427",
  "purchase_date": "2026-05-23",
  "warranty_months": 12
}
```

- `PUT /api/devices/:id` – sửa `product_name`, `serial_no`, `purchase_date`, `warranty_months`; không cho đổi khách hàng.
- `DELETE /api/devices/:id` – xóa mềm.
- Trùng serial trả `409 TRUNG_DU_LIEU`; serial sai định dạng trả `422`; không thấy khách hàng trả `404`.

---

## 6. Danh mục

### 6.1. GET `/api/catalogs`

```json
{
  "data": {
    "centers": [
      {
        "center_id": "1",
        "center_code": "TT01",
        "center_name": "TTBH Quận 10",
        "city": "TP. Hồ Chí Minh",
        "is_active": true
      }
    ],
    "categories": [
      {
        "category_id": "3",
        "category_name": "SAC",
        "default_priority": "TRUNG_BINH",
        "is_active": true
      }
    ]
  }
}
```

### 6.2. GET `/api/catalogs/categories/:id/suggest`

```json
{
  "data": {
    "category": {
      "category_id": "3",
      "category_name": "SAC",
      "default_priority": "TRUNG_BINH",
      "is_active": true
    },
    "suggestedPriority": "TRUNG_BINH",
    "slaHours": 72
  }
}
```

---

## 7. Phiếu bảo hành

### 7.1. POST `/api/tickets/preview` (QT-04)

**Request**

```json
{
  "priority": "CAO",
  "received_at": "2026-10-24T09:00:00+07:00"
}
```

**Response 200**

```json
{
  "data": {
    "priority": "CAO",
    "received_at": "2026-10-24T09:00:00+07:00",
    "due_date": "2026-10-26T09:00:00+07:00",
    "sla_hours": 24
  }
}
```

Ngày `2026-10-24` là Thứ Bảy; cộng 24 giờ làm việc rơi vào Chủ Nhật nên bỏ trọn Chủ Nhật, hạn chuyển sang Thứ Hai `2026-10-26`.

### 7.2. GET `/api/tickets`

Query tùy chọn:

| Tên | Mô tả |
|---|---|
| `status` | Một trong 6 trạng thái QT-06 |
| `category_id` | Mã nhóm sự cố `1`…`6` |
| `priority` | `CAO`, `TRUNG_BINH`, `THAP` |
| `q` | Mã phiếu, mã TCK, họ tên/SĐT/mã khách hàng |
| `center_id` | Không cho phép vượt trung tâm của nhân viên trong token (QT-14) |

**Response 200**

```json
{
  "data": [
    {
      "ticketId": "TCK0023",
      "ticketCode": "BH-000004/2024",
      "tenKhach": "Phạm Gia Vinh",
      "sdtHienThi": "0372***442",
      "tenThietBi": "Nokia Pro Max 16",
      "serialNo": "SN201103205275",
      "nhomSuCo": "PHAN_MEM",
      "mucUuTien": "THAP",
      "trangThai": "DA_DONG",
      "conBaoHanh": true,
      "ketLuanBaoHanh": "Còn bảo hành",
      "hanCamKet": "2024-09-18T10:00:00+07:00",
      "ngayTiepNhan": "2024-09-12T10:00:00+07:00",
      "trungTam": "TTBH Quận 10"
    }
  ],
  "total": 1
}
```

Danh sách sắp xếp tăng dần theo `due_date`, sau đó theo `ticket_code`. Mỗi phần tử đúng 14 khóa; không có log trong từng phần tử.

### 7.3. POST `/api/tickets`

**Request**

```json
{
  "customer_id": "CUS0022",
  "device_id": "DEV0022",
  "center_id": "1",
  "category_id": "3",
  "issue_desc": "Máy không nhận sạc, đã thử đổi cáp và củ sạc.",
  "accessories": ["SAC", "HOP"],
  "exterior_note": "Trầy nhẹ viền phải.",
  "received_at": "2026-10-21T09:00:00+07:00"
}
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `customer_id` | Có | Phải tồn tại và chưa xóa mềm |
| `device_id` | Có | Phải thuộc đúng khách hàng (QT-03) |
| `center_id` | Có | Trung tâm đang hoạt động; nhân viên chỉ được chọn trung tâm của mình (QT-14) |
| `category_id` | Có | Nhóm sự cố đang hoạt động |
| `issue_desc` | Có | 10–2000 ký tự |
| `accessories` | Không | Mảng con của `SAC`, `TAI_NGHE`, `HOP`, `KHAC`; tự loại trùng |
| `exterior_note` | Không | Tối đa 500 ký tự |
| `priority` | Không | Mặc định theo `default_priority` của nhóm; nếu khác gợi ý phải có `priority_reason` |
| `priority_reason` | Không | Tối đa 300 ký tự; bắt buộc khi đổi ưu tiên khác gợi ý (FR5) |
| `received_at` | Không | Mặc định hiện tại; dùng để tính SLA và mã phiếu theo năm Việt Nam |

**Response 201**

```json
{
  "data": {
    "ticket": {
      "ticketId": "TCK0031",
      "ticketCode": "BH-000097/2026",
      "tenKhach": "Võ Thị Cường",
      "sdtHienThi": "0945***117",
      "tenThietBi": "Apple Pro Max 11",
      "serialNo": "SN353496038427",
      "nhomSuCo": "SAC",
      "mucUuTien": "TRUNG_BINH",
      "trangThai": "MOI",
      "conBaoHanh": true,
      "ketLuanBaoHanh": "Còn bảo hành",
      "hanCamKet": "2026-10-24T09:00:00+07:00",
      "ngayTiepNhan": "2026-10-21T09:00:00+07:00",
      "trungTam": "TTBH Quận 10"
    },
    "moTaLoi": "Máy không nhận sạc, đã thử đổi cáp và củ sạc.",
    "phuKien": ["SAC", "HOP"],
    "ngoaiQuan": "Trầy nhẹ viền phải.",
    "lyDoUuTien": "",
    "lichSuTrangThai": [
      {
        "logId": "LOG000100",
        "fromStatus": null,
        "toStatus": "MOI",
        "changedAt": "2026-10-21T09:00:00+07:00",
        "changedBy": "nhanvien",
        "note": "Tạo phiếu tiếp nhận mới."
      }
    ],
    "trangThaiKeTiep": []
  }
}
```

Mã phiếu trong ví dụ chỉ có tính minh họa, không dự đoán mã kế tiếp của mẫu hiện tại.

**Lỗi nghiệp vụ chính**

| Tình huống | HTTP | Mã lỗi |
|---|---:|---|
| Thiếu/sai trường, mô tả quá ngắn, đổi ưu tiên không có lý do | `422` | `DU_LIEU_KHONG_HOP_LE` |
| Không thấy khách hàng, thiết bị, trung tâm hoặc nhóm sự cố | `404` | `KHONG_TIM_THAY` |
| Thiết bị đang có phiếu chưa đóng | `409` | `PHIEU_DANG_MO` |
| Nhân viên chọn trung tâm khác trung tâm của mình | `403` | `KHONG_DU_QUYEN` |

### 7.4. GET `/api/tickets/:id`

Trả envelope chi tiết. `data.ticket` vẫn đúng 14 khóa; các trường mô tả và lịch sử nằm ngoài `ticket` để không phá hợp đồng:

```json
{
  "data": {
    "ticket": {
      "ticketId": "TCK0031",
      "ticketCode": "BH-000097/2026",
      "tenKhach": "Võ Thị Cường",
      "sdtHienThi": "0945***117",
      "tenThietBi": "Apple Pro Max 11",
      "serialNo": "SN353496038427",
      "nhomSuCo": "SAC",
      "mucUuTien": "TRUNG_BINH",
      "trangThai": "MOI",
      "conBaoHanh": true,
      "ketLuanBaoHanh": "Còn bảo hành",
      "hanCamKet": "2026-10-24T09:00:00+07:00",
      "ngayTiepNhan": "2026-10-21T09:00:00+07:00",
      "trungTam": "TTBH Quận 10"
    },
    "moTaLoi": "Máy không nhận sạc, đã thử đổi cáp và củ sạc.",
    "phuKien": ["SAC", "HOP"],
    "ngoaiQuan": "Trầy nhẹ viền phải.",
    "lyDoUuTien": "",
    "lichSuTrangThai": [
      {
        "logId": "LOG000100",
        "fromStatus": null,
        "toStatus": "MOI",
        "changedAt": "2026-10-21T09:00:00+07:00",
        "changedBy": "nhanvien",
        "note": "Tạo phiếu tiếp nhận mới."
      }
    ],
    "trangThaiKeTiep": []
  }
}
```

`trangThaiKeTiep` hiện luôn là mảng rỗng: L2 không cung cấp thao tác chuyển trạng thái.

### 7.5. PUT `/api/tickets/:id`

Chỉ phiếu `MOI` cùng trung tâm mới được cập nhật. Phiếu sau tiếp nhận trả `409 PHIEU_CHI_DOC`; điều kiện `MOI` được kiểm tra lại tại thời điểm ghi CSDL. Không cho sửa trạng thái qua endpoint này.

Chỉ nhận các trường được phép:

```json
{
  "issue_desc": "Máy không nhận sạc, đã thử đổi cáp, củ sạc và vệ sinh chân sạc.",
  "accessories": ["SAC"],
  "exterior_note": "Trầy nhẹ viền phải, không móp.",
  "priority": "CAO",
  "priority_reason": "Khách cần máy gấp để đi công tác."
}
```

Khi đổi `priority`, hạn cam kết được tính lại từ `received_at` theo QT-04. Nếu `priority` khác gợi ý của nhóm mà thiếu `priority_reason`, trả `422`.

### 7.6. GET `/api/tickets/:id/history`

```json
{
  "data": [
    {
      "logId": "LOG000100",
      "fromStatus": null,
      "toStatus": "MOI",
      "changedAt": "2026-10-21T09:00:00+07:00",
      "changedBy": "nhanvien",
      "note": "Tạo phiếu tiếp nhận mới."
    }
  ],
  "total": 1
}
```

### 7.7. DELETE `/api/tickets/:id`

Chỉ xóa mềm phiếu `MOI` cùng trung tâm, giữ log khởi tạo. Các trạng thái khác trả `409 PHIEU_CHI_DOC`, không thể xóa để tiếp nhận lại thiết bị đang xử lý. Trả:

```json
{
  "data": {
    "ticketId": "TCK0031",
    "deleted": true
  }
}
```

---

## 8. Hợp đồng `toTicketView()` – đúng 14 khóa

Đây là hợp đồng tại ranh giới lớp nghiệp vụ, được kiểm thử tự động. Không thêm khóa lịch sử, mô tả lỗi hay phụ kiện vào object này.

| # | Khóa | Kiểu | Ý nghĩa |
|---:|---|---|---|
| 1 | `ticketId` | string | Mã nghiệp vụ `TCKxxxx` |
| 2 | `ticketCode` | string | Mã phiếu `BH-xxxxxx/năm` |
| 3 | `tenKhach` | string | Họ tên khách hàng |
| 4 | `sdtHienThi` | string | SĐT đã che 3 chữ số giữa, dạng `0901***567` (QT-15) |
| 5 | `tenThietBi` | string | Tên sản phẩm/thiết bị |
| 6 | `serialNo` | string | Serial/IMEI |
| 7 | `nhomSuCo` | string | Một trong `MAN_HINH`, `PIN`, `SAC`, `PHAN_MEM`, `NUOC_VAO`, `KHAC` |
| 8 | `mucUuTien` | string | `CAO`, `TRUNG_BINH`, `THAP` |
| 9 | `trangThai` | string | Một trong 6 trạng thái QT-06 |
| 10 | `conBaoHanh` | boolean \| null | `null` = **chưa xác minh** do thiếu ngày mua (QT-05) |
| 11 | `ketLuanBaoHanh` | string | `Còn bảo hành`, `Hết bảo hành` hoặc `Chưa xác minh bảo hành` |
| 12 | `hanCamKet` | string \| null | ISO 8601 kèm `+07:00`, hạn trả máy (QT-04) |
| 13 | `ngayTiepNhan` | string \| null | ISO 8601 kèm `+07:00` |
| 14 | `trungTam` | string | Tên trung tâm bảo hành |

**Quy tắc bắt buộc**

- `Object.keys(view).length === 14` và đúng thứ tự 14 khóa trên.
- `conBaoHanh = null` không được chuyển thành `false`.
- `sdtHienThi` không bao giờ là số đầy đủ.
- `hanCamKet` và `ngayTiepNhan` dùng `+07:00`, không dùng `Z`.
- Danh sách rỗng trả `[]`, không ném lỗi; thiếu phiếu ném `KHONG_TIM_THAY` (404).

---

## 9. Trạng thái lịch sử

Phiếu mới được tạo ở `MOI` với log khởi tạo `null → MOI`. Các trạng thái và log nguồn khác được hiển thị để tra cứu lịch sử, không phải các bước có thể thực hiện trong L2. Phiếu `DA_DONG` không được coi là phiếu mở theo QT-03.

---

## 10. Định dạng lỗi thống nhất

Mọi lỗi trả đúng ba trường, không lồng thêm `error.code`:

```json
{
  "error": "DU_LIEU_KHONG_HOP_LE",
  "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
  "fields": {
    "issue_desc": "Mô tả lỗi phải có ít nhất 10 ký tự."
  }
}
```

| HTTP | Mã `error` | Khi nào |
|---:|---|---|
| `400` | `DU_LIEU_KHONG_HOP_LE` | Body JSON hỏng, không parse được |
| `401` | `CHUA_DANG_NHAP` | Thiếu/sai/hết hạn Bearer token; sai tài khoản đăng nhập |
| `403` | `KHONG_DU_QUYEN` | Nhân viên thao tác ngoài trung tâm của mình (QT-14) |
| `404` | `KHONG_TIM_THAY` | Không thấy khách hàng, thiết bị, phiếu, trung tâm, nhóm sự cố hoặc API |
| `409` | `PHIEU_DANG_MO` | Thiết bị đang có phiếu chưa đóng (QT-03) |
| `409` | `PHIEU_CHI_DOC` | Phiếu không còn `MOI`, hoặc thay đổi giữa đọc và ghi; không được sửa/xóa |
| `409` | `TRUNG_DU_LIEU` | Trùng SĐT, serial hoặc mã phiếu |
| `422` | `DU_LIEU_KHONG_HOP_LE` | Validator hoặc nghiệp vụ từ chối dữ liệu; `fields` chỉ rõ trường |
| `503` | `DICH_VU_KHONG_SAN_SANG` | CSDL/dịch vụ dữ liệu tạm không sẵn sàng |
| `500` | `LOI_HE_THONG` | Lỗi không lường trước; trả `fields.maTraCuu`, không lộ stack/CSDL |

**Ví dụ 409 phiếu đang mở**

```json
{
  "error": "PHIEU_DANG_MO",
  "message": "Thiết bị đang có phiếu chưa đóng BH-000009/2026 (QT-03).",
  "fields": {
    "device_id": "Hãy xử lý hoặc đóng phiếu đang mở trước khi tiếp nhận phiếu mới."
  }
}
```

**Ví dụ 500**

```json
{
  "error": "LOI_HE_THONG",
  "message": "Hệ thống đang gặp sự cố. Vui lòng thử lại sau. Mã tra cứu: 7F3A-21.",
  "fields": {
    "maTraCuu": "7F3A-21"
  }
}
```

---

## 11. Truy vết nghiệp vụ

| Quy tắc | Endpoint / thành phần |
|---|---|
| QT-01, QT-02 – SĐT duy nhất, chuẩn hóa | `GET/POST /api/customers`, `normalizePhone()` |
| QT-03 – serial duy nhất, một phiếu mở/thiết bị | `GET/POST /api/devices`, `POST /api/tickets`, partial unique index |
| QT-04 – SLA 24/72/120 giờ làm việc, bỏ Chủ Nhật | `POST /api/tickets/preview`, `POST/PUT /api/tickets`, `slaCalculator.service.js` |
| QT-05 – bảo hành theo ngày, `null` khi chưa xác minh | `GET /api/devices/lookup`, `checkWarranty()` |
| QT-06 – trạng thái | Tạo `MOI` và log khởi tạo; `GET /api/tickets/:id/history` đọc lịch sử, không chuyển trạng thái |
| QT-13 – xóa mềm | `DELETE` của customer/device/ticket |
| QT-14 – phạm vi trung tâm | `requireAuth`, `assertCenterAccess()`, lọc `center_id` |
| QT-15 – che SĐT | `maskPhone()`, `toTicketView()` |
| FR1–FR6, UC1–UC6, US1–US8 | Toàn bộ luồng khách hàng → thiết bị → phiếu |

---

## 12. Smoke test nhanh

```powershell
# 1. Đăng nhập và lấy token
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"username":"nhanvien","password":"nhanvien123"}'
$headers = @{ Authorization = "Bearer $($login.data.token)" }

# 2. Kiểm tra sức khỏe
Invoke-RestMethod http://localhost:3000/health

# 3. Lấy danh mục
Invoke-RestMethod -Headers $headers http://localhost:3000/api/catalogs

# 4. Xem trước hạn cam kết
Invoke-RestMethod -Method Post -Headers $headers -ContentType 'application/json' `
  -Uri http://localhost:3000/api/tickets/preview `
  -Body '{"priority":"CAO","received_at":"2026-10-24T09:00:00+07:00"}'

# 5. Danh sách phiếu
Invoke-RestMethod -Headers $headers 'http://localhost:3000/api/tickets?status=MOI'
```

Giao diện web chạy tại `http://localhost:3000`; mọi thao tác UI đều đi qua `src/public/apiClient.js`.
