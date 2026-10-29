# Nhật ký lỗi

## BUG-001 · Minor — Có thể xóa lý do khi ưu tiên khác gợi ý

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-001 · Minor — dữ liệu chỉnh sửa không còn đủ lý do đổi ưu tiên. |
| 2. Phát hiện bởi | Đối chiếu quy tắc đổi ưu tiên trong `updateTicket`. |
| 3. Triệu chứng | Phiếu có mức ưu tiên khác mức gợi ý vẫn cho phép cập nhật `priority_reason` thành rỗng. |
| 4. Cách tái lập | `node --test tests/priority-regression.test.js` với bản code trước sửa: phiếu THAP, nhóm gợi ý CAO, cập nhật riêng lý do thành chuỗi rỗng. |
| 5. Nguyên nhân | Nhánh cập nhật riêng `priority_reason` không kiểm tra mức ưu tiên hiện tại so với nhóm sự cố. |
| 6. Cách sửa | Trong `src/services/ticket.service.js`, kiểm tra mức ưu tiên và lý do sau khi gộp cập nhật; từ chối nếu thiếu lý do. |
| 7. Commit và xác nhận | Test tái lập FAIL trước sửa với `Missing expected rejection`, PASS sau sửa. Commit: chưa tạo; bổ sung link commit thực tế sau khi chủ repo commit và push. |

## BUG-002 · Major — Sửa/xóa được phiếu sau tiếp nhận

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-002 · Major — API vượt phạm vi L2 và có thể bỏ qua kiểm tra phiếu mở. |
| 2. Phát hiện bởi | Rà soát phạm vi và chạy fixture bằng OpenCode, 28/10/2026. |
| 3. Triệu chứng | Sửa/xóa mềm được phiếu DANG_XU_LY; sau khi xóa có thể tiếp nhận lại thiết bị đó. |
| 4. Cách tái lập | Test đầu trong `tests/intake-boundary.test.js`: fixture có phiếu sau MOI, gọi update/delete; trước sửa FAIL với `Missing expected rejection`. |
| 5. Nguyên nhân | Service chỉ kiểm tra trung tâm, repository ghi theo ID mà không kiểm tra trạng thái. |
| 6. Cách sửa | Chặn mọi trạng thái khác MOI; điều kiện ghi repository có `status: MOI`, trả xung đột nếu bản ghi đã thay đổi. |
| 7. Commit và xác nhận | Test hồi quy PASS; HTTP thật PUT/DELETE phiếu DA_PHAN_CONG trả 409 PHIEU_CHI_DOC và bản ghi không đổi (`current-api-check.json`). SHA chờ chủ repo commit. |

## BUG-003 · Minor — Kết quả tra cứu hiện nguyên SĐT

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-003 · Minor — hiển thị không nhất quán QT-15. |
| 2. Phát hiện bởi | Đối chiếu UI với case study, 28/10/2026. |
| 3. Triệu chứng | Kết quả hồ sơ trên màn tiếp nhận hiện số đầy đủ dù view phiếu đã che. |
| 4. Cách tái lập | Test `QT-15: kết quả tra cứu hồ sơ che SĐT` trong `tests/static-assets.test.js`; trước sửa FAIL vì không có chuỗi đã che. |
| 5. Nguyên nhân | Component render trực tiếp `customer.phone`. |
| 6. Cách sửa | Che số trong khối kết quả hồ sơ; giữ nguyên số nhân viên nhập trong ô tra cứu. |
| 7. Commit và xác nhận | Test PASS; E2E thực tế xác nhận `customerPhoneMasked: true`. SHA chờ chủ repo commit. |

## BUG-004 · Major — Nhận ngày không tồn tại và mô tả sai kiểu

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-004 · Major — dữ liệu đầu vào không được kiểm tra đúng. |
| 2. Phát hiện bởi | Kiểm tra validation tại route và service, 28/10/2026. |
| 3. Triệu chứng | Ngày 2026-02-30 được coi là hợp lệ; object được ép thành mô tả đủ độ dài. |
| 4. Cách tái lập | Các test validation/service trong `tests/intake-boundary.test.js` FAIL trước sửa vì kết quả valid=true hoặc thiếu rejection. |
| 5. Nguyên nhân | Chỉ kiểm tra `new Date` và độ dài `String(value)`, chưa kiểm tra kiểu và ngày lịch thực tế. |
| 6. Cách sửa | Helper thuần `src/validators/primitives.js` kiểm tra kiểu, ngày nhuận và ngày/tháng; dùng tại validator và service. |
| 7. Commit và xác nhận | Test PASS; gọi route thật nhận 422 với fields, không ghi CSDL. SHA chờ chủ repo commit. |

## BUG-005 · Minor — Không có số liệu vẫn hiện SLA 100%

| Mục | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-005 · Minor — số liệu UI gây hiểu nhầm. |
| 2. Phát hiện bởi | Chụp màn hình lỗi kết nối thật trên CSDL tạm, 28/10/2026. |
| 3. Triệu chứng | Không tải được phiếu hoặc không có phiếu mở nhưng banner vẫn hiện đạt SLA 100%. |
| 4. Cách tái lập | Mở danh sách trên CSDL chưa có phiếu hoặc dừng Express rồi tải lại danh sách từ UI đang mở. |
| 5. Nguyên nhân | Công thức gán 100 khi mẫu số bằng 0, vẫn hiển thị chỉ số trong lúc tải/lỗi. |
| 6. Cách sửa | Tỷ lệ không xác định dùng null, ghi rõ chưa có mẫu; chỉ số đang tải/lỗi hiển thị dấu gạch. |
| 7. Commit và xác nhận | Test UI rỗng/lỗi PASS; ảnh 04–06 chụp lại từ request thật. SHA chờ chủ repo commit. |
