# Test Report — Buổi 14

**Dự án:** Smart CRM – Mekong Mobile · Track SE · Luồng L2  
**Sinh viên:** Nguyễn Duy Khang · MSSV 2374802010212  
**Ngày kiểm chứng lại:** 12/11/2026 (bổ sung kiểm thử đóng gói BT3)
**Kế hoạch:** [Test Plan](test-plan.md)

## 1. Môi trường và kết quả tổng hợp

- Mã nguồn được kiểm: `main` tại `7d51189` (đã gồm đóng gói BT3); bảng 12 TC và ảnh gốc được lập tại `8d9d537` ngày 05/11/2026.
- Windows/PowerShell; Node.js `v24.21.0`, npm `11.19.0`.
- Lệnh tại gốc repo: `npm test`; exit code **0**; không dùng CSDL chính. Lần chạy trong container Docker riêng có cùng kết quả, log tại [container-tests.txt](evidence/bt3/container-tests.txt).
- [Ảnh tổng kết do người thực hiện cung cấp](screenshots/buoi14/testreport.png) và 12 ảnh TC được chụp ngày 05/11 với tổng 121. Lần chạy 12/11 có thêm test đóng gói nên tổng hiện tại là 130; không dùng ảnh cũ làm số liệu hiện tại.

| Chỉ tiêu | Kết quả |
|---|---:|
| Test runner phát hiện (14 file) | 130 |
| Test thực thi, không tính SKIP | 129 |
| PASS | 129 |
| FAIL | 0 |
| SKIP | 1 |
| Cancelled / Todo | 0 / 0 |

**Không ghi “130 PASS” hoặc “130 đã thực thi”.** Tổng 130 bao gồm một test chưa chạy. Đây là kết quả sau các sửa đổi đã có trong repo, không chứng minh rằng trước sửa không có lỗi.

Test bị bỏ qua: `re-extraction reproduces committed sample when source is available` trong [dataset-scope.test.js](../tests/dataset-scope.test.js). Điều kiện `skip: !process.env.DATASET_SOURCE`; chưa kiểm chứng việc tái trích xuất từ file nguồn. Test này khác TC-12 (tái lập kết quả bộ test).

## 2. Kết quả 12 kịch bản đại diện

Bảng dưới ánh xạ 12 case vào assertion **đã chạy trong bộ test tự động**; đây không phải thao tác tay trên Postman/UI. Gói Docker có live smoke ghi MongoDB demo thật, tách khỏi bảng này và được ghi ở mục 5.

