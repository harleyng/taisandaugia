interface LoginConsentNoticeProps {
  /** Nhãn nút CTA của màn đăng nhập hiện tại (vd "Đăng nhập", "Tiếp tục"). */
  cta?: string;
  className?: string;
}

/**
 * Dòng text consent ở màn ĐĂNG NHẬP (không checkbox): nhấn nút = đồng ý.
 * Màn ĐĂNG KÝ dùng checkbox riêng (RegisterConsent).
 */
export const LoginConsentNotice = ({ cta = "Đăng nhập", className }: LoginConsentNoticeProps) => (
  <p className={`text-xs leading-snug text-muted-foreground text-center ${className ?? ""}`}>
    Bằng cách nhấn “{cta}”, bạn đồng ý với{" "}
    <a
      href="/dieu-khoan-su-dung"
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      Điều khoản sử dụng
    </a>{" "}
    và{" "}
    <a
      href="/chinh-sach-bao-mat"
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      Chính sách bảo mật
    </a>{" "}
    của chúng tôi.
  </p>
);
