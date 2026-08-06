import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Database, Loader2 } from 'lucide-react'
import { listAuctioneers, markLegacyImported } from '@/lib/auctioneers/storage'
import { importLegacy } from '@/lib/auctioneers/supabase-repo'
import { qk } from '@/lib/queryKeys'

interface Props {
  organizationId: string
  auctionOrgId: string | null
  /** Đã có dữ liệu trên Supabase rồi thì không mời nhập nữa. */
  hasRemoteData: boolean
  onImported: () => void
}

/**
 * Nhập roster cũ từ localStorage lên Supabase — TƯỜNG MINH, không tự động.
 *
 * Tự động sẽ sai: dữ liệu cũ có thể là bản demo mà ai đó từng nghịch, và
 * StrictMode của React 18 gọi effect hai lần. Đẩy ngầm là làm bẩn roster thật
 * mà không có đường lùi.
 */
export function LegacyImportBanner({ organizationId, auctionOrgId, hasRemoteData, onImported }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()

  const legacy = listAuctioneers()
  if (hasRemoteData || legacy.length === 0) return null

  async function handleImport() {
    setConfirmOpen(false)
    setBusy(true)
    try {
      const { imported, skipped } = await importLegacy(legacy, { organizationId, auctionOrgId })
      markLegacyImported()
      qc.invalidateQueries({ queryKey: qk.auctioneers(organizationId) })
      toast.success(
        skipped > 0
          ? `Đã nhập ${imported} đấu giá viên, bỏ qua ${skipped} bản trùng số thẻ.`
          : `Đã nhập ${imported} đấu giá viên.`,
      )
      onImported()
    } catch {
      toast.error('Nhập dữ liệu thất bại. Dữ liệu cũ vẫn còn nguyên, bạn có thể thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className="p-4 rounded-2xl border-warning/40 bg-warning/5">
        <div className="flex items-start gap-3">
          <Database className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              Tìm thấy {legacy.length} đấu giá viên lưu trên trình duyệt này
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Dữ liệu cũ chỉ nằm trên máy bạn. Nhập lên hệ thống để đồng nghiệp cùng
              xem được và không mất khi đổi máy.
            </p>
          </div>
          <Button size="sm" className="shrink-0 gap-1.5" disabled={busy} onClick={() => setConfirmOpen(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Nhập dữ liệu cũ
          </Button>
        </div>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nhập {legacy.length} đấu giá viên lên hệ thống?</AlertDialogTitle>
            <AlertDialogDescription>
              Bản ghi trùng số thẻ ĐGV sẽ được bỏ qua, không ghi đè. Dữ liệu cũ trên
              trình duyệt vẫn được giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>Nhập dữ liệu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
