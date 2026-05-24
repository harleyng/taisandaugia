import { useState, useCallback, useMemo } from 'react'
import type { TaxRecord, TaxRecordType } from '@/types/tax'
import { listTaxRecords, upsertTaxRecord, softDeleteTaxRecord } from '@/lib/tax/storage'
import { getTargetYear, calcMucIV9, previewScore } from '@/lib/tax/scoring'
import { getCapacityProfile, saveCapacityProfile } from '@/lib/applications/storage'
import { useGeneralInfo } from '@/hooks/useGeneralInfo'

export function useTaxRecords() {
  const { generalInfo } = useGeneralInfo()
  const [records, setRecords] = useState<TaxRecord[]>(() => listTaxRecords())

  const targetYear = useMemo(() => getTargetYear(), [])

  const activeRecords = useMemo(() => records.filter((r) => !r.isDeleted), [records])

  const scoreIV9 = useMemo(() => calcMucIV9(records), [records])

  const targetRecord = useMemo(
    () => activeRecords.find((r) => r.year === targetYear),
    [activeRecords, targetYear]
  )

  // Auto-detect loại kê khai theo loại tổ chức
  const defaultRecordType = useMemo((): TaxRecordType => {
    return generalInfo?.orgType === 'TRUNG_TAM_DV' ? 'NSNN' : 'CIT'
  }, [generalInfo?.orgType])

  const syncProfile = useCallback(
    (updatedRecords: TaxRecord[]) => {
      const score = calcMucIV9(updatedRecords)
      const yr = getTargetYear()
      const active = updatedRecords.filter((r) => !r.isDeleted)
      const trec = active.find((r) => r.year === yr)
      const taxPaidPreviousYear = trec ? trec.amount / 1_000_000 : 0
      const existing = getCapacityProfile()
      const totalWithoutIV9 = existing.totalCapacityScore - existing.scoreIV9
      saveCapacityProfile({
        ...existing,
        scoreIV9: score,
        taxPaidPreviousYear,
        totalCapacityScore: totalWithoutIV9 + score,
      })
    },
    []
  )

  const addRecord = useCallback(
    (record: TaxRecord) => {
      upsertTaxRecord(record)
      const updated = listTaxRecords()
      setRecords(updated)
      syncProfile(updated)
    },
    [syncProfile]
  )

  const updateRecord = useCallback(
    (record: TaxRecord) => {
      const updated_record = { ...record, updatedAt: new Date().toISOString() }
      upsertTaxRecord(updated_record)
      const updated = listTaxRecords()
      setRecords(updated)
      syncProfile(updated)
    },
    [syncProfile]
  )

  const deleteRecord = useCallback(
    (id: string) => {
      softDeleteTaxRecord(id)
      const updated = listTaxRecords()
      setRecords(updated)
      syncProfile(updated)
    },
    [syncProfile]
  )

  return {
    records: activeRecords,
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
