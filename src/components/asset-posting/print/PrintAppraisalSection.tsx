import { formatVnd } from "@/lib/advertising/slug";
import { printDay } from "@/lib/asset-posting/postingPrint";
import { APPRAISAL_EXPIRY_LABEL, appraisalExpiryOf } from "@/lib/dossier/expiry";
import { defaultValidUntil } from "@/lib/dossier/draft";
import type { PostingPrintData } from "@/hooks/usePostingPrintData";
import { SectionHead } from "./printParts";

/** 05 Kết quả thẩm định giá — đơn của sàn hoặc kết quả đối tác riêng; chưa có thì không in mục. */
export function PrintAppraisalSection({ data }: { data: PostingPrintData }) {
  const a = data.appraisal;
  if (!a) return null;

  // Không ghi hạn ⇒ ngày cấp + 6 tháng, khớp cách SQL tính hạn chứng thư.
  const validUntil = a.validUntil ?? (a.issuedAt ? defaultValidUntil(a.issuedAt) : null);
  const expiry = appraisalExpiryOf(validUntil);
  const rows: [string, string][] = [
    ["Đơn vị thẩm định", `${a.partnerName ?? "—"}${a.source === "platform" ? " (qua sàn)" : ""}`],
    ["Giá thẩm định", formatVnd(a.value)],
    ...(a.certificateNo ? ([["Số chứng thư", a.certificateNo]] as [string, string][]) : []),
    ["Ngày chứng thư", printDay(a.issuedAt)],
    ["Hiệu lực đến", printDay(validUntil)],
  ];

  return (
    <section className="sec">
      <SectionHead n="05" title="Kết quả thẩm định giá" />
      <table className="tbl">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="k">{k}</td>
              <td>
                <b>{v}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {expiry && expiry !== "valid" && (
        <div className="concl">
          <b style={{ color: expiry === "expired" ? "var(--err)" : "var(--me)" }}>{APPRAISAL_EXPIRY_LABEL[expiry]}</b>
        </div>
      )}
    </section>
  );
}
