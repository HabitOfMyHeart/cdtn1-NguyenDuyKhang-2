# SRS RÚT GỌN – BUỔI 4

**Họ tên:** Nguyễn Duy Khang  
**MSSV:** 2374802010212  
**Track:** SE  
**Luồng:** L2 – Tiếp nhận và phân loại yêu cầu bảo hành
---

# 1. Giới thiệu và phạm vi

## 1.1. Bối cảnh

Mekong Mobile cần số hóa quy trình tiếp nhận yêu cầu bảo hành. Luồng L2 tập trung vào việc tiếp nhận, tra cứu khách hàng, ghi nhận thiết bị và lỗi, phân loại sự cố, xác định mức ưu tiên, sinh hạn cam kết và tạo phiếu bảo hành mới.

## 1.2. Phạm vi đã được phê duyệt

Nhân viên tiếp nhận tra cứu hoặc tạo mới thông tin khách hàng bằng số điện thoại, ghi nhận thông tin thiết bị và mô tả lỗi, sau đó hệ thống tự động kiểm tra hạn bảo hành, phân loại nhóm sự cố, xác định mức ưu tiên và sinh hạn cam kết trả máy, kết thúc bằng việc tạo phiếu bảo hành mới ở trạng thái chờ xử lý lưu vào hệ thống.

## 1.3. Trong phạm vi

- Tra cứu khách hàng bằng số điện thoại.
- Tạo hồ sơ khách hàng mới nếu chưa có.
- Nhập Serial/IMEI để xác định thiết bị.
- Kiểm tra thời hạn bảo hành.
- Ghi nhận mô tả lỗi khách kể.
- Ghi nhận phụ kiện đi kèm.
- Ghi nhận tình trạng ngoại quan.
- Chọn nhóm sự cố chuẩn hóa.
- Đề xuất mức ưu tiên mặc định theo nhóm sự cố.
- Tính hạn cam kết trả máy theo mức ưu tiên và ngày làm việc.
- Tạo phiếu bảo hành có mã hiển thị duy nhất.
- Lưu phiếu mới ở trạng thái Chờ xử lý.

## 1.4. Chủ ý không làm trong phạm vi này

Phạm vi kết thúc sau khi tạo phiếu bảo hành mới ở trạng thái Chờ xử lý. Vì vậy tài liệu này không đặc tả các bước xử lý sau tiếp nhận như phân công kỹ thuật viên, sửa chữa, quản lý linh kiện, trả máy hoặc đóng phiếu.

## 1.5. Thuật ngữ sử dụng

| Thuật ngữ | Ý nghĩa |
|---|---|
| Khách hàng | Cá nhân đã mua sản phẩm hoặc sử dụng dịch vụ của Mekong Mobile |
| Thiết bị | Máy cụ thể của khách hàng, xác định bằng Serial hoặc IMEI |
| Phiếu bảo hành | Yêu cầu bảo hành hoặc sửa chữa được ghi nhận, có mã duy nhất |
| Nhóm sự cố | Màn hình, pin, sạc, phần mềm, nước vào, khác |
| Mức ưu tiên | Cao, Trung bình, Thấp |
| Hạn cam kết | Thời điểm chậm nhất phải hoàn tất phiếu, tính từ lúc tiếp nhận theo mức ưu tiên |
| Chờ xử lý | Trạng thái kết thúc phạm vi đã được phê duyệt sau khi tạo phiếu mới |

---

# 2. Các bên liên quan và vai trò người dùng

| Vai trò | Trách nhiệm trong phạm vi |
|---|---|
| Nhân viên tiếp nhận | Tra cứu hoặc tạo khách hàng; nhập Serial/IMEI; ghi nhận thông tin tiếp nhận; chọn nhóm sự cố; xác nhận tạo phiếu bảo hành |

**Actor trực tiếp của luồng:** Nhân viên tiếp nhận.

---

# 3. Yêu cầu chức năng

## 3.1. Danh sách yêu cầu chức năng

