import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Gavel, ExternalLink } from 'lucide-react'
import { fetchAuctionsByAuctioneer, auctionStats } from '@/lib/personnel/auction-source'
import { groupNumber } from '@/components/asset-posting/format'

interface Props {
  auctioneerId: string
  fullName: string
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

/**
 * CHỈ ĐỌC. Cuộc đấu giá thuộc module Lịch sử đấu giá — hồ sơ không tạo bản sao,
 * chỉ hiển thị lại theo tên người điều hành để biết template sẽ in ra những gì.
 */
export function ConductedAuctionsCard({ auctioneerId, fullName }: Props) {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['auction-records', auctioneerId],
    enabled: !!auctioneerId,
    queryFn: () => fetchAuctionsByAuctioneer(auctioneerId),
  })
  const auctions = useMemo(() => data ?? [], [data])
  const stats = useMemo(() => auctionStats(auctions), [auctions])

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Gavel className="h-4 w-4 text-muted-foreground" />
            Cuộc đấu giá đã điều hành ({auctions.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lấy tự động từ mục Lịch sử đấu giá. Muốn sửa thì sửa ở đó.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => navigate('/portal/nang-luc/lich-su-dau-gia')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Mở Lịch sử đấu giá
        </Button>
      </div>

      {auctions.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Chưa có cuộc đấu giá nào ghi nhận <strong>{fullName}</strong> là người điều hành.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              {stats.successful}/{stats.total} đấu giá thành
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal">
              Tổng giá trúng {groupNumber(String(stats.totalWinningValue))} ₫
            </Badge>
          </div>

          <div className="divide-y rounded-lg border">
            {auctions.map((a) => (
              <div key={a.id} className="px-3 py-2.5">
                <p className="text-sm truncate">{a.assetDescription}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[
                    fmtDate(a.date),
                    a.ownerName,
                    a.winningPrice ? `${groupNumber(String(a.winningPrice))} ₫` : '',
                    a.isSuccessful === undefined ? '' : a.isSuccessful ? 'Thành' : 'Không thành',
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
