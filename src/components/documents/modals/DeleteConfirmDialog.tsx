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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'soft' | 'hard'
  name: string
  onConfirm: () => void
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  mode,
  name,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'hard' ? 'Xóa vĩnh viễn?' : 'Chuyển vào thùng rác?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'hard' ? (
              <>
                File <strong>{name}</strong> sẽ bị xóa vĩnh viễn và không thể
                khôi phục. Hành động này không thể hoàn tác.
              </>
            ) : (
              <>
                File <strong>{name}</strong> sẽ được chuyển vào thùng rác. Bạn
                có thể khôi phục trong vòng 30 ngày.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={mode === 'hard' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {mode === 'hard' ? 'Xóa vĩnh viễn' : 'Chuyển vào thùng rác'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
