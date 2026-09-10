import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useOrg } from '@/contexts/OrgContext'
import type { OrgServiceRequest, ServiceQuoteInput } from '@/types/consignment'

const QUOTE_BUCKET = 'quote-docs'

/**
 * Hộp thư yêu cầu ký gửi của tổ chức đấu giá.
 *
 * Đọc qua RPC `org_service_requests` chứ KHÔNG select thẳng bảng: RLS lọc theo
 * dòng nên không giấu được cột, mà tổ chức không được thấy danh tính chủ tài
 * sản / số nhà / giấy tờ sở hữu trước khi trúng.
 */
function useCurrentAuctionOrg() {
  // OrgContext đi theo MEMBERSHIP (không phải owner_id như usePortalOrg), khớp
  // với user_in_auction_org() ở server — nên Quản lý / Nhân viên cũng dùng được
  // hộp thư, không chỉ chủ sở hữu tổ chức.
  const { currentOrg, loading } = useOrg()
  const auctionOrgId = (currentOrg?.licenseInfo?.auction_org_id as string | undefined) ?? null
  return {
    organizationId: currentOrg?.id ?? null,
    auctionOrgId: currentOrg?.kycStatus === 'APPROVED' ? auctionOrgId : null,
    isLoading: loading,
  }
}

export function useOrgServiceRequests() {
  const { auctionOrgId, organizationId, isLoading: orgLoading } = useCurrentAuctionOrg()

  const query = useQuery({
    queryKey: ['org-service-requests', auctionOrgId],
    enabled: !!auctionOrgId,
    queryFn: async (): Promise<OrgServiceRequest[]> => {
      const { data, error } = await supabase.rpc('org_service_requests', {
        _auction_org_id: auctionOrgId!,
      })
      if (error) throw error
      return (data ?? []) as unknown as OrgServiceRequest[]
    },
  })

  const requests = useMemo(() => query.data ?? [], [query.data])

  return {
    requests,
    isLoading: orgLoading || query.isLoading,
    error: query.error,
    hasOrg: !!auctionOrgId,
    organizationId,
    auctionOrgId,
  }
}

interface RespondArgs {
  requestId: string
  action: 'seen' | 'quote' | 'decline'
  quote?: ServiceQuoteInput
  declineReason?: string
}

/** Trả lời một yêu cầu: đánh dấu đã xem · gửi báo giá · từ chối. */
export function useRespondServiceRequest() {
  const queryClient = useQueryClient()
  const { auctionOrgId } = useCurrentAuctionOrg()

  return useMutation({
    mutationFn: async ({ requestId, action, quote, declineReason }: RespondArgs) => {
      const payload =
        action === 'quote'
          ? { ...quote }
          : action === 'decline'
            ? { decline_reason: declineReason ?? null }
            : null

      const { error } = await supabase.rpc('org_respond_service_request', {
        _request_id: requestId,
        _action: action,
        _quote: payload as never,
      })
      if (error) throw error
      return { action }
    },
    onSuccess: ({ action }) => {
      queryClient.invalidateQueries({ queryKey: ['org-service-requests', auctionOrgId] })
      // 'seen' chạy ngầm khi mở yêu cầu — báo toast sẽ thành nhiễu.
      if (action === 'quote') toast.success('Đã gửi báo giá tới chủ tài sản.')
      if (action === 'decline') toast.success('Đã từ chối yêu cầu.')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Không gửi được phản hồi. Vui lòng thử lại.')
    },
  })
}

/**
 * Tải tệp báo giá lên. Path BẮT BUỘC là {organization_id}/{request_id}/{file} —
 * policy storage khớp organization_id ở đoạn 1 và request_id ở đoạn 2.
 */
export async function uploadQuoteDoc(
  organizationId: string,
  requestId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `${organizationId}/${requestId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage.from(QUOTE_BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

/** Bucket private ⇒ phải ký URL mới xem được. */
export async function signQuoteDoc(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(QUOTE_BUCKET).createSignedUrl(path, expiresIn)
  if (error) return null
  return data?.signedUrl ?? null
}
