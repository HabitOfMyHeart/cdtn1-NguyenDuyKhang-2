# Test Plan — Buổi 14

**Dự án:** Smart CRM – Mekong Mobile · Track SE · Luồng L2 (tiếp nhận bảo hành)  
**Sinh viên:** Nguyễn Duy Khang · MSSV 2374802010212  
**Ngày lập:** 05/11/2026 · **Cập nhật đóng gói BT3:** 12/11/2026

## 1. Mục tiêu và phạm vi

Kiểm chứng quy tắc tiếp nhận, chất lượng dữ liệu và các lỗi hồi quy bằng bộ test hiện có; ghi nhận kết quả thực tế trong [Test Report](test-report.md).

| Phạm vi | Nội dung |
|---|---|
| QT-01, QT-02 | Chuẩn hóa SĐT, nhận diện hồ sơ, chặn số trùng. |
| QT-03 | Chuẩn hóa serial, chặn serial trùng và phiếu mở thứ hai cho cùng thiết bị. |
| QT-04 | SLA theo ưu tiên CAO/TRUNG_BINH/THAP, bỏ Chủ Nhật, lý do đổi ưu tiên. |
| QT-05 | Bảo hành theo ngày; đúng ngày hết hạn vẫn còn; thiếu ngày mua là `null`. |
| Tiếp nhận L2 | Tạo phiếu MOI, sinh mã, ghi lịch sử; phiếu sau MOI chỉ đọc. |
| QT-14, QT-15 | Phạm vi trung tâm của phiếu; che SĐT hiển thị. |
| Hạ tầng và giao diện | Xác thực, cấu hình, xử lý lỗi, timeout, dữ liệu mẫu, trạng thái giao diện và phản hồi bất đồng bộ. |

**Trong phạm vi 12 TC Buổi 14, không kiểm:** tích hợp đọc/ghi MongoDB thật, E2E trình duyệt thật, tải đồng thời, hiệu năng và luồng xử lý sau tiếp nhận. Test giao diện dùng harness mô phỏng; test HTTP dùng máy chủ loopback và dependency giả lập, không chứng minh tích hợp CSDL. Không suy rộng kết quả QT-14 của phiếu thành bảo đảm phân quyền cho mọi tài nguyên customer/device. Gói Docker BT3 bổ sung live smoke riêng, ghi ở đoạn dưới.

**Bổ sung BT3 (12/11/2026):** gói Docker có live smoke trên MongoDB demo riêng, không dùng CSDL chính. Kết quả và giới hạn nằm trong [Deployment Guide](deployment-guide.md) và `docs/evidence/bt3/`; đây là kiểm chứng đóng gói, không thay đổi phạm vi 12 TC Buổi 14.

## 2. Chiến lược và thiết kế test

- Dùng Node.js Test Runner (`node:test`), assertion và fixture có sẵn; không thêm framework hay đổi mã nguồn nghiệp vụ.
- Phần lớn test là unit/service với repository trong bộ nhớ, helper thuần hoặc dependency giả lập. Có kiểm thử hợp đồng và HTTP thật tại ranh giới Express; không gán nhãn mọi test service là API test.
- Chọn **12 kịch bản báo cáo** từ các test tự động để đọc và đối chiếu; chúng không phải 12 lần test tay mới. TC-05 và TC-06 là hai assertion trên cùng ranh giới ngày trong một test function.
- Nguồn đối chiếu: [SRS](srs.md), [hợp đồng API](api-contract.md), [Bug Log](bug-log.md) và test hồi quy trong `tests/`.

