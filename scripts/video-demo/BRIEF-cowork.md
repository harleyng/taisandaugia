# Yêu cầu: dựng video demo tính năng "Kế hoạch đấu giá"

Chào bạn — mình cần dựng một video demo sản phẩm, có phụ đề tiếng Việt và nhạc nền. Toàn bộ yêu cầu, kịch bản phụ đề và quy ước trình bày nằm ngay dưới đây; **ảnh chụp màn hình và tệp nhạc mình gửi kèm trong hội thoại này**.

Mong bạn: đọc hết yêu cầu, nói lại cho mình **kế hoạch dựng** (thứ tự cảnh, thời lượng, cách nhấn mạnh) để mình chốt trước, rồi hãy dựng. Nếu thiếu ảnh cho cảnh nào thì liệt kê ra cho mình chụp thêm, **đừng tự vẽ hay tự thay bằng ảnh minh hoạ**.

---

## 1. Cần gì

Một video `.mp4` khoảng **98 giây** (~1 phút 40), **1920×1080, 30fps**, giới thiệu tính năng **"Kế hoạch đấu giá"** của sàn Tài Sản Đấu Giá:

- **Phụ đề tiếng Việt nung vào hình** (không phải tệp phụ đề rời), chữ trắng trên dải nền tối bo góc, đặt ở dưới khung.
- **Nhạc nền không lời**, êm, nhỏ — đã có sẵn tệp, xem §3. Không thuyết minh giọng nói.
- **Nhấn mạnh (highlight) chi tiết đang nói tới**: mỗi cảnh có MỘT vùng cần chú ý (một nút, một ô trong lưới, một con số). Làm nổi bằng một trong các cách — viền sáng bo góc quanh vùng đó, hoặc làm tối/mờ nhẹ phần còn lại của khung (vignette ~25–35%), hoặc con trỏ/vòng tròn mềm. Dùng NHẤT QUÁN một cách trong cả video, đừng đổi kiểu giữa các cảnh.
- **Zoom nhẹ, chậm, không gây chóng mặt** — đây là yêu cầu rõ ràng của người đặt:
  - zoom vào đúng tâm của vùng nhấn mạnh, không zoom vào giữa khung một cách vô nghĩa;
  - biên độ **tối đa 8–12%** (scale 1.00 → 1.10 là đủ), tuyệt đối không quá 1,15;
  - thời gian **4–6 giây cho một chuyển động**, easing mượt hai đầu (ease-in-out), không bao giờ tuyến tính cứng;
  - **một chuyển động cho mỗi cảnh** — hoặc zoom vào, hoặc zoom ra, không zoom qua zoom lại trong cùng một cảnh;
  - **không pan và zoom đồng thời**; nếu cần đổi vùng chú ý thì cắt cảnh, đừng rê khung;
  - cảnh có nhiều chữ (bảng danh mục, trang in) thì giữ gần như tĩnh (scale 1.00 → 1.02) để đọc được.
- Chuyển cảnh: fade đen **0,3–0,5s** giữa các cảnh. Không trượt, không xoay, không hiệu ứng bay nhảy.
- Thẻ mở đầu và thẻ kết bằng chữ, nền xanh lá đậm của thương hiệu: **HSL(152 60% 26%)** ≈ `#1B4430`.

## 1b. Phong cách tham chiếu (từ video OmniX đã có)

Đã soi tệp `OmniX_KienThucThuongHieu_Demo_v2.mp4` của chính người đặt: **1920×1080, H.264 + AAC, 30fps, dài 2:16, 41,6 MB**. Video mới nên **cùng thông số kỹ thuật**, nhưng ngắn hơn (~85 giây).

Cách video đó làm (lấy làm chuẩn):

- Ảnh chụp màn hình được **phủ tối/ngả tím toàn khung**, chỉ vùng cần chú ý là sáng rõ.
- Vùng chú ý được đóng **khung bo góc sáng** quanh nút cần bấm.
- Có **vòng sáng tròn quanh con trỏ**, con trỏ vẽ to hơn thật.
- Phụ đề **hai tầng** ở đáy khung: một **viên nhỏ chữ hoa** ("BƯỚC 1 · TẠO THƯƠNG HIỆU") nằm trên, và **hộp chữ lớn nền tối bo góc** nằm dưới ("Bấm "Thêm thương hiệu"").
- Tông thương hiệu của video đó là **tím**; video này dùng **xanh lá đậm HSL(152 60% 26%) ≈ `#1B4430`** cho đúng thương hiệu Tài Sản Đấu Giá.

⚠️ **Điều người đặt muốn SỬA so với video cũ: "highlight quá nhiều thứ, làm ít lại."** Trong một khung của video cũ có tới bốn thứ cùng đòi sự chú ý — phủ tối, khung sáng, vòng tròn con trỏ, viên "bước". Lần này:

