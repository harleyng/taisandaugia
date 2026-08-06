import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CpdExemption, DossierEvent } from '@/types/personnel'
import * as cpdRepo from '@/lib/personnel/cpd-repo'
import * as dossier from '@/lib/personnel/dossier-repo'
import * as auctioneerRepo from '@/lib/auctioneers/supabase-repo'
import { evaluatePerson, summarize, type CpdPersonYear } from '@/lib/personnel/cpd'
import { formLabel } from '@/lib/personnel/cpd-catalog'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { useCpdCatalog } from '@/hooks/useCpdCatalog'
import { qk } from '@/lib/queryKeys'

/**
 * Sổ tuân thủ bồi dưỡng của CẢ TỔ CHỨC trong một năm.
 *
 * Ba query key tách rời (roster / sự kiện / miễn trừ) để ghi nhận một khoá không
 * kéo theo refetch danh sách đấu giá viên. Mọi mutation ghi vào sự kiện đều phải
 * invalidate CẢ key ['personnel', auctioneerId, 'events'] — hồ sơ cá nhân đang
 * mở ở tab khác vẫn phải thấy bản ghi mới.
 */
export function useOrgCpd(year: number) {
  const { organizationId, auctionOrgId, hasOrg, isLoading: orgLoading } = usePortalOrg()
  const { catalog, index, resolve, isLoading: catalogLoading } = useCpdCatalog()
  const qc = useQueryClient()

  const rosterQuery = useQuery({
    queryKey: qk.auctioneers(organizationId),
    enabled: !!organizationId,
    queryFn: () => auctioneerRepo.listByOrg(organizationId!),
  })

  const eventsQuery = useQuery({
    queryKey: ['cpd', organizationId, 'events'],
    enabled: !!organizationId,
    queryFn: () => cpdRepo.listOrgTrainingEvents(organizationId!),
  })

  const exemptionsQuery = useQuery({
    queryKey: ['cpd', organizationId, 'exemptions'],
    enabled: !!organizationId,
    queryFn: () => cpdRepo.listExemptions(organizationId!),
  })

  const roster = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data])
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])
  const exemptions = useMemo(() => exemptionsQuery.data ?? [], [exemptionsQuery.data])

  const eventsByPerson = useMemo(() => {
    const m = new Map<string, DossierEvent[]>()
    for (const e of events) {
      const list = m.get(e.auctioneerId)
      if (list) list.push(e)
      else m.set(e.auctioneerId, [e])
    }
    return m
  }, [events])

  const exemptionByPerson = useMemo(() => {
    const m = new Map<string, CpdExemption>()
    for (const x of exemptions) if (x.year === year) m.set(x.auctioneerId, x)
    return m
  }, [exemptions, year])

  /** Nghĩa vụ chỉ áp cho người ĐANG hành nghề tại tổ chức. */
  const applicable = useMemo(() => roster.filter((a) => a.isActive), [roster])

  /** Nhãn "Hình thức — Vai trò" của một bản ghi, tra qua index đã dựng sẵn. */
  const labelOf = useCallback((e: DossierEvent) => formLabel(
    e.cpdActivityTypeId ? index.typeById.get(e.cpdActivityTypeId) : undefined,
    e.cpdActivityRoleId ? index.roleById.get(e.cpdActivityRoleId) : undefined,
  ), [index])

  const rows = useMemo((): Array<CpdPersonYear & { name: string }> => {
    return applicable.map((a) => {
      const ex = exemptionByPerson.get(a.id)
      const reasonName = ex ? index.reasonById.get(ex.reasonId)?.name : undefined
      return {
        ...evaluatePerson(
          a.id,
          eventsByPerson.get(a.id) ?? [],
          year,
          resolve,
          ex ? { reasonName } : undefined,
          labelOf,
        ),
        name: a.fullName,
      }
    })
  }, [applicable, eventsByPerson, exemptionByPerson, year, resolve, labelOf, index])

  const summary = useMemo(() => summarize(rows), [rows])

  const invalidate = useCallback((auctioneerId?: string) => {
    qc.invalidateQueries({ queryKey: ['cpd', organizationId] })
    if (auctioneerId) qc.invalidateQueries({ queryKey: qk.personnel.events(auctioneerId) })
  }, [qc, organizationId])

  const saveRecord = useMutation({
    mutationFn: (ev: Partial<DossierEvent> & { auctioneerId: string }) => {
      if (!organizationId) throw new Error('Thiếu ngữ cảnh tổ chức')
      return dossier.upsertEvent({
        ...ev,
        organizationId,
        eventType: 'TRAINING',
        title: ev.title ?? '',
      })
    },
    onSuccess: (_r, ev) => { invalidate(ev.auctioneerId); toast.success('Đã lưu hoạt động bồi dưỡng') },
    onError: () => toast.error('Lưu thất bại'),
  })

  const removeRecord = useMutation({
    mutationFn: (r: { id: string; auctioneerId: string }) => dossier.deleteEvent(r.id),
    onSuccess: (_r, v) => { invalidate(v.auctioneerId); toast.success('Đã xoá') },
    onError: () => toast.error('Xoá thất bại'),
  })

  // organizationId đến từ ngữ cảnh portal, không phải từ form — nhận vào kiểu đã
  // bỏ trường đó để chỗ gọi không phải truyền chuỗi rỗng lấy lệ.
  const saveExemption = useMutation({
    mutationFn: (ex: Omit<Parameters<typeof cpdRepo.upsertExemption>[0], 'organizationId'>) => {
      if (!organizationId) throw new Error('Thiếu ngữ cảnh tổ chức')
      return cpdRepo.upsertExemption({ ...ex, organizationId })
    },
    onSuccess: (_r, ex) => { invalidate(ex.auctioneerId); toast.success('Đã lưu diện miễn') },
    onError: () => toast.error('Lưu diện miễn thất bại'),
  })

  const removeExemption = useMutation({
    mutationFn: (x: CpdExemption) => cpdRepo.deleteExemption(x.id),
    onSuccess: (_r, x) => { invalidate(x.auctioneerId); toast.success('Đã bỏ diện miễn') },
    onError: () => toast.error('Bỏ diện miễn thất bại'),
  })

  return {
    year,
    organizationId,
    auctionOrgId,
    hasOrg,
    catalog,
    // Danh mục nằm trong điều kiện tải: chấm tuân thủ khi chưa có quy tắc sẽ ra
    // "chưa đủ giờ" cho cả đội rồi tự sửa sau một nhịp — nhấp nháy một kết luận
    // pháp lý sai còn tệ hơn chờ thêm 200ms.
    isLoading: orgLoading || catalogLoading || rosterQuery.isLoading
      || eventsQuery.isLoading || exemptionsQuery.isLoading,
    roster,
    applicable,
    rows,
    summary,
    eventsByPerson,
    exemptionByPerson,
    saveRecord,
    removeRecord,
    saveExemption,
    removeExemption,
  }
}
