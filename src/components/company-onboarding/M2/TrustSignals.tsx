import { Lock, Scale, Clock } from "lucide-react";

const SIGNALS = [
  { icon: Lock, label: "Mã hóa AES-256", desc: "Dữ liệu được bảo vệ toàn trình" },
  { icon: Scale, label: "Tuân thủ NĐ 13/2023/NĐ-CP", desc: "Quy định bảo vệ dữ liệu cá nhân" },
  { icon: Clock, label: "Xét duyệt trong 24h", desc: "Sau khi nộp hồ sơ đầy đủ" },
];

export const TrustSignals = () => (
  <div className="space-y-3">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      Cam kết bảo mật
    </p>
    {SIGNALS.map(({ icon: Icon, label, desc }) => (
      <div key={label} className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
        </div>
      </div>
    ))}
  </div>
);
