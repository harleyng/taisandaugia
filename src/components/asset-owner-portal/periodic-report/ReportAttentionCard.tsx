import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import type { ReportPayload } from "@/lib/ownerPeriodicReport";
import { reportAttentionItems, type AttentionItem } from "@/lib/ownerReportDigest";

const SHOWN = 6;

const TONE: Record<AttentionItem["tone"], string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  muted: "text-foreground",
};

/** "Cần lãnh đạo lưu ý": bỏ cọc, khoản chờ thu, tài sản tồn đọng — gom từ phần 3–4 của báo cáo. */
export function ReportAttentionCard({ payload }: { payload: ReportPayload }) {
  const items = reportAttentionItems(payload);
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOWN);

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl bg-card px-5 py-[18px] shadow-card">
      <h3 className="text-[15px] font-semibold text-foreground">
        Cần lãnh đạo lưu ý{items.length ? ` · ${items.length}` : ""}
      </h3>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">Không có vấn đề phát sinh trong kỳ.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-[13.5px]">
            <tbody>
              {shown.map((i) => (
                <tr key={i.key} className="border-b last:border-0">
                  <td className="py-2.5 pr-2.5 align-middle">
                    <b className="block font-semibold text-foreground">{i.title}</b>
                    {i.branchName && <small className="block text-[12.5px] text-muted-foreground">{i.branchName}</small>}
                  </td>
                  <td className={cn("px-2.5 py-2.5 align-middle", TONE[i.tone])}>{i.issue}</td>
                  <td className="py-2.5 pl-2.5 text-right align-middle font-semibold tabular-nums">
                    {i.amount !== null ? formatMoneyShort(i.amount) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > SHOWN && (
            <Button variant="ghost" size="sm" className="mt-1 h-8 px-2 text-muted-foreground" onClick={() => setAll(!all)}>
              {all ? "Thu gọn" : `Xem thêm ${items.length - SHOWN} mục`}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
