import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const sections = [
  {
    title: "1. Thông tin chúng tôi thu thập",
    content: [
      "Khi bạn đăng ký tài khoản hoặc sử dụng dịch vụ của TàiSảnĐấuGiá, chúng tôi có thể thu thập các thông tin sau:",
      "• **Thông tin cá nhân:** Họ tên, số điện thoại, địa chỉ email, địa chỉ liên hệ.",
      "• **Thông tin thiết bị:** Địa chỉ IP, loại trình duyệt, hệ điều hành, thời gian truy cập.",
      "• **Dữ liệu hành vi:** Các trang bạn truy cập, phiên đấu giá bạn theo dõi, tìm kiếm bạn thực hiện.",
      "• **Thông tin thanh toán:** Chúng tôi không lưu trữ trực tiếp thông tin thẻ ngân hàng. Mọi giao dịch được xử lý qua cổng thanh toán bảo mật (VNPay).",
    ],
  },
  {
    title: "2. Mục đích sử dụng thông tin",
    content: [
      "Chúng tôi sử dụng thông tin thu thập được để:",
      "• Cung cấp, vận hành và cải thiện dịch vụ.",
      "• Gửi thông báo về các phiên đấu giá theo dõi, kết quả đấu giá và cập nhật pháp lý.",
      "• Xác minh danh tính và bảo vệ tài khoản người dùng.",
      "• Phân tích dữ liệu sử dụng để cải thiện trải nghiệm sản phẩm.",
      "• Tuân thủ các nghĩa vụ pháp lý theo quy định của pháp luật Việt Nam.",
    ],
  },
  {
    title: "3. Chia sẻ thông tin với bên thứ ba",
    content: [
      "TàiSảnĐấuGiá không bán hoặc cho thuê thông tin cá nhân của bạn. Chúng tôi chỉ chia sẻ thông tin trong các trường hợp sau:",
      "• **Đối tác dịch vụ:** Các nhà cung cấp dịch vụ kỹ thuật, thanh toán, phân tích — được ràng buộc bảo mật theo hợp đồng.",
      "• **Yêu cầu pháp lý:** Khi có yêu cầu từ cơ quan nhà nước có thẩm quyền theo đúng quy định pháp luật.",
      "• **Bảo vệ quyền lợi:** Trong trường hợp cần thiết để ngăn chặn gian lận hoặc bảo vệ an toàn người dùng.",
    ],
  },
  {
    title: "4. Bảo mật thông tin",
    content: [
      "Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ thông tin cá nhân của bạn:",
      "• Mã hóa dữ liệu truyền tải bằng HTTPS/TLS.",
      "• Kiểm soát quyền truy cập nội bộ theo nguyên tắc tối thiểu đặc quyền.",
      "• Giám sát hệ thống liên tục để phát hiện và xử lý sự cố bảo mật.",
      "Tuy nhiên, không có hệ thống nào an toàn tuyệt đối. Bạn nên bảo vệ mật khẩu và không chia sẻ thông tin đăng nhập với bất kỳ ai.",
    ],
  },
  {
    title: "5. Cookie và công nghệ theo dõi",
    content: [
      "Chúng tôi sử dụng cookie và các công nghệ tương tự để:",
      "• Duy trì phiên đăng nhập của bạn.",
      "• Ghi nhớ tùy chọn và bộ lọc tìm kiếm.",
      "• Phân tích lưu lượng truy cập và hành vi người dùng (thông qua công cụ phân tích ẩn danh).",
      "Bạn có thể tắt cookie trong cài đặt trình duyệt, tuy nhiên một số tính năng của nền tảng có thể không hoạt động đầy đủ.",
    ],
  },
  {
    title: "6. Quyền của người dùng",
    content: [
      "Bạn có quyền:",
      "• **Truy cập:** Yêu cầu xem thông tin cá nhân chúng tôi đang lưu trữ về bạn.",
      "• **Chỉnh sửa:** Cập nhật thông tin không chính xác hoặc lỗi thời.",
      "• **Xóa:** Yêu cầu xóa tài khoản và dữ liệu cá nhân (trừ dữ liệu cần giữ theo quy định pháp luật).",
      "• **Phản đối:** Từ chối nhận thông tin marketing qua email hoặc SMS.",
      "Để thực hiện các quyền trên, vui lòng liên hệ: contact@taisandaugia.vn",
    ],
  },
  {
    title: "7. Lưu trữ dữ liệu",
    content: [
      "Chúng tôi lưu trữ thông tin cá nhân trong suốt thời gian tài khoản của bạn còn hoạt động và trong thời gian cần thiết để tuân thủ nghĩa vụ pháp lý (tối thiểu 5 năm theo quy định về kế toán và thuế tại Việt Nam).",
      "Sau khi tài khoản bị xóa, dữ liệu cá nhân sẽ được ẩn danh hóa hoặc xóa hoàn toàn trong vòng 90 ngày.",
    ],
  },
  {
    title: "8. Thay đổi chính sách",
    content: [
      "Chúng tôi có thể cập nhật Chính sách Bảo mật này theo thời gian. Khi có thay đổi quan trọng, chúng tôi sẽ thông báo qua email hoặc thông báo nổi bật trên nền tảng trước ít nhất 7 ngày.",
      "Việc tiếp tục sử dụng dịch vụ sau ngày có hiệu lực đồng nghĩa với việc bạn chấp nhận chính sách mới.",
    ],
  },
  {
    title: "9. Liên hệ",
    content: [
      "Nếu bạn có bất kỳ câu hỏi nào về Chính sách Bảo mật này, vui lòng liên hệ:",
      "• Email: contact@taisandaugia.vn",
      "• Hotline: 1900 1234",
      "• Địa chỉ: 123 Đường ABC, Quận 1, TP.HCM",
    ],
  },
];

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Page header */}
      <section className="bg-foreground text-background">
        <div className="container px-4 py-14 md:py-20 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Chính sách bảo mật</h1>
          <p className="text-background/60 text-sm md:text-base">
            Cập nhật lần cuối: 17/05/2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="container px-4 py-10 md:py-16 flex-1">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground leading-relaxed mb-10 p-5 rounded-xl bg-muted/50 border border-border">
            TàiSảnĐấuGiá ("chúng tôi") cam kết bảo vệ quyền riêng tư và thông tin cá nhân của bạn.
            Chính sách này mô tả cách chúng tôi thu thập, sử dụng và bảo vệ thông tin khi bạn sử dụng nền tảng taisandaugia.vn.
          </p>

          <div className="flex flex-col gap-10">
            {sections.map(({ title, content }) => (
              <div key={title}>
                <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">{title}</h2>
                <div className="flex flex-col gap-2.5">
                  {content.map((line, i) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g);
                    return (
                      <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                        {parts.map((part, j) =>
                          j % 2 === 1 ? (
                            <strong key={j} className="text-foreground font-medium">{part}</strong>
                          ) : (
                            part
                          )
                        )}
                      </p>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
