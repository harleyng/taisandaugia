import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "react-router-dom";

const sections = [
  {
    id: "gioi-thieu",
    title: "1. Giới thiệu",
    content: [
      "Chào mừng bạn đến với TàiSảnĐấuGiá (\"Nền tảng\"). Bằng việc truy cập hoặc sử dụng dịch vụ của chúng tôi, bạn đồng ý tuân thủ các điều khoản sử dụng được nêu dưới đây.",
      "Vui lòng đọc kỹ các điều khoản này trước khi sử dụng nền tảng. Nếu bạn không đồng ý với bất kỳ điều khoản nào, bạn không được phép sử dụng dịch vụ của chúng tôi.",
    ],
  },
  {
    id: "dieu-kien-su-dung",
    title: "2. Điều kiện sử dụng",
    content: [
      "Bạn phải đủ 18 tuổi trở lên hoặc có sự giám sát của người giám hộ hợp pháp để sử dụng nền tảng.",
      "Bạn cam kết cung cấp thông tin chính xác, đầy đủ và cập nhật khi đăng ký tài khoản.",
      "Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động diễn ra dưới tài khoản của mình.",
      "Bạn không được sử dụng nền tảng cho bất kỳ mục đích bất hợp pháp hoặc trái với các quy định hiện hành của pháp luật Việt Nam.",
    ],
  },
  {
    id: "tai-khoan",
    title: "3. Tài khoản người dùng",
    content: [
      "Mỗi người dùng chỉ được đăng ký một tài khoản. Việc tạo nhiều tài khoản nhằm mục đích gian lận hoặc lợi dụng chính sách sẽ dẫn đến việc khóa tài khoản vĩnh viễn.",
      "TàiSảnĐấuGiá có quyền tạm khóa hoặc chấm dứt tài khoản của bạn nếu phát hiện vi phạm điều khoản sử dụng mà không cần thông báo trước.",
      "Bạn có thể xóa tài khoản bất kỳ lúc nào bằng cách liên hệ với bộ phận hỗ trợ của chúng tôi.",
    ],
  },
  {
    id: "noi-dung",
    title: "4. Nội dung và quyền sở hữu trí tuệ",
    content: [
      "Toàn bộ nội dung trên nền tảng bao gồm văn bản, hình ảnh, biểu đồ, logo và phần mềm đều thuộc quyền sở hữu của TàiSảnĐấuGiá hoặc các đối tác được cấp phép.",
      "Bạn không được sao chép, phân phối, chỉnh sửa hoặc sử dụng nội dung vào mục đích thương mại mà không có sự cho phép bằng văn bản từ TàiSảnĐấuGiá.",
      "Dữ liệu đấu giá được tổng hợp từ các nguồn công khai. TàiSảnĐấuGiá không chịu trách nhiệm về tính chính xác của thông tin do bên thứ ba cung cấp.",
    ],
  },
  {
    id: "dich-vu-tra-phi",
    title: "5. Dịch vụ trả phí và tín dụng",
    content: [
      "Một số tính năng nâng cao trên nền tảng yêu cầu tín dụng (credits) hoặc gói đăng ký trả phí.",
      "Tín dụng đã mua không có giá trị hoàn tiền trừ trường hợp có lỗi kỹ thuật từ phía TàiSảnĐấuGiá được xác nhận.",
      "Giá cả và các gói dịch vụ có thể thay đổi. Chúng tôi sẽ thông báo trước ít nhất 7 ngày đối với các thay đổi ảnh hưởng đến dịch vụ hiện tại của bạn.",
      "Việc thanh toán được xử lý qua các cổng thanh toán bảo mật. TàiSảnĐấuGiá không lưu trữ thông tin thẻ ngân hàng của bạn.",
    ],
  },
  {
    id: "trach-nhiem",
    title: "6. Giới hạn trách nhiệm",
    content: [
      "TàiSảnĐấuGiá cung cấp thông tin đấu giá với mục đích tham khảo. Chúng tôi không phải là tổ chức đấu giá và không chịu trách nhiệm về kết quả của bất kỳ phiên đấu giá nào.",
      "Chúng tôi không đảm bảo tính liên tục, không gián đoạn hoặc hoàn toàn chính xác của nền tảng. Dịch vụ có thể tạm ngừng để bảo trì hoặc nâng cấp.",
      "TàiSảnĐấuGiá không chịu trách nhiệm về bất kỳ thiệt hại trực tiếp, gián tiếp, ngẫu nhiên hay hệ quả nào phát sinh từ việc sử dụng hoặc không thể sử dụng nền tảng.",
    ],
  },
  {
    id: "bao-mat",
    title: "7. Bảo mật và quyền riêng tư",
    content: [
      "Việc thu thập và xử lý dữ liệu cá nhân của bạn được thực hiện theo Chính sách bảo mật của TàiSảnĐấuGiá.",
      "Chúng tôi sử dụng các biện pháp bảo mật tiêu chuẩn ngành để bảo vệ thông tin của bạn, tuy nhiên không thể đảm bảo an toàn tuyệt đối trước mọi mối đe dọa.",
      "Bạn đồng ý nhận các thông báo liên quan đến tài khoản và dịch vụ qua email đã đăng ký. Bạn có thể hủy đăng ký nhận thông báo marketing bất kỳ lúc nào.",
    ],
  },
  {
    id: "thay-doi",
    title: "8. Thay đổi điều khoản",
    content: [
      "TàiSảnĐấuGiá có quyền cập nhật điều khoản sử dụng bất kỳ lúc nào. Chúng tôi sẽ thông báo qua email hoặc hiển thị thông báo nổi bật trên nền tảng.",
      "Việc tiếp tục sử dụng nền tảng sau khi điều khoản được cập nhật đồng nghĩa với việc bạn chấp nhận các điều khoản mới.",
      "Ngày cập nhật gần nhất được ghi rõ ở cuối trang này.",
    ],
  },
  {
    id: "luat-ap-dung",
    title: "9. Luật áp dụng",
    content: [
      "Các điều khoản này được điều chỉnh và giải thích theo pháp luật Cộng hòa Xã hội Chủ nghĩa Việt Nam.",
      "Mọi tranh chấp phát sinh từ hoặc liên quan đến các điều khoản này sẽ được giải quyết tại Tòa án nhân dân có thẩm quyền tại Thành phố Hồ Chí Minh.",
    ],
  },
  {
    id: "lien-he",
    title: "10. Liên hệ",
    content: [
      "Nếu bạn có bất kỳ câu hỏi nào về điều khoản sử dụng, vui lòng liên hệ với chúng tôi:",
    ],
    contact: true,
  },
];