| Mã | Yêu cầu chức năng |
|---|---|
| FR1 | Hệ thống cho phép nhân viên tiếp nhận tra cứu khách hàng bằng số điện thoại. |
| FR2 | Hệ thống cho phép tạo hồ sơ khách hàng mới khi số điện thoại chưa tồn tại. |
| FR3 | Hệ thống cho phép nhập Serial/IMEI để tra cứu thông tin thiết bị. |
| FR4 | Hệ thống tự động kiểm tra thời hạn bảo hành và xác định điều kiện bảo hành. |
| FR5 | Hệ thống cho phép ghi nhận mô tả lỗi khách kể, phụ kiện đi kèm và tình trạng ngoại quan. |
| FR6 | Hệ thống cho phép chọn nhóm sự cố chuẩn hóa và đề xuất mức ưu tiên mặc định tương ứng. |
| FR7 | Hệ thống tự động tính hạn cam kết trả máy dựa trên mức ưu tiên và ngày làm việc. |
| FR8 | Hệ thống tạo phiếu bảo hành mới có mã hiển thị duy nhất. |
| FR9 | Hệ thống lưu phiếu bảo hành mới ở trạng thái Chờ xử lý. |

## 3.2. User Story và MoSCoW

### US1 – MUST

Là **nhân viên tiếp nhận**, tôi muốn **tra cứu khách hàng qua số điện thoại (hoặc tạo hồ sơ mới nếu chưa có)** để **không phải hỏi lại thông tin của khách đã từng mua hàng tại hệ thống**.

### US2 – MUST

Là **nhân viên tiếp nhận**, tôi muốn **nhập số Serial/IMEI để tra cứu thông tin thiết bị và tự động kiểm tra thời hạn bảo hành** để **xác định đúng điều kiện bảo hành miễn phí hay tính phí trước khi nhận máy**.

### US3 – MUST

Là **nhân viên tiếp nhận**, tôi muốn **ghi nhận mô tả lỗi khách kể, phụ kiện đi kèm và tình trạng ngoại quan** để **tạo phiếu bảo hành mới có mã hiển thị duy nhất**.

### US4 – SHOULD

Là **nhân viên tiếp nhận**, tôi muốn **chọn nhóm sự cố chuẩn hóa (màn hình, pin, sạc, phần mềm, nước vào, khác)** để **hệ thống tự động đề xuất mức ưu tiên mặc định tương ứng**.

### US5 – SHOULD

Là **nhân viên tiếp nhận**, tôi muốn **hệ thống tự động tính toán hạn cam kết trả máy (`due_date`) dựa trên mức ưu tiên và ngày làm việc thực tế** để **hẹn thời gian chính xác cho khách hàng**.

### US6 – SHOULD

Là **nhân viên tiếp nhận**, tôi muốn **tạo hồ sơ khách hàng mới khi tra cứu số điện thoại nhưng chưa có khách hàng** để **tiếp tục quá trình tiếp nhận bảo hành**.

> US6 chi tiết hóa nhánh “tạo hồ sơ mới nếu chưa có” đã nằm trong US1.

### US7 – SHOULD

Là **nhân viên tiếp nhận**, tôi muốn **hệ thống đánh dấu trường hợp chưa xác minh bảo hành khi không có ngày mua** để **nhận biết trường hợp cần xử lý theo quy tắc bảo hành**.

> US7 chi tiết hóa ngoại lệ của việc kiểm tra bảo hành trong US2 theo QT-05.

### US8 – SHOULD

Là **nhân viên tiếp nhận**, tôi muốn **phiếu bảo hành mới được lưu ở trạng thái Chờ xử lý** để **hoàn tất bước tiếp nhận và lưu yêu cầu vào hệ thống**.

> US8 lấy từ điểm kết thúc trong câu phạm vi đã được phê duyệt.

### Tổng hợp MoSCoW

| Mức | Số lượng |
|---|---:|
| MUST | 3 |
| SHOULD | 5 |
| COULD | 0 |
| WON'T | 0 |
| **Tổng** | **8** |

## 3.3. Tiêu chí chấp nhận Given – When – Then cho các story MUST

### US1

**AC1 – Luồng chính**  
**GIVEN** số điện thoại đã tồn tại trong hệ thống  
**WHEN** nhân viên tiếp nhận tra cứu bằng số điện thoại  
**THEN** hệ thống hiển thị hồ sơ khách hàng đã có.

**AC2 – Ngoại lệ**  
**GIVEN** số điện thoại chưa tồn tại trong hệ thống  
**WHEN** nhân viên tiếp nhận thực hiện tra cứu  
**THEN** hệ thống chuyển sang nhánh tạo hồ sơ khách hàng mới với số điện thoại đã nhập.

### US2

