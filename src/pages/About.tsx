import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Target,
  Eye,
  Users,
  ShieldCheck,
  TrendingUp,
  Handshake,
  ArrowRight,
} from "lucide-react";

const stats = [
  { value: "10K+", label: "Nhà đầu tư" },
  { value: "5K+", label: "Phiên đấu giá" },
  { value: "63", label: "Tỉnh thành" },
  { value: "98%", label: "Hài lòng" },
];

const values = [
  {
    icon: ShieldCheck,
    title: "Minh bạch",
    desc: "Mọi thông tin đấu giá được kiểm duyệt và hiển thị trung thực, không che giấu dữ liệu.",
  },
  {
    icon: TrendingUp,
    title: "Cập nhật liên tục",
    desc: "Hệ thống cập nhật phiên đấu giá theo thời gian thực từ các tổ chức đấu giá toàn quốc.",
  },
  {
    icon: Users,
    title: "Cộng đồng",
    desc: "Xây dựng mạng lưới nhà đầu tư và tổ chức đấu giá chuyên nghiệp, tin cậy.",
  },
  {
    icon: Handshake,
    title: "Hợp tác",
    desc: "Đồng hành cùng các tổ chức đấu giá, cơ quan nhà nước và nhà đầu tư trên cả nước.",
  },
];


const About = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-foreground text-background">
        <div className="container px-4 py-16 md:py-24 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/10 border border-background/10 mb-6 text-[11px] font-medium text-background/70">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Nền tảng đấu giá tài sản hàng đầu Việt Nam
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-5 leading-tight">
            Chúng tôi là <span className="text-primary">TàiSảnĐấuGiá</span>
          </h1>
          <p className="text-background/60 text-sm md:text-lg leading-relaxed">
            Nền tảng tra cứu, theo dõi và tham gia đấu giá tài sản minh bạch —
            giúp mọi nhà đầu tư tiếp cận cơ hội một cách công bằng và nhanh chóng.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border">
        <div className="container px-4 py-10 md:py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto text-center">
            {stats.map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="container px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="flex flex-col gap-4 p-7 rounded-2xl border border-border bg-card">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Sứ mệnh</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Dân chủ hoá thị trường đấu giá tài sản Việt Nam — đưa thông tin minh bạch đến tay mọi nhà đầu tư, từ cá nhân nhỏ lẻ đến tổ chức lớn, giúp họ ra quyết định đúng đắn và tự tin.
            </p>
          </div>
          <div className="flex flex-col gap-4 p-7 rounded-2xl border border-border bg-card">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Eye className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Tầm nhìn</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Trở thành hệ sinh thái đấu giá tài sản số 1 Đông Nam Á vào năm 2030 — nơi kết nối toàn bộ chuỗi giá trị từ định giá, đấu giá, pháp lý đến chuyển nhượng tài sản.
            </p>
          </div>
        </div>
      </section>

      {/* Core values */}
      <section className="bg-muted/40 border-y border-border">
        <div className="container px-4 py-12 md:py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">Giá trị cốt lõi</h2>
            <p className="text-sm text-muted-foreground">Những nguyên tắc định hướng mọi quyết định của chúng tôi</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {values.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-3 p-6 rounded-2xl bg-background border border-border">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="container px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-6 text-center">Câu chuyện của chúng tôi</h2>
          <div className="flex flex-col gap-5 text-sm text-muted-foreground leading-relaxed">
            <p>
              TàiSảnĐấuGiá ra đời vào năm 2024 từ trải nghiệm thực tế của những người sáng lập khi cố gắng tìm kiếm thông tin về các phiên đấu giá đất đai và tài sản thi hành án. Thị trường khi đó rất phân tán — thông tin nằm rải rác trên hàng chục website của các tổ chức đấu giá khác nhau, không có chuẩn định dạng, khó tra cứu.
            </p>
            <p>
              Chúng tôi bắt đầu bằng một trang web đơn giản tổng hợp thông báo đấu giá từ vài chục tổ chức. Chỉ sau 6 tháng, lượng người dùng tăng trưởng vượt kỳ vọng — đó là minh chứng cho nhu cầu thực sự của thị trường.
            </p>
            <p>
              Ngày nay, TàiSảnĐấuGiá phủ sóng hơn 5.000 phiên đấu giá mỗi năm, hơn 10.000 nhà đầu tư sử dụng hàng ngày và kết nối trực tiếp với hàng trăm tổ chức đấu giá trên toàn quốc. Hành trình vẫn còn rất dài phía trước.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/40 border-t border-border">
      <div className="container px-4 py-12 md:py-16 text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-3">Sẵn sàng cùng chúng tôi?</h2>
        <p className="text-sm text-muted-foreground mb-7 max-w-md mx-auto">
          Liên hệ để hợp tác, quảng cáo hoặc đưa nền tảng của bạn lên TàiSảnĐấuGiá.
        </p>
        <Button asChild size="lg">
          <Link to="/lien-he">
            Liên hệ ngay
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
          </Link>
        </Button>
      </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
