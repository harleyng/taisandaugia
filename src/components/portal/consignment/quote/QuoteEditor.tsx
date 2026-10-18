import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { uploadQuoteDoc, useRespondServiceRequest } from '@/hooks/useOrgServiceRequests'
import { planLeadTimeDays } from '@/lib/quotePlan'
import type { OrgServiceRequest, QuotePlan } from '@/types/consignment'
import { ConsignmentCanvas } from '../ConsignmentCanvas'
import { QuoteSessionCard } from './QuoteSessionCard'
import { QuoteChannelsCard } from './QuoteChannelsCard'
import { QuoteTimelineCard } from './QuoteTimelineCard'
import { QuoteScopeCard } from './QuoteScopeCard'
import { QuoteFeesCard } from './QuoteFeesCard'
import { QuoteAttachCard } from './QuoteAttachCard'
import { QuoteSubmitBar } from './QuoteSubmitBar'
import { QuoteGroup } from './parts'
import { initialQuoteForm, isAppraisal, isoDay, quoteTotals, toQuoteInput, validateQuoteForm, type QuoteForm } from './quoteForm'

interface Props {
  request: OrgServiceRequest
  organizationId: string | null
  /** Nút quay lại + tiêu đề trang. */
  header: ReactNode
}

/**
 * Form báo giá (design "Gửi báo giá"): Phương án tổ chức · Chi phí · Bổ sung,
 * thanh tổng kết dính đáy. Gửi lại được nhiều lần — RPC ghi đè tới khi chủ tài
 * sản chốt. Phí dịch vụ và lead time do server suy ra từ khoản mục / mốc 'mo_phien'.
 */
export function QuoteEditor({ request: r, organizationId, header }: Props) {
  const navigate = useNavigate()
  const respond = useRespondServiceRequest()
  const [form, setForm] = useState<QuoteForm>(() => initialQuoteForm(r))
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const set = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setPlan = (patch: Partial<QuotePlan>) => setForm((f) => ({ ...f, plan: { ...f.plan, ...patch } }))

  const today = isoDay(new Date())
  const appraisal = isAppraisal(r)
  const totals = quoteTotals(form, r)
  const errors = validateQuoteForm(form, r, today)
  const updating = !!r.quoted_at

  const submit = async () => {
    if (errors.length) {
      setShowErrors(true)
      return
    }
    let docPath: string | null = null
    if (file && organizationId) {
      try {
        setUploading(true)
        docPath = await uploadQuoteDoc(organizationId, r.id, file)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không tải được tệp báo giá.')
        return
      } finally {
        setUploading(false)
      }
    }
    respond.mutate(
      { requestId: r.id, action: 'quote', quote: toQuoteInput(form, r, docPath) },
      { onSuccess: () => navigate(`/portal/yeu-cau-ky-gui/${r.id}`) },
    )
  }

  return (
    <ConsignmentCanvas
      footer={
        <QuoteSubmitBar
          commissionPct={form.commissionPct}
          total={totals.total}
          leadDays={planLeadTimeDays(form.plan)}
          errors={showErrors ? errors : []}
          busyLabel={uploading ? 'Đang tải tệp…' : respond.isPending ? 'Đang gửi…' : null}
          submitLabel={updating ? 'Cập nhật báo giá' : 'Gửi báo giá'}
          onSubmit={submit}
        />
      }
    >
      {header}
      <div className="flex min-w-0 flex-col gap-6">
        <QuoteGroup>Phương án tổ chức</QuoteGroup>
        <QuoteSessionCard
          request={r}
          plan={form.plan}
          onPlan={setPlan}
          appraisal={appraisal}
          base={totals.base}
          startingPrice={form.startingPrice}
          onStartingPrice={(v) => set('startingPrice', v)}
          validUntil={form.validUntil}
          onValidUntil={(v) => set('validUntil', v)}
          today={today}
        />
        <QuoteChannelsCard
          plan={form.plan}
          onPlan={setPlan}
          otherOn={form.otherChannel}
          onOtherOn={(on) => set('otherChannel', on)}
        />
        <QuoteTimelineCard milestones={form.plan.milestones} onChange={(milestones) => setPlan({ milestones })} />
        <QuoteScopeCard plan={form.plan} onPlan={setPlan} />

        <QuoteGroup>Chi phí</QuoteGroup>
        <QuoteFeesCard
          fees={form.fees}
          onFees={(fees) => set('fees', fees)}
          commissionPct={form.commissionPct}
          onCommissionPct={(v) => set('commissionPct', v)}
          ownerMaxPct={r.commission_pct}
          base={totals.base}
          totals={totals}
        />

        <QuoteGroup>Bổ sung</QuoteGroup>
        <QuoteAttachCard
          note={form.note}
          onNote={(v) => set('note', v)}
          file={file}
          onFile={setFile}
          hasExistingDoc={!!r.quote_doc_path}
        />
      </div>
    </ConsignmentCanvas>
  )
}