**AC3 – Luồng chính**  
**GIVEN** thiết bị có thông tin ngày mua và số tháng bảo hành  
**WHEN** nhân viên nhập Serial/IMEI để kiểm tra  
**THEN** hệ thống xác định tình trạng bảo hành theo QT-05.

**AC4 – Ngoại lệ**  
**GIVEN** thiết bị không có ngày mua  
**WHEN** hệ thống kiểm tra bảo hành  
**THEN** phiếu được đánh dấu **“chưa xác minh bảo hành”** theo QT-05.

### US3

**AC5 – Luồng chính**  
**GIVEN** thông tin tiếp nhận bắt buộc đã được ghi nhận  
**WHEN** nhân viên xác nhận lưu phiếu  
**THEN** hệ thống tạo phiếu bảo hành mới có mã hiển thị duy nhất.

**AC6 – Ngoại lệ**  
**GIVEN** nhân viên chưa nhập mô tả lỗi  
**WHEN** nhân viên xác nhận lưu phiếu  
**THEN** hệ thống từ chối lưu và thông báo rõ trường còn thiếu.

**Tổng:** 8 User Story | 3 MUST | 6 tiêu chí GWT | 3 ngoại lệ.

---

# 4. Yêu cầu phi chức năng

| Mã | Loại | Yêu cầu có ngưỡng đo được | Cách kiểm chứng |
|---|---|---|---|
| NFR1 | Khả dụng | Nhân viên tiếp nhận mới phải tạo được một phiếu bảo hành đúng trong **dưới 3 phút**, không cần hỏi đồng nghiệp. | Đo thời gian hoàn thành một lượt tạo phiếu hợp lệ. |
| NFR2 | Khả năng đáp ứng quy mô prototype | Prototype phải làm việc được với tối thiểu **100 ticket và 200 ticket_status_log** theo phạm vi dữ liệu đã chọn. | Nạp đủ số lượng dữ liệu trên và thực hiện luồng tiếp nhận. |
| NFR3 | Khả năng đáp ứng dữ liệu tham chiếu | Prototype phải làm việc được với tối thiểu **50 customer**, đồng thời sử dụng đủ **6 service_centers** và **6 issue_categories** theo phạm vi dữ liệu đã chọn. | Nạp đủ số lượng dữ liệu trên và đối chiếu danh mục được sử dụng trong luồng tiếp nhận. |

---

# 5. Ràng buộc và quy tắc nghiệp vụ

## 5.1. Quy tắc nghiệp vụ áp dụng cho L2

| Mã | Quy tắc |
|---|---|
| QT-01 | Số điện thoại khách hàng là duy nhất. Nếu số đã tồn tại, hệ thống hiển thị hồ sơ có sẵn thay vì tạo hồ sơ mới. |
| QT-02 | Số điện thoại được chuẩn hóa về 10 chữ số bắt đầu bằng 0. Dạng `+84`, `84`, có dấu cách hoặc dấu chấm phải được quy về dạng chuẩn. |
| QT-03 | Thiết bị được xác định duy nhất bằng Serial hoặc IMEI. Một thiết bị chỉ thuộc về một khách hàng tại một thời điểm. |
| QT-04 | Hạn cam kết được sinh từ thời điểm tiếp nhận: CAO = 24 giờ, TRUNG_BINH = 72 giờ, THAP = 120 giờ; chỉ tính ngày làm việc từ thứ Hai đến thứ Bảy. |
| QT-05 | Thiết bị còn bảo hành nếu `(ngày tiếp nhận − ngày mua) ≤ số tháng bảo hành`. Nếu không có ngày mua, phiếu được đánh dấu “chưa xác minh bảo hành” và cần quản lý phê duyệt. |

## 5.2. Danh mục nhóm sự cố

Các nhóm sự cố trong phạm vi:

- MAN_HINH
- PIN
- SAC
- PHAN_MEM
- NUOC_VAO
- KHAC

Mức ưu tiên mặc định được lấy từ danh mục nhóm sự cố.

## 5.3. Ràng buộc công nghệ

Theo Phiếu phạm vi:

| Thành phần | Công nghệ |
|---|---|
| Ngôn ngữ | JavaScript |
| Backend | Express.js |
| Frontend | React |
| CSDL | MongoDB |

---

# 6. Bảng truy vết yêu cầu

