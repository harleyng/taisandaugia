import type { UseFormReturn } from 'react-hook-form'
import { FormField, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { EditFormValues } from '../EditInfoSheet'

const POSITIONS = ['Giám đốc', 'Tổng Giám đốc', 'Chủ tịch HĐQT', 'Trưởng đơn vị', 'Khác']

interface LegalRepSectionProps {
  form: UseFormReturn<EditFormValues>
}

export function LegalRepSection({ form }: LegalRepSectionProps) {
  return (
    <div className="space-y-4">
      <FormField control={form.control} name="legalRepName" render={({ field }) => (
        <FormItem>
          <FormLabel>Họ tên đại diện pháp lý *</FormLabel>
          <FormControl><Input {...field} placeholder="Nguyễn Văn A" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="legalRepPosition" render={({ field }) => (
        <FormItem>
          <FormLabel>Chức vụ</FormLabel>
          <FormControl>
            <Input
              {...field}
              list="positions-list"
              placeholder="VD: Giám đốc"
            />
          </FormControl>
          <datalist id="positions-list">
            {POSITIONS.map((p) => <option key={p} value={p} />)}
          </datalist>
        </FormItem>
      )} />

      <FormField control={form.control} name="legalRepIdNumber" render={({ field }) => (
        <FormItem>
          <FormLabel>Số CMND / CCCD</FormLabel>
          <FormControl>
            <Input
              {...field}
              className="font-mono"
              placeholder="(riêng tư — chỉ hiện 4 số cuối khi xem)"
            />
          </FormControl>
          <p className="text-xs text-muted-foreground">Thông tin riêng tư — sẽ được che khi hiển thị</p>
        </FormItem>
      )} />

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="legalRepIdIssuedDate" render={({ field }) => (
          <FormItem>
            <FormLabel>Ngày cấp</FormLabel>
            <FormControl><Input {...field} type="date" /></FormControl>
          </FormItem>
        )} />

        <FormField control={form.control} name="legalRepIdIssuedPlace" render={({ field }) => (
          <FormItem>
            <FormLabel>Nơi cấp</FormLabel>
            <FormControl><Input {...field} placeholder="VD: Cục CS QLHC..." /></FormControl>
          </FormItem>
        )} />
      </div>
    </div>
  )
}
