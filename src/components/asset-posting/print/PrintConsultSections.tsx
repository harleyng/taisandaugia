import { countByStatus, sortItemsForSeller } from "@/lib/legalConsult/checklist";
import { itemStatusLabel } from "@/lib/legalConsult/status";
import { isPreApproval, printDay, type PrintTone } from "@/lib/asset-posting/postingPrint";
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