| Mã | Tiền điều kiện | Các bước | Dữ liệu thử | Kết quả mong đợi | Ưu tiên | Kết quả thực tế | PASS/FAIL |
|---|---|---|---|---|---|---|---|
| TC-01 | Fixture mới; nhân viên center 1; khách/thiết bị hợp lệ. | Gọi service tạo phiếu; đọc lại chi tiết và lịch sử. | Tiếp nhận 21/10/2026 09:00 +07; ưu tiên CAO. | Phiếu MOI, mã mới, hạn 22/10/2026 09:00 +07; log null → MOI. | High | `TCK0001`, `BH-000001/2026`, trạng thái/hạn/log khớp assertion. Đây là service test, không đo HTTP 201. | PASS |
| TC-02 | Fixture khách hàng riêng. | Chuẩn hóa SĐT; thử tạo trùng; tạo khách với số mới. | `0901.234.567`, `+84 90 123 4567`, `0084 90 123 4567`; số mới `+84 93 765 4321`. | Chuẩn hóa về số nội địa; chặn tạo trùng; số mới lưu đúng. | High | Số cũ chuẩn hóa `0901234567`, tạo trùng báo `TRUNG_DU_LIEU`; khách mới có số `0937654321`. | PASS |
| TC-03 | Fixture thiết bị riêng. | Chuẩn hóa serial; thử tạo serial trùng. | Serial có khoảng trắng/chữ thường và serial đã có trong fixture. | Serial chuẩn hóa viết hoa; từ chối trùng. | High | Test QT-03 hoàn tất; assertion chuẩn hóa và chặn trùng thành công. | PASS |
| TC-04 | Helper SLA; không cần CSDL. | Tính hạn CAO/TRUNG_BINH/THAP và trường hợp qua Chủ Nhật. | 24/10/2026 09:00 +07, CAO; 21/10/2026 09:00 +07, TRUNG_BINH/THAP. | Lần lượt 26/10, 24/10, 27/10 lúc 09:00 +07; bỏ Chủ Nhật. | High | Các mốc thời gian trả về đúng assertion trong test QT-04. | PASS |
| TC-05 | Thiết bị mua 21/10/2025, BH 12 tháng. | Kiểm tra bảo hành ở cuối ngày hết hạn. | `2026-10-21T23:59:59+07:00`. | `conBaoHanh=true`, “Còn bảo hành”. | High | `true` và kết luận đúng; assertion nửa đầu test biên QT-05. | PASS |
| TC-06 | Cùng thiết bị và ranh giới TC-05. | Kiểm tra bảo hành ở đầu ngày kế tiếp. | `2026-10-22T00:00:00+07:00`. | `conBaoHanh=false`, “Hết bảo hành”. | High | `false` và kết luận đúng; assertion nửa sau cùng test biên QT-05. | PASS |
| TC-07 | Thiết bị thiếu ngày mua. | Kiểm helper và tạo phiếu qua service với thiết bị chưa xác minh. | `purchase_date=null`, BH 12 tháng. | `conBaoHanh=null`, “Chưa xác minh bảo hành”; không trả false. | Medium | Cả helper và view phiếu giữ null, kết luận đúng. | PASS |
| TC-08 | Helper che số; không cần trình duyệt thật. | Gọi `maskPhone`; đối chiếu kết quả hiển thị. | `0901234567`. | `0901***567`. | High | Test hợp đồng QT-15 trả đúng số đã che. | PASS |
| TC-09 | Phiếu thuộc trung tâm khác nhân viên. | Gọi service xem phiếu ngoài trung tâm. | Phiếu center 1; nhân viên center 2 theo fixture. | Lỗi forbidden, mã `KHONG_DU_QUYEN`. | High | Assertion phân quyền service QT-14 thành công; không phải phép đo HTTP 403 riêng cho case này. | PASS |
| TC-10 | Express loopback thật, JWT test; không kết nối CSDL. | POST `/api/tickets` lần lượt ba body sai; kiểm status và fields. | (a) `issue_desc={}`; (b) `received_at=2026-02-30T09:00:00+07:00`; (c) body `[]`; trường khác theo PAYLOAD test. | Cả ba HTTP 422, `DU_LIEU_KHONG_HOP_LE`, có field lỗi ngoài mã tra cứu. | High | Cả ba response đạt assertion 422/code/fields trong test HTTP thật. | PASS |
| TC-11 | Fixture phiếu đã qua MOI. | Thử sửa/xóa phiếu; kiểm không thể xóa để tiếp nhận lại. | Các trạng thái sau MOI trong test L2. | Từ chối sửa/xóa bằng conflict `PHIEU_CHI_DOC`; không bỏ qua ràng buộc phiếu mở. | High | Test hồi quy service L2 thành công, không phát sinh thay đổi trái phép trong fixture. | PASS |
| TC-12 | Dependencies đã có; chạy tại gốc repo và trong container Docker. | Chạy lại `npm test`; đối chiếu tổng giữa hai môi trường. | Bộ `tests/*.test.js`, không có `DATASET_SOURCE`. | Kết quả tổng tái lập: 130 tổng, 129 PASS, 0 FAIL, 1 SKIP; exit 0. | High | Host và container đều cho 130/129/0/1, exit 0; log tại [container-tests.txt](evidence/bt3/container-tests.txt). | PASS |

## 3. Ánh xạ test và cách chạy lại

