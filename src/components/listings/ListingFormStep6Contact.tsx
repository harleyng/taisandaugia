import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface ListingFormStep6ContactProps {
  contactName: string;
  setContactName: (value: string) => void;
  contactPhone: string;
  setContactPhone: (value: string) => void;
  contactEmail: string;
  setContactEmail: (value: string) => void;
}

export const ListingFormStep6Contact = ({
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  contactEmail,
  setContactEmail,
}: ListingFormStep6ContactProps) => {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Thông tin liên hệ</h2>
        <p className="text-muted-foreground text-lg">
          Nhập thông tin liên hệ để khách hàng có thể liên lạc với bạn
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Thông tin liên hệ được tự động điền từ hồ sơ của bạn. Vui lòng kiểm tra và cập nhật nếu cần.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contactName">Tên liên hệ <span className="text-destructive">*</span></Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Họ và tên"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactPhone">Số điện thoại <span className="text-destructive">*</span></Label>
          <Input
            id="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="0912345678"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email liên hệ <span className="text-destructive">*</span></Label>
          <Input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
        </div>
      </div>
    </div>
  );
};
