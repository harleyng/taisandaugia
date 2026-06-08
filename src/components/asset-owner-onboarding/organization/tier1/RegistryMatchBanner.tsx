import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { InfoBox } from "@/components/shared/InfoBox";

interface Props {
  score: number | null;
  linked: boolean;
}

export const RegistryMatchBanner = ({ score, linked }: Props) => {
  if (score === null) return null;

  if (linked && score >= 0.8) {
    return (
      <InfoBox variant="success" className="flex items-center gap-2 px-3 py-2 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
        <span className="text-green-700 font-medium">
          Khớp trên cổng quốc gia ({Math.round(score * 100)}% độ chính xác) – xác thực bổ sung tự động
        </span>
      </InfoBox>
    );
  }

  if (score >= 0.5) {
    return (
      <InfoBox variant="amber" className="flex items-center gap-2 px-3 py-2 text-xs">
        <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-amber-700">
          Có thể khớp trên cổng đấu giá ({Math.round(score * 100)}%) – đội ngũ sẽ xác minh khi duyệt
        </span>
      </InfoBox>
    );
  }

  return (
    <InfoBox variant="muted" className="flex items-center gap-2 px-3 py-2 text-xs">
      <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground">
        Không tìm thấy trên cổng quốc gia – đội ngũ sẽ xác minh thủ công qua tài liệu
      </span>
    </InfoBox>
  );
};
