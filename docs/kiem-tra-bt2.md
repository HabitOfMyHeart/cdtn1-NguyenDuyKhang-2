# Đối chiếu BT2 trước khi nộp

**Cập nhật:** 28/10/2026. Căn cứ đề BT2, phiếu phạm vi, BT1 và Buổi 10/12 trong `File source`. Đây là kiểm tra working tree; không phải chứng nhận bản đã nộp, clone remote hay peer review.

## 1. Tiêu chí kỹ thuật

| Mục | Trạng thái và minh chứng |
|---|---|
| C1 — dựng theo README | README đã cập nhật; chưa kiểm chứng bản clone từ tag cuối do chủ repo chưa chốt tag. Không đánh dấu hoàn tất. |
| C2 — tách lớp | Routes, services, repositories riêng; service dùng lỗi nghiệp vụ, middleware ánh xạ HTTP. |
| C3 — quy tắc thật | Chuẩn hóa/chặn trùng SĐT, serial, một phiếu mở/thiết bị, SLA, bảo hành và lý do đổi ưu tiên. |
| C4 — ba loại test | 121 test, 120 PASS/0 FAIL/1 SKIP có lý do. Happy/boundary/invalid trong `tests/ticket.service.test.js`; log đầy đủ tại `evidence/final/npm-test.txt`. |
| C5 — chạy lần hai | Migration/seed trên MongoDB tạm riêng hai lần: 34 khách/50 thiết bị/50 phiếu/192 log, 0 trùng khóa. `evidence/final/current-working-tree-check.txt`. |
| C6 — lockfile/cấu hình | Có package-lock và .env.example; .env/node_modules bị ignore. Các tệp mới/sửa vẫn chờ chủ repo commit. |
| C7 — dữ liệu sai | Ngày lịch sai và mô tả object trả 422 có fields; HTTP kiểm chứng thực tế tại `evidence/final/current-api-check.json`. |
| S1 — CRUD | Khách, thiết bị, phiếu có đủ CRUD backend; phiếu chỉ sửa/xóa khi còn MOI. |
| S2 — service độc lập HTTP | Service không nhận req/res, không trả response; lỗi có kind/code để middleware xử lý. |
| S3 — migration/seed | Có migration sáu collection và seed case study; không sinh thêm nguồn giả. |
| S4 — UI/API/trạng thái | Ba màn hình API thật; ảnh 01–07 mới gồm request chờ, hai loại rỗng, lỗi thật và kiểm tra retry. |

## 2. Kết quả luồng UI thật

Đăng nhập → tra cứu khách nguồn → tra cứu serial của thiết bị có phiếu đã đóng → chọn nhóm Sạc → nhập mô tả → xem SLA → lưu MOI → mở lại sau reload. Kết quả `BH-007325/2026`, đúng một log khởi tạo, bảo hành null vì nguồn thiếu ngày mua. Sau E2E CSDL tạm tăng từ 50/192 thành 51/193; không phải seed nhân đôi.

Chi tiết: `evidence/final/current-ui-e2e.json`. Đã dừng Express tạm để phát sinh lỗi mạng thật và khởi động lại, bấm Thử lại tải được danh sách. Loading chụp khi request thật chịu độ trễ 1800ms, không ghi đè state/response. CSDL chính không được kết nối trong phiên này.

## 3. Sai lệch/giới hạn chưa được phép coi là hoàn thành

- QT-14: chốt mô tả bản BT2 là phiếu theo trung tâm của token, khách/thiết bị dùng chung kể cả CRUD hỗ trợ; chỉ đáp ứng một phần. Đây không phải chính sách đã được giảng viên phê duyệt, không dùng cho vận hành dữ liệu thật đa trung tâm; không tự gán trung tâm sở hữu từ phiếu lịch sử.
- QT-05: thiếu ngày mua vẫn tạo `MOI` với bảo hành `null` (“Chưa xác minh bảo hành”), không xác nhận miễn phí hay đã duyệt. Chưa có quản lý/endpoint phê duyệt nên chỉ đáp ứng phần kiểm tra/ghi nhận của quy tắc; cờ bảo hành lịch sử không phải bằng chứng duyệt trong prototype.
- `BT1-PDF/NFR1–5` (Mục 1.4, Bảng 5): tra cứu P95 ≤2 giây/10.000 bản ghi, lưu ≤3 giây/≥95% số lần, 50 người dùng đồng thời/tỷ lệ lỗi <1%, uptime ≥99%, tính đúng đắn 100%. Chưa có kiểm chứng định lượng đầy đủ; test SLA/mã phiếu chỉ chứng minh các trường hợp đã kiểm.
- `SRS/NFR1`: tạo phiếu <3 phút với người mới, chưa đo. `SRS/NFR2–3`: ≥100 phiếu/200 log/50 khách và đủ 6 trung tâm/6 nhóm; mẫu 50/192/34/6/6 chưa đủ ngưỡng số lượng. Hai bộ trùng mã nhưng khác nội dung, không thay thế nhau; xem TD-05 trong `thay-doi-thiet-ke.md`. Không sửa SRS, bịa số đo hoặc sinh thêm dữ liệu giả.
- Ảnh test là bản hiển thị log thực tế, không giả làm ảnh terminal tương tác.
- Chưa có tag cuối, clone từ tag, peer review thật và xác nhận nộp E-learning. Agent không thay chủ repo thực hiện hoặc tự tạo minh chứng cho các mục này.

## 4. Checklist Buổi 10/12 còn lại cho người nộp

- [ ] Đọc và hiểu mã có AI hỗ trợ; chuẩn bị giải thích một hàm và điểm nghẽn khi dữ liệu tăng 10 lần.
- [ ] Xác nhận cách đối chiếu hai bộ NFR với giảng viên; giữ ghi chú chưa kiểm chứng cho các ngưỡng chưa đo. Riêng `SRS/NFR1` phải đo với người mới nếu muốn tuyên bố đạt.
- [ ] Xin xác nhận chấp nhận giới hạn QT-14 và phần phê duyệt QT-05 của bản BT2, hoặc nhận yêu cầu mở rộng. Chốt mô tả tài liệu không thay thế xác nhận của giảng viên.
- [ ] Chủ repo commit các thay đổi theo đơn vị có ý nghĩa; điền SHA thật vào bug log.
- [ ] Chủ repo tạo/push tag v0.2, kiểm tra repo public và tag đúng commit cuối.
- [ ] Tự kiểm bản nộp từ thư mục mới theo README; không dùng log working tree để thay cho kết quả clone.
- [ ] Nhờ sinh viên khác review thật theo Buổi 10, ghi ba dòng vào issue.
- [ ] Nộp đúng một PDF + link repo/tag, kiểm tra trạng thái đã nộp.

Peer review là hoạt động Buổi 10; tag và phép thử dựng lại thuộc đề BT2/Buổi 12. Không thêm Docker, vai trò quản lý, chuyển trạng thái sửa chữa hoặc chức năng ngoài L2 chỉ để tăng số lượng tính năng.
