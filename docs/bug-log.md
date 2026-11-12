# Nhật ký lỗi

## Tình trạng minh chứng commit (đối chiếu ngày 05/11/2026)

Đã đối chiếu diff và bổ sung link commit chứa thay đổi sửa cho cả 5 bug bên dưới. Đây là **bug lịch sử**, không phải lỗi mới phát hiện trong buổi 14. Các ghi nhận FAIL trước sửa/E2E bên dưới được giữ từ nhật ký cũ; lần cập nhật tài liệu này không chạy lại bản trước sửa hoặc E2E đó.

**Phạm vi commit:** BUG-001/002/004 nằm chung commit backend `4c34a07`; BUG-003/005 nằm chung commit giao diện `27cf6b0`. Đề BT3 không yêu cầu mỗi bug một commit riêng; yêu cầu là mỗi bug đủ 7 mục và link commit mở được, trỏ đúng thay đổi. Commit cập nhật tài liệu này không dùng thay link sửa lỗi.

## BUG-001 · Minor — Có thể xóa lý do khi ưu tiên khác gợi ý

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-001 · Minor — dữ liệu chỉnh sửa không còn đủ lý do đổi ưu tiên. |
| 2. Phát hiện bởi | Đối chiếu quy tắc đổi ưu tiên trong `updateTicket`. |
| 3. Triệu chứng | Phiếu có mức ưu tiên khác mức gợi ý vẫn cho phép cập nhật `priority_reason` thành rỗng. |
| 4. Cách tái lập | `node --test tests/priority-regression.test.js` với bản code trước sửa: phiếu THAP, nhóm gợi ý CAO, cập nhật riêng lý do thành chuỗi rỗng. |
| 5. Nguyên nhân | Nhánh cập nhật riêng `priority_reason` không kiểm tra mức ưu tiên hiện tại so với nhóm sự cố. |
| 6. Cách sửa | Trong `src/services/ticket.service.js`, kiểm tra mức ưu tiên và lý do sau khi gộp cập nhật; từ chối nếu thiếu lý do. |
| 7. Commit và xác nhận | Nhật ký cũ ghi test tái lập FAIL trước sửa với `Missing expected rejection`, PASS sau sửa. [Commit chứa bản sửa 4c34a07](https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2/commit/4c34a076fd86baf7d4eb1c9c8982392a472f9f42): bổ sung kiểm tra lý do rỗng trong nhánh cập nhật riêng `priority_reason`. Commit gộp, không riêng BUG-001. Test hồi quy hiện có: [priority-regression.test.js:5](../tests/priority-regression.test.js#L5), PASS trong lần chạy 12/11/2026. |

## BUG-002 · Major — Sửa/xóa được phiếu sau tiếp nhận

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-002 · Major — API vượt phạm vi L2 và có thể bỏ qua kiểm tra phiếu mở. |
| 2. Phát hiện bởi | Rà soát phạm vi và chạy fixture bằng OpenCode, 28/10/2026. |
| 3. Triệu chứng | Sửa/xóa mềm được phiếu DANG_XU_LY; sau khi xóa có thể tiếp nhận lại thiết bị đó. |
| 4. Cách tái lập | Test đầu trong `tests/intake-boundary.test.js`: fixture có phiếu sau MOI, gọi update/delete; trước sửa FAIL với `Missing expected rejection`. |
| 5. Nguyên nhân | Service chỉ kiểm tra trung tâm, repository ghi theo ID mà không kiểm tra trạng thái. |
| 6. Cách sửa | Chặn mọi trạng thái khác MOI; điều kiện ghi repository có `status: MOI`, trả xung đột nếu bản ghi đã thay đổi. |
| 7. Commit và xác nhận | Nhật ký cũ ghi test hồi quy PASS; HTTP thật PUT/DELETE phiếu DA_PHAN_CONG trả 409 PHIEU_CHI_DOC và bản ghi không đổi (`current-api-check.json`, không dùng làm minh chứng mới ở lần cập nhật này). [Commit chứa bản sửa 4c34a07](https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2/commit/4c34a076fd86baf7d4eb1c9c8982392a472f9f42): thêm `assertIntakeTicket`, kiểm trạng thái tại service/repository và xử lý xung đột khi ghi. Commit gộp, không riêng BUG-002. Test hồi quy hiện có: [intake-boundary.test.js:10](../tests/intake-boundary.test.js#L10), PASS trong lần chạy 12/11/2026. |

## BUG-003 · Minor — Kết quả tra cứu hiện nguyên SĐT

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-003 · Minor — hiển thị không nhất quán QT-15. |
| 2. Phát hiện bởi | Đối chiếu UI với case study, 28/10/2026. |
| 3. Triệu chứng | Kết quả hồ sơ trên màn tiếp nhận hiện số đầy đủ dù view phiếu đã che. |
| 4. Cách tái lập | Test `QT-15: kết quả tra cứu hồ sơ che SĐT` trong `tests/static-assets.test.js`; trước sửa FAIL vì không có chuỗi đã che. |
| 5. Nguyên nhân | Component render trực tiếp `customer.phone`. |
| 6. Cách sửa | Che số trong khối kết quả hồ sơ; giữ nguyên số nhân viên nhập trong ô tra cứu. |
| 7. Commit và xác nhận | Nhật ký cũ ghi test PASS; E2E xác nhận `customerPhoneMasked: true`. [Commit chứa bản sửa 27cf6b0](https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2/commit/27cf6b07b4cefeed53be39385f4973848d6d4f6b): thay render trực tiếp `customer.phone` bằng `maskPhone(customer.phone)`. Commit gộp, không riêng BUG-003. Test hồi quy hiện có: [static-assets.test.js:333](../tests/static-assets.test.js#L333), PASS trong lần chạy 12/11/2026. |

## BUG-004 · Major — Nhận ngày không tồn tại và mô tả sai kiểu

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-004 · Major — dữ liệu đầu vào không được kiểm tra đúng. |
| 2. Phát hiện bởi | Kiểm tra validation tại route và service, 28/10/2026. |
| 3. Triệu chứng | Ngày 2026-02-30 được coi là hợp lệ; object được ép thành mô tả đủ độ dài. |
| 4. Cách tái lập | Các test validation/service trong `tests/intake-boundary.test.js` FAIL trước sửa vì kết quả valid=true hoặc thiếu rejection. |
| 5. Nguyên nhân | Chỉ kiểm tra `new Date` và độ dài `String(value)`, chưa kiểm tra kiểu và ngày lịch thực tế. |
| 6. Cách sửa | Helper thuần `src/validators/primitives.js` kiểm tra kiểu, ngày nhuận và ngày/tháng; dùng tại validator và service. |
| 7. Commit và xác nhận | Test HTTP hồi quy nhận 422 với fields, không cần ghi CSDL; xem [Test Report](test-report.md), TC-10. [Commit chứa bản sửa 4c34a07](https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2/commit/4c34a076fd86baf7d4eb1c9c8982392a472f9f42): thêm helper kiểm ngày lịch và kiểu trong `primitives.js`, dùng tại validator/service. Commit gộp, không riêng BUG-004. Test hồi quy hiện có: [intake-boundary.test.js:62](../tests/intake-boundary.test.js#L62), [:76](../tests/intake-boundary.test.js#L76), [:99](../tests/intake-boundary.test.js#L99), PASS trong lần chạy 12/11/2026. |

## BUG-005 · Minor — Không có số liệu vẫn hiện SLA 100%

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-005 · Minor — số liệu UI gây hiểu nhầm. |
| 2. Phát hiện bởi | Chụp màn hình lỗi kết nối thật trên CSDL tạm, 28/10/2026. |
| 3. Triệu chứng | Không tải được phiếu hoặc không có phiếu mở nhưng banner vẫn hiện đạt SLA 100%. |
| 4. Cách tái lập | Mở danh sách trên CSDL chưa có phiếu hoặc dừng Express rồi tải lại danh sách từ UI đang mở. |
| 5. Nguyên nhân | Công thức gán 100 khi mẫu số bằng 0, vẫn hiển thị chỉ số trong lúc tải/lỗi. |
| 6. Cách sửa | Tỷ lệ không xác định dùng null, ghi rõ chưa có mẫu; chỉ số đang tải/lỗi hiển thị dấu gạch. |
| 7. Commit và xác nhận | Nhật ký cũ ghi test UI rỗng/lỗi PASS; ảnh 04–06 chụp lại từ request thật. [Commit chứa bản sửa 27cf6b0](https://github.com/HabitOfMyHeart/cdtn1-NguyenDuyKhang-2/commit/27cf6b07b4cefeed53be39385f4973848d6d4f6b): thay tỷ lệ 100 khi không có mẫu bằng null, tách hiển thị thiếu số liệu/tải/lỗi. Commit gộp, không riêng BUG-005. Test hồi quy hiện có: [static-assets.test.js:309](../tests/static-assets.test.js#L309), PASS trong lần chạy 12/11/2026. |
