import type { UseFormReturn } from 'react-hook-form'
import { FormField, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { vietnamProvinces } from '@/constants/vietnam-locations'
import type { EditFormValues } from '../EditInfoSheet'

interface AddressContactSectionProps {
  form: UseFormReturn<EditFormValues>
}

export function AddressContactSection({ form }: AddressContactSectionProps) {
  return (
    <div className="space-y-4">
      <FormField control={form.control} name="address" render={({ field }) => (
        <FormItem>
          <FormLabel>Địa chỉ trụ sở *</FormLabel>
          <FormControl><Input {...field} placeholder="Số nhà, tên đường..." /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <div className="grid grid-cols-3 gap-2">
        <FormField control={form.control} name="province" render={({ field }) => (
          <FormItem className="col-span-1">
            <FormLabel>Tỉnh / TP *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {vietnamProvinces.map((p) => (
                  <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="district" render={({ field }) => (
          <FormItem>
            <FormLabel>Quận / Huyện</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )} />

        <FormField control={form.control} name="ward" render={({ field }) => (
          <FormItem>
            <FormLabel>Phường / Xã</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Số điện thoại *</FormLabel>
            <FormControl><Input {...field} placeholder="0971234567" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="alternativePhone" render={({ field }) => (
          <FormItem>
            <FormLabel>SĐT phụ</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="fax" render={({ field }) => (
          <FormItem>
            <FormLabel>Fax</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )} />

        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email *</FormLabel>
            <FormControl><Input {...field} type="email" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="alternativeEmail" render={({ field }) => (
        <FormItem>
          <FormLabel>Email phụ</FormLabel>
          <FormControl><Input {...field} type="email" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="website" render={({ field }) => (
        <FormItem>
          <FormLabel>Website</FormLabel>
          <FormControl><Input {...field} placeholder="https://..." /></FormControl>
          <FormMessage />
          <p className="text-xs text-muted-foreground">
            💡 Website cũng dùng cho Mục II.3 (Cơ sở vật chất)
          </p>
        </FormItem>
      )} />
    </div>
  )
}
