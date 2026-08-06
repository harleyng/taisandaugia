import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { DossierEvent, EventType } from '@/types/personnel'
import { EVENT_TYPE_LABELS } from '@/types/personnel'
import { useCpdCatalog } from '@/hooks/useCpdCatalog'
import {
  hoursFieldState, ruleFor, selectableRoles, selectableTypes,
} from '@/lib/personnel/cpd-catalog'
import { groupNumber, parseNumber } from '@/components/asset-posting/format'
import { PersonnelFileUpload } from './PersonnelFileUpload'

const schema = z.object({
  title: z.string().min(2, 'Bắt buộc'),
  organizationName: z.string().optional(),
  role: z.string().optional(),
  startedOn: z.string().optional(),
  endedOn: z.string().optional(),
  referenceNo: z.string().optional(),
  outcome: z.string().optional(),
  amount: z.string().optional(),
  hours: z.string().optional(),
  notes: z.string().optional(),
  cpdYear: z.string().optional(),
})

type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventType: EventType
  existing?: DossierEvent
  onSave: (ev: Partial<DossierEvent>) => void
  /**
   * Truyền cả hai để bật ô đính kèm minh chứng. Thiếu một trong hai thì ẩn —
   * `uploadDocFile` dựng đường dẫn `{organizationId}/{auctioneerId}/…` và policy
   * bucket khớp đúng quy ước đó, không có id thì không tải lên được.
   */
  organizationId?: string
  auctioneerId?: string
}

/**
 * Nhãn từng trường đổi theo loại sự kiện — một dialog dùng cho cả 4 loại.
 *
 * Nhánh TRAINING KHÔNG còn switch theo mã hình thức: nhãn lấy từ danh mục
 * (`titleLabel`/`orgLabel`) nên admin thêm hình thức mới là form tự đúng, không
 * phải sửa file này.
 */
function labelsFor(t: EventType) {
  switch (t) {
    case 'WORK':
      return { title: 'Vị trí / công việc', org: 'Nơi công tác', role: 'Chức vụ' }
    case 'TRAINING':
      return { title: 'Tên hoạt động', org: 'Đơn vị tổ chức', role: '' }
    case 'REWARD':
      return { title: 'Hình thức khen thưởng', org: 'Cấp khen thưởng', role: '' }
    case 'DISCIPLINE':
      return { title: 'Hình thức kỷ luật', org: 'Cấp ra quyết định', role: '' }
  }
}