| TC | Test thực thi | Ranh giới |
|---|---|---|
| TC-01 | [ticket.service.test.js:53](../tests/ticket.service.test.js#L53) | Service, repository trong bộ nhớ. |
| TC-02 | [ticket.service.test.js:306](../tests/ticket.service.test.js#L306) | Unit/service khách hàng. |
| TC-03 | [ticket.service.test.js:339](../tests/ticket.service.test.js#L339) | Unit/service thiết bị. |
| TC-04 | [ticket.service.test.js:116](../tests/ticket.service.test.js#L116) | Helper tính SLA. |
| TC-05, TC-06 | [ticket.service.test.js:169](../tests/ticket.service.test.js#L169) | Hai phía cùng ranh giới ngày, trong một test function. |
| TC-07 | [ticket.service.test.js:185](../tests/ticket.service.test.js#L185) | Helper và service với fixture. |
| TC-08 | [ticket.contract.test.js:53](../tests/ticket.contract.test.js#L53) | Helper hợp đồng; không E2E trình duyệt. |
| TC-09 | [ticket.service.test.js:278](../tests/ticket.service.test.js#L278) | Service phân quyền phiếu. |
| TC-10 | [intake-boundary.test.js:99](../tests/intake-boundary.test.js#L99) | HTTP/Express thật; không CSDL thật. |
| TC-11 | [intake-boundary.test.js:10](../tests/intake-boundary.test.js#L10) | Service hồi quy với fixture. |
| TC-12 | [package.json](../package.json) — script `test` | Chạy lại bộ test tự động. |

Chạy các file chứa case đại diện:

```powershell
node --test tests/ticket.service.test.js tests/ticket.contract.test.js tests/intake-boundary.test.js
```

Chạy riêng test HTTP của TC-10:

```powershell
node --test --test-name-pattern="422" tests/intake-boundary.test.js
```

Lệnh xác nhận toàn bộ và TC-12:

```powershell
npm test
```

## 4. Độ phủ loại test và tình trạng ảnh

| Loại | Bằng chứng nội dung test | Tình trạng |
|---|---|---|
| Luồng đúng | TC-01/02/03/04/07. | Có. |
| Biên | TC-05/06, cùng ranh giới 23:59:59 → 00:00:00 ngày kế tiếp. | Có. |
| Dữ liệu sai | TC-10a/b là hai đầu vào sai khác nhau; TC-10c bổ sung body sai kiểu. | Có, cùng một test function HTTP. |
| Bảo mật/chất lượng dữ liệu | TC-08 che số; TC-09 phạm vi trung tâm. | Có. |
| Tái lập | TC-12 chạy lại bộ test cho cùng tổng PASS/FAIL/SKIP. | Có; test tái trích xuất file nguồn vẫn SKIP. |

Ảnh hiện có: [docs/screenshots/buoi14/](screenshots/buoi14/) gồm `testreport.png` và **12 ảnh riêng TC-01 → TC-12 do người thực hiện cung cấp**, chụp ngày 05/11/2026. Ảnh tổng kết và ảnh TC-12 ghi tổng 121/120 của lần chạy cũ; lần chạy 12/11 có thêm 9 test đóng gói nên tổng hiện tại là 130/129. Không dùng ảnh cũ để thay số liệu hiện tại.

**Minh chứng ảnh:** đã có 12 tệp ảnh riêng cho 12 mã TC, nội dung khác nhau. Ảnh không thay thế log máy đọc được; log mới nhất nằm trong [container-tests.txt](evidence/bt3/container-tests.txt) và [host-coverage.txt](evidence/bt3/host-coverage.txt).

## 5. Kết luận và nội dung điền checklist

- Bộ test hiện có không phát hiện FAIL trong lần chạy lại; một test chưa thực thi do thiếu file nguồn.
- Có nội dung đủ năm loại trong kiểm thử tự động; đã có 12 ảnh riêng TC-01 → TC-12.
- Đã chạy tích hợp MongoDB thật trong gói Docker demo riêng và live smoke 8 kiểm tra; chưa chạy E2E trình duyệt đầy đủ, đo tải hay CI. Coverage đã đo: 77,56% dòng, 79,08% nhánh, 67,66% hàm — **chưa đạt 80%**, không tuyên bố đạt.
- Bug lịch sử và tình trạng commit theo [Bug Log](bug-log.md); đề BT3 không yêu cầu mỗi bug một commit riêng, nhưng link commit phải mở được và trỏ đúng thay đổi.

Sau khi commit/push tài liệu, có thể dùng:

**3. Test Plan:** https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2/blob/main/docs/test-plan.md

**4. Test Report:** https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2/blob/main/docs/test-report.md

- Số test tự động được phát hiện: **130** / thực thi: **129** / PASS: **129** / FAIL: **0** / SKIP: **1**.
- Đủ 5 loại: **Có về nội dung test tự động**; đã có 12 ảnh riêng TC-01 → TC-12, test tái trích xuất nguồn chưa chạy.
- Ảnh chụp kết quả: https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2/blob/main/docs/screenshots/buoi14/testreport.png
