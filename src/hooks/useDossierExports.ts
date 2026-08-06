import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { useCredits } from '@/hooks/useCredits'
import { useServiceCatalog } from '@/hooks/useServiceCatalog'
import * as repo from '@/lib/personnel/exports-repo'
import { listDocuments, listEvents } from '@/lib/personnel/dossier-repo'
import { listExemptionsForAuctioneer } from '@/lib/personnel/cpd-repo'
import { fetchCatalog } from '@/lib/personnel/cpd-catalog-repo'
import { qk } from '@/lib/queryKeys'
import { fetchAuctionsByAuctioneer } from '@/lib/personnel/auction-source'
import {
  renderDossier,
  dossierFileName,
  type DossierExportFormat,
} from '@/lib/personnel/export-dossier'
import type { DossierTemplate } from '@/lib/personnel/dossier-content'
import type { Auctioneer } from '@/types/auctioneer'

export interface GenerateInput {
  people: Auctioneer[]
}

export function useDossierExports() {
  const { userId } = useAuth()
  const { organizationId, orgName } = usePortalOrg()
  const { balance, chargePersonnelDossierExport } = useCredits()
  const { costOf } = useServiceCatalog()
  const qc = useQueryClient()

  const unitCost = costOf('export_personnel_dossier') || 1

  const { data, isLoading } = useQuery({
    queryKey: ['dossier-exports', organizationId],
    enabled: !!organizationId,
    queryFn: () => repo.listExports(organizationId!),
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['dossier-exports', organizationId] })
  }, [qc, organizationId])

  const generate = useMutation({
    mutationFn: async ({ people }: GenerateInput) => {
      if (!organizationId || !userId) throw new Error('Thiếu ngữ cảnh tổ chức')

      // DỰNG FILE TRƯỚC, TRỪ CREDIT SAU. Render có thể hỏng (font PDF, dữ liệu
      // lỗi) — trừ trước rồi hỏng là người dùng mất tiền mà không nhận được gì,
      // và không có đường hoàn.
      // Nạp MỘT lần cho cả lô: danh mục dùng chung, fetch theo từng người là
      // N lượt round-trip cho cùng một câu trả lời.
      const cpdCatalog = await qc.fetchQuery({
        queryKey: qk.cpdCatalog,
        queryFn: fetchCatalog,
        staleTime: 10 * 60 * 1000,
      })

      const rendered: Array<{ person: Auctioneer; blob: Blob; fileName: string }> = []
      for (const person of people) {
        const bundle = {
          person,
          documents: await listDocuments(person.id),
          events: await listEvents(person.id),
          auctions: await fetchAuctionsByAuctioneer(person.id),
          // Không có diện miễn thì mục "Tuân thủ bồi dưỡng" in THIẾU GIỜ cho
          // người đang được miễn theo Điều 26.3 — sai luật ngay trên bản nộp.
          cpdExemptions: await listExemptionsForAuctioneer(person.id),
          // Thiếu danh mục thì mục VI mất tên hình thức và mục VII chấm mọi
          // người thành "chưa đủ giờ" — bản in sai trên sản phẩm có tính phí.
          cpdCatalog,
        }
        rendered.push({
          person,
          blob: await renderDossier(bundle, orgName ?? ''),
          fileName: dossierFileName(person.fullName),
        })
      }

      // Trừ MỘT lần cho cả lô: deductCredits là read-then-write không atomic,
      // gọi N lần nhân N cửa sổ tranh chấp và có thể hỏng nửa chừng.
      const charge = await chargePersonnelDossierExport(people.length)
      if (!charge.ok) return { ok: false as const, reason: 'insufficient' as const }

      // KHÔNG tự tải về máy: hồ sơ đã lưu lại, người dùng chủ động Xem hoặc
      // Tải từ danh sách. Tự đẩy N file xuống thư mục Downloads là phiền.
      for (const r of rendered) {
        await repo.recordExport({
          organizationId,
          auctioneerId: r.person.id,
          auctioneerName: r.person.fullName,
          licenseNumber: r.person.licenseNumber,
          template: 'FULL',
          format: 'PDF',
          blob: r.blob,
          fileName: r.fileName,
          creditsCharged: unitCost,
          generatedBy: userId,
        })
      }
      return { ok: true as const, count: people.length }
    },
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error('Số dư credit không đủ để xuất số hồ sơ đã chọn.')
        return
      }
      invalidate()
      toast.success(`Đã xuất ${r.count} hồ sơ.`)
    },
    onError: () => toast.error('Có lỗi khi tạo hồ sơ. Vui lòng thử lại.'),
  })

  const remove = useMutation({
    mutationFn: (e: repo.DossierExport) => repo.deleteExport(e.id, e.filePath),
    onSuccess: () => { invalidate(); toast.success('Đã xoá bản ghi.') },
    onError: () => toast.error('Xoá thất bại.'),
  })

  const download = useCallback(async (e: repo.DossierExport) => {
    if (!e.filePath) {
      toast.error('Bản này không lưu được file lúc xuất, không tải lại được.')
      return
    }
    const url = await repo.getExportUrl(
      e.filePath,
      dossierFileName(e.auctioneerName),
    )
    if (url) window.location.href = url
    else toast.error('Không tải được file.')
  }, [])

  /** URL mở inline để nhúng vào khung xem trước (không ép tải xuống). */
  const previewUrl = useCallback(async (e: repo.DossierExport) => {
    if (!e.filePath) return null
    return repo.getExportUrl(e.filePath)
  }, [])

  return {
    exports: data ?? [],
    isLoading,
    unitCost,
    balance,
    organizationId,
    orgName,
    generate,
    remove,
    download,
    previewUrl,
  }
}
