import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { Camera, CheckCircle2, UserSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  idFrontUploaded: boolean;
  idBackUploaded: boolean;
  selfieUploaded: boolean;
  onUpload: (slot: "id_front" | "id_back" | "selfie", file: File) => Promise<void>;
}

const PhotoSlot = ({
  label,
  hint,
  icon: Icon,
  uploaded,
  onPick,
}: {
  label: string;
  hint: string;
  icon: typeof Camera;
  uploaded: boolean;
  onPick: (file: File) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          "w-full rounded-2xl border-2 p-5 flex flex-col items-center gap-2 transition-all",
          uploaded
            ? "border-green-400 bg-green-50"
            : "border-dashed border-border hover:border-primary/50 hover:bg-muted/20"
        )}
      >
        {uploaded ? (
          <>
            <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-700">{label} – Đã tải lên</span>
            <span className="text-[11px] text-muted-foreground">Nhấn để thay ảnh</span>
          </>
        ) : (
          <>
            <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold text-foreground">{label}</span>
            <span className="text-[11px] text-muted-foreground text-center">{hint}</span>
            <span className="text-[11px] text-primary font-medium">Nhấn để tải ảnh</span>
          </>
        )}
      </button>
    </div>
  );
};

export const EKYCSection = ({ idFrontUploaded, idBackUploaded, selfieUploaded, onUpload }: Props) => (
  <Card className="rounded-2xl p-5 space-y-4">
    <div>
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">B</span>
        eKYC – Xác thực danh tính
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">
        Ảnh phải rõ nét, đủ ánh sáng, không che khuất thông tin. Tệp JPG/PNG, tối đa 10 MB.
      </p>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <PhotoSlot
        label="Mặt trước CCCD"
        hint="Ảnh chụp mặt có ảnh và họ tên"
        icon={Camera}
        uploaded={idFrontUploaded}
        onPick={(f) => onUpload("id_front", f)}
      />
      <PhotoSlot
        label="Mặt sau CCCD"
        hint="Ảnh chụp mặt có mã vạch"
        icon={Camera}
        uploaded={idBackUploaded}
        onPick={(f) => onUpload("id_back", f)}
      />
      <PhotoSlot
        label="Selfie khuôn mặt"
        hint="Ảnh chân dung, nền sáng"
        icon={UserSquare}
        uploaded={selfieUploaded}
        onPick={(f) => onUpload("selfie", f)}
      />
    </div>
  </Card>
);
