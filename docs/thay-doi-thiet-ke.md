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

## Đối chiếu triển khai hiện tại với Bài tập 1

Các mục TD-01…TD-04 ở trên là ghi nhận lịch sử phản hồi; phần dưới mô tả giới hạn triển khai hiện tại, không sửa hay thay thế SRS Bài tập 1.

| Khác biệt cụ thể | Vì sao | Ảnh hưởng |
|---|---|---|
| Luồng nhân viên kết thúc khi tạo `MOI`; API không đăng ký route chuyển trạng thái, chi tiết trả `trangThaiKeTiep: []`. | Khoanh phạm vi L2 vào tiếp nhận. | Các trạng thái và log sau tiếp nhận chỉ để đọc, không thể thao tác chuyển từ UI/API này. |
| Chỉ hỗ trợ `NHAN_VIEN` theo trung tâm, không có vai trò quản lý. | Phù hợp phạm vi nhân viên tiếp nhận. | Không có góc nhìn hoặc thao tác của quản lý; token vai trò khác bị từ chối. |
| Mẫu hiện tại trích 50 phiếu cùng 192 log nguồn thay mẫu cũ 30/99; ngày mua thiết bị để `null` khi nguồn thiếu. | Giữ dấu vết nguồn và tránh tự tạo ngày mua hoặc lịch sử. | Kết quả seed, ID và dữ liệu có thể khác ví dụ cũ; lịch sử cũ không chứng minh mẫu hiện tại. |
| `docs/srs.md` NFR2 ghi tối thiểu 100 phiếu/200 log; mẫu hiện tại có 50 phiếu/192 log (CSDL chính 50/188). Đây không phải NFR2 về thời gian lưu trong PDF BT1. | Phiếu phạm vi L2 chốt 50–100 phiếu, 100–200 log; giữ đúng mẫu nguồn, không tự sinh thêm. | Mẫu chưa đủ ngưỡng dữ liệu của SRS; không dùng số lượng mẫu để kết luận về hiệu năng trong PDF BT1. Xem bảng đối chiếu NFR bên dưới. |
| UI dùng facade, transport chung và module API phiếu riêng. | Tách xử lý HTTP/JWT khỏi giao diện. | Các module được phục vụ qua `/assets/api`, backend vẫn chia routes/services/repositories. |
| Seed chỉ thêm dữ liệu trên đích trống hoặc đã khớp mẫu; chế độ `--add-safe --confirm-add-safe` chỉ chèn phần nguồn không xung đột, không cập nhật các bản ghi sẵn có. | Tránh ghi đè dữ liệu đang sử dụng khi tái dựng. | CSDL chính đã được sao lưu và bổ sung 4 khách, 20 thiết bị, 20 phiếu, 85 log; 51 bản ghi cũ khác nguồn vẫn giữ nguyên, nên tổng số đạt phạm vi nhưng không phải bản sao nguyên gốc. Migration và seed đã chạy hai lần trên CSDL tạm sạch, không nhân đôi; log tại `docs/evidence/final/clean-seed-check.txt`. |
| Khóa nghiệp vụ dạng chuỗi `CUS0001`, `DEV0001`, `TCK0001`, `LOG0001` được dùng làm định danh tra cứu; Mongoose vẫn sinh thêm `_id` ObjectId. | Mã nghiệp vụ ổn định giúp đối chiếu dữ liệu nguồn, seed và URL/API không phụ thuộc ObjectId. | Các trường `customer_id`, `device_id`, `ticket_id`, `log_id` là duy nhất; quan hệ tham chiếu bằng chuỗi; API dùng mã nghiệp vụ trong `:id`. |
| Thêm `product_id`, `product_code` vào `device`; thêm `priority_reason` vào `ticket`; thêm `center_code`, `is_active` vào danh mục. | Lưu mã sản phẩm nguồn, lý do đổi mức ưu tiên và trạng thái danh mục phục vụ tra cứu/hiển thị. | Schema có thêm trường ngoài DDL Bài tập 1; seed và API trả các trường này khi có. |
| Thêm cờ `is_deleted` cho `customer`, `device`, `ticket`. | Xóa mềm để không phá tham chiếu lịch sử. | API DELETE đặt cờ thay vì xóa vật lý; truy vấn mặc định loại bản ghi đã xóa; unique index mở phiếu dùng `is_deleted: false`. |
| Không có trạng thái `DA_HUY` trong enum trạng thái. | Luồng L2 kết thúc ở `MOI`; không có API hủy phiếu và mẫu nguồn không có `DA_HUY`. | Enum chỉ gồm các trạng thái cần đọc/ghi trong phạm vi; nếu mở rộng hủy phiếu phải bổ sung trạng thái, API và test tương ứng. |
| `docs/srs.md` NFR3 yêu cầu tối thiểu 50 khách; seed có 34 khách, CSDL chính có 35. NFR1 của SRS yêu cầu nhân viên mới tạo phiếu dưới 3 phút nhưng chưa đo với người thật. | Giữ mẫu 30–50 khách theo phiếu phạm vi; test tự động không thay phép đo khả dụng. | Chưa đủ minh chứng cho các ngưỡng SRS; không đồng nhất với NFR1/NFR3 của PDF BT1, không sinh khách giả hoặc sửa SRS để che khác biệt. |
| CRUD phiếu chỉ sửa/xóa mềm khi trạng thái còn `MOI`; mọi trạng thái sau đó chỉ đọc. | Ngăn API vượt ranh giới tiếp nhận và ngăn xóa phiếu đang xử lý để mở lại thiết bị. | Service trả lỗi nghiệp vụ `PHIEU_CHI_DOC`; repository kiểm tra `status: MOI` ngay trong điều kiện ghi để tránh thay đổi đồng thời. |
| QT-14: bản BT2 giới hạn phiếu theo trung tâm của token; hồ sơ khách/thiết bị dùng chung, gồm API tra cứu và CRUD hỗ trợ. | Mô hình hiện tại chưa có trung tâm sở hữu hồ sơ; không tự gán quyền sở hữu từ một phiếu lịch sử. | Chỉ đáp ứng một phần QT-14; đăng nhập không thay thế phân quyền hồ sơ. Đây là giới hạn prototype, không phải chính sách đã được giảng viên phê duyệt. Chưa dùng để vận hành dữ liệu thật đa trung tâm. |
| QT-05: thiếu ngày mua vẫn cho tạo phiếu `MOI` với `is_warranty = null`, view `conBaoHanh = null` và kết luận “Chưa xác minh bảo hành”. | L2 chỉ tiếp nhận; không có vai trò, endpoint hay quy trình quản lý phê duyệt. Không bịa ngày mua hoặc tự suy diễn bảo hành. | Việc tạo phiếu không xác nhận đủ điều kiện bảo hành miễn phí và không thay thế phê duyệt. Phần phê duyệt trong case study/BT1/SRS chưa hiện thực; không tuyên bố đáp ứng trọn QT-05. `true`/`false` của phiếu lịch sử giữ theo nguồn, không phải bằng chứng phê duyệt trong prototype. |
| Kết quả tra cứu hồ sơ trên UI che SĐT như view phiếu; ô nhập giữ số nhân viên nhập. Validator dùng chung kiểm tra kiểu dữ liệu và ngày lịch có thật. | Khắc phục hiển thị SĐT đầy đủ và việc JavaScript tự chuẩn hóa ngày sai/ép object thành mô tả. | `src/public/app.js`, `src/validators/primitives.js`, các service; thêm test hồi quy và test HTTP trả lỗi rõ trường. |
| Thanh mô phỏng UI chuyển vào mục thu gọn; ảnh minh chứng cuối thay bằng request thật, lỗi thật và dữ liệu rỗng thật trên MongoDB tạm riêng. | Tránh nhầm ảnh mô phỏng với sự cố thực tế. | Minh chứng mới tại `docs/screenshots/final/` và `docs/evidence/final/current-ui-e2e.json`; không ghi CSDL chính. |