| FR | User Story | Use Case | MoSCoW |
|---|---|---|---|
| FR1 | US1 | UC1 – Tra cứu khách hàng | MUST |
| FR2 | US6 | UC2 – Tạo hồ sơ khách hàng mới | SHOULD |
| FR3 | US2 | UC3 – Tra cứu thiết bị và kiểm tra bảo hành | MUST |
| FR4 | US2, US7 | UC3 – Tra cứu thiết bị và kiểm tra bảo hành | MUST / SHOULD |
| FR5 | US3 | UC4 – Ghi nhận thông tin tiếp nhận | MUST |
| FR6 | US4 | UC5 – Phân loại nhóm sự cố và xác định mức ưu tiên | SHOULD |
| FR7 | US5 | UC6 – Tính hạn cam kết và tạo phiếu bảo hành | SHOULD |
| FR8 | US3 | UC6 – Tính hạn cam kết và tạo phiếu bảo hành | MUST |
| FR9 | US8 | UC6 – Tính hạn cam kết và tạo phiếu bảo hành | SHOULD |

**Kiểm tra truy vết:** 9 FR có mã | 0 ô trống.

---

# PHỤ LỤC A – USE CASE

## A1. Actor

| Actor | Vai trò |
|---|---|
| **Nhân viên tiếp nhận** | Thực hiện quy trình tiếp nhận và phân loại yêu cầu bảo hành |

**Tổng actor: 1**

---

## A2. Danh sách Use Case

| Mã | Use Case | Actor | User Story liên quan |
|---|---|---|---|
| **UC1** | Tra cứu khách hàng | Nhân viên tiếp nhận | US1 |
| **UC2** | Tạo hồ sơ khách hàng mới | Nhân viên tiếp nhận | US1, US6 |
| **UC3** | Tra cứu thiết bị và kiểm tra bảo hành | Nhân viên tiếp nhận | US2, US7 |
| **UC4** | Ghi nhận thông tin tiếp nhận | Nhân viên tiếp nhận | US3 |
| **UC5** | Phân loại nhóm sự cố và xác định mức ưu tiên | Nhân viên tiếp nhận | US4 |
| **UC6** | Tính hạn cam kết và tạo phiếu bảo hành | Nhân viên tiếp nhận | US3, US5, US8 |

**Tổng Use Case: 6**

---

## A3. Quan hệ Use Case

| Use Case nguồn | Quan hệ | Use Case đích | Ý nghĩa |
|---|---|---|---|
| UC2 – Tạo hồ sơ khách hàng mới | `<<extend>>` | UC1 – Tra cứu khách hàng | Chỉ phát sinh khi không tìm thấy khách hàng |
| UC6 – Tính hạn cam kết và tạo phiếu bảo hành | `<<include>>` | UC1 – Tra cứu khách hàng | Tra cứu khách hàng là bước bắt buộc trước khi tạo phiếu |
| UC6 – Tính hạn cam kết và tạo phiếu bảo hành | `<<include>>` | UC3 – Tra cứu thiết bị và kiểm tra bảo hành | Cần xác định thiết bị và tình trạng bảo hành |
| UC6 – Tính hạn cam kết và tạo phiếu bảo hành | `<<include>>` | UC4 – Ghi nhận thông tin tiếp nhận | Cần ghi nhận lỗi, phụ kiện và ngoại quan |
| UC6 – Tính hạn cam kết và tạo phiếu bảo hành | `<<include>>` | UC5 – Phân loại nhóm sự cố và xác định mức ưu tiên | Cần mức ưu tiên để tính hạn cam kết |


---

## A4. Đặc tả chi tiết UC6 – Tính hạn cam kết và tạo phiếu bảo hành

| Thuộc tính | Nội dung |
|---|---|
| **Mã Use Case** | UC6 |
| **Tên Use Case** | Tính hạn cam kết và tạo phiếu bảo hành |
| **Actor chính** | Nhân viên tiếp nhận |
| **Mục tiêu** | Hoàn tất quá trình tiếp nhận bằng việc tính hạn cam kết và tạo phiếu bảo hành mới |
| **Điều kiện trước** | Nhân viên đang thực hiện quy trình tiếp nhận yêu cầu bảo hành |
| **Điều kiện sau** | Phiếu bảo hành mới có mã hiển thị duy nhất và được lưu ở trạng thái Chờ xử lý |

### Luồng chính

