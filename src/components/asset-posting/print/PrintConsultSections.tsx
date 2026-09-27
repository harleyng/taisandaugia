import { formatVnd } from "@/lib/advertising/slug";
import { countByStatus, sortItemsForSeller } from "@/lib/legalConsult/checklist";
import { itemStatusLabel } from "@/lib/legalConsult/status";
import { biddingMethodLabel } from "@/lib/auctionConsult/labels";
import { bidStepPercent, depositVnd } from "@/lib/auctionConsult/proposal";
import { decisionLabel } from "@/lib/auctionConsult/status";
import { isPreApproval, printDay, type PrintTone } from "@/lib/asset-posting/postingPrint";
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from "@/types/asset-posting";
import type { ProposalNoteKey } from "@/types/auctionConsult";
import type { PostingPrintData } from "@/hooks/usePostingPrintData";
import { PrintEmpty, SectionHead } from "./printParts";

const VERDICT_TONE: Record<string, PrintTone> = { sufficient: "ok", needs_clarification: "me", missing: "err" };

/** 03 Kết quả rà soát pháp lý — checklist của lần tư vấn pháp lý hoàn tất mới nhất. */
export function PrintLegalReviewSection({ data }: { data: PostingPrintData }) {
  const { current, items, active } = data.legal;
  const pre = isPreApproval(data.status.stage);

  if (!current) {
    return (
      <section className="sec">
        <SectionHead n="03" title="Kết quả rà soát pháp lý" />
        <PrintEmpty
          icon="§"
          title="Chưa có kết quả rà soát pháp lý"
          text={
            active
              ? "Yêu cầu rà soát đang được chuyên gia xử lý."
              : pre
                ? "Hồ sơ sẽ được rà soát sau khi sàn duyệt."
                : "Chưa yêu cầu rà soát. Tổ chức đấu giá sẽ tự thẩm định khi tiếp nhận hồ sơ."
          }
        />
      </section>
    );
  }

  const counts = countByStatus(items);
  const pending = counts.missing + counts.needs_clarification;
  const aux = `Bản ${current.version ?? "—"} · hoàn tất ${printDay(current.completed_at)}`;

  return (
    <section className="sec">
      <SectionHead n="03" title="Kết quả rà soát pháp lý" aux={aux} />
      <table className="tbl">
        <thead>
          <tr>
            <th>Hạng mục</th>
            <th>Kết quả</th>
            <th>Nhận xét của chuyên gia</th>
          </tr>
        </thead>
        <tbody>
          {sortItemsForSeller(items).map((it) => {
            const note = it.status !== "sufficient" && it.required_action ? it.required_action : it.expert_note;
            return (
              <tr key={it.id}>
                <td className="k">{it.label}</td>
                <td>
                  <span className={`vt ${VERDICT_TONE[it.status ?? ""] ?? "mu"}`}>{itemStatusLabel(it.status)}</span>
                </td>
                <td className="n">{note || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="concl">
        <span>
          Người rà soát: <b>{current.expert_name ?? current.partner_name ?? "—"}</b>
        </span>
        {items.length > 0 && (
          <span>
            Kết luận:{" "}
            <b style={{ color: pending > 0 ? "var(--me)" : "var(--ok)" }}>
              {pending > 0 ? `Cần bổ sung ${pending} mục` : "Đủ hồ sơ theo checklist"}
            </b>
          </span>
        )}
      </div>
    </section>
  );
}

/** 05 Tư vấn đấu giá — chỉ in khi đã có phương án hoàn tất. Không in giá bảo lưu (riêng tư). */
export function PrintAuctionConsultSection({ data }: { data: PostingPrintData }) {
  const { current, proposal: pr } = data.auction;
  if (!current || !pr) return null;

  const notes = (pr.field_notes ?? {}) as Partial<Record<ProposalNoteKey, string>>;
  const start = pr.starting_price == null ? null : Number(pr.starting_price);
  const depVal = pr.deposit_value == null ? null : Number(pr.deposit_value);
  const depV = depositVnd(pr.deposit_mode, depVal, start);
  const stepPct = bidStepPercent(pr.bid_step == null ? null : Number(pr.bid_step), start);
  const rows: [string, string, string | undefined][] = [
    [
      "Hình thức",
      pr.auction_format ? (AUCTION_FORMAT_LABELS[pr.auction_format as AuctionFormat] ?? pr.auction_format) : "—",
      notes.auction_format,
    ],
    ["Phương thức trả giá", biddingMethodLabel(pr.bidding_method), notes.bidding_method],
    ["Giá khởi điểm", start ? formatVnd(start) : "—", notes.starting_price],
    ["Bước giá", pr.bid_step ? `${formatVnd(pr.bid_step)}${stepPct != null ? ` (${stepPct}%)` : ""}` : "—", notes.bid_step],
    ...(pr.auction_format !== "truc_tiep"
      ? ([["Thời lượng mỗi lô", pr.lot_duration_minutes ? `${pr.lot_duration_minutes} phút` : "—", notes.lot_duration]] as [
          string,
          string,
          string | undefined,
        ][])
      : []),
    [
      "Tiền đặt trước",
      pr.deposit_mode === "percent" && depVal != null
        ? `${depVal}%${depV != null ? ` ≈ ${formatVnd(depV)}` : ""}`
        : depVal != null
          ? formatVnd(depVal)
          : "—",
      notes.deposit,
    ],
  ];

  return (
    <section className="sec">
      <SectionHead
        n="05"
        title="Tư vấn đấu giá"
        aux={`Bản ${current.version ?? "—"} · hoàn tất ${printDay(current.completed_at)}`}
      />
      {pr.rationale && <p className="desc">{pr.rationale}</p>}
      <table className="tbl">
        <thead>
          <tr>
            <th>Tham số</th>
            <th>Đề xuất</th>
            <th>Ghi chú của chuyên gia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v, note]) => (
            <tr key={k}>
              <td className="k">{k}</td>
              <td>
                <b>{v}</b>
              </td>
              <td className="n">{note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="concl">
        <span>
          Chuyên gia: <b>{current.expert_name ?? current.partner_name ?? "—"}</b>
        </span>
        <span>
          Quyết định của chủ tài sản: <b>{decisionLabel(current.seller_decision)}</b>
        </span>
      </div>
    </section>
  );
}
