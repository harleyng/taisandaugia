import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Auctioneer } from '@/types/auctioneer'
import type { DossierEvent, PersonnelDocument } from '@/types/personnel'
import * as dossier from '@/lib/personnel/dossier-repo'
import * as cpdRepo from '@/lib/personnel/cpd-repo'
import * as auctioneerRepo from '@/lib/auctioneers/supabase-repo'
import { calcCompleteness } from '@/lib/personnel/completeness'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { qk } from '@/lib/queryKeys'

/**
 * Hồ sơ số hoá của MỘT đấu giá viên.
 *
 * Ba query key tách rời để upload một giấy tờ không kéo theo refetch cả danh
 * sách sự kiện. Mọi thao tác ghi lên chính bản ghi đấu giá viên đều phải
 * invalidate CẢ key roster ['auctioneers', orgId], nếu không trang Đấu giá
 * viên sẽ hiển thị tên cũ.
 */
export function usePersonnelDossier(auctioneerId: string | undefined) {
  const { organizationId, auctionOrgId } = usePortalOrg()
  const qc = useQueryClient()

  const personQuery = useQuery({
    queryKey: qk.personnel.byAuctioneer(auctioneerId),
    enabled: !!auctioneerId && !!organizationId,
    queryFn: async (): Promise<Auctioneer | undefined> => {
      const all = await auctioneerRepo.listByOrg(organizationId!)
      return all.find((a) => a.id === auctioneerId)
    },
  })

  const docsQuery = useQuery({
    queryKey: qk.personnel.documents(auctioneerId),
    enabled: !!auctioneerId,
    queryFn: () => dossier.listDocuments(auctioneerId!),
  })

  const eventsQuery = useQuery({
    queryKey: qk.personnel.events(auctioneerId),
    enabled: !!auctioneerId,
    queryFn: () => dossier.listEvents(auctioneerId!),
  })

  // Diện miễn bồi dưỡng (Điều 26.3): thiếu nó thì banner tuân thủ báo thiếu giờ
  // oan cho người đang được miễn.
  const exemptionsQuery = useQuery({
    queryKey: qk.personnel.cpdExemptions(auctioneerId),
    enabled: !!auctioneerId,
    queryFn: () => cpdRepo.listExemptionsForAuctioneer(auctioneerId!),
  })

  const documents = useMemo(() => docsQuery.data ?? [], [docsQuery.data])
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])
  const cpdExemptions = useMemo(() => exemptionsQuery.data ?? [], [exemptionsQuery.data])
  const person = personQuery.data

  const completeness = useMemo(
    () => calcCompleteness(person, documents, events),
    [person, documents, events],
  )

  const invalidatePerson = useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.personnel.byAuctioneer(auctioneerId) })
    // Bản ghi đấu giá viên cũng là dòng của roster ⇒ phải làm mới cả hai.
    qc.invalidateQueries({ queryKey: qk.auctioneers(organizationId) })
  }, [qc, auctioneerId, organizationId])

  const invalidateDocs = useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.personnel.documents(auctioneerId) })
  }, [qc, auctioneerId])

  const invalidateEvents = useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.personnel.events(auctioneerId) })
  }, [qc, auctioneerId])

  const savePerson = useMutation({
    mutationFn: (patch: Partial<Auctioneer>) => {
      if (!person || !organizationId) throw new Error('Chưa tải xong hồ sơ')
      return auctioneerRepo.upsertOne(
        { ...person, ...patch, dossierUpdatedAt: new Date().toISOString() },
        { organizationId, auctionOrgId },
      )
    },
    onSuccess: () => { invalidatePerson(); toast.success('Đã lưu hồ sơ') },
    onError: () => toast.error('Lưu hồ sơ thất bại'),
  })

  const saveDocument = useMutation({
    mutationFn: (doc: Partial<PersonnelDocument>) => {
      if (!auctioneerId || !organizationId) throw new Error('Thiếu ngữ cảnh tổ chức')
      return dossier.upsertDocument({
        ...doc,
        auctioneerId,
        organizationId,
        docType: doc.docType ?? 'OTHER',
      })
    },
    onSuccess: () => { invalidateDocs(); toast.success('Đã lưu giấy tờ') },
    onError: () => toast.error('Lưu giấy tờ thất bại'),
  })

  const removeDocument = useMutation({
    mutationFn: (id: string) => dossier.deleteDocument(id),
    onSuccess: () => { invalidateDocs(); toast.success('Đã xoá giấy tờ') },
    onError: () => toast.error('Xoá giấy tờ thất bại'),
  })

  const saveEvent = useMutation({
    mutationFn: (ev: Partial<DossierEvent>) => {
      if (!auctioneerId || !organizationId) throw new Error('Thiếu ngữ cảnh tổ chức')
      return dossier.upsertEvent({
        ...ev,
        auctioneerId,
        organizationId,
        eventType: ev.eventType ?? 'WORK',
        title: ev.title ?? '',
      })
    },
    onSuccess: () => { invalidateEvents(); toast.success('Đã lưu') },
    onError: () => toast.error('Lưu thất bại'),
  })

  const removeEvent = useMutation({
    mutationFn: (id: string) => dossier.deleteEvent(id),
    onSuccess: () => { invalidateEvents(); toast.success('Đã xoá') },
    onError: () => toast.error('Xoá thất bại'),
  })

  const importAuctions = useMutation({
    mutationFn: (rows: Parameters<typeof dossier.importAuctionEvents>[0]) =>
      dossier.importAuctionEvents(rows),
    onSuccess: (count) => {
      invalidateEvents()
      toast.success(
        count > 0 ? `Đã nạp ${count} cuộc đấu giá.` : 'Không có cuộc đấu giá mới để nạp.',
      )
    },
    onError: () => toast.error('Nạp dữ liệu thất bại'),
  })

  return {
    person,
    documents,
    events,
    cpdExemptions,
    completeness,
    organizationId,
    isLoading: personQuery.isLoading || docsQuery.isLoading || eventsQuery.isLoading,
    savePerson,
    saveDocument,
    removeDocument,
    saveEvent,
    removeEvent,
    importAuctions,
  }
}
