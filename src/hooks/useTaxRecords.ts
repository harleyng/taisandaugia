import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { TaxRecord, TaxRecordType } from '@/types/tax'
import { calcMucIV9, getTargetYear, previewScore } from '@/lib/tax/scoring'
import * as repo from '@/lib/tax/supabase-repo'
import { patchCapacityProfile } from '@/lib/applications/capacity-sync'
import { qk } from '@/lib/queryKeys'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { useGeneralInfo } from '@/hooks/useGeneralInfo'

/**
 * Bản ghi thuế & tài chính (mục IV.9 của bộ tiêu chí năng lực).
 *
 * Chuyển từ localStorage sang bảng org_tax_records. Giữ nguyên tên các hàm trả
 * về để TaxRecordForm / TaiChinhPage không phải đổi.
 */
export function useTaxRecords() {
  const { organizationId } = usePortalOrg()
  const { generalInfo } = useGeneralInfo()
  const qc = useQueryClient()
  const queryKey = qk.orgTaxRecords(organizationId)

  const { data: records = [], isLoading } = useQuery({
    queryKey,
    enabled: !!organizationId,
    queryFn: () => repo.listTaxRecords(organizationId!),
  })

  const targetYear = useMemo(() => getTargetYear(), [])
  const activeRecords = useMemo(() => records.filter((r) => !r.isDeleted), [records])
  const scoreIV9 = useMemo(() => calcMucIV9(records), [records])

  const targetRecord = useMemo(
    () => activeRecords.find((r) => r.year === targetYear),
    [activeRecords, targetYear],
  )

  // Trung tâm dịch vụ nộp NSNN, doanh nghiệp nộp thuế TNDN.
  const defaultRecordType = useMemo(
    (): TaxRecordType => (generalInfo?.orgType === 'TRUNG_TAM_DV' ? 'NSNN' : 'CIT'),
    [generalInfo?.orgType],
  )

  /**
   * Cập nhật điểm IV.9 trong hồ sơ năng lực tổng hợp.
   *
   * Đọc lại danh sách TỪ DB thay vì dùng state cũ: bản localStorage tính trên
   * mảng vừa ghi, nhưng với DB thì thành viên khác có thể vừa thêm bản ghi khác
   * — tính trên dữ liệu cũ sẽ ghi đè điểm của họ.
   */
  const syncProfile = useCallback(async () => {
    if (!organizationId) return
    // Đọc lại TỪ DB: thành viên khác có thể vừa thêm bản ghi thuế khác, tính
    // trên state cũ sẽ ghi đè điểm của họ.
    const fresh = await repo.listTaxRecords(organizationId)
    const trec = fresh.filter((r) => !r.isDeleted).find((r) => r.year === getTargetYear())
    await patchCapacityProfile(
      organizationId,
      {
        scoreIV9: calcMucIV9(fresh),
        // CapacityProfile.taxPaidPreviousYear tính bằng TRIỆU VND.
        taxPaidPreviousYear: trec ? trec.amount / 1_000_000 : 0,
      },
      'scoreIV9',
    )
    qc.invalidateQueries({ queryKey: qk.orgCapacityProfile(organizationId) })
  }, [organizationId, qc])

  const guard = useCallback(
    async (action: () => Promise<unknown>, failMsg: string) => {
      if (!organizationId) {
        toast.error('Chưa xác định được tổ chức. Vui lòng tải lại trang.')
        return
      }
      try {
        await action()
        await syncProfile()
        qc.invalidateQueries({ queryKey })
      } catch {
        toast.error(failMsg)
      }
    },
    [organizationId, qc, queryKey, syncProfile],
  )

  const addRecord = useCallback(
    (record: TaxRecord) =>
      guard(() => repo.upsertTaxRecord(record, organizationId!), 'Không lưu được bản ghi thuế'),
    [guard, organizationId],
  )

  const updateRecord = useCallback(
    (record: TaxRecord) =>
      guard(
        () => repo.upsertTaxRecord(record, organizationId!),
        'Không cập nhật được bản ghi thuế',
      ),
    [guard, organizationId],
  )

  const deleteRecord = useCallback(
    (id: string) => guard(() => repo.softDeleteTaxRecord(id), 'Không xoá được bản ghi thuế'),
    [guard],
  )

  return {
    records: activeRecords,
    isLoading,
    targetYear,
    targetRecord,
    scoreIV9,
    defaultRecordType,
    previewScore,
    addRecord,
    updateRecord,
    deleteRecord,
  }
}
