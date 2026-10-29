# Kiểm chứng dữ liệu cuối – CSDL `mekong_warranty`

**Ngày kiểm chứng:** 27/10/2026  
**Người thực hiện:** Nguyễn Duy Khang – MSSV 2374802010212  
**Môi trường:** Windows, Node.js v24.21.0, npm 11.19.0, MongoDB Server 9.0.2  
**Phạm vi:** bổ sung dữ liệu case study vào CSDL chính, không cập nhật hoặc xóa bản ghi cũ.

## 1. Trạng thái trước khi ghi

| Collection | Số bản ghi |
|---|---:|
| `customer` | 31 |
| `device` | 30 |
| `ticket` | 30 |
| `ticket_status_log` | 103 |
| `service_center` | 6 |
| `issue_category` | 6 |

Kế hoạch `--plan-safe` xác định **51 bản ghi cũ khác nguồn** (24 thiết bị và 27 phiếu), chủ yếu ở `purchase_date`, `due_date`, `is_warranty` và `status`. Các bản ghi này được giữ nguyên. Kế hoạch đề xuất bổ sung 4 khách, 20 thiết bị, 20 phiếu và 85 log nguồn không xung đột.

## 2. Sao lưu trước khi ghi

Toàn bộ 6 collection được xuất bằng EJSON, kèm `manifest.json` ghi thời điểm và số bản ghi:

`C:\Users\ACER\AppData\Local\Temp\opencode\mekong_warranty-backup-20261027`

Bản sao lưu nằm ngoài repository và không được commit. Không có thông tin khách hàng nào được đưa vào tài liệu này.

## 3. Lệnh đã chạy

```powershell
node seeds/seed_l2_data.js --plan-safe
node seeds/seed_l2_data.js --add-safe
node seeds/seed_l2_data.js --add-safe --confirm-add-safe
```

- Lần chạy `--add-safe` không kèm xác nhận đã dừng trước khi kết nối và không ghi dữ liệu.
- Lần chạy có xác nhận chỉ chèn phần không xung đột, không cập nhật hoặc xóa bản ghi cũ.
- Kết quả ghi: `customers=4`, `devices=20`, `tickets=20`, `status_logs=85`.

## 4. Trạng thái sau khi ghi

| Collection | Trước | Chèn thêm | Sau |
|---|---:|---:|---:|
| `customer` | 31 | 4 | 35 |
| `device` | 30 | 20 | 50 |
| `ticket` | 30 | 20 | 50 |
| `ticket_status_log` | 103 | 85 | 188 |
| `service_center` | 6 | 0 | 6 |
| `issue_category` | 6 | 0 | 6 |

Tổng số phiếu, log và khách hàng nằm trong khoảng phiếu phạm vi (50–100 phiếu, 100–200 log, 30–50 khách hàng); danh mục có đủ 6 trung tâm và 6 nhóm sự cố.

## 5. Đối soát sau khi ghi

Mỗi bản ghi cũ được băm SHA-256 từ EJSON trước khi ghi và so lại sau khi ghi:

| Kiểm tra | Kết quả |
|---|---:|
| Bản ghi cũ bị thiếu | 0 |
| Bản ghi cũ bị thay đổi | 0 |
| Phiếu nguồn mới (`SRC-TCK-*`) | 20 |
| Log nguồn mới (`SRC-LOG-*`) | 85 |
| Log mới mồ côi (không có phiếu cha) | 0 |
| Thiết bị có từ hai phiếu mở trở lên | 0 |

Trạng thái của 20 phiếu nguồn mới được giữ theo dữ liệu nguồn: 6 `DA_PHAN_CONG`, 1 `HOAN_TAT`, 13 `DA_DONG`. Đây là lịch sử case study, không phải phiếu do luồng tiếp nhận mới tạo; phiếu tạo từ luồng hiện tại vẫn bắt đầu ở `MOI`.

## 6. Kiểm tra E2E chỉ đọc sau khi ghi

