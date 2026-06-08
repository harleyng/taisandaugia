import { User, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetOwnerBranch } from "@/types/asset-owner";

interface Props {
  value: AssetOwnerBranch | null;
  onChange: (branch: AssetOwnerBranch) => void;
}

const OPTIONS: {
  key: AssetOwnerBranch;
  icon: typeof User;
  title: string;
  subtitle: string;
  tags: string[];
}[] = [
  {
    key: "individual",
    icon: User,
    title: "Cá nhân",
    subtitle: "Bạn tự nguyện bán tài sản cá nhân hoặc sở hữu cá nhân",
    tags: ["Bất động sản", "Xe cộ", "Tài sản khác"],
  },
  {
    key: "organization",
    icon: Building2,
    title: "Tổ chức",
    subtitle: "Ngân hàng, AMC, Thi hành án, Cơ quan nhà nước, Quản tài viên",
    tags: ["Ngân hàng / TCTD", "AMC", "Thi hành án", "Cơ quan nhà nước"],
  },
];

export const BranchSelector = ({ value, onChange }: Props) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-foreground">Bạn là ai?</h2>
      <p className="text-sm text-muted-foreground mt-0.5">
        Chọn loại chủ thể để chúng tôi hướng dẫn đúng quy trình xác thực
      </p>
    </div>
    <div className="grid sm:grid-cols-2 gap-3">
      {OPTIONS.map(({ key, icon: Icon, title, subtitle, tags }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "text-left rounded-2xl border-2 p-5 transition-all",
              selected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "rounded-xl p-2.5 flex-shrink-0",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              {selected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
            </div>
            <p className="font-semibold text-foreground mt-3">{title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((t) => (
                <span
                  key={t}
                  className={cn(
                    "text-[11px] rounded-full px-2 py-0.5 font-medium",
                    selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>

    {value && (
      <div className="flex justify-end">
        <button
          onClick={() => onChange(value)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Tiếp tục
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )}
  </div>
);
