import type { UseFormReturn } from 'react-hook-form'
import { FormField, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import type { EditFormValues } from '../EditInfoSheet'

interface EntityInfoSectionProps {
  form: UseFormReturn<EditFormValues>
}

export function EntityInfoSection({ form }: EntityInfoSectionProps) {
  return (
    <div className="space-y-4">
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>Tên đầy đủ *</FormLabel>
          <FormControl><Input {...field} placeholder="Công ty Đấu giá Hợp danh..." /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="shortName" render={({ field }) => (
        <FormItem>
          <FormLabel>Tên viết tắt</FormLabel>
          <FormControl><Input {...field} placeholder="VD: NALAF" /></FormControl>
        </FormItem>
      )} />

      <FormField control={form.control} name="orgType" render={({ field }) => (
        <FormItem>
          <FormLabel>Loại tổ chức *</FormLabel>
          <FormControl>
            <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-1.5">
              {[
                { value: 'TRUNG_TAM_DV', label: 'Trung tâm dịch vụ đấu giá tài sản' },
                { value: 'CONG_TY_HOP_DANH', label: 'Công ty đấu giá hợp danh' },
                { value: 'DN_TU_NHAN', label: 'Doanh nghiệp đấu giá tư nhân' },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`orgType-${opt.value}`} />
                  <Label htmlFor={`orgType-${opt.value}`} className="font-normal">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="taxCode" render={({ field }) => (
          <FormItem>
            <FormLabel>MST (Mã số thuế) *</FormLabel>
            <FormControl><Input {...field} className="font-mono" placeholder="0123456789" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="registrationCode" render={({ field }) => (
          <FormItem>
            <FormLabel>Mã định danh / CCHN</FormLabel>
            <FormControl><Input {...field} className="font-mono text-xs" placeholder="OWN-..." /></FormControl>
          </FormItem>
        )} />
      </div>

    </div>
  )
}