export function DossierEventDialog({
  open, onOpenChange, eventType, existing, onSave, organizationId, auctioneerId,
}: Props) {
  const isTraining = eventType === 'TRAINING'
  const { catalog, isLoading: catalogLoading } = useCpdCatalog()
  const types = selectableTypes(catalog)

  const [typeId, setTypeId] = useState<string>(existing?.cpdActivityTypeId ?? '')
  const [roleId, setRoleId] = useState<string>(existing?.cpdActivityRoleId ?? '')
  const [isStateCenter, setIsStateCenter] = useState(existing?.isStateAuctionCenter ?? false)
  const [attachments, setAttachments] = useState<string[]>(existing?.attachments ?? [])

  // Bản ghi cũ có thể trỏ tới hình thức đã bị tắt — tra trong TOÀN danh mục chứ
  // không tra trong danh sách đã lọc, nếu không mở ra sửa sẽ mất lựa chọn.
  const selectedType = catalog.activityTypes.find((t) => t.id === typeId)
  const roles = selectableRoles(selectedType)
  const selectedRole = selectedType?.roles.find((r) => r.id === roleId)
  const rule = ruleFor(selectedType, selectedRole)

  // Vai trò bắt buộc khi hình thức phân vai trò — thiếu nó thì không biết tính
  // đạt cả năm hay cộng giờ, tức là không chấm được.
  const roleMissing = isTraining && !!selectedType?.hasRoles && !selectedRole
  const hoursMode = hoursFieldState(rule)
  // Giờ hiện cho MỌI hình thức: hồ sơ kết xuất in số giờ thực tế của khoá học kể
  // cả khi hình thức đó đã cho đạt cả năm.
  const showOutcome = isTraining && rule?.mode === 'HOURS'
  const showRef = eventType !== 'WORK'

  const L = labelsFor(eventType)
  const titleLabel = isTraining && selectedType ? selectedType.titleLabel : L.title
  const orgLabel = isTraining && selectedType ? selectedType.orgLabel : L.org

  const toValues = (e?: DossierEvent): Values => ({
    title: e?.title ?? '',
    organizationName: e?.organizationName ?? '',
    role: e?.role ?? '',
    startedOn: e?.startedOn ?? '',
    endedOn: e?.endedOn ?? '',
    referenceNo: e?.referenceNo ?? '',
    outcome: e?.outcome ?? '',
    amount: e?.amount ? groupNumber(String(e.amount)) : '',
    hours: e?.hours ? String(e.hours) : '',
    notes: e?.notes ?? '',
    cpdYear: String(e?.cpdYear ?? new Date().getFullYear()),
  })

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(existing) })

  useEffect(() => {
    if (open) {
      form.reset(toValues(existing))
      setIsStateCenter(existing?.isStateAuctionCenter ?? false)
      // Mở form THÊM MỚI thì chọn sẵn hình thức đầu danh mục — người dùng gần
      // như luôn khai lớp bồi dưỡng, và bỏ trống sẽ khiến bản ghi không được
      // tính vào nghĩa vụ mà không có gì báo.
      setTypeId(existing?.cpdActivityTypeId ?? types[0]?.id ?? '')
      setRoleId(existing?.cpdActivityRoleId ?? '')
      setAttachments(existing?.attachments ?? [])
    }
  }, [open, existing?.id, types.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Đổi hình thức thì vai trò cũ hết nghĩa. Mặc định vai trò đầu tiên để không
  // rơi vào trạng thái "đã chọn hình thức nhưng chưa chấm được".
  useEffect(() => {
    if (!isTraining || !selectedType) return
    if (!selectedType.hasRoles) { if (roleId) setRoleId(''); return }
    if (!selectedType.roles.some((r) => r.id === roleId)) {
      setRoleId(selectableRoles(selectedType)[0]?.id ?? '')
    }
  }, [isTraining, selectedType, roleId])

  // Quy đổi cố định thì con số hiển thị phải là con số được cộng — để người dùng
  // sửa tay sẽ tạo ra hai sự thật khác nhau trên cùng màn hình.
  useEffect(() => {
    if (hoursMode === 'fixed' && rule?.fixedHours != null) {
      form.setValue('hours', String(rule.fixedHours))
    }
  }, [hoursMode, rule?.fixedHours, form])

  // Đổi ngày bắt đầu thì kéo theo năm tính nghĩa vụ, trừ khi người dùng đã tự
  // sửa năm (khoá vắt qua năm) — khi đó tôn trọng con số họ nhập.
  const startedOn = form.watch('startedOn')
  useEffect(() => {
    if (!isTraining || !startedOn) return
    const y = startedOn.slice(0, 4)
    if (y.length === 4 && !existing) form.setValue('cpdYear', y)
  }, [startedOn, isTraining, existing, form])

  function submit(v: Values) {
    onSave({
      ...existing,
      eventType,
      title: v.title,
      organizationName: v.organizationName,
      role: v.role,
      startedOn: v.startedOn,
      endedOn: v.endedOn,
      referenceNo: v.referenceNo,
      outcome: v.outcome,
      amount: v.amount ? Number(parseNumber(v.amount)) || undefined : undefined,
      hours: v.hours ? Number(v.hours) : undefined,
      notes: v.notes,
      isStateAuctionCenter: eventType === 'WORK' ? isStateCenter : undefined,
      attachments,
      cpdYear: isTraining ? Number(v.cpdYear) || new Date().getFullYear() : undefined,
      cpdActivityTypeId: isTraining ? (typeId || undefined) : undefined,
      // Chỉ ghi vai trò khi hình thức thực sự phân vai trò — tránh để lại id mồ
      // côi nếu admin sau này tắt cờ hasRoles của hình thức đó.
      cpdActivityRoleId: isTraining && selectedType?.hasRoles ? (roleId || undefined) : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {existing ? 'Sửa' : 'Thêm'} — {EVENT_TYPE_LABELS[eventType]}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4 pt-1">
            {isTraining && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Hình thức bồi dưỡng</label>
                  <Select value={typeId} onValueChange={setTypeId} disabled={catalogLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={catalogLoading ? 'Đang tải danh mục…' : 'Chọn hình thức'} />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedType?.description && (
                    <p className="text-xs text-muted-foreground">{selectedType.description}</p>
                  )}
                </div>

                {selectedType?.hasRoles && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      Vai trò <span className="text-destructive">*</span>
                    </label>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger><SelectValue placeholder="Chọn vai trò" /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedRole?.description && (
                      <p className="text-xs text-muted-foreground">{selectedRole.description}</p>
                    )}
                    {roleMissing && (
                      <p className="text-xs text-destructive">
                        Hình thức này tính khác nhau theo vai trò — phải chọn vai trò mới ghi nhận được.
                      </p>
                    )}
                  </div>
                )}

                {/* Nói thẳng bản ghi này được tính thế nào, thay vì bắt người
                    dùng suy ra từ tên hình thức. */}
                {rule && (
                  <p className="text-xs text-muted-foreground">
                    {rule.mode === 'FULL_YEAR'
                      ? 'Hoạt động này được tính là hoàn thành nghĩa vụ bồi dưỡng của cả năm.'
                      : rule.fixedHours != null
                        ? `Được quy đổi ${rule.fixedHours} giờ, cộng vào mốc tối thiểu 8 giờ/năm.`
                        : 'Tính theo số giờ khai bên dưới, cộng vào mốc tối thiểu 8 giờ/năm.'}
                  </p>
                )}
              </div>
            )}

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{titleLabel} <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="organizationName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{orgLabel}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />

              {L.role && (
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{L.role}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="startedOn" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {eventType === 'WORK' ? 'Từ ngày' : 'Ngày'}
                  </FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />

              {eventType === 'WORK' && (
                <FormField control={form.control} name="endedOn" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Đến ngày</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
              )}

              {showRef && (
                <FormField control={form.control} name="referenceNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      {isTraining ? 'Số giấy chứng nhận' : 'Số quyết định'}
                    </FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              )}

              {showOutcome && (
                <FormField control={form.control} name="outcome" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Xếp loại</FormLabel>
                    <FormControl><Input {...field} placeholder="Đạt" /></FormControl>
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="hours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    Số giờ{hoursMode === 'fixed' && ' (quy đổi cố định)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      disabled={isTraining && hoursMode === 'fixed'}
                    />
                  </FormControl>
                </FormItem>
              )} />

              {isTraining && (
                <FormField control={form.control} name="cpdYear" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tính cho năm</FormLabel>
                    <FormControl><Input type="number" min={2000} max={2100} {...field} /></FormControl>
                  </FormItem>
                )} />
              )}
            </div>

            {eventType === 'WORK' && (
              <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
                <Checkbox
                  className="mt-0.5"
                  checked={isStateCenter}
                  onCheckedChange={(v) => setIsStateCenter(v === true)}
                />
                <span>
                  <span className="text-sm">
                    Trung tâm dịch vụ đấu giá tài sản (Sở Tư pháp)
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Tick nếu đây là nơi công tác thuộc Nhà nước — tính điểm Mục V.2 theo
                    TT 19/2024/TT-BTP, tối đa 4 điểm cho tổ chức.
                  </span>
                </span>
              </label>
            )}

            {organizationId && auctioneerId && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  {isTraining ? 'Giấy tờ xác nhận' : 'Tệp đính kèm'}
                </label>
                {isTraining && selectedType?.evidenceHint && (
                  <p className="text-xs text-muted-foreground">{selectedType.evidenceHint}</p>
                )}
                <PersonnelFileUpload
                  organizationId={organizationId}
                  auctioneerId={auctioneerId}
                  value={attachments}
                  onChange={setAttachments}
                />
              </div>
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ghi chú</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={roleMissing}>Lưu</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
