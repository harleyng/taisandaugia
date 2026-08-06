import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { usePublicAuctioneers } from '@/hooks/usePublicAuctioneers'
import { categoryLabel } from '@/lib/personnel/auction-source'
import { groupNumber } from '@/components/asset-posting/format'

interface Props {
  auctionOrgId: string
}

/**
 * Mục "Đội ngũ đấu giá viên" trên trang tổ chức công khai.
 *
 * Đặt NGOÀI nhánh paywall: tổ chức chủ động bật chia sẻ từng người, nên đây là
 * thông tin họ muốn khách vãng lai thấy. Không render gì khi chưa ai bật.
 */
export function AuctioneerTeamSection({ auctionOrgId }: Props) {
  const { auctioneers, isLoading } = usePublicAuctioneers(auctionOrgId)

  if (isLoading || auctioneers.length === 0) return null

  return (
    <Card className="p-6 mb-6 rounded-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">
          Đội ngũ đấu giá viên ({auctioneers.length})
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {auctioneers.map((a) => (
          <div key={a.id} className="rounded-xl border p-3">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-secondary mb-2.5">
              <img
                src={
                  a.portrait_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(a.full_name)}&background=random`
                }
                alt={a.full_name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="text-sm font-medium leading-snug">{a.full_name}</p>
            <Badge variant="secondary" className="mt-1.5 text-xs font-normal">
              {a.title}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1.5">
              Thẻ {a.license_number} · {a.years_of_experience} năm kinh nghiệm
            </p>

            {/* Chỉ số chỉ hiện khi tổ chức chủ động bật cho từng người. */}
            {a.total_auctions !== null && a.total_auctions > 0 && (
              <div className="mt-2 space-y-0.5 border-t pt-2">
                <p className="text-xs">
                  <span className="font-medium">{a.total_auctions}</span> cuộc đã điều hành
                  {a.successful_auctions !== null && ` · ${a.successful_auctions} thành`}
                </p>
                {!!a.total_winning_value && (
                  <p className="text-xs text-muted-foreground">
                    Tổng giá trúng {groupNumber(String(Math.round(a.total_winning_value)))} ₫
                  </p>
                )}
                {a.top_category && (
                  <p className="text-xs text-muted-foreground">
                    Sở trường: {categoryLabel(a.top_category)}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
