import { useWatch } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { FormField, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { CheckCircle2 } from 'lucide-react'
import { calcYearsOfOperation, calcMucIV5, mucIV5NextThreshold } from '@/lib/general-info/scoring'
import { DocFileUpload } from '../DocFileUpload'
import type { EditFormValues } from '../EditInfoSheet'

const ISSUERS = ['Bộ Tư pháp', 'Sở Tư pháp TP.HCM', 'Sở Tư pháp Hà Nội', 'Sở Tư pháp Đà Nẵng', 'UBND Tỉnh/TP']

interface EstablishmentSectionProps {
  form: UseFormReturn<EditFormValues>
}

export function EstablishmentSection({ form }: EstablishmentSectionProps) {
  const foundedDate = useWatch({ control: form.control, name: 'foundedDate' })

  let scoreHint: React.ReactNode = null
  if (foundedDate) {
    try {
      const op = calcYearsOfOperation(foundedDate)
      const score = calcMucIV5(op.years)
      const next = mucIV5NextThreshold(op.years)
      if (op.years > 0 || op.months > 0) {
        scoreHint = (
          <div className={`rounded-md px-3 py-2 text-xs flex items-start gap-2 ${score >= 4 ? 'bg-success/10 text-success' : 'bg-primary/5 text-primary'}`}>
            {score >= 4 && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            <span>
              Hoạt động {op.displayText} → Mục IV.5: <strong>{score}/4 điểm</strong>
              {score >= 4 ? ' ✓ (mức cao nhất)' : next ? ` · ${next}` : ''}
            </span>
          </div>
        )
      }
    } catch { /* ignore parse errors */ }
  }

  return (
    <div className="space-y-5">
      <FormField control={form.control} name="foundedDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Ngày thành lập *</FormLabel>
          <FormControl><Input {...field} type="date" /></FormControl>
          <FormMessage />
          {scoreHint}
        </FormItem>
      )} />

      {/* QĐ thành lập */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quyết định thành lập</p>

        <FormField control={form.control} name="establishmentDecisionNumber" render={({ field }) => (
          <FormItem>
            <FormLabel>Số quyết định</FormLabel>
            <FormControl><Input {...field} placeholder="QĐ-123/BTP-2010" /></FormControl>
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="establishmentDecisionDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Ngày ban hành</FormLabel>
              <FormControl><Input {...field} type="date" /></FormControl>
            </FormItem>
          )} />

          <FormField control={form.control} name="establishmentDecisionIssuer" render={({ field }) => (
            <FormItem>
              <FormLabel>Cấp bởi</FormLabel>
              <FormControl>
                <Input {...field} list="issuers-list" placeholder="Bộ Tư pháp" />
              </FormControl>
            </FormItem>
          )} />
        </div>

        <datalist id="issuers-list">
          {ISSUERS.map((i) => <option key={i} value={i} />)}
        </datalist>

        <FormField control={form.control} name="establishmentDecisionFile" render={({ field }) => (
          <FormItem>
            <FormLabel>File đính kèm</FormLabel>
            <FormControl>
              <DocFileUpload
                value={field.value ?? ''}
                onChange={field.onChange}
                fieldId="establishment-decision"
                label="Quyết định thành lập"
              />
            </FormControl>
          </FormItem>
        )} />
      </div>

      {/* GĐKHĐ */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giấy đăng ký hoạt động</p>

        <FormField control={form.control} name="businessLicenseNumber" render={({ field }) => (
          <FormItem>
            <FormLabel>Số GĐKHĐ</FormLabel>
            <FormControl><Input {...field} placeholder="GDK-456" /></FormControl>
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="businessLicenseDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Ngày cấp</FormLabel>
              <FormControl><Input {...field} type="date" /></FormControl>
            </FormItem>
          )} />

          <FormField control={form.control} name="businessLicenseIssuer" render={({ field }) => (
            <FormItem>
              <FormLabel>Cấp bởi</FormLabel>
              <FormControl>
                <Input {...field} list="issuers-list" placeholder="Sở Tư pháp..." />
              </FormControl>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="businessLicenseFile" render={({ field }) => (
          <FormItem>
            <FormLabel>File đính kèm</FormLabel>
            <FormControl>
              <DocFileUpload
                value={field.value ?? ''}
                onChange={field.onChange}
                fieldId="business-license"
                label="Giấy đăng ký hoạt động"
              />
            </FormControl>
          </FormItem>
        )} />
      </div>
    </div>
  )
}
