import type { UseFormReturn } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { DeltaFieldsSection } from "../DeltaFieldsSection";
import type { WizardValues } from "../wizardSchema";

interface StepProps {
  form: UseFormReturn<WizardValues>;
}

/** Bước 2: thông tin chung (tên, mô tả, khu vực) + thông tin riêng theo loại. */
export function Step2GeneralInfo({ form }: StepProps) {
  const province = form.watch("province");
  const district = form.watch("district");
  const provinceObj = vietnamProvinces.find((p) => p.name === province);
  const districtObj = provinceObj?.districts.find((d) => d.name === district);

  return (
    <Form {...form}>
      <div className="space-y-5">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên tài sản *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="VD: Quyền sử dụng đất tại 12 Nguyễn Huệ" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mô tả chi tiết</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Mô tả đặc điểm, vị trí, hiện trạng tài sản..." className="min-h-[88px]" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Khu vực (Tỉnh / TP) *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val);
                    form.setValue("district", "");
                    form.setValue("ward", "");
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn tỉnh / thành phố" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vietnamProvinces.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="district"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quận / Huyện</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue("ward", "");
                    }}
                    disabled={!provinceObj}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {provinceObj?.districts.map((d) => (
                        <SelectItem key={d.name} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ward"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phường / Xã</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!districtObj}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {districtObj?.wards.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Địa chỉ cụ thể</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Số nhà, tên đường..." />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Thông tin riêng theo loại tài sản</p>
          <p className="text-xs text-muted-foreground">Các thông số đặc thù giúp tổ chức đấu giá định giá chính xác.</p>
        </div>
        <DeltaFieldsSection form={form} />
      </div>
    </Form>
  );
}
