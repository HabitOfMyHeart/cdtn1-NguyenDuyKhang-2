# Nhật ký thay đổi thiết kế

**Sinh viên:** Nguyễn Duy Khang – MSSV 2374802010212  
**Môn:** Chuyên đề tốt nghiệp 1 – Track SE, Luồng L2  
**Mốc phản hồi:** Sau Bài tập 1 (Buổi 8, ngày 15/10/2026)

Mỗi mục dưới đây ghi lại một phản hồi của giảng viên theo bốn phần: phản hồi, quyết định, lý do và ảnh hưởng. Các thay đổi đã được áp dụng trực tiếp vào kho mã nguồn của Bài tập 2.

---

## TD-01 — Xóa dứt điểm dấu vết bản nháp trong SQL DDL

- **Phản hồi của GV:** DDL ở Mục 4 còn sót 5 dòng giữ chỗ của bản nháp; đây là dấu vết chưa hoàn thiện, phải xóa trước khi nộp.
- **Quyết định:** SỬA.
- **Lý do:** Khung DDL quan hệ 3NF là nguồn tham chiếu để viết 6 Mongoose schema ở Bài tập 2. Giữ ký tự giữ chỗ sẽ khiến tài liệu và mã nguồn không còn là bản hoàn chỉnh, đồng thời gây khó hiểu khi đối chiếu ràng buộc.
- **Ảnh hưởng:** `db/schema.sql` đã được rà soát toàn bộ, chỉ còn 6 bảng nghiệp vụ, khóa chính/khóa ngoại, CHECK constraint và index; không còn dòng giữ chỗ. `docs/srs.md` được giữ nguyên nội dung đã duyệt.

---

## TD-02 — Sửa lỗi hiển thị Actor trên Use Case và thẻ HTML trên ERD

- **Phản hồi của GV:** Hình Use Case chỉ hiện một chấm tròn, không thấy hình người và nhãn “Nhân viên tiếp nhận”; Hình ERD hiện lẫn thẻ `<b>…</b>` và ký tự `&....` khi xuất PDF. Cần xuất ảnh lại và kiểm tra trên bản in.
- **Quyết định:** SỬA.
- **Lý do:** Sơ đồ phải biểu diễn đúng ký pháp UML/ERD và không được lộ mã đánh dấu thô khi xuất sang PDF. Nhãn tiếng Việt cần hiển thị đầy đủ để người đọc không phải suy đoán.
- **Ảnh hưởng:** Viết lại `docs/Usecase.drawio` với `shape=umlActor`, nhãn actor rõ ràng và 6 use case; viết lại `docs/erd.drawio` với nhãn thuần văn bản, không dùng thẻ HTML. Cả hai tệp đã được mở lại bằng draw.io và kiểm tra không còn ký tự đánh dấu thô.

---

## TD-03 — Bổ sung `.gitignore`, `api-contract.md` và quy ước commit từ máy

- **Phản hồi của GV:** Repo chỉ có 2 commit “Add files via upload”, thiếu `api-contract.md` và `.gitignore`.
- **Quyết định:** SỬA.
- **Lý do:** Bài nộp cần chứng minh quá trình làm việc qua Git CLI, đồng thời không đưa dữ liệu thô nặng hoặc tệp môi trường lên GitHub. Hợp đồng API là căn cứ để ba lớp routes – services – repositories thống nhất dữ liệu trao đổi.
- **Ảnh hưởng:** Thêm `.gitignore` chặn `dataset/`, `data/raw/`, `*.csv`, `.env` và `node_modules/`; chỉ giữ mẫu nhỏ trong `data/sample/`. Thêm `docs/api-contract.md` mô tả đầy đủ endpoint, mã lỗi, hợp đồng 14 khóa và vòng đời trạng thái. Các commit được tạo tuần tự từ máy bằng Git CLI, không dùng thao tác upload trực tiếp.

---

## TD-04 — Chuẩn hóa lỗi chính tả và tên trạng thái trong tài liệu

- **Phản hồi của GV:** SRS còn một số lỗi chính tả và tên trạng thái chưa thống nhất; cần sửa chính tả và dùng cùng một bộ mã trạng thái trong toàn bộ hồ sơ.
- **Quyết định:** SỬA.
- **Lý do:** Từ ngữ và mã trạng thái nhất quán giúp SRS, hợp đồng API, schema và giao diện cùng diễn đạt một quy tắc nghiệp vụ, tránh lỗi khi đối chiếu QT-06.
- **Ảnh hưởng:** Chuẩn hóa thành “dữ liệu”, “tách”, “tách riêng”, “luồng” và bộ trạng thái `MOI`, `DA_PHAN_CONG`, `DANG_XU_LY`, `CHO_LINH_KIEN`, `HOAN_TAT`, `DA_DONG` trong `docs/srs.md`, `docs/api-contract.md`, `src/models/schemas.js` và giao diện.
