import { useCallback, useEffect, useState } from 'react'
import type { Folder } from '@/types/document'
import {
  listFolders,
  saveFolders,
  seedDefaultFolders,
  upsertFolder,
} from '@/lib/documents/storage'

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>(() => {
    seedDefaultFolders()
    return listFolders()
  })

  const reload = useCallback(() => setFolders(listFolders()), [])

  useEffect(() => {
    reload()
  }, [reload])

  const rootFolders = folders
    .filter((f) => f.parentId === null && !f.deletedAt)
    .sort((a, b) => a.order - b.order)

  const getChildren = useCallback(
    (parentId: string) =>
      folders
        .filter((f) => f.parentId === parentId && !f.deletedAt)
        .sort((a, b) => a.order - b.order),
    [folders],
  )

  const getFolderPath = useCallback(
    (folderId: string): Folder[] => {
      const path: Folder[] = []
      let current = folders.find((f) => f.id === folderId)
      while (current) {
        path.unshift(current)
        current = current.parentId
          ? folders.find((f) => f.id === current!.parentId)
          : undefined
      }
      return path
    },
    [folders],
  )

  const getDepth = useCallback(
    (folderId: string): number => {
      let depth = 0
      let current = folders.find((f) => f.id === folderId)
      while (current?.parentId) {
        depth++
        current = folders.find((f) => f.id === current!.parentId)
      }
      return depth
    },
    [folders],
  )

  const hasDuplicateName = useCallback(
    (name: string, parentId: string | null, excludeId?: string): boolean => {
      return folders.some(
        (f) =>
          f.parentId === parentId &&
          !f.deletedAt &&
          f.name.toLowerCase() === name.toLowerCase() &&
          f.id !== excludeId,
      )
    },
    [folders],
  )

  const createFolder = useCallback(
    (name: string, parentId: string | null): Folder => {
      const siblings = folders.filter(
        (f) => f.parentId === parentId && !f.deletedAt,
      )
      const now = new Date().toISOString()
      const folder: Folder = {
        id: crypto.randomUUID(),
        name,
        parentId,
        order: siblings.length,
        createdAt: now,
        updatedAt: now,
      }
      upsertFolder(folder)
      reload()
      return folder
    },
    [folders, reload],
  )

  const renameFolder = useCallback(
    (id: string, name: string) => {
      const folder = folders.find((f) => f.id === id)
      if (!folder) return
      upsertFolder({ ...folder, name, updatedAt: new Date().toISOString() })
      reload()
    },
    [folders, reload],
  )

  const moveFolder = useCallback(
    (id: string, newParentId: string | null) => {
      const folder = folders.find((f) => f.id === id)
      if (!folder) return
      // Prevent moving into own descendant
      const isDescendant = (targetId: string | null): boolean => {
        if (!targetId) return false
        if (targetId === id) return true
        const target = folders.find((f) => f.id === targetId)
        return isDescendant(target?.parentId ?? null)
      }
      if (isDescendant(newParentId)) return
      upsertFolder({
        ...folder,
        parentId: newParentId,
        updatedAt: new Date().toISOString(),
      })
      reload()
    },
    [folders, reload],
  )

  const reorderFolders = useCallback(
    (parentId: string | null, orderedIds: string[]) => {
      const all = listFolders()
      orderedIds.forEach((id, i) => {
        const idx = all.findIndex((f) => f.id === id)
        if (idx >= 0) all[idx] = { ...all[idx], order: i, updatedAt: new Date().toISOString() }
      })
      saveFolders(all)
      reload()
    },
    [reload],
  )

  const deleteFolder = useCallback(
    (id: string) => {
      // Also delete all descendant folders (soft-delete via deletedAt)
      const collectIds = (fid: string): string[] => {
        const children = folders.filter((f) => f.parentId === fid)
        return [fid, ...children.flatMap((c) => collectIds(c.id))]
      }
      const ids = collectIds(id)
      const all = listFolders()
      const now = new Date().toISOString()
      const updated = all.map((f) =>
        ids.includes(f.id) ? { ...f, deletedAt: now, updatedAt: now } : f,
      )
      saveFolders(updated)
      reload()
    },
    [folders, reload],
  )

  return {
    folders: folders.filter((f) => !f.deletedAt),
    rootFolders,
    getChildren,
    getFolderPath,
    getDepth,
    hasDuplicateName,
    createFolder,
    renameFolder,
    moveFolder,
    reorderFolders,
    deleteFolder,
    reload,
  }
}

export type UseFoldersReturn = ReturnType<typeof useFolders>
