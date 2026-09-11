import { useEffect, useState } from 'react'
import { Download, FileText, Loader2, Paperclip, Wand2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CONTRACT_FILE_ACCEPT, validateContractFile } from '@/lib/consignment/contractFiles'
import { generateContractDraftFile } from '@/hooks/useConsignmentContract'
import type { OrgContractDetail } from '@/types/consignment-contract'

export interface ShareDraftValues {
  file: File
  contractNo: string
  /** Tệp do sàn tạo từ báo giá (true) hay tổ chức tự tải lên (false). */
  generated: boolean
}

interface ShareDraftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  detail: OrgContractDetail
  categoryLabel: string | null
  /** Đã có bản ký — dự thảo mới sẽ gỡ bản ký và mọi xác nhận. */
  hasSigned: boolean
  onSubmit: (values: ShareDraftValues) => void
}

/**
 * Tổ chức chia sẻ dự thảo hợp đồng dịch vụ: tạo tự động từ báo giá đã chốt
 * (điều khoản mẫu, cần rà soát) hoặc tải lên bản của tổ chức.
 */
export function ShareDraftDialog({
  open, onOpenChange, isPending, detail, categoryLabel, hasSigned, onSubmit,
}: ShareDraftDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [generated, setGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [contractNo, setContractNo] = useState(detail.contract.contract_no ?? '')

  useEffect(() => {
    if (!open) return
    setFile(null)
    setGenerated(false)
    setContractNo(detail.contract.contract_no ?? '')
  }, [open, detail.contract.contract_no])

  // Object URL của bản xem trước phải giải phóng khi đổi tệp / đóng.
  useEffect(() => {
    if (!file || !generated) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, generated])

  const pickFile = (f: File | null) => {
    if (!f) {
      setFile(null)
      setGenerated(false)
      return
    }
    const invalid = validateContractFile(f)
    if (invalid) {
      toast.error(invalid)
      return
    }
    setFile(f)
    setGenerated(false)
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const withNo = { ...detail, contract: { ...detail.contract, contract_no: contractNo.trim() || null } }
      setFile(await generateContractDraftFile(withNo, categoryLabel))
      setGenerated(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được dự thảo. Vui lòng thử lại.')
    } finally {
      setGenerating(false)
    }
  }

  const busy = isPending || generating
  const cannotGenerate = detail.missing.length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chia sẻ dự thảo hợp đồng</DialogTitle>
          <DialogDescription>
            Dự thảo hợp đồng dịch vụ đấu giá tài sản theo đúng phương án và chi phí chủ tài sản đã chốt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="draft-contract-no">Số hợp đồng (nếu đã có)</Label>
            <Input
              id="draft-contract-no"
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
              placeholder="VD: 15/2026/HĐDV"
              disabled={busy}
            />
          </div>

          {file ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                {generated ? (
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => pickFile(null)}
                  disabled={busy}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Bỏ tệp đã chọn"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {generated && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
                  <span className="text-foreground">
                    Bản tạo tự động dùng điều khoản mẫu — mở ra rà soát trước khi chia sẻ.
                  </span>
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      download={file.name}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" /> Tải xem
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={generate}
                disabled={busy || cannotGenerate}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {generating ? 'Đang tạo dự thảo…' : 'Tạo dự thảo từ báo giá đã chốt'}
              </Button>
              {cannotGenerate && (
                <p className="text-xs text-muted-foreground">Bổ sung đủ thông tin các bên trước khi tạo dự thảo.</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="draft-file">Hoặc tải lên bản của tổ chức (PDF/JPG/PNG, ≤ 10MB)</Label>
                <Input
                  id="draft-file"
                  type="file"
                  accept={CONTRACT_FILE_ACCEPT}
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
              </div>
            </div>
          )}

          {hasSigned && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-foreground">
              Đã có bản ký được tải lên. Chia sẻ dự thảo mới sẽ gỡ bản ký đó và mọi xác nhận — hai bên phải ký
              và xác nhận lại.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Để sau
          </Button>
          <Button
            onClick={() => file && onSubmit({ file, contractNo, generated })}
            disabled={!file || busy}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Chia sẻ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
