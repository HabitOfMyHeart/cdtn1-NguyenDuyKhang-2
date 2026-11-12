# AI Disclosure Bài tập 1

## Bảng khai báo sử dụng công cụ AI

| Công cụ | Dùng vào việc gì | Áp dụng ở phần nào | Đã kiểm chứng thế nào |
|---|---|---|---|
| **ChatGPT/Gemini** | Gợi ý cách tổ chức bảng cho mô hình dữ liệu; gợi ý cấu trúc 6 mục của bản SRS rút gọn; gợi ý cách đặt ngưỡng đo được cho NFR. | Mục 1 (soạn bảng); Mục 3 (lập luận); Mục 4 (ERD, DDL skeleton) | Đối chiếu từng quy tắc QT với Bảng 9.1 của case study; tự kiểm tra mỗi NFR có ngưỡng số; tự kiểm tra 3NF và các ràng buộc duy nhất; đọc lại toàn bộ văn bản và viết lại bằng ngôn ngữ của mình. |
| **Không sử dụng AI** | Phân tích phạm vi, đặc tả use case, vẽ sơ đồ use case bằng draw.io, vẽ wireframe và lập bảng truy vết. | Mục 1.2; Mục 2; Mục 5 | Không áp dụng. |
# AI Disclosure – Bài tập 2

## Bảng khai báo sử dụng công cụ AI

| Công cụ | Dùng vào việc gì | Áp dụng ở tệp / hàm nào | Em đã kiểm chứng thế nào |
|---|---|---|---|
| **OpenCode** | Rà soát và sửa ranh giới tiếp nhận, quy tắc ưu tiên và lịch Việt Nam. | `src/services/ticket.service.js`: `createTicket`, `updateTicket`, `previewDueDate`; `src/services/slaCalculator.service.js`; `src/services/warrantyCheck.service.js`. | Chạy `tests/ticket.service.test.js`, `tests/priority-regression.test.js`, `tests/business-integrity.test.js`. Test lỗi xóa lý do ưu tiên đã FAIL trước khi sửa và PASS sau khi sửa (BUG-001). Kiểm tra thủ công công thức 24/72/120 giờ, bỏ Chủ Nhật và múi giờ `Asia/Ho_Chi_Minh`. |
| **OpenCode** | Tách client, xử lý phiên, timeout và trạng thái form; che SĐT hồ sơ và không suy diễn SLA 100% khi thiếu dữ liệu. | `src/api/client.js`, `src/api/ticket.api.js`, `src/public/apiClient.js`, `src/public/app.js`. | Chạy test transport/UI. Ngày 28/10/2026 chạy luồng UI thật trên MongoDB tạm riêng: tạo `BH-007325/2026` ở MOI, một log, reload vẫn thấy; dừng Express và Retry thật, hai loại rỗng thật, loading bằng độ trễ mạng 1800ms. Ảnh 01–07 mới không dùng thanh mô phỏng. Log: `docs/evidence/final/current-ui-e2e.json`. |
| **OpenCode** | Rà soát xử lý lỗi, requestId, log, xác thực và cấu hình. | `src/services/errors.js`, `src/middlewares/`, `src/config/`, `src/logger.js`, `src/server.js`. | Chạy `tests/infrastructure-*.test.js` và toàn bộ `npm test` ngày 28/10/2026: 121 test, 120 PASS, 0 FAIL, 1 SKIP có lý do. HTTP thật trả 409 cho sửa/xóa phiếu sau MOI, 422 cho ngày/kiểu sai; log tại `docs/evidence/final/current-api-check.json`. |
| **OpenCode** | Chọn mẫu case study và thiết kế seed thận trọng. | `scripts/extract_l2_dataset.py`, `data/sample/`, `seeds/seed_l2_data.js`. | Chạy `tests/dataset-scope.test.js` với `DATASET_SOURCE`: 4/4 PASS. Đối chiếu CSV nguồn: 50 phiếu, 192 log, 34 khách, 50 thiết bị, 6 trung tâm, 6 nhóm. Trên CSDL chính đã sao lưu tại `C:\Users\ACER\AppData\Local\Temp\opencode\mekong_warranty-backup-20261027`, chạy `--add-safe --confirm-add-safe`: chèn 4 khách, 20 thiết bị, 20 phiếu, 85 log; đối soát 0 bản ghi cũ bị đổi hoặc thiếu. Đã chạy migration và seed hai lần trên CSDL tạm sạch: lần đầu 34 khách/50 thiết bị/50 phiếu/192 log, lần hai không đổi và 0 trùng khóa; log tại `docs/evidence/final/clean-seed-check.txt`. |
| **OpenCode** | Rà soát và cập nhật tài liệu, nhãn minh chứng lịch sử. | `README.md`, `docs/api-contract.md`, `docs/thay-doi-thiet-ke.md`, `docs/architecture-thuc-te.drawio`, `docs/bug-log.md`, `docs/kiem-chung-csdl.md`. | Đối chiếu phiếu phạm vi, BT1, mã nguồn, log test và ảnh chụp. Tự đọc lại từng mục; các số liệu trong báo cáo lấy từ log và CSDL, không lấy từ ảnh cũ. |
| **OpenCode** | Sửa ranh giới API, validation kiểu/ngày và dọn hàm không dùng; đồng bộ báo cáo BT2. | `src/services/ticket.service.js`, `src/repositories/ticket.repository.js`, `src/validators/primitives.js`, validator/service khách và thiết bị; `tests/intake-boundary.test.js`; PDF BT2. | Năm test mới FAIL trước sửa, sau sửa PASS; thêm test trạng thái thay đổi đồng thời và HTTP thật. Chạy migration/seed hai lần trên MongoDB tạm 27018, 34/50/50/192 không đổi, 0 trùng khóa. Không ghi CSDL chính; không clone/commit/push/tag hay làm peer review thay người nộp. |

