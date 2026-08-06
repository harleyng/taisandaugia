import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { Auctioneer } from '@/types/auctioneer'
import { GENDER_LABELS, ID_TYPE_LABELS } from '@/types/personnel'
import { PortraitUpload } from './PortraitUpload'

const schema = z.object({
  idType: z.enum(['CCCD', 'PASSPORT']).optional(),
  idNumber: z.string().optional(),
  idIssuedDate: z.string().optional(),
  idIssuedPlace: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional(),
  hometown: z.string().optional(),
  ethnicity: z.string().optional(),
  nationality: z.string().optional(),
  permanentAddress: z.string().optional(),
  educationLevel: z.string().optional(),
  major: z.string().optional(),
  almaMater: z.string().optional(),
  practiceStartDate: z.string().optional(),
  managementStartDate: z.string().optional(),
  professionalCertIssuedDate: z.string().optional(),
}).refine(
  // CCCD 9–12 chữ số, hộ chiếu ≥6 ký tự — cùng luật với KYC tổ chức.
  (v) => {
    if (!v.idNumber) return true
    if (v.idType === 'PASSPORT') return v.idNumber.trim().length >= 6
    return /^\d{9,12}$/.test(v.idNumber.trim())
  },
  { message: 'CCCD phải 9–12 chữ số; hộ chiếu tối thiểu 6 ký tự', path: ['idNumber'] },
)

type Values = z.infer<typeof schema>

interface Props {
  person: Auctioneer
  organizationId: string
  saving: boolean
  onSave: (patch: Partial<Auctioneer>) => void
}

function toValues(a: Auctioneer): Values {
  return {
    idType: a.idType,
    idNumber: a.idNumber ?? '',
    idIssuedDate: a.idIssuedDate ?? '',
    idIssuedPlace: a.idIssuedPlace ?? '',
    gender: a.gender,
    dateOfBirth: a.dateOfBirth ?? '',
    hometown: a.hometown ?? '',
    ethnicity: a.ethnicity ?? '',
    nationality: a.nationality ?? 'Việt Nam',
    permanentAddress: a.permanentAddress ?? '',
    educationLevel: a.educationLevel ?? '',
    major: a.major ?? '',
    almaMater: a.almaMater ?? '',
    practiceStartDate: a.practiceStartDate ?? '',
    managementStartDate: a.managementStartDate ?? '',
    professionalCertIssuedDate: a.professionalCertIssuedDate ?? '',
  }
}

export function IdentitySection({ person, organizationId, saving, onSave }: Props) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(person) })

  useEffect(() => { form.reset(toValues(person)) }, [person.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Thông tin định danh</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Chỉ dùng nội bộ và trong file hồ sơ xuất ra. Không hiển thị công khai trên sàn.
        </p>
      </div>

      <PortraitUpload
        organizationId={organizationId}
        auctioneerId={person.id}
        value={person.portraitUrl}
        onChange={(url) => onSave({ portraitUrl: url })}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => onSave(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="idType" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Loại giấy tờ</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.entries(ID_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="idNumber" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Số giấy tờ</FormLabel>
                <FormControl><Input {...field} placeholder="0123456789" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="idIssuedDate" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ngày cấp</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="idIssuedPlace" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Nơi cấp</FormLabel>
                <FormControl><Input {...field} placeholder="Cục CSQLHC về TTXH" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ngày sinh</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="gender" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Giới tính</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="hometown" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Quê quán</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="ethnicity" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Dân tộc</FormLabel>
                <FormControl><Input {...field} placeholder="Kinh" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="nationality" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Quốc tịch</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="educationLevel" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Trình độ học vấn</FormLabel>
                <FormControl><Input {...field} placeholder="Cử nhân / Thạc sĩ" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="major" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Chuyên ngành</FormLabel>
                <FormControl><Input {...field} placeholder="Luật" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="almaMater" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Cơ sở đào tạo</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="permanentAddress" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Địa chỉ thường trú</FormLabel>
              <FormControl><Input {...field} /></FormControl>
            </FormItem>
          )} />

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mốc hành nghề
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Quyết định điểm Mục IV.7 và IV.8 theo TT 19/2024/TT-BTP.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="practiceStartDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Ngày bắt đầu hành nghề đấu giá</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground">
                    Mốc sớm nhất giữa ngày cấp Thẻ ĐGV và ngày đăng ký danh sách tại Sở Tư
                    pháp. Thẻ ĐGV chỉ có từ 1/7/2017 — bỏ trống sẽ tính từ ngày cấp thẻ và
                    có thể thiệt tới 7 năm thâm niên.
                  </p>
                </FormItem>
              )} />

              <FormField control={form.control} name="managementStartDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Ngày bắt đầu giữ chức quản lý</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground">
                    Chỉ áp dụng cho Giám đốc / Phó Giám đốc.
                  </p>
                </FormItem>
              )} />

              <FormField control={form.control} name="professionalCertIssuedDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Ngày cấp CCHN</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Lưu thông tin
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  )
}
