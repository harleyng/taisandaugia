import { VneidVerifiedBadge } from "@/components/vneid/VneidButton";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDayMonthYear } from "@/lib/biddingContracts/contractDetail";
import { ID_TYPE_LABELS, type ContractWithSession, type KycField } from "@/types/bidding-contract";
import type { AuctionSessionItem } from "@/types/auction-session";
import { HsCard, KvList, WarnTag } from "./ui";

const Mono = ({ children }: { children: string | null }) => <span className="font-mono text-[12.5px]">{children ?? "—"}</span>;

/** Thẻ "Người đăng ký" (design `who`): tổ chức → người ĐDPL/người đăng ký → người được uỷ quyền. */
export function ApplicantCard({ contract: c }: { contract: ContractWithSession }) {
  const org = c.buyer_kind === "organization";
  const edited = new Set<KycField>(c.id_edited_fields ?? []);
  const flag = (f: KycField) => (edited.has(f) ? <WarnTag>đã sửa</WarnTag> : null);
  const proxyEdited = new Set<KycField>(c.proxy_id_edited_fields ?? []);

  return (
    <HsCard title="Người đăng ký">
      <KvList
        rows={[
          org && ["Tổ chức", c.org_name],
          org && ["Mã số doanh nghiệp", <Mono key="t">{c.org_tax_code}</Mono>],
          org && ["Địa chỉ trụ sở", c.org_address],
          [
            org ? "Người đại diện" : "Họ và tên",
            <span key="n" className="inline-flex flex-wrap items-center gap-1.5">
              {c.full_name}
              {flag("full_name")}
              {c.identity_source === "vneid" && <VneidVerifiedBadge />}
            </span>,
          ],
          [
            `Số ${ID_TYPE_LABELS[c.id_type]}`,
            <span key="i">
              <Mono>{c.id_number}</Mono>
              {flag("id_number")}
            </span>,
          ],
          c.date_of_birth && [
            "Ngày sinh",
            <span key="d">
              {formatDayMonthYear(c.date_of_birth)}
              {flag("date_of_birth")}
            </span>,
          ],
          ["Điện thoại", <span key="p" className="tabular-nums">{c.phone}</span>],
          ["Email", c.email],
          [
            "Địa chỉ",
            <span key="a">
              {c.address || "—"}
              {flag("address")}
            </span>,
          ],
          c.has_proxy && c.proxy_full_name && [
            "Người được uỷ quyền",
            <span key="x">
              {c.proxy_full_name}
              {proxyEdited.size > 0 && <WarnTag>đã sửa</WarnTag>}
            </span>,
          ],
          c.has_proxy && c.proxy_id_number && [
            `Số ${ID_TYPE_LABELS[c.proxy_id_type ?? "cccd"]} người uỷ quyền`,
            <Mono key="xi">{c.proxy_id_number}</Mono>,
          ],
          c.has_proxy && c.proxy_phone && ["SĐT người uỷ quyền", <span key="xp" className="tabular-nums">{c.proxy_phone}</span>],
        ]}
      />
    </HsCard>
  );
}

/**
 * Thẻ "Lô đăng ký" (design `lotH`): các lô người mua chọn khi mua hồ sơ (hồ sơ cũ
 * không chọn = mọi lô); tiền đặt trước phải nộp = tổng tiền đặt trước các lô đó.
 */
export function LotsCard({ items, required }: { items: AuctionSessionItem[]; required: number | null }) {
  const lots = [...items].sort((a, b) => (a.lot_no ?? 0) - (b.lot_no ?? 0));
  return (
    <HsCard title="Tài sản đăng ký" aside={`${lots.length} tài sản`}>
      <div className="rounded-[10px] text-[13.5px] shadow-[inset_0_0_0_1px_hsl(var(--border))]">
        {lots.map((i) => (
          <div key={i.id} className="flex justify-between gap-3 border-t px-3.5 py-2.5 first:border-t-0">
            <span className="min-w-0 truncate">
              <b className="font-semibold">Tài sản {i.lot_no}</b> · {i.title}
            </span>
            <span className="shrink-0 tabular-nums">{i.deposit_amount != null ? formatVnd(i.deposit_amount) : "—"}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 rounded-b-[10px] border-t bg-muted px-3.5 py-2.5 text-muted-foreground">
          <span>Tiền đặt trước phải nộp</span>
          <b className="font-semibold tabular-nums text-foreground">{required != null ? formatVnd(required) : "—"}</b>
        </div>
      </div>
    </HsCard>
  );
}
