import { Check, MapPin, Coins, Building2, ExternalLink, Gavel } from "lucide-react";
import { orgFitSentence } from "@/lib/orgFit";
import type { MatchCriteria, OrgMatchResult } from "@/lib/orgMatching";
import { OrgScoreDetail } from "./OrgScoreDetail";

interface OrgMatchCardProps {
  result: OrgMatchResult;
  /** Tiêu chí đã dùng để chấm điểm — cần để viết câu giải thích độ phù hợp. */
  criteria: MatchCriteria;
  selected: boolean;
  /** Tổ chức này đã nhận yêu cầu cho hồ sơ — không gửi lại được (UNIQUE ở DB). */
  sent?: boolean;
  /** Khoá thẻ: đã gửi, hoặc đã chọn đủ trần tổ chức. */
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * Card so sánh một tổ chức — dạng hiển thị DUY NHẤT của danh sách gợi ý (mọi breakpoint).
 *
 * Đây là một CHECKBOX (role="checkbox"), không phải radio: một hồ sơ gửi được
 * tới nhiều tổ chức, bấm lại thẻ đã chọn là bỏ chọn.
 */
export function OrgMatchCard({ result, criteria, selected, sent, disabled, onToggle }: OrgMatchCardProps) {
  const { org, attrs } = result;
  const fit = orgFitSentence(result, criteria);

  return (
    // div + role=checkbox (không phải <button>/<input>): bên trong có popover điểm
    // khớp và link hồ sơ tổ chức — lồng <button>/<a> trong <button> là HTML không
    // hợp lệ, React sẽ cảnh báo hydrate.
    // h-full + flex-col: các thẻ trong một hàng lưới cao bằng nhau và nút chọn
    // luôn dính đáy (mt-auto), dù tên/tỉnh/câu giải thích dài ngắn khác nhau.
    <div
      role="checkbox"
      tabIndex={disabled ? -1 : 0}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onToggle()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`flex h-full w-full flex-col rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? "cursor-pointer border-primary bg-primary/5 ring-2 ring-primary/30"
          : disabled
            ? "cursor-not-allowed border-border opacity-55"
            : "cursor-pointer border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{org.name}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {org.province && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {org.province}
                </span>
              )}
              {/* Tab mới + chặn nổi bọt: mở cùng tab (hoặc để click rơi xuống thẻ)
                  sẽ làm mất hồ sơ đang nhập dở trong wizard. */}
              <a
                href={`/auction-org/${org.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-medium transition hover:text-primary hover:underline"
              >
                Xem hồ sơ <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
        {/* Ô tick thay cho dấu check chỉ-hiện-khi-chọn: người dùng phải thấy ĐƯỢC
            PHÉP chọn nhiều tổ chức trước khi bấm, chứ không phải sau. */}
        <span
          aria-hidden
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border-[1.5px] ${
            selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
          }`}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </div>

      {/* Vì sao tổ chức này — một câu, trên mọi thẻ, kể cả thẻ điểm thấp. Hàng số
          liệu bên dưới là THUỘC TÍNH của tổ chức; câu này là ĐỐI CHIẾU với hồ sơ
          của người đang đọc, nên nó đứng trước và không bị cắt dòng. */}
      <p className="mt-2.5 text-[13px] leading-snug text-foreground">{fit}</p>

      {/* Điểm khớp đứng RIÊNG một hàng: nó là thứ người dùng so sánh giữa các thẻ,
          xếp chung hàng với phiên/thù lao thì chìm xuống ngang số liệu phụ. */}
      <div className="mt-3 -ml-1.5">
        <OrgScoreDetail result={result} size="lg" />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Gavel className="h-3.5 w-3.5 text-muted-foreground/60" />
          {attrs.total_sessions} phiên đấu giá
        </span>
        <span className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-muted-foreground/60" /> Thù lao ~{attrs.commission_rate}%
        </span>
      </div>

      <div className="mt-auto pt-3">
        <span
          className={`flex w-full items-center justify-center rounded-[10px] border-[1.5px] px-3 py-2 text-[13px] font-semibold transition ${
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-foreground"
          }`}
        >
          {sent ? "Đã gửi yêu cầu" : selected ? "Bỏ chọn" : "Chọn tổ chức này"}
        </span>
      </div>
    </div>
  );
}
