# RE:ACT — Năm câu tự luận, bản cuối để dán vào form

**Tài Sản Đấu Giá** · Nhóm chủ đề 1 · Hạn nộp 23:59 ngày 22/09/2026

> Chỗ duy nhất còn trống: **tên tổ chức đối tác** ở câu 5. Mọi phần khác dán được ngay.

---

## 1 · Xác định vấn đề *(~250 từ)*

Thông tin về tài sản đấu giá tại Việt Nam — phần lớn là tài sản phát mãi của ngân hàng và tài sản thi hành án — là thông tin công khai theo luật. Nhưng công khai không đồng nghĩa với tiếp cận được. Thông báo đấu giá nằm rải rác trên hàng trăm website của các tổ chức đấu giá, cổng thông tin nhà nước và báo in, phần lớn dưới dạng PDF quét hoặc ảnh chụp, không theo mẫu thống nhất, không tìm kiếm được và không so sánh được.

Hệ quả là quyền tiếp cận thông tin bị phân tầng theo nguồn lực. Đơn vị lớn bỏ tiền duy trì một đội chuyên rà soát hằng ngày nên luôn biết tin sớm. Người hành nghề đơn lẻ không có lựa chọn đó, và thường chỉ biết khi phiên đấu giá đã gần kết thúc.

Vấn đề có ba nguyên nhân gốc. **Thứ nhất**, chưa có chuẩn dữ liệu chung cho thông báo đấu giá; mỗi tổ chức công bố theo cách riêng. **Thứ hai**, chi phí thu thập và kiểm chứng thông tin quá cao so với thu nhập của một cá nhân hành nghề. **Thứ ba**, rào cản kỹ năng số và rào cản địa lý cùng tồn tại: nhiều người không đủ kỹ năng khai thác thông tin đã công khai, và muốn tham dự một phiên đấu giá thường phải di chuyển về đô thị lớn.

Ba nhóm chịu ảnh hưởng trực tiếp: môi giới bất động sản và đấu giá viên hành nghề tự do — lao động phi chính thức sống bằng hoa hồng, không hợp đồng lao động, không bảo hiểm xã hội; người có nhu cầu ở các tỉnh xa trung tâm; và người tham gia nhỏ lẻ phải đối mặt với các nhóm có tổ chức trong một thị trường vốn có tiếng về dàn xếp.

---

## 2 · Mô tả giải pháp *(~150 từ)*

Tài Sản Đấu Giá thu thập thông báo đấu giá từ các nguồn phân tán, chuẩn hóa thành một cấu trúc dữ liệu thống nhất và đưa tới người hành nghề qua hai giao diện: trang tra cứu công khai cho phép tìm theo vị trí, loại tài sản, khoảng giá và mốc thời gian, hiển thị trên bản đồ thay vì danh sách PDF; và ứng dụng PWA cài trực tiếp từ trình duyệt, không qua kho ứng dụng, chạy được trên máy cấu hình thấp và kết nối yếu.

Sản phẩm lõi cho người hành nghề là báo cáo toàn cảnh thị trường 7–14 ngày tới với giá 25.000đ — thay cho việc phải duy trì một đội rà soát riêng.

Người dùng cũng có thể khai báo nhu cầu tài sản và được hệ thống thông báo ngay khi có tài sản mới khớp — thay vì phải tự đi tìm.

Nền tảng đi theo bốn giai đoạn chuyển đổi số nối tiếp nhau: số hóa và làm sạch dữ liệu, biến dữ liệu thành hồ sơ tài sản số, phân tích số trên dữ liệu đã chuẩn hóa, và mở rộng hệ sinh thái. Chúng tôi đang ở cuối giai đoạn một, đầu giai đoạn hai.

Công nghệ sử dụng: pipeline bóc tách PDF quét và văn bản không cấu trúc; PostgreSQL với phân quyền ở tầng hàng dữ liệu; truy vấn không gian địa lý; kiến trúc PWA offline-first; xác thực định danh và lưu vết giao dịch thiết kế ngay từ đầu.

---

## 3 · Kết quả mà giải pháp kỳ vọng và/hoặc đã đạt được

**Đã đạt được.** Nền tảng ra mắt ngày 23/06/2026 và đang vận hành tại taisandaugia.vn với độ phủ dữ liệu đấu giá công khai toàn quốc: **692.670+ tài sản đấu giá, 570.560+ cuộc đấu giá, 670+ công ty đấu giá**, dữ liệu từ năm 2020 và cập nhật hằng ngày.

Ba dịch vụ đã có doanh thu thật: báo cáo toàn cảnh thị trường (25.000đ), hồ sơ dự thầu chuẩn Thông tư 19 cho công ty đấu giá (~400.000đ), và báo cáo vận hành nội bộ cho tổ chức nhiều chi nhánh như ngân hàng (~1.000.000đ/chi nhánh/tháng). Nền tảng do Công ty TNHH Giải pháp Xã hội SS Corp Việt Nam vận hành, phối hợp cùng DVL Auction.

Điều chúng tôi **chưa** có là bằng chứng về tác động lên nhóm người dùng yếu thế. Chúng tôi có dữ liệu thị trường, nhưng chưa có dữ liệu cho thấy nền tảng đã thay đổi sinh kế của ai. Đó chính là khoảng trống mà Living Labs lấp vào.

**Tác động kỳ vọng.** Rút ngắn khoảng cách thông tin giữa người hành nghề tự do và các đơn vị có nguồn lực lớn, qua đó cải thiện thu nhập và tính ổn định sinh kế của nhóm lao động phi chính thức này; đồng thời mở rộng khả năng tham gia thị trường cho người ở địa bàn xa trung tâm.

