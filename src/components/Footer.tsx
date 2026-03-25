import { Mail, Phone, MapPin, Facebook, Youtube } from "lucide-react";
import logo from "@/assets/logo.png";
import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="bg-foreground text-background">
      <div className="container py-12 px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Asset Auction - tàisảnđấugiá" className="h-8 object-contain invert" />
            </div>
            <p className="text-sm text-background/60 mb-4">
              Nền tảng tra cứu và đấu giá tài sản hàng đầu Việt Nam
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
                <Facebook className="h-4 w-4 text-background/60" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
                <Youtube className="h-4 w-4 text-background/60" />
              </a>
            </div>
          </div>

          {/* About */}
          <div>
            <h3 className="font-semibold text-background mb-4 text-sm">Về chúng tôi</h3>
            <ul className="space-y-2 text-sm text-background/60">
              <li><Link to="#" className="hover:text-background transition-colors">Giới thiệu</Link></li>
              <li><Link to="#" className="hover:text-background transition-colors">Liên hệ</Link></li>
              <li><Link to="#" className="hover:text-background transition-colors">Tuyển dụng</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-background mb-4 text-sm">Dịch vụ</h3>
            <ul className="space-y-2 text-sm text-background/60">
              <li><Link to="#" className="hover:text-background transition-colors">Đăng thông báo đấu giá</Link></li>
              <li><Link to="#" className="hover:text-background transition-colors">Định giá tài sản</Link></li>
              <li><Link to="#" className="hover:text-background transition-colors">Tư vấn pháp lý đấu giá</Link></li>
              <li><Link to="#" className="hover:text-background transition-colors">Tra cứu phiên đấu giá</Link></li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="font-semibold text-background mb-4 text-sm">Chính sách</h3>
            <ul className="space-y-2 text-sm text-background/60">
              <li><Link to="#" className="hover:text-background transition-colors">Quy chế đấu giá</Link></li>
              <li><Link to="#" className="hover:text-background transition-colors">Chính sách bảo mật</Link></li>
              <li><Link to="#" className="hover:text-background transition-colors">Điều khoản sử dụng</Link></li>
              <li><Link to="#" className="hover:text-background transition-colors">Hướng dẫn tham gia đấu giá</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-background mb-4 text-sm">Liên hệ</h3>
            <ul className="space-y-3 text-sm text-background/60">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>123 Đường ABC, Quận 1, TP.HCM</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>1900 1234</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>contact@taisandaugia.vn</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/10 mt-8 pt-8 text-center text-sm text-background/40">
          <p>&copy; 2026 Asset Auction. All rights reserved.</p>
        </div>
      </div>
    </footer>);

};