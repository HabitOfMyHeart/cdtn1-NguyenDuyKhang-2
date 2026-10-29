# Smart CRM – Mekong Mobile

**Luồng L2 · Track SE · Nguyễn Duy Khang · MSSV 2374802010212**

Prototype cho nhân viên tra cứu/tạo khách hàng và thiết bị, kiểm tra bảo hành, chọn nhóm sự cố, tính SLA và tạo phiếu `MOI`. Luồng tiếp nhận kết thúc tại `MOI`; UI chỉ xem danh sách, chi tiết và lịch sử, không phân công hay sửa chữa. Backend có CRUD cho khách hàng, thiết bị và phiếu; chỉ phiếu `MOI` cùng trung tâm mới được sửa/xóa mềm. Phiếu lịch sử chưa đóng vẫn ngăn tiếp nhận lại thiết bị, không thể xóa để vượt kiểm tra này.

## 1. Công nghệ và cấu trúc

Node.js **20+**, Express 5, MongoDB **7+**, Mongoose 8, React 18 UMD + `htm`, `node:test`. Đã kiểm chứng với Node 24.21.0 và MongoDB 9.0.2.

- Backend: `src/routes → src/services → src/repositories → MongoDB`, sáu collection.
- Frontend: `src/public/app.js → src/public/apiClient.js → src/api/`; module client phục vụ qua `/assets/api`.
- React/htm lấy từ `node_modules`, không cần CDN hay bước build.
- [Kiến trúc thực tế](docs/architecture-thuc-te.drawio) · [API](docs/api-contract.md).

## 2. Cài đặt và chạy

Cần Git, Node.js/npm và **MongoDB Server đang chạy**; Compass không thay thế MongoDB Server. Dùng PowerShell. Tag `v0.2` là mốc nộp dự kiến, chỉ clone được khi chủ repo đã tạo và push tag.

```powershell
git clone --branch v0.2 --depth 1 https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2.git
cd cdtn1-NguyenDuyKhang-2
npm ci
Copy-Item .env.example .env
notepad .env
```

**Trước khi tiếp tục:** trong `.env`, đổi `MONGODB_URI` sang một CSDL sạch được phép dùng, ví dụ `mongodb://127.0.0.1:27017/mekong_bt2_demo`. Xác nhận đúng server và tên CSDL. Không chạy migration/seed trên CSDL đang sử dụng để thử bài; chúng tạo collection/index và ghi dữ liệu. Không thay `.env` đang dùng bằng lệnh sao chép trên nếu không phải thư mục cài mới.

```powershell
npm run db:migrate
npm run db:seed
npm test
```

Kiểm tra chạy lại **trước khi tạo/sửa dữ liệu qua ứng dụng**:

```powershell
npm run db:migrate
npm run db:seed
npm start
```

Giữ terminal này chạy, mở `http://localhost:3000`. Ở terminal khác:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Mong đợi `/health` trả `status=ok`, `database=connected`. Đăng nhập demo **`nhanvien / nhanvien123`**, trung tâm 1; không dùng tài khoản mẫu cho production. `npm run dev` chạy chế độ theo dõi mã.

## 3. Dữ liệu và quy tắc

Seed sạch: **34 khách / 50 thiết bị / 50 phiếu / 192 log / 6 trung tâm / 6 nhóm**, trích từ case study; không sinh thêm dữ liệu giả. Ngày mua không có trong nguồn nên giữ `null`; cờ bảo hành lịch sử giữ nguyên nguồn. Một lần tiếp nhận mới sẽ tính lại bảo hành và có thể trả “Chưa xác minh”, không suy diễn thành hết bảo hành. Xem [nguồn và cách tái trích](data/sample/README.md).

**QT-05 — giới hạn bản BT2:** thiếu ngày mua vẫn cho tạo phiếu `MOI` với `is_warranty`/`conBaoHanh = null` (“Chưa xác minh bảo hành”). Tạo phiếu không xác nhận bảo hành miễn phí, không có nghĩa đã được quản lý phê duyệt. Bản L2 không có vai trò/endpoint phê duyệt nên chỉ đáp ứng phần kiểm tra/ghi nhận, chưa đủ toàn bộ QT-05 của case study/BT1/SRS. Cờ bảo hành lịch sử giữ theo nguồn, không phải kết quả duyệt của prototype.

Seed mặc định chỉ nạp vào CSDL trống hoặc khớp bộ mẫu; chạy lại không nhân đôi. Nếu đã có dữ liệu tiếp nhận mới/khác nguồn, seed dừng để tránh ghi đè; đây không phải chức năng đồng bộ dữ liệu vận hành. `npm run db:seed -- --plan-safe` chỉ lập kế hoạch đọc. Chế độ bổ sung dữ liệu khác nguồn yêu cầu sao lưu, dừng tiến trình ghi và phê duyệt riêng; không cần cho việc dựng BT2 trên đích sạch.