**Cách đo lường trong giai đoạn Living Labs.** Đo trên một nhóm người hành nghề tham gia thử nghiệm, so sánh trước và sau:

1. **Độ trễ thông tin** — số ngày từ khi thông báo đấu giá phát hành đến khi người dùng tiếp cận được. Đây là chỉ số lõi, hệ thống ghi nhận tự động, không phụ thuộc lời khai.
2. **Số cơ hội tiếp cận được mỗi tháng** trên mỗi người dùng — hệ thống ghi nhận.
3. **Số giao dịch hoàn tất và thu nhập hoa hồng** — người dùng tự khai hằng tháng.
4. **Tỷ lệ duy trì sử dụng** sau 30 và 90 ngày — hệ thống ghi nhận.
5. **Tỷ lệ nữ và tỷ lệ người dùng ngoài Hà Nội / TP.HCM** trong nhóm thử nghiệm — khảo sát.
6. **Thay đổi trong cách ra quyết định nghề nghiệp** — phỏng vấn sâu 8–10 người dùng ở đầu, giữa và cuối kỳ.

---

## 4 · Mức độ sẵn sàng với Living Labs

**Chọn:** ☑ `Đã liên hệ và nhận được sự đồng ý sơ bộ/thiện chí hợp tác từ đối tác`

> ⚠️ Chỉ giữ đáp án này nếu bạn thực sự đã trao đổi và đối tác đã thể hiện thiện chí. BTC hoàn toàn có thể gọi xác minh. Nếu chưa chắc, hạ xuống *"Đang trong quá trình tiếp cận, chưa có phản hồi chính thức"* — trung thực an toàn hơn nhiều so với bị phát hiện.

---

## 5 · Thông tin về tổ chức đối tác *(~100 từ)*

**Điền trước:** `[TÊN TỔ CHỨC]` · `[loại hình: sàn giao dịch BĐS / hội môi giới / tổ chức đấu giá / hợp tác xã]` · `[tỉnh/thành]` · `[số lượng môi giới trong mạng lưới]`

> Bản để dán:

[TÊN TỔ CHỨC] là [loại hình] đang hoạt động tại [tỉnh/thành], với mạng lưới khoảng [số] môi giới và đấu giá viên hành nghề tự do. Hai bên đã trao đổi và đối tác thể hiện thiện chí đồng hành trong giai đoạn Living Labs.

Đối tác hỗ trợ ba việc. **Một**, giới thiệu nhóm người hành nghề tham gia thử nghiệm, để chúng tôi làm việc với người dùng thật thay vì tuyển ngẫu nhiên. **Hai**, cung cấp địa điểm tổ chức các buổi hướng dẫn sử dụng và phỏng vấn người dùng định kỳ. **Ba**, đối chiếu và xác minh dữ liệu thông báo đấu giá trên địa bàn, giúp chúng tôi kiểm định độ chính xác của pipeline chuẩn hóa dữ liệu.

Đổi lại, đối tác được sử dụng miễn phí toàn bộ công cụ trong thời gian chương trình và nhận báo cáo tổng hợp về hoạt động của mạng lưới.

---

## 6 · Động lực tham gia RE:ACT *(~250 từ)* — bản có gắn lộ trình dài hạn

Chúng tôi đang ở đúng điểm chuyển mà RE:ACT được thiết kế để hỗ trợ: sản phẩm đã chạy, nhưng chưa được kiểm chứng với người dùng thật ở quy mô đủ để biết mình đúng hay sai.

Bài toán dài hạn của chúng tôi là hoàn thiện bốn giai đoạn chuyển đổi số của thị trường đấu giá tài sản: số hóa dữ liệu, biến dữ liệu thành tài sản số, phân tích số, và mở rộng hệ sinh thái — hướng tới một sàn đấu giá trực tuyến vận hành đầu–cuối, phù hợp với định hướng đấu giá tài sản 100% online của Nhà nước.

Vấn đề là lộ trình này, nếu để thị trường tự dẫn dắt, sẽ luôn phục vụ bên trả tiền nhiều nhất trước. Hai hạng mục có ý nghĩa nhất với nhóm yếu thế lại nằm ở giai đoạn ba và bốn: **đấu giá trực tuyến** để người ở tỉnh xa không phải di chuyển mới tham gia được, và **hệ sinh thái mở** kết nối đấu giá viên hành nghề tự do với các tổ chức đang cần người. Cả hai đều là loại tính năng một công ty sẽ hoãn lại năm này qua năm khác.

Chúng tôi tham gia RE:ACT để đưa chúng lên trước, với ba thứ mình đang thiếu: một môi trường kiểm chứng có cấu trúc để kiểm định giả định lõi — rằng độ trễ thông tin là nút thắt lớn nhất; cố vấn để thiết kế lại mô hình sao cho gói cơ bản miễn phí cho người hành nghề tự do mà vẫn bền vững; và năng lực xây khung đo lường tác động xã hội đạt chuẩn, thứ mà một đội kỹ thuật như chúng tôi không tự làm được.

RE:ACT không tài trợ cả lộ trình. RE:ACT tài trợ việc đưa nhóm yếu thế vào lộ trình đó ngay từ đầu, thay vì để họ tiếp cận sau cùng.

---

## Kiểm tra trước khi bấm gửi

- [ ] Đã điền tên tổ chức đối tác ở câu 5
- [ ] Số liệu 692.670+ / 570.560+ / 670+ vẫn đúng tại thời điểm nộp
- [ ] Pitch deck và video demo đã chia sẻ **View only** cho BTC
- [ ] Video demo quay trên **điện thoại**, thấy giao diện người hành nghề — không phải dashboard desktop
- [ ] Thành viên đại diện đủ 18–35 tuổi, quốc tịch Việt Nam, đang sống và làm việc tại Việt Nam
