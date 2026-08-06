import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as repo from '@/lib/personnel/cpd-catalog-repo'
import { qk } from '@/lib/queryKeys'

/**
 * Postgres 23503 = foreign_key_violation. FK từ org_auctioneer_events sang danh
 * mục là ON DELETE RESTRICT, nên xoá một hình thức đã có dữ liệu sẽ bật lỗi này.
 * Đó là hành vi ĐÚNG (bản ghi lịch sử phải giữ được nhãn) — chỉ cần nói cho
 * admin biết lối đi thay thế thay vì ném mã lỗi Postgres ra màn hình.
 */
function errMessage(e: unknown, fallback: string): string {
  const code = (e as { code?: string } | null)?.code
  if (code === '23503') {
    return 'Đang có bản ghi bồi dưỡng dùng mục này nên không xoá được. Hãy tắt trạng thái hoạt động để ẩn khỏi ô chọn.'
  }
  if (code === '23505') return 'Mã này đã tồn tại. Chọn mã khác.'
  return fallback
}

export function useCpdCatalogAdmin() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.cpdCatalog })

  const saveType = useMutation({
    mutationFn: repo.upsertActivityType,
    onSuccess: () => { invalidate(); toast.success('Đã lưu hình thức bồi dưỡng') },
    onError: (e) => toast.error(errMessage(e, 'Lưu hình thức thất bại')),
  })

  const removeType = useMutation({
    mutationFn: repo.deleteActivityType,
    onSuccess: () => { invalidate(); toast.success('Đã xoá hình thức') },
    onError: (e) => toast.error(errMessage(e, 'Xoá hình thức thất bại')),
  })

  const saveRole = useMutation({
    mutationFn: repo.upsertActivityRole,
    onSuccess: () => { invalidate(); toast.success('Đã lưu vai trò') },
    onError: (e) => toast.error(errMessage(e, 'Lưu vai trò thất bại')),
  })

  const removeRole = useMutation({
    mutationFn: repo.deleteActivityRole,
    onSuccess: () => { invalidate(); toast.success('Đã xoá vai trò') },
    onError: (e) => toast.error(errMessage(e, 'Xoá vai trò thất bại')),
  })

  const saveReason = useMutation({
    mutationFn: repo.upsertExemptionReason,
    onSuccess: () => { invalidate(); toast.success('Đã lưu trường hợp miễn') },
    onError: (e) => toast.error(errMessage(e, 'Lưu trường hợp miễn thất bại')),
  })

  const removeReason = useMutation({
    mutationFn: repo.deleteExemptionReason,
    onSuccess: () => { invalidate(); toast.success('Đã xoá trường hợp miễn') },
    onError: (e) => toast.error(errMessage(e, 'Xoá trường hợp miễn thất bại')),
  })

  return { saveType, removeType, saveRole, removeRole, saveReason, removeReason }
}
