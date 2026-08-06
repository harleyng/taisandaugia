import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Folder } from '@/types/document'
import { qk } from '@/lib/queryKeys'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import * as repo from '@/lib/documents/supabase-repo'

/**
 * Cây thư mục của tủ tài liệu.
 *
 * Trước đây đọc/ghi localStorage nên đồng bộ. Nay đi Supabase (bảng
 * org_document_folders): các hàm ghi thành async, nhưng GIỮ NGUYÊN tên và thứ tự
 * tham số để hai component đang dùng (DocumentCabinetPage, DocumentsTabInModule)
 * không phải đổi. Không call site nào dùng giá trị trả về, nên gọi không await
 * vẫn đúng; ai cần chờ thì await được.
 */
export function useFolders() {
  const { organizationId } = usePortalOrg()
  const qc = useQueryClient()
  const queryKey = qk.orgDocuments.folders(organizationId)

  const { data: allFolders = [], isLoading } = useQuery({
    queryKey,
    enabled: !!organizationId,
    // CỐ Ý KHÔNG seed trong queryFn: tổ chức mới phải thấy OnboardingView
    // (danh sách rỗng) rồi tự bấm bắt đầu. Seed tự động ở đây sẽ khiến màn
    // onboarding không bao giờ xuất hiện.
    queryFn: () => repo.listFolders(organizationId!),
  })

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey })
  }, [qc, queryKey])

  // ── Đọc dẫn xuất (thuần, logic không đổi so với bản cũ) ────────────────────

  const folders = allFolders.filter((f) => !f.deletedAt)

  const rootFolders = folders
    .filter((f) => f.parentId === null)
    .sort((a, b) => a.order - b.order)

  const getChildren = useCallback(
    (parentId: string) =>
      allFolders
        .filter((f) => f.parentId === parentId && !f.deletedAt)
        .sort((a, b) => a.order - b.order),
    [allFolders],
  )

  const getFolderPath = useCallback(
    (folderId: string): Folder[] => {
      const path: Folder[] = []
      let current = allFolders.find((f) => f.id === folderId)
      while (current) {
        path.unshift(current)
        const parentId = current.parentId
        current = parentId ? allFolders.find((f) => f.id === parentId) : undefined
      }
      return path
    },
    [allFolders],
  )

  const getDepth = useCallback(
    (folderId: string): number => {
      let depth = 0
      let current = allFolders.find((f) => f.id === folderId)
      while (current?.parentId) {
        const parentId = current.parentId
        current = allFolders.find((f) => f.id === parentId)
        depth++
      }
      return depth
    },
    [allFolders],
  )

  const hasDuplicateName = useCallback(
    (name: string, parentId: string | null, excludeId?: string): boolean =>
      allFolders.some(
        (f) =>
          f.parentId === parentId &&
          !f.deletedAt &&
          f.name.toLowerCase() === name.toLowerCase() &&
          f.id !== excludeId,
      ),
    [allFolders],
  )

  // ── Ghi ────────────────────────────────────────────────────────────────────

  /**
   * Bọc lỗi một lần cho mọi thao tác ghi. Với localStorage thì ghi không bao giờ
   * lỗi; đi mạng + RLS thì có, và im lặng nuốt lỗi sẽ khiến user tưởng đã lưu.
   */
  const guard = useCallback(
    async <T,>(action: () => Promise<T>, failMsg: string): Promise<T | undefined> => {
      if (!organizationId) {
        toast.error('Chưa xác định được tổ chức. Vui lòng tải lại trang.')
        return undefined
      }
      try {
        const result = await action()
        reload()
        return result
      } catch {
        toast.error(failMsg)
        return undefined
      }
    },
    [organizationId, reload],
  )

  /** Tạo bộ thư mục mặc định — gọi từ OnboardingView. Idempotent. */
  const seedDefaults = useCallback(
    () => guard(() => repo.seedDefaultFolders(organizationId!), 'Không tạo được thư mục mặc định'),
    [guard, organizationId],
  )

  const createFolder = useCallback(
    (name: string, parentId: string | null) =>
      guard(
        () =>
          repo.upsertFolder(
            {
              id: crypto.randomUUID(),
              name,
              parentId,
              order: allFolders.filter((f) => f.parentId === parentId && !f.deletedAt).length,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            organizationId!,
          ),
        'Không tạo được thư mục',
      ),
    [allFolders, guard, organizationId],
  )

  const renameFolder = useCallback(
    (id: string, name: string) => {
      const folder = allFolders.find((f) => f.id === id)
      if (!folder) return Promise.resolve(undefined)
      return guard(
        () => repo.upsertFolder({ ...folder, name }, organizationId!),
        'Không đổi được tên thư mục',
      )
    },
    [allFolders, guard, organizationId],
  )

  const moveFolder = useCallback(
    (id: string, newParentId: string | null) => {
      const folder = allFolders.find((f) => f.id === id)
      if (!folder) return Promise.resolve(undefined)

      // Chặn kéo thư mục vào chính nhánh con của nó: sẽ tạo chu trình và
      // getFolderPath/getDepth lặp vô hạn.
      const isDescendant = (targetId: string | null): boolean => {
        if (!targetId) return false
        if (targetId === id) return true
        return isDescendant(allFolders.find((f) => f.id === targetId)?.parentId ?? null)
      }
      if (isDescendant(newParentId)) {
        toast.error('Không thể chuyển thư mục vào chính nhánh con của nó')
        return Promise.resolve(undefined)
      }

      return guard(
        () => repo.upsertFolder({ ...folder, parentId: newParentId }, organizationId!),
        'Không chuyển được thư mục',
      )
    },
    [allFolders, guard, organizationId],
  )

  const reorderFolders = useCallback(
    // `_parentId` giữ lại cho khớp signature cũ mà call site đang truyền; thứ tự
    // suy hoàn toàn từ orderedIds nên không cần tới nó.
    (_parentId: string | null, orderedIds: string[]) =>
      guard(
        () => repo.reorderFolders(orderedIds, organizationId!),
        'Không lưu được thứ tự thư mục',
      ),
    [guard, organizationId],
  )

  const deleteFolder = useCallback(
    (id: string) =>
      guard(() => repo.softDeleteFolderTree(id, organizationId!), 'Không xoá được thư mục'),
    [guard, organizationId],
  )

  return {
    folders,
    rootFolders,
    isLoading,
    getChildren,
    getFolderPath,
    getDepth,
    hasDuplicateName,
    seedDefaults,
    createFolder,
    renameFolder,
    moveFolder,
    reorderFolders,
    deleteFolder,
    reload,
  }
}

export type UseFoldersReturn = ReturnType<typeof useFolders>
