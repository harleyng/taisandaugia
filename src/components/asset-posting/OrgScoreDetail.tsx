import { Info, Target } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MATCH_SIGNAL_LABELS,
  MATCH_WEIGHTS,
  type MatchBreakdown,
  type OrgMatchResult,
} from "@/lib/orgMatching";

const SIGNALS = Object.keys(MATCH_SIGNAL_LABELS) as (keyof MatchBreakdown)[];

/**
 * Điểm khớp KHÔNG phải phần trăm — là tổng có trọng số của 5 tín hiệu (tối đa 100).
 *
 * MỘT tông màu cho mọi mức điểm: bản trước tô theo ngưỡng (≥75 --success, ≥50
 * --primary) mà hai token này đều là XANH LÁ, nên 77 và 63 chỉ khác nhau một
 * sắc độ — người đọc thấy "hai màu" chứ không đọc ra thứ bậc. Thứ bậc đã nằm ở
 * chính con số và ở popover phân rã bên dưới.
 * Trước đây hiển thị "82%" với pill xanh cho mọi tổ chức: người dùng đọc ra xác suất
 * và không phân biệt được 38 với 88. Giờ nêu rõ "82/100" + mở được bảng phân rã.
 */
/** Cỡ hiển thị — "lg" dùng cho thẻ gợi ý, nơi điểm là thông tin dẫn dắt. */
const SIZES = {
  sm: { icon: "h-3.5 w-3.5", score: "text-sm" },
  md: { icon: "h-4 w-4", score: "text-base" },
  lg: { icon: "h-4 w-4", score: "text-lg" },
} as const;

export function OrgScoreDetail({
  result,
  size = "md",
}: {
  result: OrgMatchResult;
  size?: keyof typeof SIZES;
}) {
  const score = Math.round(result.score);
  const sz = SIZES[size];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Điểm khớp ${score} trên 100 — xem cách tính`}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 transition hover:bg-muted"
        >
          <Target className={`${sz.icon} text-primary`} />
          <span className={`font-bold leading-none text-primary ${sz.score}`}>{score}</span>
          <span className={`leading-none text-muted-foreground ${sz.score}`}>/100</span>
          <Info className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3.5">
        <p className="text-[13px] font-semibold text-foreground">Vì sao {score}/100 điểm khớp?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sàn đối chiếu hồ sơ của bạn với tổ chức theo 5 tín hiệu:
        </p>
        <dl className="mt-2.5 flex flex-col gap-2">
          {SIGNALS.map((k) => {
            const got = result.breakdown[k];
            const max = MATCH_WEIGHTS[k];
            return (
              <div key={k}>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-xs text-foreground">{MATCH_SIGNAL_LABELS[k]}</dt>
                  <dd className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {got}/{max}
                  </dd>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(got / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          Điểm chỉ để so sánh nhanh các tổ chức trong danh sách này, không phải cam kết về kết quả đấu giá.
        </p>
      </PopoverContent>
    </Popover>
  );
}