- **Mỗi cảnh chỉ MỘT điểm nhấn.** Chọn *hoặc* khung sáng quanh vùng đó, *hoặc* vòng sáng con trỏ — **không dùng cả hai cùng lúc**.
- Giữ lớp **phủ tối nhẹ** (25–35%) vì nó dẫn mắt tốt mà không ồn; đừng tăng đậm hơn.
- **Viên "BƯỚC n" chỉ hiện khi sang bước mới**, không lặp ở mọi cảnh.
- Nếu vùng chú ý đã rõ nhờ zoom thì **bỏ luôn khung sáng** — zoom chính là điểm nhấn rồi.
- Mục tiêu: xem xong thấy **rõ ràng, thong thả**, không thấy màn hình "nhấp nháy" chỗ nào cũng sáng.

## 2. Tính năng này là gì (để viết đúng tinh thần)

Từ 01/07/2025 chính quyền hai cấp: **UBND xã/phường** chuẩn bị và tổ chức đấu giá quyền sử dụng đất, còn **tỉnh** giao chỉ tiêu, tổng hợp và theo dõi. Trước đây mỗi đơn vị giữ kế hoạch trong Word/Excel, tỉnh gõ lại, tiến độ báo bằng tay. Tính năng này cho:

- **Cán bộ xã**: một danh mục mọi thửa đất sẽ đấu giá trong năm, mỗi thửa có bước tiếp theo và hạn; báo cáo tháng lên tỉnh được sinh ra chứ không phải viết.
- **Tỉnh**: màn "Toàn tỉnh" — xã nào đã trình, kế hoạch so thực tế theo tháng/quý, xã nào đang trễ.

Số liệu trong video lấy từ Trạm demo: **UBND tỉnh Bắc Ninh**, năm **2026**, 4 xã/phường, 20 tài sản, đã thu **123,6 tỷ** trên chỉ tiêu **180 tỷ**.

## 3. Nhạc nền (đã có)

`bed.wav` — pad hợp âm Am–F–C–G, **100 giây** (đủ phủ 98,5s video), stereo 44.1kHz, đỉnh **−18 dBFS**, đã fade 3s đầu/cuối. Tự tổng hợp hoàn toàn nên **không vướng bản quyền**, dùng thoải mái.

Nếu cần đúng độ dài khác: `python3 -I make_music.py <tệp-ra>.wav <số-giây>` (kèm trong thư mục này).

## 4. Ảnh chụp màn hình

Sẽ gửi kèm, đặt tên `01.png` … `20.png` theo đúng thứ tự bảng §5. Chụp ở khổ desktop; vài màn có thêm bản mobile 375px nếu cần chèn.

⚠️ **Cảnh 15 và 16 chưa quay được**: tính năng tương ứng (Báo cáo định kỳ có phần kế hoạch — P8; màn Toàn tỉnh — P7) **chưa dựng xong**. Mọi cảnh còn lại đã có màn thật để chụp. Nếu cần ra video sớm thì bỏ 15 và 16, phần còn lại vẫn liền mạch.

⚠️ **Chưa có ảnh ở thời điểm viết brief này** — tính năng nằm sau trang đăng nhập, phải đăng nhập thật mới chụp được. Nếu hội thoại nhận được brief mà chưa có ảnh thì chờ, đừng dựng bằng ảnh tự vẽ.

## 5. Kịch bản phụ đề (đã chốt nội dung, chỉnh lời thoải mái)

Cột **"Nhấn mạnh"** là vùng cần làm nổi + là tâm của cú zoom nhẹ ở cảnh đó.

