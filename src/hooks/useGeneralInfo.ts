import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  calcCompletionPercentage,
  calcMucIV5,
  calcYearsOfOperation,
} from '@/lib/general-info/scoring'
import type { BankAccount, Branch, OrgGeneralInfo } from '@/types/general-info'
import * as repo from '@/lib/general-info/supabase-repo'
import { patchCapacityProfile } from '@/lib/applications/capacity-sync'
import { qk } from '@/lib/queryKeys'
import { usePortalOrg } from '@/hooks/usePortalOrg'

/**
 * Thông tin chung của tổ chức (mục I + IV.5 của bộ tiêu chí năng lực).
 *
 * Chuyển từ localStorage sang org_general_info + org_bank_accounts + org_branches.
 * Chi nhánh và tài khoản ngân hàng nay là BẢNG RIÊNG, nên các hàm add/update/remove
 * ghi thẳng vào bảng con thay vì sửa mảng lồng rồi lưu lại cả object — nhờ vậy hai
 * người cùng sửa hai chi nhánh khác nhau không ghi đè lẫn nhau.
 */
export function useGeneralInfo() {
  const { organizationId } = usePortalOrg()
  const qc = useQueryClient()
  const queryKey = qk.orgGeneralInfo(organizationId)

  const { data: generalInfo = null, isLoading } = useQuery({
    queryKey,
    enabled: !!organizationId,
    queryFn: () => repo.getGeneralInfo(organizationId!),
  })

  const yearsOfOperation = useMemo(() => {
    if (!generalInfo?.foundedDate) return null
    return calcYearsOfOperation(generalInfo.foundedDate)
  }, [generalInfo?.foundedDate])

  const mucIV5Score = useMemo(
    () => (yearsOfOperation ? calcMucIV5(yearsOfOperation.years) : 0),
    [yearsOfOperation],
  )

  const completionPercentage = useMemo(
    () => (generalInfo ? calcCompletionPercentage(generalInfo) : 0),
    [generalInfo],
  )

  const guard = useCallback(
    async (action: () => Promise<unknown>, failMsg: string) => {
      if (!organizationId) {
        toast.error('Chưa xác định được tổ chức. Vui lòng tải lại trang.')
        return
      }
      try {
        await action()
        qc.invalidateQueries({ queryKey })
      } catch {
        toast.error(failMsg)
      }
    },
    [organizationId, qc, queryKey],
  )

  const save = useCallback(
    (
      info: Omit<OrgGeneralInfo, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string
        createdAt?: string
      },
    ) =>
      guard(async () => {
        const now = new Date().toISOString()
        const full: OrgGeneralInfo = {
          ...info,
          // id/createdAt do DB quản; giá trị ở đây chỉ để thoả kiểu.
          id: info.id ?? '',
          createdAt: info.createdAt ?? now,
          updatedAt: now,
          bankAccounts: info.bankAccounts ?? [],
          branches: info.branches ?? [],
        }
        await repo.saveGeneralInfo(full, organizationId!)

        // Cập nhật điểm IV.5 (số năm hoạt động) + mục I trong hồ sơ năng lực.
        if (full.foundedDate) {
          const yrs = calcYearsOfOperation(full.foundedDate)
          await patchCapacityProfile(
            organizationId!,
            {
              onMinistryList: full.isListedInMOJDirectory,
              companyName: full.name || undefined,
              scoreIV5: calcMucIV5(yrs.years),
              yearsActive: yrs.years,
            },
            'scoreIV5',
          )
          qc.invalidateQueries({ queryKey: qk.orgCapacityProfile(organizationId) })
        }
      }, 'Không lưu được thông tin chung'),
    [guard, organizationId, qc],
  )

  // ── Chi nhánh ──────────────────────────────────────────────────────────────

  const addBranch = useCallback(
    (branch: Omit<Branch, 'id'>) =>
      guard(() => repo.addBranch(branch, organizationId!), 'Không thêm được chi nhánh'),
    [guard, organizationId],
  )

  const updateBranch = useCallback(
    (branch: Branch) => guard(() => repo.updateBranch(branch), 'Không cập nhật được chi nhánh'),
    [guard],
  )

  const removeBranch = useCallback(
    (id: string) => guard(() => repo.removeBranch(id), 'Không xoá được chi nhánh'),
    [guard],
  )

  // ── Tài khoản ngân hàng ────────────────────────────────────────────────────

  const addBankAccount = useCallback(
    (account: Omit<BankAccount, 'id'>) =>
      guard(
        () => repo.addBankAccount(account, organizationId!),
        'Không thêm được tài khoản ngân hàng',
      ),
    [guard, organizationId],
  )

  const updateBankAccount = useCallback(
    (account: BankAccount) =>
      guard(
        () => repo.updateBankAccount(account, organizationId!),
        'Không cập nhật được tài khoản ngân hàng',
      ),
    [guard, organizationId],
  )

  const removeBankAccount = useCallback(
    (id: string) => guard(() => repo.removeBankAccount(id), 'Không xoá được tài khoản ngân hàng'),
    [guard],
  )

  return {
    generalInfo,
    isLoading,
    yearsOfOperation,
    mucIV5Score,
    completionPercentage,
    save,
    addBranch,
    updateBranch,
    removeBranch,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
  }
}
