import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { PublicAuctioneer } from '@/types/personnel'

/**
 * Đội ngũ đấu giá viên công khai của một tổ chức.
 *
 * Đi qua RPC chứ không đọc bảng: org_auctioneers KHÔNG có policy public-read,
 * vì RLS là row-level nên một policy như vậy sẽ lộ cả CCCD/email/ghi chú nội
 * bộ. Hàm public_org_auctioneers khoá cứng đúng 7 cột an toàn.
 */
export function usePublicAuctioneers(auctionOrgId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['public-auctioneers', auctionOrgId],
    enabled: !!auctionOrgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PublicAuctioneer[]> => {
      const { data, error } = await supabase.rpc('public_org_auctioneers', {
        _auction_org_id: auctionOrgId!,
      })
      if (error) throw error
      return (data ?? []) as PublicAuctioneer[]
    },
  })

  return { auctioneers: data ?? [], isLoading }
}
