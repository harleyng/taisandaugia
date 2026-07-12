import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface RegisterConsentProps {
  agreeTerms: boolean;
  onAgreeTermsChange: (checked: boolean) => void;
  emailOptIn: boolean;
  onEmailOptInChange: (checked: boolean) => void;
}

/**
 * Hai checkbox consent ở màn tạo mật khẩu đăng ký:
 *  - Đồng ý Điều khoản & Chính sách bảo mật (BẮT BUỘC)
 *  - Nhận email quảng cáo (TÙY CHỌN)
 * Dùng chung cho luồng đăng ký email và đăng ký SĐT.
 */
export const RegisterConsent = ({
  agreeTerms,
  onAgreeTermsChange,
  emailOptIn,
  onEmailOptInChange,
}: RegisterConsentProps) => (
  <div className="space-y-3 pt-1">
    <div className="flex items-start gap-2.5">
      <Checkbox
        id="agree-terms"
        checked={agreeTerms}
        onCheckedChange={(checked) => onAgreeTermsChange(checked === true)}
        className="mt-0.5"
      />
      <Label htmlFor="agree-terms" className="text-sm font-normal leading-snug text-muted-foreground">
        Tôi đồng ý với{" "}
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
        </a>
        .
      </Label>
    </div>

    <div className="flex items-start gap-2.5">
      <Checkbox
        id="email-opt-in"
        checked={emailOptIn}
        onCheckedChange={(checked) => onEmailOptInChange(checked === true)}
        className="mt-0.5"
      />
      <Label htmlFor="email-opt-in" className="text-sm font-normal leading-snug text-muted-foreground">
        Tôi muốn nhận các thông tin mới, ưu đãi và cập nhật sản phẩm qua email.
      </Label>
    </div>
  </div>
);
