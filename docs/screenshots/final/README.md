# Ảnh minh chứng cuối – BT2

**Ngày:** 28/10/2026 (giờ Việt Nam). Chrome headless, viewport 1440×1000; ảnh full-page có thể cao hơn. Node 24.21.0, MongoDB 9.0.2 tạm riêng tại `127.0.0.1:27018`. Chạy working tree hiện tại, không clone và không ghi CSDL chính.

| Tệp | Minh chứng thực tế |
|---|---|
| `01-danh-sach.png` | Đăng nhập nhân viên trung tâm 1, danh sách 9 phiếu từ API/seed case study trước E2E. |
| `02-tiep-nhan.png` | Màn tiếp nhận, danh mục tải từ API thật. |
| `03-chi-tiet.png` | Phiếu mới `TCK0031` / `BH-007325/2026` được lưu từ UI, trạng thái MOI, một log khởi tạo; mở lại sau reload. |
| `04-rong.png` | API trả 0 phiếu từ CSDL tạm `mekong_bt2_empty_check`, chỉ có danh mục 6 trung tâm/6 nhóm. |
| `05-loi.png` | Request thật thất bại khi tiến trình Express tạm dừng; có nút Thử lại. Khởi động lại rồi bấm nút đã tải lại 10 phiếu của trung tâm. |
| `06-dang-tai.png` | Request thật đang chờ, áp dụng độ trễ mạng 1800ms bằng Chrome; không thay response hay hàm fetch. |
| `07-rong-bo-loc.png` | Từ khóa không khớp dữ liệu thật; khác với trạng thái chưa có dữ liệu. |
| `08-ket-qua-test.png` | Bản hiển thị log chạy `npm test`, ba test đại diện và tổng kết; không phải ảnh terminal tương tác. Log gốc đính kèm trong repo. |

Ảnh 01–07 **không dùng thanh mô phỏng**. Công cụ mô phỏng vẫn có trong UI dưới mục thu gọn được gắn nhãn, không phải nguồn của các ảnh này.

Chi tiết E2E: [`current-ui-e2e.json`](../../evidence/final/current-ui-e2e.json). Seed ban đầu có 50 phiếu/192 log; thao tác tiếp nhận trên CSDL tạm tăng đúng một phiếu và một log thành 51/193. Thiết bị/khách được chọn từ một phiếu nguồn đã đóng, không tạo hồ sơ giả. Các ảnh có dữ liệu case study và cần được xử lý như thông tin nhạy cảm; không công bố ra ngoài phạm vi được phép.

Ảnh mới thay ảnh mô phỏng cũ. Bản sao lưu ảnh cũ và PDF cũ được giữ ngoài repo trong thư mục tạm của phiên kiểm chứng.