| Loại bắt buộc | Kịch bản đối chiếu |
|---|---|
| Luồng đúng | TC-01 → TC-04: tạo phiếu, SĐT, serial, SLA; TC-07: nhánh chưa xác minh. |
| Biên | TC-05: cuối ngày hết hạn; TC-06: đầu ngày kế tiếp, cùng ranh giới. |
| Dữ liệu sai | TC-10a: mô tả object; TC-10b: ngày không tồn tại; thêm body mảng TC-10c. |
| Bảo mật/chất lượng dữ liệu | TC-08 che SĐT; TC-09 ngăn xem phiếu ngoài trung tâm. |
| Tái lập | TC-12 chạy lại bộ test bằng một lệnh, đối chiếu tổng PASS/FAIL/SKIP. |

TC-11 bảo vệ hồi quy sửa/xóa phiếu sau MOI. Đủ năm loại về **nội dung test tự động**. Ảnh riêng TC-01 → TC-12 đã có trong `docs/screenshots/buoi14/`; xem [Test Report](test-report.md) mục 4.

## 3. Môi trường, dữ liệu và cách thực hiện

- Windows, PowerShell; môi trường kiểm chứng ngày 05/11/2026: Node.js `v24.21.0`, npm `11.19.0`; dự án yêu cầu Node.js >= 20. Lần chạy lại 12/11 dùng cùng phiên bản.
- Phiên bản mã Buổi 14: `8d9d537`; lần chạy lại 12/11: `main` tại `7d51189` (đã gồm đóng gói BT3).
- Dependencies theo `package.json`/lockfile; nếu máy mới đã có lockfile, cài bằng `npm ci`.
- Fixture nghiệp vụ: `tests/helpers/inMemoryRepositories.js`; dữ liệu mẫu tĩnh: `data/sample/`.
- Không chạy migrate/seed trên CSDL chính; không sửa `.env` hoặc JWT secret của ứng dụng. Test HTTP tự cấu hình danh tính/secret chỉ trong tiến trình test.

Tại thư mục gốc dự án:

```powershell
npm test
```

Lệnh tương ứng: `node --test tests/*.test.js`, hiện gồm 14 file test. Xem ánh xạ từng TC và lệnh chạy chọn lọc tại [Test Report](test-report.md).

Test tái trích xuất dữ liệu cần biến `DATASET_SOURCE` trỏ đến file nguồn phù hợp và Python. Nếu thiếu biến này, ghi **SKIP**, không tính PASS. Không đưa đường dẫn nguồn cá nhân hay thông tin bí mật vào minh chứng.

## 4. Tiêu chí đánh giá, minh chứng và bàn giao

- PASS khi assertion thực chạy thành công; FAIL khi kết quả khác mong đợi; SKIP khi chưa thực thi do thiếu điều kiện. Không chuyển SKIP thành PASS.
- Đối chiếu số liệu: `tests = pass + fail + skipped + cancelled` trong lần chạy hiện tại; không đồng nhất tổng test runner với số case trong bảng báo cáo.
- Mục tiêu kỹ thuật: `npm test` exit code 0, không có FAIL; mọi SKIP có lý do. Mục tiêu hoàn chỉnh cần chạy cả test tái trích xuất khi có file nguồn.
- Đã có ảnh riêng TC-01 → TC-12 trong `docs/screenshots/buoi14/`; ảnh `TC-12.png` là lần chạy cũ 121/120, log lần chạy hiện tại nằm trong `docs/evidence/bt3/container-tests.txt`. Một ảnh tổng kết không thay thế ảnh từng case.
- Nếu phát hiện FAIL: giữ bằng chứng, ghi bước tái lập/nguyên nhân/cách sửa trong Bug Log; commit chứa bản sửa phải có link công khai đúng thay đổi. Đề BT3 không yêu cầu mỗi bug một commit riêng.
- CI: **Chưa làm**. Coverage: đã đo ngày 12/11/2026 bằng `node --test --experimental-test-coverage`: 77,56% dòng, 79,08% nhánh, 67,66% hàm; **chưa đạt 80%**, không tuyên bố đạt.
- Đầu ra: Test Plan này và [Test Report](test-report.md); giới hạn minh chứng phải được giữ nguyên khi điền checklist nộp.
