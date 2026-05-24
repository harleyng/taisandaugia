import { useState, useCallback, useMemo } from 'react'
import { loadGeneralInfo, saveGeneralInfo } from '@/lib/general-info/storage'
import { calcYearsOfOperation, calcMucIV5, calcCompletionPercentage } from '@/lib/general-info/scoring'
import type { OrgGeneralInfo, Branch, BankAccount } from '@/types/general-info'
import { getCapacityProfile, saveCapacityProfile } from '@/lib/applications/storage'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function useGeneralInfo() {
  const [generalInfo, setGeneralInfo] = useState<OrgGeneralInfo | null>(() => loadGeneralInfo())

  const yearsOfOperation = useMemo(() => {
    if (!generalInfo?.foundedDate) return null
    return calcYearsOfOperation(generalInfo.foundedDate)
  }, [generalInfo?.foundedDate])

  const mucIV5Score = useMemo(() => {
    if (!yearsOfOperation) return 0
    return calcMucIV5(yearsOfOperation.years)
  }, [yearsOfOperation])

  const completionPercentage = useMemo(() => {
    if (!generalInfo) return 0
    return calcCompletionPercentage(generalInfo)
  }, [generalInfo])

  const save = useCallback((info: Omit<OrgGeneralInfo, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }) => {
    const now = new Date().toISOString()
    const existing = loadGeneralInfo()
    const updated: OrgGeneralInfo = {
      ...info,
      id: info.id ?? existing?.id ?? generateId(),
      createdAt: info.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
      bankAccounts: info.bankAccounts ?? existing?.bankAccounts ?? [],
      branches: info.branches ?? existing?.branches ?? [],
    }
    saveGeneralInfo(updated)
    setGeneralInfo(updated)
    if (updated.foundedDate) {
      const yrs = calcYearsOfOperation(updated.foundedDate)
      const iv5 = calcMucIV5(yrs.years)
      const profile = getCapacityProfile()
      saveCapacityProfile({
        ...profile,
        scoreIV5: iv5,
        yearsActive: yrs.years,
        totalCapacityScore: profile.totalCapacityScore - profile.scoreIV5 + iv5,
      })
    }
  }, [])

  const addBranch = useCallback((branch: Omit<Branch, 'id'>) => {
    setGeneralInfo((prev) => {
      if (!prev) return prev
      const updated = { ...prev, branches: [...prev.branches, { ...branch, id: generateId() }], updatedAt: new Date().toISOString() }
      saveGeneralInfo(updated)
      return updated
    })
  }, [])

  const updateBranch = useCallback((branch: Branch) => {
    setGeneralInfo((prev) => {
      if (!prev) return prev
      const updated = { ...prev, branches: prev.branches.map((b) => (b.id === branch.id ? branch : b)), updatedAt: new Date().toISOString() }
      saveGeneralInfo(updated)
      return updated
    })
  }, [])

  const removeBranch = useCallback((id: string) => {
    setGeneralInfo((prev) => {
      if (!prev) return prev
      const updated = { ...prev, branches: prev.branches.filter((b) => b.id !== id), updatedAt: new Date().toISOString() }
      saveGeneralInfo(updated)
      return updated
    })
  }, [])

  const addBankAccount = useCallback((account: Omit<BankAccount, 'id'>) => {
    setGeneralInfo((prev) => {
      if (!prev) return prev
      const updated = { ...prev, bankAccounts: [...prev.bankAccounts, { ...account, id: generateId() }], updatedAt: new Date().toISOString() }
      saveGeneralInfo(updated)
      return updated
    })
  }, [])

  const updateBankAccount = useCallback((account: BankAccount) => {
    setGeneralInfo((prev) => {
      if (!prev) return prev
      const updated = { ...prev, bankAccounts: prev.bankAccounts.map((a) => (a.id === account.id ? account : a)), updatedAt: new Date().toISOString() }
      saveGeneralInfo(updated)
      return updated
    })
  }, [])

  const removeBankAccount = useCallback((id: string) => {
    setGeneralInfo((prev) => {
      if (!prev) return prev
      const updated = { ...prev, bankAccounts: prev.bankAccounts.filter((a) => a.id !== id), updatedAt: new Date().toISOString() }
      saveGeneralInfo(updated)
      return updated
    })
  }, [])

  return {
    generalInfo,
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
