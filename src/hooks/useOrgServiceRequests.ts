import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useOrg } from '@/contexts/OrgContext'
import { useHasOrgPermission } from '@/hooks/useOrgPermissions'
import { assertRpcOk } from '@/lib/consignment/errors'
import { qk } from '@/lib/queryKeys'
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
    queryKey: qk.consignment.orgRequests(auctionOrgId),
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

/**
 * Số yêu cầu chờ trả lời — cho badge ở sidebar.
 *
 * RPC đếm riêng chứ không tái dùng `org_service_requests`: sidebar render trên
 * MỌI trang portal, không nên kéo về cả projection hồ sơ + mảng ảnh cho một
 * con số. Chỉ gọi khi người dùng thực sự thấy được module — người không có
 * quyền `view` sẽ dính `insufficient_privilege` ở server.
 */
export function useOrgServiceRequestCounts() {
  const { auctionOrgId } = useCurrentAuctionOrg()
  const canView = useHasOrgPermission('yeu-cau-ky-gui', 'view')

  const query = useQuery({
    queryKey: qk.consignment.orgCounts(auctionOrgId),
    enabled: !!auctionOrgId && canView,
    staleTime: 60_000,
    queryFn: async (): Promise<{ new: number; quoted: number; contractsAction: number }> => {
      const { data, error } = await supabase.rpc('org_service_request_counts', {
        _auction_org_id: auctionOrgId!,
      })
      if (error) throw error
      const raw = (data ?? {}) as { new?: number; quoted?: number; contracts_action?: number }
      return { new: raw.new ?? 0, quoted: raw.quoted ?? 0, contractsAction: raw.contracts_action ?? 0 }
    },
  })

  return {
    newCount: query.data?.new ?? 0,
    quotedCount: query.data?.quoted ?? 0,
    /** Hợp đồng tổ chức đang phải làm bước kế tiếp (soạn / ký / xác nhận). */
    contractsActionCount: query.data?.contractsAction ?? 0,
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

      const { data, error } = await supabase.rpc('org_respond_service_request', {
        _request_id: requestId,
        _action: action,
        _quote: payload as never,
      })
      if (error) throw error
      // Hồ sơ đã chốt tổ chức khác / yêu cầu đã kết thúc về dạng {ok:false}.
      assertRpcOk(data)
      return { action }
    },
    onSuccess: ({ action }) => {
      // 'seen' chạy ngầm khi mở yêu cầu — báo toast sẽ thành nhiễu.
      if (action === 'quote') toast.success('Đã gửi báo giá tới chủ tài sản.')
      if (action === 'decline') toast.success('Đã từ chối yêu cầu.')
    },
    // Làm mới cả khi thất bại: báo giá bị từ chối vì chủ tài sản vừa chốt tổ
    // chức khác thì danh sách phải chuyển yêu cầu sang tab đã đóng ngay.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.consignment.orgRequests(auctionOrgId) })
      // Mở một yêu cầu làm 'sent' → 'seen', badge phải tụt ngay.
      queryClient.invalidateQueries({ queryKey: qk.consignment.orgCounts(auctionOrgId) })
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