Server được khởi động tạm trên cổng ngẫu nhiên, kết nối CSDL chính; không tạo phiếu mới.

| Kiểm tra | Kết quả |
|---|---|
| `GET /health` | 200 |
| Đăng nhập nhân viên trung tâm 1 | 200 |
| `GET /api/tickets` bằng token nhân viên | 200, thấy 9 phiếu thuộc trung tâm 1 |
| Mã phiếu mẫu trong danh sách | `BH-000004/2024`, `BH-006278/2024`, `BH-000022/2025` |

## 7. Kiểm chứng migration và seed trên CSDL tạm sạch

Ngày 27/10/2026, một MongoDB tạm được khởi động tại `127.0.0.1:27018` với thư mục dữ liệu riêng trong `%TEMP%\opencode\bt2-clean-db`, CSDL `mekong_warranty_bt2_check`. CSDL chính `mekong_warranty` không được kết nối trong đợt này.

| Bước | Kết quả |
|---|---|
| `npm run db:migrate` lần 1 | Tạo 6 collection, đồng bộ index, tất cả 0 bản ghi |
| `npm run db:seed` lần 1 | Nạp mẫu vào CSDL trống |
| Đếm sau lần 1 | 34 khách, 50 thiết bị, 50 phiếu, 192 log, 6 trung tâm, 6 nhóm |
| `npm run db:migrate` lần 2 | 6 collection đã tồn tại; index đồng bộ; số bản ghi không đổi |
| `npm run db:seed` lần 2 | Không chèn thêm; số bản ghi không đổi |
| Đếm sau lần 2 | 34 khách, 50 thiết bị, 50 phiếu, 192 log, 6 trung tâm, 6 nhóm |
| Trùng khóa sau lần 2 | 0 SĐT, 0 serial, 0 mã phiếu, 0 `log_id` |

Log đầy đủ: [`docs/evidence/final/clean-seed-check.txt`](evidence/final/clean-seed-check.txt). Sau khi đếm, CSDL tạm được xóa; MongoDB tạm dừng và thư mục dữ liệu tạm được dọn. Đây là kiểm chứng trên đích sạch, không phải thao tác trên CSDL chính.

## 8. Giới hạn

- 51 bản ghi cũ trong CSDL chính vẫn khác dữ liệu nguồn và được giữ nguyên; vì vậy **tổng số đạt phạm vi nhưng CSDL chính không phải bản sao nguyên gốc của case study**. CSDL tạm sạch thì khớp đúng mẫu 50 phiếu/192 log/34 khách/50 thiết bị.
- Ghi nhiều collection không phải transaction. Nếu lỗi giữa chừng, phải đối soát với bản sao lưu trước khi chạy lại.
- Tag `v0.2` và kiểm chứng clone sạch từ remote do người nộp thực hiện; quy trình ở Mục 6 của báo cáo BT2.
- Kết quả test tự động của phiên bản hiện tại được ghi riêng trong `docs/evidence/final/`.

## 9. Tái kiểm chứng sau sửa lỗi BT2 (28/10/2026)

Phiên mới chạy trên MongoDB tạm riêng tại cổng 27018, không kết nối CSDL chính. Migration/seed hai lần cho cùng kết quả 34/50/50/192, không trùng khóa. Luồng UI thật sau đó tạo một phiếu mới ở MOI và một log, thành 51/193; reload vẫn thấy, lỗi kết nối và nút Retry được kiểm tra thật. Một CSDL tạm khác chỉ có danh mục được dùng để chụp trạng thái chưa có phiếu. Cả hai CSDL tạm được dọn sau kiểm chứng.

Log mới: [migration/seed](evidence/final/current-working-tree-check.txt), [UI E2E](evidence/final/current-ui-e2e.json), [API từ chối sửa/xóa sau MOI và dữ liệu sai](evidence/final/current-api-check.json). Đây là working tree hiện tại, không phải clone từ tag hay peer review. Số liệu CSDL chính ở các mục trên là biên bản ngày 27/10, không phải kết quả đọc lại trong phiên này.
