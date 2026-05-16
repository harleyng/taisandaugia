import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from "lucide-react";

const contactInfo = [
  {
    icon: MapPin,
    label: "Địa chỉ",
    value: "123 Đường ABC, Quận 1, TP.HCM",
  },
  {
    icon: Phone,
    label: "Hotline",
    value: "1900 1234",
  },
  {
    icon: Mail,
    label: "Email",
    value: "contact@taisandaugia.vn",
  },
  {
    icon: Clock,
    label: "Giờ làm việc",
    value: "Thứ 2 – Thứ 6: 8:00 – 17:30",
  },
];

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Page header */}
      <section className="bg-foreground text-background">
        <div className="container px-4 py-14 md:py-20 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Liên hệ với chúng tôi</h1>
          <p className="text-background/60 text-sm md:text-base max-w-xl mx-auto">
            Có câu hỏi hoặc muốn hợp tác quảng cáo? Gửi tin nhắn cho chúng tôi — chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="container px-4 py-10 md:py-16 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 max-w-5xl mx-auto">

          {/* Contact info */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Thông tin liên hệ</h2>
              <p className="text-sm text-muted-foreground">
                Liên hệ trực tiếp qua các kênh dưới đây hoặc điền vào form bên cạnh.
              </p>
            </div>

            <ul className="flex flex-col gap-5">
              {contactInfo.map(({ icon: Icon, label, value }) => (
                <li key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-foreground">{value}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Map placeholder */}
            <div className="rounded-xl overflow-hidden border border-border aspect-video w-full bg-muted flex items-center justify-center mt-2">
              <div className="text-center text-muted-foreground text-sm">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <span className="opacity-50">Bản đồ</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-16">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Gửi thành công!</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Chúng tôi đã nhận được tin nhắn của bạn và sẽ phản hồi sớm nhất có thể.
                </p>
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  Gửi tin nhắn khác
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Họ và tên <span className="text-destructive">*</span></Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Nguyễn Văn A"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone">Số điện thoại <span className="text-destructive">*</span></Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="0912 345 678"
                      value={form.phone}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="subject">Chủ đề</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="Trả giá quảng cáo / Hợp tác / Hỗ trợ..."
                    value={form.subject}
                    onChange={handleChange}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="message">Nội dung <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Mô tả nhu cầu của bạn..."
                    rows={5}
                    value={form.message}
                    onChange={handleChange}
                    required
                  />
                </div>

                <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-end">
                  <Send className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  Gửi tin nhắn
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
