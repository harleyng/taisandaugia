import { useNavigate } from "react-router-dom";
import { FileText, History, Landmark, UserRound } from "lucide-react";
import { SectionCard } from "@/components/auction-sessions/detail/ui";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { BUYER_DEPOSIT_TAGS, REVIEW_TAGS, buyerDepositStateOf, type Tag } from "@/lib/biddingContracts/buyerContract";
import { buyerHistoryOf } from "@/lib/biddingContracts/buyerHistory";
import { myContractDepositPath } from "@/lib/biddingContracts/paths";
import { useContractReviewEvents } from "@/hooks/useBiddingContracts";
import { registeredLotsOf, type MyContract } from "@/hooks/useBuyerContracts";
import { BUYER_KIND_LABELS, ID_TYPE_LABELS } from "@/types/bidding-contract";
import { DocLine, InfoGrid, TagPill } from "../ui";

/** "••• ••• 1234" — chỉ lộ 4 số cuối giấy tờ. */
const maskId = (n: string | null | undefined) => (n ? `••• ••• ${n.slice(-4)}` : "—");
const dob = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN") : "—");
const extOf = (path: string) => (/\.pdf$/i.test(path) ? "PDF" : "ẢNH");

export function RegistrantSection({ contract: c }: { contract: MyContract }) {
  const org = c.buyer_kind === "organization";
  const rows = [
    { label: "Loại", value: BUYER_KIND_LABELS[c.buyer_kind] },
    ...(org
      ? [
          { label: "Tổ chức", value: c.org_name ?? "—" },
          { label: "Mã số thuế", value: c.org_tax_code ?? "—" },
        ]
      : []),
    { label: org ? "Người đại diện" : "Họ tên", value: c.full_name },
    { label: ID_TYPE_LABELS[c.id_type], value: <span className="font-mono">{maskId(c.id_number)}</span> },
    { label: "Ngày sinh", value: dob(c.date_of_birth) },
    { label: "Điện thoại", value: c.phone },
    { label: "Email", value: c.email },
    { label: "Địa chỉ", value: c.address, full: true },
    {
      label: "Người dự phiên",
      value: c.has_proxy
        ? `${c.proxy_full_name ?? "Người được uỷ quyền"} · ${ID_TYPE_LABELS[c.proxy_id_type ?? "cccd"]} ${maskId(c.proxy_id_number)}`
        : org
          ? "Chính người đại diện theo pháp luật"
          : "Chính người đăng ký",
      full: true,
    },
  ];
  return (
    <SectionCard icon={UserRound} title="Người đăng ký">
      <div className="px-4 pb-4">
        <InfoGrid rows={rows} />
      </div>
    </SectionCard>
  );
}

export function DocumentsSection({ contract: c }: { contract: MyContract }) {
  const tag: Tag =
    c.status === "pending_payment"
      ? { label: "Chưa gửi", tone: "muted" }
      : c.review_status === "approved"
        ? { label: "Hợp lệ", tone: "ok" }
        : REVIEW_TAGS[c.review_status];
  const docs: { ext: string; title: string; sub: string }[] = [];
  if (c.identity_source === "vneid" && !c.id_front_path) {
    docs.push({ ext: "VNeID", title: "Danh tính — xác thực VNeID", sub: `${ID_TYPE_LABELS[c.id_type]} ${maskId(c.id_number)}` });
  }
  if (c.id_front_path) docs.push({ ext: extOf(c.id_front_path), title: `${ID_TYPE_LABELS[c.id_type]} mặt trước`, sub: c.full_name });
  if (c.id_back_path) docs.push({ ext: extOf(c.id_back_path), title: `${ID_TYPE_LABELS[c.id_type]} mặt sau`, sub: c.full_name });
  if (c.org_reg_doc_path) docs.push({ ext: extOf(c.org_reg_doc_path), title: "Giấy chứng nhận đăng ký doanh nghiệp", sub: c.org_name ?? "" });
  if (c.proxy_id_front_path) docs.push({ ext: extOf(c.proxy_id_front_path), title: "Giấy tờ người được uỷ quyền", sub: c.proxy_full_name ?? "" });
  if (c.poa_doc_path) docs.push({ ext: extOf(c.poa_doc_path), title: "Giấy uỷ quyền", sub: c.proxy_full_name ?? "" });

  return (
    <SectionCard icon={FileText} title="Giấy tờ đã nộp">
      <div className="flex flex-col gap-3 px-4 pb-4">
        {docs.map((d) => (
          <DocLine key={d.title} ext={d.ext} title={d.title} sub={d.sub} aside={<TagPill tag={tag} />} />
        ))}
        {c.review_status === "needs_info" && c.review_note && (
          <p className="text-[13px] text-[hsl(var(--tier-warn-fg))]">Tổ chức yêu cầu: {c.review_note}</p>
        )}
      </div>
    </SectionCard>
  );
}

export function DepositSection({ contract: c }: { contract: MyContract }) {
  const navigate = useNavigate();
  const lots = registeredLotsOf(c);
  const total = lots.reduce((a, l) => a + (l.deposit_amount ?? 0), 0);
  const state = buyerDepositStateOf(c);
  const canGuide = state === "pending" || state === "sent";
  return (
    <SectionCard
      icon={Landmark}
      title="Tiền đặt trước"
      aside={
        <span className="flex items-center gap-2.5">
          <TagPill tag={BUYER_DEPOSIT_TAGS[state]} />
          {canGuide && (
            <button type="button" className="text-[13px] font-medium text-primary" onClick={() => navigate(myContractDepositPath(c.code))}>
              Hướng dẫn nộp
            </button>
          )}
        </span>
      }
    >
      <div className="px-4 pb-4">
        <div className="flex flex-col gap-2">
          {lots.map((l) => (
            <div key={l.id} className="flex justify-between gap-3 rounded-[10px] bg-muted px-3 py-2.5 text-sm">
              <span className="min-w-0 text-foreground">
                Tài sản {l.lot_no} · {l.title}
              </span>
              <b className="shrink-0">{formatVnd(l.deposit_amount ?? 0)}</b>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Tổng</span>
          <b className="text-[17px] text-foreground">{formatVnd(total)}</b>
        </div>
      </div>
    </SectionCard>
  );
}

export function HistorySection({ contract: c }: { contract: MyContract }) {
  const { data: events = [] } = useContractReviewEvents(c.id);
  const items = buyerHistoryOf(c, events);
  return (
    <SectionCard icon={History} title="Lịch sử hồ sơ">
      <ol className="px-4 pb-4">
        {items.map((h, i) => (
          <li key={`${h.at}-${i}`} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-t border-border py-2 text-sm first:border-0">
            <span className="text-xs text-muted-foreground">{formatDateTime(h.at)}</span>
            <span className={cn(h.tone === "current" && "text-primary", h.tone === "warn" && "text-[hsl(var(--tier-warn-fg))]")}>
              {h.text}
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
