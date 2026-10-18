import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import { useSessionAuctionConsultSuggestions } from "@/hooks/useAuctionConsultSuggestions";
import { useSessionLotResults } from "@/hooks/useLotStates";
import { useOrgConsignmentContractList } from "@/hooks/useOrgServiceRequests";
import { formatMismatches } from "@/lib/auctionConsult/suggestion";
import { formatVnd } from "@/lib/advertising/slug";
import { LOT_RESULT_DISPLAY, lotResultOf, type LotResultKey } from "@/lib/auctionSessions/sessionDetail";
import { paginate } from "@/lib/auctionSessions/sessionList";
import { formatMoneyShort } from "@/utils/money";
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from "@/types/asset-posting";
import type { AuctionSessionItem, AuctionSessionWithItems } from "@/types/auction-session";
import { AddSessionItemDialog } from "./AddSessionItemDialog";
import { DetailNote, TabHeader } from "./DetailCard";
import { EditSessionItemDialog } from "./EditSessionItemDialog";
import { MissingFloorNotice } from "./MissingFloorNotice";
import { RemoveSessionItemDialog } from "./RemoveSessionItemDialog";
import { DESIGN_BTN } from "./SessionDetailHero";
import { DotPill, type PillTone } from "./list/SessionStatePill";

const PAGE_SIZE = 10;
const SOURCE_LABEL = { listing: "Tin công khai", posting: "Ký gửi" } as const;
const RESULT_TONE: Record<LotResultKey, PillTone> = {
  wait: "muted",
  live: "live",
  paused: "warning",
  tied: "warning",
  won: "ok",
  unsold: "warning",
  closed: "muted",
  pulled: "muted",
};

const TH =
  "whitespace-nowrap border-b bg-muted/40 px-3.5 py-[11px] text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground";
const TD = "border-b px-3.5 py-[13px] align-middle";
const STICKY = "sticky right-0 w-11 bg-card shadow-[-1px_0_0_hsl(var(--border))]";
const short = (v: number | null) => (v != null ? formatMoneyShort(v) : "—");
const categoryName = (slug: string | null) => (slug ? (CHILD_NAME[slug] ?? PARENT_NAME[slug] ?? null) : null);

/** Lối xem tài sản nguồn: ký gửi → yêu cầu ký gửi; tin công khai → trang tin. */
function sourcePath(item: AuctionSessionItem): string | null {
  if (item.source === "posting" && item.asset_posting_id && item.service_request_id) {
    return `/portal/yeu-cau-ky-gui/${item.service_request_id}`;
  }
  if (item.source === "listing" && item.listing_id) return `/listings/${item.listing_id}`;
  return null;
}

interface Props {
  session: AuctionSessionWithItems;
  auctionOrgId: string | null;
  canUpdate: boolean;
  /** Còn trước giờ đấu và phiên chưa huỷ — thêm / sửa / gỡ lô được. */
  editable: boolean;
}