| Bước | Nội dung |
|---:|---|
| 1 | Nhân viên nhập số điện thoại khách hàng. |
| 2 | Hệ thống tra cứu khách hàng. |
| 3 | Nhân viên nhập Serial/IMEI của thiết bị. |
| 4 | Hệ thống tra cứu thiết bị và kiểm tra thời hạn bảo hành. |
| 5 | Nhân viên ghi nhận mô tả lỗi, phụ kiện đi kèm và tình trạng ngoại quan. |
| 6 | Nhân viên chọn nhóm sự cố chuẩn hóa. |
| 7 | Hệ thống đề xuất mức ưu tiên mặc định tương ứng. |
| 8 | Hệ thống tính hạn cam kết trả máy theo QT-04. |
| 9 | Nhân viên kiểm tra lại thông tin tiếp nhận. |
| 10 | Nhân viên xác nhận tạo phiếu. |
| 11 | Hệ thống sinh mã hiển thị duy nhất. |
| 12 | Hệ thống lưu phiếu bảo hành mới ở trạng thái Chờ xử lý. |

### Luồng ngoại lệ

| Mã | Bước | Trường hợp | Xử lý |
|---|---:|---|---|
| **2a** | 2 | Không tìm thấy khách hàng | Nhân viên thực hiện UC2 – Tạo hồ sơ khách hàng mới, sau đó tiếp tục luồng chính. |
| **4a** | 4 | Không có ngày mua | Hệ thống đánh dấu **“chưa xác minh bảo hành”** theo QT-05. |
| **10a** | 10 | Thiếu mô tả lỗi | Hệ thống từ chối tạo phiếu và yêu cầu bổ sung trường còn thiếu. |

**Tổng hợp Use Case: 1 actor | 6 use case | UC đặc tả chi tiết: UC6 | 3 luồng ngoại lệ**

---

# PHỤ LỤC B – API CONTRACT [TRACK SE]
## B1. Danh sách endpoint

| Method | Endpoint | Mục đích | User Story |
|---|---|---|---|
| GET | `/api/customers?phone={phone}` | Tra cứu khách hàng bằng số điện thoại | US1 |
| POST | `/api/customers` | Tạo khách hàng mới khi chưa tồn tại | US6 |
| GET | `/api/customers/{id}/devices` | Lấy thông tin thiết bị của khách hàng | US2, US7 |
| POST | `/api/tickets` | Tạo phiếu bảo hành mới | US3, US4, US5, US8 |

## B2. Quy ước chung

