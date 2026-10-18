import { Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetOwnerOrgKYC, AssetOwnerOrgKYCStatus } from "@/types/asset-owner";

const STATUS: Record<AssetOwnerOrgKYCStatus, { label: string; className: string }> = {
  draft: { label: "Nháp", className: "bg-muted text-muted-foreground" },
  pending_review: { label: "Chờ duyệt", className: "bg-warning/15 text-warning" },
  under_review: { label: "Đang xét duyệt", className: "bg-warning/15 text-warning" },
  approved: { label: "Đã duyệt", className: "bg-success/15 text-success" },
  rejected: { label: "Bị từ chối", className: "bg-destructive/10 text-destructive" },
};

interface Props {
  orgKycs: AssetOwnerOrgKYC[];
  /** null = đang khai hồ sơ tổ chức mới. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/**
 * Danh sách hồ sơ KYC tổ chức của tài khoản — một tài khoản KYC được nhiều tổ chức,
 * mỗi hồ sơ duyệt sinh một Trạm Điều Hành riêng.
 */
export const OrgKycPicker = ({ orgKycs, selectedId, onSelect, onNew }: Props) => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
    <p className="text-xs font-medium text-muted-foreground">Hồ sơ tổ chức của bạn</p>
    <div className="flex flex-wrap gap-2">
      {orgKycs.map((k) => {
        const status = STATUS[k.status];
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => onSelect(k.id)}
            className={cn(
              "flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              k.id === selectedId ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
            )}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-foreground">{k.org_name?.trim() || "Hồ sơ chưa đặt tên"}</span>
            <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium", status.className)}>
              {status.label}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onNew}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-sm font-medium text-primary transition-colors",
          selectedId === null ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Tổ chức mới
      </button>
    </div>
  </div>
);