### Xác nhận

Các lần chạy tự động nêu trên do OpenCode thực hiện và có log đi kèm. **Người nộp cần tự đọc, hiểu mã và chạy lại để xác nhận trước khi nộp**; bảng này không thay thế xác nhận của người nộp, clone bản cuối hoặc peer review thật. Hai bộ `BT1-PDF/NFR1–5` và `SRS/NFR1–3` được phân biệt theo nguồn; giới hạn QT-14 và phần phê duyệt QT-05 chưa hiện thực được ghi trong `README.md`, `docs/kiem-tra-bt2.md`, TD-05/TD-06 của `docs/thay-doi-thiet-ke.md` và báo cáo Word. Việc làm rõ tài liệu không thay thế số đo NFR hoặc phê duyệt của giảng viên; không sửa SRS hay mã nguồn trong đợt chỉnh tài liệu này.

**Nguyễn Duy Khang**  
**MSSV:** 2374802010212  
**Ngày cập nhật:** 28/10/2026

## AI Disclosure — Bài tập 3 (toàn bộ giai đoạn 3)

Phiên làm việc được khai báo dưới đây dùng **OpenCode** (model DeepSeek V4.1
Flash Free). Bảng chỉ ghi những việc agent thực sự làm và những kiểm tra thực sự
đã chạy; không khai thay phần người nộp tự làm.

| Công cụ | Dùng vào việc gì | Áp dụng ở tệp / hàm nào | Đã kiểm chứng thế nào |
|---|---|---|---|
| OpenCode | Đóng gói Docker hai lệnh, bootstrap một lần, chặn chạy smoke ngoài container. | `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `docker/start-demo.js` (`initializeDemo`), `docker/smoke-guard.js`, `tests/docker-startup.test.js`, `tests/docker-smoke.js`. | 8 test bootstrap PASS; live smoke 8/8 PASS trong container, tạo và đọc lại phiếu `TCK0032`; compose exit `0`, app và db `healthy`; log trong `docs/evidence/bt3/`. Người nộp cần tự chạy lại. |
| OpenCode | Viết Deployment Guide, checklist bảo mật 7 mục và README hai lệnh. | `docs/deployment-guide.md`, `docs/checklist-bao-mat.md`, `README.md`. | Đối chiếu `Dockerfile`, `docker-compose.yml`, `.env.example`, `.gitignore`; chạy `npm audit` thấy 2 cảnh báo High; kiểm container non-root/read-only/`cap_drop: ALL`; ghi rõ mục 3, 4, 7 là **CHƯA LÀM**. Không tuyên bố deploy Render/Atlas. |
| OpenCode | Đồng bộ Test Plan, Test Report, Bug Log và ánh xạ ảnh minh chứng. | `docs/test-plan.md`, `docs/test-report.md`, `docs/bug-log.md`, `docs/screenshots/buoi14/`, `docs/evidence/bt3/`. | Chạy `npm test`: 130 test, 129 PASS, 0 FAIL, 1 SKIP; đối chiếu 12 test case đủ 8 cột và 12 ảnh TC-01 → TC-12 có sẵn; kiểm 5 bug đủ 7 mục và link commit; coverage 77,56% dòng / 79,08% nhánh / 67,66% hàm. Không tạo ảnh hay bug mới. |
| OpenCode | Chuyển collection Postman của người nộp vào repo, nhúng 25 response thật, viết README và environment. | `docs/api-docs/Smart-CRM-Mekong-Mobile-API-BT3.postman_collection.json`, `docs/api-docs/bt3-local.postman_environment.json`, `docs/api-docs/README.md`, `docs/api-docs/verification.json`. | Collection gốc và 25 response thật do người nộp cung cấp ngoài repo; agent chỉ tạo bản sao, không sửa file gốc. Kiểm JSON parse, 25 request / 23 endpoint, 25/25 request đủ 7 mục, 25 example nhúng, 0 ký tự tiếng Việt trong mô tả, không có JWT, secret rỗng. Collection chưa chạy end-to-end một lần; README ghi rõ. |
| OpenCode | Chạy clone sạch từ `main` đã push và ghi minh chứng hai lệnh. | `docs/evidence/bt3/clean-clone/`, `docs/deployment-guide.md`, `docs/checklist-bao-mat.md`. | Clone `origin/main` tại `7d51189`, đúng hai lệnh; compose exit `0`; app và db `healthy`; health HTTP `200`; seed 34/50/50/192/6/6; test trong container 130/129/0/1. Đây không phải clone từ tag `v1.0`. |
| OpenCode | Rà soát và cập nhật chính bảng khai báo AI cho giai đoạn 3. | `docs/ai-disclosure.md`. | Đối chiếu lại commit, tệp, log và số liệu trong bảng; không khai các mục chưa làm. Người nộp đọc lại và sửa nếu phần tự làm khác. |

### Xác nhận

Các lần chạy tự động trong bảng do OpenCode thực hiện và có log/tệp kèm theo.
**Người nộp phải tự đọc, hiểu và chạy lại trước khi nộp**; bảng này không thay
thế xác nhận của người nộp, peer review hay kiểm tra của giảng viên. Các mục
checklist bảo mật 3, 4, 7 vẫn là **CHƯA LÀM**; không có deploy Render/Atlas hay
URL công khai.

**Nguyễn Duy Khang**

**MSSV:** 2374802010212

**Ngày cập nhật:** 12/11/2026