**CSDL chính** có 35/50/50/188 theo biên bản ngày 27/10/2026, còn 51 bản ghi cũ khác nguồn được giữ nguyên; không phải bản sao nguyên gốc. Lịch sử sao lưu, bổ sung và đối soát nằm trong [kiểm chứng CSDL](docs/kiem-chung-csdl.md), không phải hướng dẫn cần chạy lại.

API phiếu giới hạn theo trung tâm của token. **Khách hàng/thiết bị hiện là hồ sơ dùng chung**, gồm cả CRUD hỗ trợ; chưa phân quyền theo trung tâm cho hai nhóm này, nên không tuyên bố đã đáp ứng toàn bộ QT-14. UI che SĐT trong kết quả hồ sơ và view phiếu; ô nhập vẫn giữ số do nhân viên nhập. API hồ sơ còn trả dữ liệu đầy đủ để tiếp nhận, không phải lớp chống truy xuất PII hoàn chỉnh.

Đây là giới hạn được chốt để mô tả bản BT2, không phải chính sách dùng chung đã được giảng viên phê duyệt. Xác thực đăng nhập không thay thế phân quyền hồ sơ; chưa dùng prototype để vận hành dữ liệu thật đa trung tâm. Nếu phải mở rộng, cần thống nhất mô hình sở hữu/quyền truy cập trước, không tự gán trung tâm từ một phiếu lịch sử.

## 4. Kiểm thử và minh chứng

```powershell
npm test
```

Kết quả ngày 28/10/2026: **121 test, 120 PASS, 0 FAIL, 1 SKIP**. Test tự dựng fixture, không cần MongoDB hay CSV ngoài repo. Test tái trích nguồn được SKIP khi thiếu `DATASET_SOURCE`; đây là kiểm tra bổ sung, ba loại test bắt buộc đều chạy. Ba test đại diện trong `tests/ticket.service.test.js`: happy path (dòng 53), biên bảo hành (dòng 169), dữ liệu sai (dòng 216).

- [Log test cuối](docs/evidence/final/npm-test.txt).
- [Migration/seed hai lần trên MongoDB tạm riêng](docs/evidence/final/current-working-tree-check.txt).
- [Luồng UI thật, lưu và tải lại, lỗi kết nối và thử lại](docs/evidence/final/current-ui-e2e.json).
- [Ảnh minh chứng và cách tạo](docs/screenshots/final/README.md).
- [Bảng đối chiếu C1–C7/S1–S4 và việc còn lại](docs/kiem-tra-bt2.md).

Ảnh UI cuối dùng request/dữ liệu thật, không dùng thanh mô phỏng. Công cụ mô phỏng vẫn được giữ trong mục thu gọn, có nhãn rõ ràng; nó không thay cho kiểm chứng mất kết nối thật. Hồ sơ `docs/kiem-chung-buoi10.md` và `docs/evidence/buoi10/` chỉ là lịch sử bản cũ.

## 5. Giới hạn và hồ sơ nộp

- **Không đồng nhất hai bộ NFR:** PDF BT1 (Mục 1.4, Bảng 5) ghi NFR1–5 về tra cứu P95 ≤2 giây/10.000 bản ghi, lưu ≤3 giây/≥95% số lần, 50 người dùng đồng thời/tỷ lệ lỗi <1%, uptime ≥99% và tính đúng đắn. Chưa có kiểm chứng định lượng đầy đủ các ngưỡng này; test chức năng không thay thế kiểm tải/uptime.
- **Riêng `docs/srs.md`:** NFR1 là tạo phiếu <3 phút với người mới (chưa đo); NFR2 là ≥100 phiếu/200 log; NFR3 là ≥50 khách và đủ 6 trung tâm/6 nhóm. Mẫu 50/192/34 đủ dải phiếu phạm vi nhưng chưa đủ ngưỡng mẫu SRS, không chứng minh giới hạn năng lực hệ thống. Dùng nhãn `BT1-PDF/NFRx` và `SRS/NFRx` để phân biệt nguồn, không sửa SRS hoặc loại bỏ cam kết BT1. Bảng đối chiếu và mức kiểm chứng: [TD-05/TD-06](docs/thay-doi-thiet-ke.md).
- JWT demo trong `localStorage`, chưa refresh/thu hồi token, rate limiting hay phân trang. Docker tùy chọn, không thêm cho BT2.
- [Bug log](docs/bug-log.md) · [AI disclosure](docs/ai-disclosure.md) · Sơ đồ/SQL BT1 được giữ để truy vết, không phải migration MongoDB.
- Kiểm chứng hiện tại chạy trực tiếp working tree, **không phải clone từ tag và không phải peer review**. Chủ repo tự commit/push/tag `v0.2`, điền SHA thật vào bug log, kiểm chứng bản nộp và nhờ sinh viên khác review; không có bằng chứng giả thay thế.
