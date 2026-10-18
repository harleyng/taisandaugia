import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { SessionFormValues } from "@/lib/auctionSessions/sessionForm";

const pad = (n: number) => String(n).padStart(2, "0");
const dm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "22/10/2026 · 09:00–11:30" cùng ngày; "25/09 → 20/10/2026" khác ngày; null nếu chưa khai. */
function previewRange(a: string | undefined, b: string | undefined): string | null {
  const x = a ? new Date(a) : null;
  if (!x || Number.isNaN(x.getTime())) return null;
  const y = b ? new Date(b) : null;
  if (!y || Number.isNaN(y.getTime())) return `${dm(x)} · ${hm(x)}`;
  return x.toDateString() === y.toDateString()
    ? `${dm(x)}/${x.getFullYear()} · ${hm(x)}–${hm(y)}`
    : `${dm(x)} → ${dm(y)}/${y.getFullYear()}`;
}

function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <li className="flex justify-between gap-2.5 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <b className={cn("text-right font-semibold tabular-nums", !value && "font-normal text-muted-foreground/70")}>
        {value || "Chưa khai báo"}
      </b>
    </li>
  );
}

interface Props {
  values: SessionFormValues;
  /** Nhãn trạng thái hiện tại ("Nháp" khi tạo mới). */
  stateLabel: string;
  submitLabel: string;
  busy: boolean;
  /** Số trường đang lỗi sau lần bấm Lưu đầu tiên. */
  errorCount: number;
  endInvalid: boolean;
  onCancel: () => void;
}

/** Cột phải dính: xem trước thẻ phiên + nút Huỷ / Lưu (design `.aside`). */
export function SessionFormAside({ values: v, stateLabel, submitLabel, busy, errorCount, endInvalid, onCancel }: Props) {
  const title = v.title.trim();
  return (
    <aside className="flex flex-col gap-4 min-[1150px]:sticky min-[1150px]:top-5">
      <section className="rounded-2xl bg-card shadow-card">
        <div className="px-5 py-[18px]">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-[5px] rounded-full bg-muted px-[9px] py-0.5 font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-['']">
              {stateLabel}
            </span>
            {AUCTION_FORMAT_LABELS[v.auction_format]}
            {v.province ? ` · ${v.province}` : ""}
          </div>
          <h3
            className={cn(
              "mt-1.5 text-[15px] font-semibold [text-wrap:pretty]",
              !title && "font-medium text-muted-foreground/70",
            )}
          >
            {title || "Tên phiên"}
          </h3>
          <ul className="mt-3.5 flex flex-col gap-2.5 border-t pt-3.5">
            <Line label="Nhận hồ sơ" value={previewRange(v.registration_start_at, v.registration_end_at)} />
            <Line label="Xem tài sản" value={previewRange(v.viewing_start_at, v.viewing_end_at)} />
            <Line label="Đấu giá" value={endInvalid ? null : previewRange(v.starts_at, v.ends_at)} />
            <Line label="Phí hồ sơ" value={v.dossier_fee ? formatMoneyFull(v.dossier_fee) : null} />
            <Line label="Tối đa" value={v.max_registrants ? `${v.max_registrants} người` : "Không giới hạn"} />
          </ul>
        </div>
        <div className="flex flex-col gap-2 border-t px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onCancel} disabled={busy}>
              Huỷ
            </Button>
            <Button type="submit" className="min-w-[150px] flex-1 gap-1.5" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
          {errorCount > 0 && (
            <span className="text-center text-[12.5px] font-medium text-destructive">
              Còn {errorCount} trường cần sửa
            </span>
          )}
        </div>
      </section>
    </aside>
  );
}