/** Tab "Tài sản" (design `itemsTab`): tiêu đề + bảng lô + chân tổng / phân trang. */
export function SessionItemsCard({ session, auctionOrgId, canUpdate, editable }: Props) {
  const navigate = useNavigate();
  const items = session.auction_session_items;
  const canEdit = canUpdate && editable;
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AuctionSessionItem | null>(null);
  const [removing, setRemoving] = useState<AuctionSessionItem | null>(null);
  // Server chặn xoá lô cuối của phiên đã công bố — tắt nút trước để khỏi bấm vào lỗi.
  const lockLastLot = session.status === "published" && items.length <= 1;
  // Chỉ cảnh báo lệch hình thức so với đề xuất tư vấn — không đổi phiên (BR-CNS-04).
  const { map: suggestions } = useSessionAuctionConsultSuggestions(session.id, canEdit);
  const mismatches = formatMismatches(session.auction_format, items, suggestions);

  const { data: lotStates = [] } = useSessionLotResults(session.id, session.status === "published");
  const { data: contracts = [] } = useOrgConsignmentContractList(items.some((i) => i.source === "posting"));
  // Chủ tài sản lấy từ hợp đồng ký gửi (RPC chỉ trả TÊN, ẩn khi hợp đồng đã huỷ).
  const ownerByRequest = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contracts) if (c.owner_name && !m.has(c.service_request_id)) m.set(c.service_request_id, c.owner_name);
    return m;
  }, [contracts]);
  const stateByLot = useMemo(() => new Map(lotStates.map((s) => [s.lot_id, s])), [lotStates]);

  const results = items.map((i) => lotResultOf(stateByLot.get(i.id), session.status));
  const totalStart = items.reduce((a, i) => a + (i.starting_price ?? 0), 0);
  const won = results.filter((r) => r.key === "won");
  const totalWon = won.reduce((a, r) => a + (r.amount ?? 0), 0);
  const pg = paginate(items, page, PAGE_SIZE);

  const lockReason =
    session.status === "cancelled"
      ? "Phiên đã huỷ — không thay đổi tài sản được nữa"
      : !canUpdate
        ? "Vai trò của bạn chưa được cấp quyền sửa phiên"
        : "Đã đến giờ đấu — không thêm, sửa hay gỡ tài sản được nữa";

  const header = (
    <TabHeader
      title="Tài sản trong phiên"
      description="Các tài sản đưa ra đấu giá trong phiên, kèm giá khởi điểm, tiền đặt trước và bước giá."
      actions={
        <Button
          className={DESIGN_BTN}
          onClick={() => setAdding(true)}
          disabled={!canEdit || !auctionOrgId}
          title={canEdit ? undefined : lockReason}
        >
          <Plus className="h-4 w-4" />
          Thêm tài sản
        </Button>
      }
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {header}

      {canEdit && <MissingFloorNotice session={session} />}

      {mismatches.length > 0 && (
        <DetailNote icon={<AlertTriangle />}>
          {mismatches.map((m) => (
            <p key={m.title}>
              Đề xuất tư vấn v{m.version} cho “{m.title}” là hình thức{" "}
              <strong>{AUCTION_FORMAT_LABELS[m.format as AuctionFormat] ?? m.format}</strong>, phiên đang là{" "}
              <strong>{AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format}</strong> — đổi ở phần thông
              tin phiên nếu phù hợp.
            </p>
          ))}
        </DetailNote>
      )}

      {items.length === 0 ? (
        <section className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-card">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-muted">
            <FileText className="h-[18px] w-[18px]" />
          </span>
          <b className="mb-1 block text-[15px] text-foreground">Chưa có tài sản</b>
          Chọn từ tài sản đã ký gửi với tổ chức hoặc tin đăng công khai.
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th className={cn(TH, "w-14 pl-[22px]")}>STT</th>
                  <th className={TH}>Tài sản</th>
                  <th className={TH}>Chủ tài sản</th>
                  <th className={cn(TH, "text-right")}>Giá khởi điểm</th>
                  <th className={cn(TH, "text-right")}>Đặt trước</th>
                  <th className={cn(TH, "text-right")}>Bước giá</th>
                  <th className={TH}>Kết quả</th>
                  <th
                    className={cn(
                      TH,
                      STICKY,
                      "pr-[18px] before:pointer-events-none before:absolute before:inset-0 before:bg-muted/40 before:content-['']",
                    )}
                    aria-label="Thao tác"
                  />
                </tr>
              </thead>
              <tbody>
                {pg.slice.map((item, idx) => {
                  const result = results[pg.start + idx];
                  const path = sourcePath(item);
                  const sourceGone = !item.listing_id && !item.asset_posting_id;
                  const sub = [categoryName(item.category_slug) ?? SOURCE_LABEL[item.source], sourceGone && "Nguồn đã bị gỡ"]
                    .filter(Boolean)
                    .join(" · ");
                  const owner = item.service_request_id ? ownerByRequest.get(item.service_request_id) : undefined;
                  return (
                    <tr key={item.id} className="[&:last-child>td]:border-b-0">
                      <td className={cn(TD, "pl-[22px] tabular-nums")}>
                        <b>{item.lot_no}</b>
                      </td>
                      <td className={cn(TD, "max-w-[300px]")}>
                        <b className="block truncate font-semibold" title={item.title}>
                          {item.title}
                        </b>
                        <small className="mt-0.5 block text-xs text-muted-foreground">{sub}</small>
                      </td>
                      <td className={cn(TD, "max-w-[200px] text-muted-foreground")}>{owner ?? "—"}</td>
                      <td className={cn(TD, "whitespace-nowrap text-right tabular-nums")}>
                        <b className="font-semibold">{item.starting_price != null ? formatVnd(item.starting_price) : "—"}</b>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap text-right tabular-nums")}>{short(item.deposit_amount)}</td>
                      <td className={cn(TD, "whitespace-nowrap text-right tabular-nums")}>{short(item.bid_step)}</td>
                      <td className={TD}>
                        <div className="flex flex-col items-start gap-1">
                          <DotPill tone={RESULT_TONE[result.key]}>{LOT_RESULT_DISPLAY[result.key]}</DotPill>
                          <small className="text-xs tabular-nums text-muted-foreground">
                            {result.amount != null ? formatVnd(result.amount) : " "}
                          </small>
                        </div>
                      </td>
                      <td className={cn(TD, STICKY, "pr-[18px] text-right")}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label="Thao tác">
                              <MoreHorizontal className="h-[18px] w-[18px]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[170px]">
                            <DropdownMenuItem
                              className="text-[13px] font-medium"
                              disabled={!path}
                              onClick={() => path && navigate(path)}
                            >
                              Xem chi tiết tài sản
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[13px] font-medium"
                              disabled={!canEdit}
                              onClick={() => setEditing(item)}
                            >
                              Sửa tài sản
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[13px] font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                              disabled={!canEdit || lockLastLot}
                              onClick={() => setRemoving(item)}
                            >
                              Gỡ tài sản
                            </DropdownMenuItem>
                            {(!canEdit || lockLastLot) && (
                              <p className="max-w-[220px] px-2 pb-1.5 pt-1 text-[11.5px] leading-snug text-muted-foreground">
                                {canEdit ? "Phiên đã công bố phải còn ít nhất 1 tài sản" : lockReason}
                              </p>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-[22px] py-3 text-[12.5px] tabular-nums text-muted-foreground">
            <span>
              Tổng giá khởi điểm <b className="font-semibold text-foreground">{formatVnd(totalStart)}</b> · Tổng giá trúng{" "}
              <b className="font-semibold text-foreground">{won.length ? formatVnd(totalWon) : "—"}</b>
            </span>
            <div className="flex items-center gap-3">
              <span>
                {pg.start + 1}–{Math.min(pg.start + PAGE_SIZE, items.length)} / {items.length} tài sản
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={pg.page <= 1}
                  onClick={() => setPage(pg.page - 1)}
                  title="Trang trước"
                >
                  <ChevronLeft className="h-[18px] w-[18px]" />
                </Button>
                {Array.from({ length: pg.pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === pg.page ? "page" : undefined}
                    onClick={() => setPage(n)}
                    className={cn(
                      "h-7 min-w-7 rounded-[7px] px-1.5 text-[12.5px] text-foreground hover:bg-muted",
                      n === pg.page && "bg-primary/10 font-semibold text-primary hover:bg-primary/10",
                    )}
                  >
                    {n}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={pg.page >= pg.pages}
                  onClick={() => setPage(pg.page + 1)}
                  title="Trang sau"
                >
                  <ChevronRight className="h-[18px] w-[18px]" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {canEdit && (
        <>
          <AddSessionItemDialog session={session} auctionOrgId={auctionOrgId} open={adding} onOpenChange={setAdding} />
          <EditSessionItemDialog
            item={editing}
            sessionFormat={session.auction_format}
            biddingMethod={session.bidding_method}
            onOpenChange={(open) => !open && setEditing(null)}
          />
          <RemoveSessionItemDialog item={removing} onOpenChange={(open) => !open && setRemoving(null)} />
        </>
      )}
    </div>
  );
}
