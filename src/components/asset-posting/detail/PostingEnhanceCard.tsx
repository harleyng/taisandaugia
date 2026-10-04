import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Calculator, Glasses, ShieldCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import { summarizeScans, usePostingScans } from "@/hooks/useAsset3dScans";
import { usePostingVrOrders } from "@/hooks/useVrTourOrders";
import { usePostingAuthenticationOrders } from "@/hooks/useAuthenticationOrders";
import { usePostingValuationOrders } from "@/hooks/useValuationOrders";
import { summarizeValuations } from "@/lib/valuation/status";
import { summarizeVrOrders } from "@/lib/vrTour/status";
import { summarizeGdOrders } from "@/lib/authentication/status";
import type { AssetPosting } from "@/types/asset-posting";
import { usePostingCanWrite } from "../postingAccess";
import { EnhanceServiceDialog, type EnhanceKind } from "./EnhanceServiceDialog";

type EnhanceState = "has" | "busy" | "off";

interface EnhanceRow {
  /** Dịch vụ mở trong dialog — hoặc tab riêng của hồ sơ (thẩm định giá / giám định). */
  kind: EnhanceKind | "tdg" | "gd";
  tab?: "tham-dinh" | "giam-dinh";
  title: string;
  icon: LucideIcon;
  state: EnhanceState;
  line: string;
  action: string;
}

const LINK = "h-auto p-0 text-[13px] font-semibold text-primary hover:bg-transparent hover:underline";

/**
 * "Tăng sức hút hồ sơ": 3D · VR tour · Thẩm định giá · Giám định, mỗi dịch vụ một dòng gọn.
 * 3D / VR mở dialog chứa thẻ đầy đủ; Thẩm định giá / Giám định chuyển sang tab riêng của hồ sơ
 * (nơi chọn đối tác riêng hay dịch vụ của sàn). Trạng thái dòng đọc cùng query với thẻ.
 */
export function PostingEnhanceCard({ posting: p, locked }: { posting: AssetPosting; locked: boolean }) {
  const [open, setOpen] = useState<EnhanceKind | null>(null);
  const [, setParams] = useSearchParams();
  const canWrite = usePostingCanWrite();
  const { data: scans = [] } = usePostingScans(p.id);
  const { data: vrOrders = [] } = usePostingVrOrders(p.id);
  const { data: gdOrders = [] } = usePostingAuthenticationOrders(p.id);
  const { data: tdgOrders = [] } = usePostingValuationOrders(p.id);

  const s3 = summarizeScans(scans);
  const vr = summarizeVrOrders(vrOrders);
  const gd = summarizeGdOrders(gdOrders);
  const tdg = summarizeValuations(tdgOrders);
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
      kind: "tdg",
      tab: "tham-dinh",
      title: "Thẩm định giá",
      icon: Calculator,
      state: tdg.current ? "has" : tdg.active ? "busy" : "off",
      line: tdg.current ? "Có chứng thư thẩm định giá" : tdg.active ? "Đơn đang xử lý" : "Căn cứ đặt giá khởi điểm",
      action: "Thẩm định giá",
    },
    {
      kind: "gd",
      tab: "giam-dinh",
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
          Hồ sơ có 3D/VR, thẩm định giá và giám định thường nhận báo giá nhanh hơn.
        </p>
        <ul className="flex flex-col">
          {rows.map((r) => {
            const Icon = r.icon;
            const good = r.state === "has" && (r.kind !== "gd" || gd.completed?.verdict === "authentic");
            const go = () => {
              if (r.tab) {
                const tab = r.tab;
                setParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("tab", tab);
                  return next;
                });
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else setOpen(r.kind as EnhanceKind);
            };
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
                  <Button variant="ghost" className={LINK} onClick={go}>
                    {r.state === "has" ? "Xem" : "Theo dõi"}
                  </Button>
                ) : (
                  canWrite &&
                  !locked && (
                    <Button variant="outline" size="sm" className="h-8 px-[11px] text-[12.5px]" onClick={go}>
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
