import { feeTotal, feeTotalRequired } from '@/lib/quotePlan'
import { formatVnd } from '@/lib/advertising/slug'
import type { QuoteFeeItem } from '@/types/consignment'

interface FeesTableProps {
  items: QuoteFeeItem[] | null
  /** Báo giá cũ chưa tách khoản mục — chỉ có tổng phí dịch vụ. */
  legacyServiceFee: number | null
}

const ROW = 'flex items-baseline justify-between gap-4 border-t border-border px-3.5 py-2.5 text-sm first:border-t-0'

/** Bảng chi phí: từng khoản + "Tổng chi phí dịch vụ" (chỉ khoản bắt buộc, khớp quote_service_fee). */
export function FeesTable({ items, legacyServiceFee }: FeesTableProps) {
  const list = items ?? []
  if (list.length === 0 && legacyServiceFee == null) return null
  const required = list.length ? feeTotalRequired(list) : (legacyServiceFee ?? 0)
  const optional = feeTotal(list) - feeTotalRequired(list)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-xl border border-border">
        {list.map((item, i) => (
          <div key={`${item.key}-${i}`} className={ROW}>
            <span className="text-muted-foreground">
              {item.label}
              {item.optional && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Tuỳ chọn</span>
              )}
            </span>
            <span className="whitespace-nowrap font-medium tabular-nums">{formatVnd(item.amount)}</span>
          </div>
        ))}
        <div className={`${ROW} bg-muted/60 font-semibold`}>
          <span>Tổng chi phí dịch vụ</span>
          <span className="whitespace-nowrap tabular-nums">{formatVnd(required)}</span>
        </div>
      </div>
      {optional > 0 && (
        <p className="text-xs text-muted-foreground">Khoản tuỳ chọn ({formatVnd(optional)}) không nằm trong tổng trên.</p>
      )}
    </div>
  )
}