- Định dạng trao đổi: JSON, UTF-8.
- Header: `Content-Type: application/json`.
- Tên trường: `snake_case`.
- Thời gian: ISO 8601 kèm múi giờ.
- Lỗi trả về cùng cấu trúc:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "fields": {}
  }
}
```

## B3. GET `/api/customers?phone={phone}`

### Request mẫu


```text
GET /api/customers?phone=0945883117
```

### Response 200 OK

```json
{
  "customer_id": 8568,
  "full_name": "Võ Thị Cường",
  "phone": "0945883117",
  "email": "cuong63@yahoo.com",
  "address": "194 Trần Hưng Đạo, Quận Tân Bình",
  "created_at": "2026-02-19"
}
```

### Response lỗi

- `400 Bad Request`: số điện thoại không hợp lệ sau chuẩn hóa.
- `404 Not Found`: không tìm thấy khách hàng.

### Validation

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| phone | Có | Chuẩn hóa theo QT-02; kết quả phải có 10 chữ số bắt đầu bằng 0 |

---

## B4. POST `/api/customers`

### Request mẫu

Mẫu dưới đây dùng dữ liệu từ bộ dataset. Khi kiểm thử nhánh `201 Created`, sử dụng trên dữ liệu thử chưa có số điện thoại này.

```json
{
  "full_name": "Võ Thị Cường",
  "phone": "0945883117",
  "email": "cuong63@yahoo.com",
  "address": "194 Trần Hưng Đạo, Quận Tân Bình"
}
```

### Response 201 Created

```json
{
  "customer_id": 8568,
  "full_name": "Võ Thị Cường",
  "phone": "0945883117",
  "email": "cuong63@yahoo.com",
  "address": "194 Trần Hưng Đạo, Quận Tân Bình",
  "created_at": "2026-02-19"
}
```

### Response lỗi

- `400 Bad Request`: dữ liệu không hợp lệ.
- `409 Conflict`: số điện thoại đã tồn tại theo QT-01.

### Validation

| Trường | Bắt buộc | Quy tắc nguồn |
|---|---|---|
| full_name | Có | Tối đa 120 ký tự theo mô hình tham chiếu |
| phone | Có | QT-01, QT-02; tối đa 20 ký tự trước chuẩn hóa theo mô hình tham chiếu |
| email | Không | Tối đa 120 ký tự theo mô hình tham chiếu |
| address | Không | Tối đa 255 ký tự theo mô hình tham chiếu |

---

## B5. GET `/api/customers/{id}/devices`

### Request mẫu

```text
GET /api/customers/8568/devices
```


### Response 200 OK

Dữ liệu dưới đây lấy từ `tickets_history.csv` và `products.csv`:

```json
{
  "customer_id": 8568,
  "devices": [
    {
      "serial_no": "SN353496038427",
      "product_id": 226,
      "product_name": "Apple Pro Max 11",
      "warranty_months": 12,
      "purchase_date": null
    }
  ]
}
```

### Response lỗi

- `400 Bad Request`: `id` không hợp lệ.
- `404 Not Found`: không tìm thấy thông tin thiết bị của khách hàng.

### Lưu ý QT-05

Vì dataset hiện tại không có `purchase_date`, dữ liệu mẫu trên chưa đủ để tự tính lại tình trạng bảo hành từ ngày mua. Theo QT-05, trường hợp không có ngày mua phải được đánh dấu **“chưa xác minh bảo hành”**.

---

## B6. POST `/api/tickets`

Endpoint này được điều chỉnh để bám đúng Phiếu phạm vi: **nhân viên chọn `category_id`, hệ thống xác định `priority` mặc định tương ứng**.

### Request mẫu

Các giá trị `customer_id`, `device_id`, `center_id`, `issue_desc` và `accessories` dưới đây lấy từ ví dụ L2 trong tài liệu tự học Track SE.  
`category_id = 3` là giá trị xuất hiện trong response mẫu chính thức và được chuyển thành đầu vào để phù hợp US4 đã được phê duyệt.  
`external_condition` được bổ sung vì US3 yêu cầu ghi nhận tình trạng ngoại quan; nguồn không cung cấp một giá trị mẫu đã điền nên không tự đặt nội dung.

```json
{
  "customer_id": 1024,
  "device_id": 3311,
  "center_id": 2,
  "issue_desc": "May sac khong vao, cam sac bao loi phu kien",
  "category_id": 3,
  "accessories": ["SAC", "HOP"],
  "external_condition": null
}
```

### Xử lý

- `category_id = 3` tương ứng nhóm `SAC`.
- Mức ưu tiên mặc định của `SAC` là `TRUNG_BINH`.
- Hạn cam kết được tính theo QT-04.

### Response 201 Created

Các giá trị chính lấy từ ví dụ API L2 chính thức:

```json
{
  "ticket_id": 88231,
  "ticket_code": "BH-000231/2026",
  "status": "MOI",
  "category_id": 3,
  "priority": "TRUNG_BINH",
  "received_at": "2026-09-08T14:30:00+07:00",
  "due_date": "2026-09-11T14:30:00+07:00"
}
```

### Response lỗi

- `400 Bad Request`: dữ liệu không hợp lệ.
- `404 Not Found`: `customer_id` hoặc `device_id` không tồn tại.
- `409 Conflict`: thiết bị đang có phiếu chưa đóng.
- `422 Unprocessable Entity`: thiết bị hết bảo hành và chưa có phê duyệt theo QT-05.

### Validation

| Trường | Bắt buộc | Kiểu / ràng buộc |
|---|---|---|
| customer_id | Có | Số nguyên dương, khách hàng phải tồn tại |
| device_id | Có | Số nguyên dương, phải thuộc khách hàng theo QT-03 |
| center_id | Có | Số nguyên dương, trung tâm phải tồn tại |
| issue_desc | Có | Chuỗi từ 10 đến 2000 ký tự |
| category_id | Có | Phải thuộc danh mục nhóm sự cố đang sử dụng |
| accessories | Không | Mảng; giá trị theo mẫu gồm `SAC`, `TAI_NGHE`, `HOP`, `KHAC` |
| external_condition | Theo US3 | Nguồn không quy định độ dài; không tự đặt ngưỡng ở BT1 |
| priority | Hệ thống xác định | `CAO`, `TRUNG_BINH`, `THAP` theo mức mặc định của nhóm sự cố |

---

