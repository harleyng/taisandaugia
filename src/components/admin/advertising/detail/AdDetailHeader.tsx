import { AdStatusBadge } from "../AdStatusBadge";
import type { Advertisement } from "@/types/advertising";

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

const devices = (ad: Advertisement) =>
  [ad.show_desktop ? "Desktop" : null, ad.show_mobile ? "Mobile" : null].filter(Boolean).join(", ") || "—";

export function AdDetailHeader({ ad }: { ad: Advertisement }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h2 className="text-base font-semibold text-foreground mb-4">Thông tin chung</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2.5 gap-x-8">
        <Row label="Tên chiến dịch">{ad.name}</Row>
        <Row label="Trạng thái"><AdStatusBadge status={ad.status} /></Row>
        <Row label="Thời gian tạo">{fmt(ad.created_at)}</Row>
        <Row label="Thiết bị hiển thị">{devices(ad)}</Row>
        <Row label="Khách hàng">{ad.customer?.name ?? "—"}</Row>
      </div>
    </div>
  );
}