### TD-05 — Làm rõ hai bộ NFR giữa PDF BT1 và SRS

- **Thay đổi gì:** ghi riêng hai nguồn yêu cầu đang không thống nhất. Dùng `File source/BT1_2374802010212_NguyenDuyKhang.pdf`, Mục 1.4, Bảng 5 (trang PDF 6, số trang in 4) để đối chiếu BT2 với bản BT1 được cung cấp; giữ nguyên `docs/srs.md`, Mục 4 để truy vết yêu cầu trong repo. Các nhãn `BT1-PDF/NFRx` và `SRS/NFRx` dưới đây chỉ phân biệt nguồn trong tài liệu BT2, không đổi mã yêu cầu gốc.
- **Vì sao:** PDF BT1 có 5 NFR về hiệu năng, đồng thời, sẵn sàng và tính đúng đắn; SRS có 3 NFR về khả dụng và quy mô mẫu. Trùng mã NFR1–3 không có nghĩa là cùng nội dung. Không có bằng chứng cho phép tự bỏ, thay thế hoặc coi một bộ đã được phê duyệt thay cho bộ kia.
- **Ảnh hưởng:** sửa cách diễn đạt trong báo cáo Word, README và checklist; công khai cả hai bộ cùng mức kiểm chứng thực tế. Không sửa PDF BT1/SRS, không thay mã nguồn, không tạo số đo hay tự công bố đạt NFR. Tối ưu/kiểm tải đầy đủ không phải yêu cầu tối thiểu BT2, nhưng các cam kết BT1 vẫn phải được truy vết.