| # | Màn | Phụ đề chính | Dòng số liệu nhỏ | Nhấn mạnh (tâm zoom) | Giây |
|:-:|---|---|---|---|--:|
| 1 | Thẻ mở đầu | **Kế hoạch đấu giá** | Xã · Phường · Tỉnh — một mô hình, hai cấp | — (thẻ chữ, tĩnh) | 3,5 |
| 2 | Danh sách kế hoạch | Mỗi đơn vị một danh mục tài sản đấu giá cho cả năm | Trình trước 15/12 · cán bộ xã chỉ thấy xã mình | bảng thông báo deadline của tỉnh | 5,5 |
| 3 | Tab Danh mục tài sản | Đúng bảy cột của biểu mẫu quen dùng — không phải học lại | 19 thửa · 359 tỷ đồng dự kiến | hàng tiêu đề bảy cột | 5 |
| 4 | Nhập từ Excel | Kế hoạch cũ trong Excel nhập thẳng vào, dòng sai được chỉ rõ | Ghi 18 · 2 dòng chưa ghi | dòng tổng kết “Ghi 18 · 2 dòng chưa ghi” | 5 |
| 5 | Trình kế hoạch | Trình lên tỉnh, kèm tổng theo từng quý |  | nút chính “Trình kế hoạch” | 4 |
| 6 | Tỉnh trả lại | Tỉnh trả lại kèm góp ý — xã thấy ngay vì sao |  | ô góp ý của tỉnh | 4 |
| 7 | Mở lại để sửa | Sửa xong trình lại, không ai phải gửi lại file qua email |  | nút “Mở lại để sửa” | 4 |
| 8 | Ghi nhận phê duyệt | Tỉnh ghi nhận quyết định đã ký — app không thay chữ ký | Quyết định số 1234/QĐ-UBND · bản mốc v1 | số quyết định + nhãn “bản mốc v1” | 5,5 |
| 9 | Tab Tiến độ | Từ đây mọi so sánh đều với bản mốc đã duyệt |  | nhãn tab “Tiến độ” | 4 |
| 10 | Lưới 12 tháng | Một lưới 12 tháng: viền là kế hoạch, nền là dự kiến mới, đỏ là đã trễ | 4 trễ · 4 nguy cơ trễ · 4 đã đấu thành | chú giải + 2–3 ô đỏ trong lưới | 6 |
| 11 | Danh sách mốc | Mười mốc cho mỗi thửa, từ pháp lý đến giao đất |  | danh sách 10 mốc trong side sheet | 5 |
| 12 | Nhãn “Sàn xác nhận” | Mốc nào sàn tự biết thì sàn tự tích — cán bộ không khai lại | Ký hợp đồng dịch vụ đấu giá · 20/05 | đúng cái nhãn “Sàn xác nhận” | 5,5 |
| 13 | Tab Theo kỳ | Kế hoạch so thực tế cho bất kỳ tháng, quý hay năm | Đã thu 123,6 tỷ / 180 tỷ chỉ tiêu | con số “đã thu 123,6 tỷ / 180 tỷ” | 6 |
| 14 | Vận hành tháng | Tháng này cần làm gì — đánh dấu xong ngay trên thẻ việc |  | thẻ việc + nút “Đánh dấu xong” | 5 |
| 15 | Báo cáo định kỳ ⟨P8⟩ | Báo cáo tháng gửi tỉnh tự có phần tiến độ kế hoạch | Không phải gõ lại từ đầu | mục “Tiến độ kế hoạch” trong báo cáo | 5 |
| 16 | Toàn tỉnh ⟨P7⟩ | Tỉnh thấy cả tỉnh: xã nào đã trình, xã nào đang trễ | 4 xã · 13 tài sản sắp đấu giá | cột “% hoàn thành” của bảng 4 xã | 6 |
| 17 | Khởi tạo tỉnh ⟨P9⟩ | Mở tỉnh mới: mỗi xã một chi nhánh, mời bằng đường dẫn | Cả tỉnh dựng xong trong vài phút | danh sách xã vừa tạo | 5,5 |
| 18 | Sắp đấu giá — trang công khai ⟨P10⟩ | Danh mục đã duyệt công khai để người mua theo dõi | Chỉ hiện quý · không hiện giá | thẻ một lô + nút “Theo dõi” | 5,5 |
| 19 | Trang in | In ra đúng biểu mẫu để trình — ô chữ ký để trống |  | khối chữ ký để trống ở cuối trang | 4,5 |
| 20 | Thẻ kết | **Lập một lần. Theo dõi cả năm.** | Tài Sản Đấu Giá | — (thẻ chữ, tĩnh) | 4 |

## 6. Ba điều KHÔNG được nói (quan trọng)

1. **Không nhắc thông báo cho người mua** — áp dụng thẳng cho **cảnh 18**: nói "để người mua theo dõi" thì được, nói "người mua sẽ được báo khi có phiên" thì KHÔNG. Nút "Theo dõi" của người mua đã có nhưng **đường gửi thông báo chưa tồn tại** — hứa là sai sự thật.
2. **Không nói "ký số" / "phê duyệt điện tử".** Quyết định vẫn ký ngoài app; app chỉ **ghi nhận** (số, ngày, tệp), ô chữ ký trên bản in để trống. Đây là chủ trương đã chốt, không phải thiếu sót.
3. **Không nói đã dùng ở tỉnh nào.** Số liệu trong video là **dữ liệu minh hoạ**, chưa có tỉnh nào chạy thật.

## 7. Quy ước trình bày

- Tiền tách nhóm bằng **dấu phẩy**: `5,000,000₫`. Nói tỷ thì "123,6 tỷ".
- Mỗi phụ đề **≤ 12 từ** để đọc kịp; số liệu đẩy xuống dòng nhỏ.
- Nói **lợi ích của người dùng**, không đọc tên nút ("không ai phải gửi lại file qua email", chứ không phải "bấm nút Mở lại để sửa").
- Giữ nguyên dấu tiếng Việt; kiểm lại các chữ dễ lỗi phông: **ộ ữ ậ ỵ ẩ ồ**.