const TermsOfUse = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-foreground text-background">
        <div className="container px-4 py-14 md:py-20 text-center max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
            Điều khoản sử dụng
          </h1>
          <p className="text-background/60 text-sm md:text-base leading-relaxed">
            Vui lòng đọc kỹ các điều khoản dưới đây trước khi sử dụng nền tảng TàiSảnĐấuGiá.
          </p>
          <p className="text-background/40 text-xs mt-4">Cập nhật lần cuối: 17/05/2026</p>
        </div>
      </section>

      <div className="container px-4 py-12 md:py-16 max-w-4xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Table of contents */}
          <aside className="lg:w-56 flex-shrink-0">
            <div className="sticky top-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mục lục</h2>
              <nav className="flex flex-col gap-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <article className="flex-1 flex flex-col gap-10">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <h2 className="text-lg font-semibold text-foreground mb-3">{s.title}</h2>
                <div className="flex flex-col gap-3">
                  {s.content.map((p, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                      {p}
                    </p>
                  ))}
                  {s.contact && (
                    <div className="mt-2 p-5 rounded-xl border border-border bg-muted/40 text-sm text-muted-foreground space-y-1">
                      <p><span className="font-medium text-foreground">Email:</span> contact@taisandaugia.vn</p>
                      <p><span className="font-medium text-foreground">Điện thoại:</span> 1900 1234</p>
                      <p><span className="font-medium text-foreground">Địa chỉ:</span> 123 Đường ABC, Quận 1, TP.HCM</p>
                      <p className="pt-1">
                        Hoặc sử dụng{" "}
                        <Link to="/lien-he" className="text-primary hover:underline">
                          trang liên hệ
                        </Link>{" "}
                        của chúng tôi.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TermsOfUse;
