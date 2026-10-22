# AI Disclosure

## Bảng khai báo sử dụng công cụ AI

| Công cụ | Dùng vào việc gì | Áp dụng ở phần nào | Đã kiểm chứng thế nào |
|---|---|---|---|
| **OpenCode** | Hỗ trợ soạn khung mã, rà soát quy tắc nghiệp vụ QT-01…QT-15, gợi ý test case, rà soát tài liệu và cách diễn đạt. Không dùng để thay thế việc đọc hiểu SRS hay tự quyết định nghiệp vụ. | Backend ba lớp `routes → services → repositories`; 6 Mongoose schema; migration/seed; giao diện React; bộ test; README và các tài liệu trong `docs/`. | Đọc lại toàn bộ diff; đối chiếu từng quy tắc với SRS và case study; chạy `npm test` độc lập với MongoDB; chạy migration/seed hai lần để kiểm tra tính idempotent; gọi thử API và thao tác trên giao diện; chỉ giữ nội dung đã hiểu và kiểm chứng. |

### Xác nhận

Tôi xác nhận đã đọc, hiểu và chịu trách nhiệm về toàn bộ nội dung nộp. Các phần do OpenCode gợi ý đều đã được kiểm tra lại bằng mã nguồn, test và thao tác thực tế trước khi đưa vào bài.

**Nguyễn Duy Khang**  
**MSSV:** 2374802010212  
**Ngày:** 21/10/2026
