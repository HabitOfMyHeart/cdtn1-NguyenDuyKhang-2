Họ tên: Nguyễn Duy Khang MSSV: 2374802010212 Track: [ X] SE [ ] DA [ ] AI

 

1. LUỒNG NGHIỆP VỤ CHỌN

 

(Chọn 1 trong danh mục L1–L10 của case study)

 

Mã luồng: L2....  Tên luồng: Tiếp nhận và phân loại yêu cầu bảo hành......

 

2. PHẠM VI DIỄN ĐẠT BẰNG MỘT CÂU

 

(Ai làm gì, theo trình tự nào, kết thúc ở đâu — theo khuôn ví dụ “VỪA ĐỦ” buổi 1)

 

Nhân viên tiếp nhận tra cứu hoặc tạo mới thông tin khách hàng bằng số điện thoại, ghi nhận thông tin thiết bị và mô tả lỗi, sau đó hệ thống tự động kiểm tra hạn bảo hành, phân loại nhóm sự cố, xác định mức ưu tiên và sinh hạn cam kết trả máy, kết thúc bằng việc tạo phiếu bảo hành mới ở trạng thái chờ xử lý lưu vào hệ thống.

 

3. DANH SÁCH SƠ BỘ 5–7 USER STORY DỰ KIẾN

·      US1: Là nhân viên tiếp nhận, tôi muốn tra cứu khách hàng qua số điện thoại (hoặc tạo hồ sơ mới nếu chưa có) để không phải hỏi lại thông tin của khách đã từng mua hàng tại hệ thống).

·      US2: Là nhân viên tiếp nhận, tôi muốn nhập số Serial/IMEI để tra cứu thông tin thiết bị và tự động kiểm tra thời hạn bảo hành để xác định đúng điều kiện bảo hành miễn phí hay tính phí trước khi nhận máy.

·      US3: Là nhân viên tiếp nhận, tôi muốn ghi nhận mô tả lỗi khách kể, phụ kiện đi kèm và tình trạng ngoại quan để tạo phiếu bảo hành mới có mã hiển thị duy nhất

·      US4: Là nhân viên tiếp nhận, tôi muốn chọn nhóm sự cố chuẩn hóa (màn hình, pin, sạc, phần mềm, nước vào, khác) để hệ thống tự động đề xuất mức ưu tiên mặc định tương ứng.

·      US5: Là nhân viên tiếp nhận, tôi muốn hệ thống tự động tính toán hạn cam kết trả máy (due_date) dựa trên mức ưu tiên và ngày làm việc thực tế để hẹn thời gian chính xác cho khách hàng.

 

4. DỮ LIỆU SẼ LÀM VIỆC

 

[ ] Sinh mô phỏng  [ X] Dùng dữ liệu mẫu của case study

 

Ước lượng số bản ghi cần thiết: Trích mẫu khoảng 50 – 100 bản ghi ticket, 100 – 200 bản ghi ticket_status_log, 30 – 50 bản ghi customer, cùng toàn bộ danh mục gồm 6 trung tâm (service_centers) và 6 nhóm sự cố (issue_categories)

 

5. CÔNG NGHỆ DỰ KIẾN

 

(Ngôn ngữ / framework / CSDL hoặc công cụ chính)

 

Ngôn ngữ: JavaScript

Framework: Express.js (Backend), React (Frontend)

CSDL: MongoDB