| Nguồn / mã | Yêu cầu gốc | Mức kiểm chứng trong BT2 |
|---|---|---|
| BT1-PDF/NFR1 | Tra cứu SĐT/serial ở P95 ≤2 giây với 10.000 bản ghi. | Chưa đo P95 trên quy mô này; thời gian unit test/E2E không thay thế phép đo. |
| BT1-PDF/NFR2 | Lưu phiếu (sinh mã, tính hạn, ghi log) ≤3 giây cho ≥95% số lần lưu. | Đã có test và E2E chức năng, chưa có thống kê đủ lần lưu để xác nhận ngưỡng. |
| BT1-PDF/NFR3 | 50 người dùng đồng thời tại 6 trung tâm; tỷ lệ lỗi <1%, không thấp hơn ngưỡng NFR1/2. | Chưa kiểm tải đồng thời; có đủ 6 trung tâm không chứng minh đáp ứng 50 người dùng. |
| BT1-PDF/NFR4 | Sẵn sàng ≥99% theo tháng trong giờ 8h–17h, thứ Hai–thứ Bảy. | Có health/readiness và xử lý lỗi; chưa có theo dõi uptime theo tháng. |
| BT1-PDF/NFR5 | 100% phiếu đúng `due_date` theo QT-04 và mã duy nhất; 0 trùng. | Test SLA/mã phiếu và đối soát seed hỗ trợ tính đúng đắn trong các trường hợp đã kiểm; chưa đủ để khẳng định 100% trong mọi tình huống vận hành. |
| SRS/NFR1 | Nhân viên mới tạo phiếu đúng trong <3 phút, không hỏi đồng nghiệp. | Chưa đo với người thật; automation không thay thế phép đo khả dụng. |
| SRS/NFR2 | Tối thiểu 100 phiếu và 200 log. | Seed sạch 50 phiếu/192 log: chưa đủ ngưỡng mẫu để kiểm chứng yêu cầu này, không kết luận hệ thống không thể xử lý quy mô đó. |
| SRS/NFR3 | Tối thiểu 50 khách, đủ 6 trung tâm và 6 nhóm. | Seed sạch 34 khách/6 trung tâm/6 nhóm: đủ danh mục, chưa đủ số khách để kiểm chứng yêu cầu này. |

### TD-06 — Chốt giới hạn QT-14 và QT-05 của bản BT2

- **Thay đổi gì:** mô tả đúng hành vi hiện tại: phiếu bị giới hạn theo trung tâm, khách/thiết bị dùng chung; thiếu ngày mua vẫn tiếp nhận `MOI` với bảo hành `null`, không có bước duyệt. Không thêm chức năng ngoài L2.
- **Vì sao:** tránh hiểu nhầm hồ sơ dùng chung đã tuân thủ QT-14, hoặc tạo phiếu `MOI` là quản lý đã duyệt QT-05. Case study yêu cầu giới hạn dữ liệu theo đơn vị và phê duyệt khi chưa xác minh; hai phần này chưa được hiện thực đầy đủ.
- **Ảnh hưởng:** thống nhất báo cáo, README, hợp đồng API và checklist. Giữ trạng thái **đáp ứng một phần** cho QT-14/QT-05; cần giảng viên xác nhận chấp nhận giới hạn hoặc yêu cầu mở rộng. Ghi nhận sai lệch không tự biến phần thiếu thành đạt; prototype chưa phù hợp vận hành thật đa trung tâm hay quyết định bảo hành miễn phí.

### Dọn mã không còn dùng (28/10/2026)

Bỏ `findOrCreateByPhone`, `describeSla`, `getCenter` và hàm `updateCustomer` trong facade UI vì không có nơi gọi; API CRUD khách hàng vẫn giữ. Giữ `products.json` vì test còn sử dụng, giữ hồ sơ Buổi 10 và sơ đồ/DDL BT1 để truy vết. Giữ `trangThaiKeTiep: []` để tương thích hợp đồng chi tiết, không mở chức năng chuyển trạng thái.
