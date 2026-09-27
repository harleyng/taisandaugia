import { useState } from "react";
import { Box, Glasses, ShieldCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import { summarizeScans, usePostingScans } from "@/hooks/useAsset3dScans";
import { usePostingVrOrders } from "@/hooks/useVrTourOrders";
import { usePostingAuthenticationOrders } from "@/hooks/useAuthenticationOrders";
import { summarizeVrOrders } from "@/lib/vrTour/status";
import { summarizeGdOrders } from "@/lib/authentication/status";
import type { AssetPosting } from "@/types/asset-posting";
import { usePostingCanWrite } from "../postingAccess";
import { EnhanceServiceDialog, type EnhanceKind } from "./EnhanceServiceDialog";

type EnhanceState = "has" | "busy" | "off";

interface EnhanceRow {
  kind: EnhanceKind;
  title: string;
  icon: LucideIcon;
  state: EnhanceState;
  line: string;
  action: string;
}

const LINK = "h-auto p-0 text-[13px] font-semibold text-primary hover:bg-transparent hover:underline";

/**
 * "Tăng sức hút hồ sơ": 3D · VR tour · Giám định, mỗi dịch vụ một dòng gọn. Nút mở
 * dialog chứa thẻ đầy đủ của dịch vụ đó — trạng thái dòng đọc cùng query với thẻ.
 */
export function PostingEnhanceCard({ posting: p, locked }: { posting: AssetPosting; locked: boolean }) {
  const [open, setOpen] = useState<EnhanceKind | null>(null);
  const canWrite = usePostingCanWrite();
  const { data: scans = [] } = usePostingScans(p.id);
  const { data: vrOrders = [] } = usePostingVrOrders(p.id);
  const { data: gdOrders = [] } = usePostingAuthenticationOrders(p.id);

  const s3 = summarizeScans(scans);
  const vr = summarizeVrOrders(vrOrders);
  const gd = summarizeGdOrders(gdOrders);
  const approved = p.review_status === "approved";

  const rows: EnhanceRow[] = [
    {
      kind: "3d",
      title: "Model 3D",
      icon: Box,
      state: s3.current ? "has" : s3.inFlight ? "busy" : "off",
      line: s3.current
        ? approved
          ? "Đã sẵn sàng"
          : "Đã sẵn sàng · công khai khi được duyệt"
        : s3.inFlight
          ? "Đang quét / xử lý model"
          : "Quét 3D qua đối tác, ~2 ngày",
      action: "Đặt quét",
    },
    {
      kind: "vr",
      title: "VR tour",
      icon: Glasses,
      state: vr.attached ? "has" : vr.active ? "busy" : "off",
      line: vr.attached ? "Đã gắn vào hồ sơ" : vr.active ? "Đơn đang xử lý" : "Tham quan 360° cho BĐS",
      action: "Đặt dịch vụ",
    },
    {
      kind: "gd",
      title: "Giám định",
      icon: ShieldCheck,
      state: gd.completed ? "has" : gd.active ? "busy" : "off",
      line: gd.completed
        ? gd.completed.verdict === "authentic"
          ? "Có chứng thư giám định"
          : "Đã có kết luận giám định"
        : gd.active
          ? "Đơn đang xử lý"
          : "Chứng thư do đối tác cấp",
      action: "Đặt giám định",
    },
  ];

  return (
    <SectionCard title="Tăng sức hút hồ sơ">
      <div>
        <p className="mb-1 text-[12.5px] text-muted-foreground">
          Hồ sơ có 3D/VR và giám định thường nhận báo giá nhanh hơn.
        </p>
        <ul className="flex flex-col">
          {rows.map((r) => {
            const Icon = r.icon;
            const good = r.state === "has" && (r.kind !== "gd" || gd.completed?.verdict === "authentic");
            return (
              <li key={r.kind} className="flex items-center gap-3 border-t border-border py-[11px] first:border-t-0 first:pt-0.5">
                <span
                  className={cn(
                    "grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px]",
                    r.state === "has" ? "bg-primary/10 text-primary" : "bg-muted text-foreground/70",
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-foreground">{r.title}</p>
                  <p className={cn("text-xs", good ? "text-success" : "text-muted-foreground")}>{r.line}</p>
                </div>
                {r.state !== "off" ? (
                  <Button variant="ghost" className={LINK} onClick={() => setOpen(r.kind)}>
                    {r.state === "has" ? "Xem" : "Theo dõi"}
                  </Button>
                ) : (
                  canWrite &&
                  !locked && (
                    <Button variant="outline" size="sm" className="h-8 px-[11px] text-[12.5px]" onClick={() => setOpen(r.kind)}>
                      {r.action}
                    </Button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <EnhanceServiceDialog kind={open} onClose={() => setOpen(null)} posting={p} locked={locked} />
    </SectionCard>
  );
}
