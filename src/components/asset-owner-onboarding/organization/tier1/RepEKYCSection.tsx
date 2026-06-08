import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { Camera, CheckCircle2, UserSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  repIdFrontUploaded: boolean;
  repIdBackUploaded: boolean;
  repSelfieUploaded: boolean;
  onUpload: (slot: "rep_id_front" | "rep_id_back" | "rep_selfie", file: File) => Promise<void>;
}

const PhotoTile = ({
  label, hint, icon: Icon, uploaded, onPick,
}: {
  label: string; hint: string; icon: typeof Camera; uploaded: boolean; onPick: (f: File) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          "w-full rounded-2xl border-2 p-4 flex flex-col items-center gap-2 transition-all",
          uploaded ? "border-green-400 bg-green-50" : "border-dashed border-border hover:border-primary/50 hover:bg-muted/20"
        )}
      >
        {uploaded ? (
          <>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-700">Đã tải lên</span>
            <span className="text-[11px] text-muted-foreground">Nhấn để thay</span>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold text-foreground">{label}</span>
            <span className="text-[11px] text-muted-foreground text-center">{hint}</span>
            <span className="text-[11px] text-primary font-medium">Tải lên</span>
          </>
        )}
      </button>
    </div>
  );
};

export const RepEKYCSection = ({
  repIdFrontUploaded, repIdBackUploaded, repSelfieUploaded, onUpload,
}: Props) => (
  <Card className="rounded-2xl p-5 space-y-4">
    <div>
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">C</span>
        eKYC người đại diện
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">
        Ảnh CCCD/Hộ chiếu và selfie của người thực hiện ký kết/uỷ quyền.
      </p>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <PhotoTile
        label="Mặt trước CCCD"
        hint="Mặt có ảnh và họ tên"
        icon={Camera}
        uploaded={repIdFrontUploaded}
        onPick={(f) => onUpload("rep_id_front", f)}
      />
      <PhotoTile
        label="Mặt sau CCCD"
        hint="Mặt có mã vạch"
        icon={Camera}
        uploaded={repIdBackUploaded}
        onPick={(f) => onUpload("rep_id_back", f)}
      />
      <PhotoTile
        label="Selfie"
        hint="Chân dung rõ nét"
        icon={UserSquare}
        uploaded={repSelfieUploaded}
        onPick={(f) => onUpload("rep_selfie", f)}
      />
    </div>
  </Card>
);
