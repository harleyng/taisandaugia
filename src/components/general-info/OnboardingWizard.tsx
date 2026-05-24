import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Form, FormField, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react'
import { vietnamProvinces } from '@/constants/vietnam-locations'
import { calcYearsOfOperation, calcMucIV5, mucIV5NextThreshold } from '@/lib/general-info/scoring'
import type { OrgGeneralInfo } from '@/types/general-info'

// Full wizard schema
const wizardSchema = z.object({
  // Step 1
  name: z.string().min(2, 'Tên công ty phải có ít nhất 2 ký tự'),
  shortName: z.string().optional(),
  orgType: z.enum(['TRUNG_TAM_DV', 'CONG_TY_HOP_DANH', 'DN_TU_NHAN']),
  taxCode: z.string().min(10, 'MST phải có 10 chữ số').max(13),
  registrationCode: z.string().optional(),

  // Step 2
  address: z.string().min(3, 'Vui lòng nhập địa chỉ'),
  province: z.string().min(1, 'Vui lòng chọn tỉnh/TP'),
  district: z.string().optional(),
  ward: z.string().optional(),
  phone: z.string().regex(/^0[0-9]{9}$/, 'SĐT không hợp lệ (VD: 0971234567)'),
  email: z.string().email('Email không hợp lệ'),
  website: z.string().url('URL không hợp lệ').optional().or(z.literal('')),

  // Step 3 (skippable)
  legalRepName: z.string().min(3, 'Họ tên phải có ít nhất 3 ký tự').optional().or(z.literal('')),
  legalRepPosition: z.string().optional(),

  // Step 4
  foundedDate: z.string().min(1, 'Vui lòng nhập ngày thành lập'),
})

type WizardValues = z.infer<typeof wizardSchema>

const STEP_REQUIRED_FIELDS: Record<number, (keyof WizardValues)[]> = {
  1: ['name', 'orgType', 'taxCode'],
  2: ['address', 'province', 'phone', 'email'],
  3: [],
  4: ['foundedDate'],
}

const STEPS = ['Pháp nhân', 'Địa chỉ & liên hệ', 'Đại diện PL', 'Thành lập']

interface OnboardingWizardProps {
  onComplete: (info: Partial<OrgGeneralInfo>) => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1)
  const [completed, setCompleted] = useState(false)
  const navigate = useNavigate()

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '', shortName: '', orgType: 'CONG_TY_HOP_DANH', taxCode: '', registrationCode: '',
      address: '', province: '', district: '', ward: '', phone: '', email: '', website: '',
      legalRepName: '', legalRepPosition: '',
      foundedDate: '',
    },
  })

  const foundedDate = form.watch('foundedDate')

  const validateCurrentStep = async (): Promise<boolean> => {
    const fields = STEP_REQUIRED_FIELDS[step]
    if (fields.length === 0) return true
    const result = await form.trigger(fields)
    return result
  }

  const handleNext = async () => {
    const valid = await validateCurrentStep()
    if (!valid) return
    if (step < 4) setStep((s) => s + 1)
    else handleFinish()
  }

  const handleSkip = () => {
    if (step < 4) setStep((s) => s + 1)
    else handleFinish()
  }

  const handleFinish = () => {
    const values = form.getValues()
    const now = new Date().toISOString()
    onComplete({
      name: values.name,
      shortName: values.shortName || undefined,
      orgType: values.orgType,
      taxCode: values.taxCode,
      registrationCode: values.registrationCode || undefined,
      isListedInMOJDirectory: true,
      address: values.address,
      province: values.province,
      district: values.district || undefined,
      ward: values.ward || undefined,
      phone: values.phone,
      email: values.email,
      website: values.website || undefined,
      legalRepName: values.legalRepName || '',
      legalRepPosition: values.legalRepPosition || undefined,
      foundedDate: values.foundedDate,
      bankAccounts: [],
      branches: [],
      createdAt: now,
    })
    setCompleted(true)
  }

  if (completed) {
    return <CompletionScreen onNavigateDGV={() => navigate('/portal/nang-luc/dau-gia-vien')} onNavigateDashboard={() => navigate('/portal/dashboard')} />
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      {/* Welcome header */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold">👋 Thiết lập thông tin công ty</h1>
        <p className="text-sm text-muted-foreground">
          Bước {step}/4 — {STEPS[step - 1]}
        </p>
      </div>

      {/* Progress */}
      <Progress value={(step / 4) * 100} className="h-1.5" />

      {/* Step indicators */}
      <div className="flex justify-between">
        {STEPS.map((label, i) => {
          const n = i + 1
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${n < step ? 'bg-success border-success text-white' : n === step ? 'border-primary text-primary' : 'border-muted text-muted-foreground'}`}>
                {n < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
              </div>
              <span className={`text-[10px] hidden sm:block ${n === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-5">
          <Form {...form}>
            <div className="space-y-4">
              {step === 1 && <Step1Entity form={form} />}
              {step === 2 && <Step2Address form={form} />}
              {step === 3 && <Step3LegalRep form={form} />}
              {step === 4 && <Step4Establishment form={form} foundedDate={foundedDate} />}
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Trở lại
          </Button>
        )}
        <div className="flex-1" />
        {step >= 3 && (
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
            Bỏ qua
          </Button>
        )}
        <Button onClick={handleNext} className="gap-1">
          {step === 4 ? 'Hoàn thành' : 'Tiếp tục'}
          {step < 4 && <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">⏱ Mất khoảng 5-10 phút</p>
    </div>
  )
}

function Step1Entity({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  return (
    <>
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
                  <RadioGroupItem value={opt.value} id={`wiz-orgType-${opt.value}`} />
                  <Label htmlFor={`wiz-orgType-${opt.value}`} className="font-normal">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

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
          <FormControl><Input {...field} className="font-mono text-xs" /></FormControl>
        </FormItem>
      )} />

    </>
  )
}

function Step2Address({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  return (
    <>
      <FormField control={form.control} name="address" render={({ field }) => (
        <FormItem>
          <FormLabel>Địa chỉ trụ sở *</FormLabel>
          <FormControl><Input {...field} placeholder="Số nhà, tên đường..." /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="province" render={({ field }) => (
        <FormItem>
          <FormLabel>Tỉnh / TP *</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger><SelectValue placeholder="Chọn tỉnh/TP" /></SelectTrigger>
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

      <div className="grid grid-cols-2 gap-3">
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

      <FormField control={form.control} name="phone" render={({ field }) => (
        <FormItem>
          <FormLabel>Số điện thoại *</FormLabel>
          <FormControl><Input {...field} placeholder="0971234567" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem>
          <FormLabel>Email *</FormLabel>
          <FormControl><Input {...field} type="email" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="website" render={({ field }) => (
        <FormItem>
          <FormLabel>Website</FormLabel>
          <FormControl><Input {...field} placeholder="https://..." /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  )
}

function Step3LegalRep({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">Thông tin đại diện pháp lý (có thể bổ sung sau).</p>

      <FormField control={form.control} name="legalRepName" render={({ field }) => (
        <FormItem>
          <FormLabel>Họ tên đại diện pháp lý</FormLabel>
          <FormControl><Input {...field} placeholder="Nguyễn Văn A" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="legalRepPosition" render={({ field }) => (
        <FormItem>
          <FormLabel>Chức vụ</FormLabel>
          <FormControl><Input {...field} placeholder="VD: Giám đốc" /></FormControl>
        </FormItem>
      )} />
    </>
  )
}

function Step4Establishment({ form, foundedDate }: { form: ReturnType<typeof useForm<WizardValues>>; foundedDate: string }) {
  let scoreHint: React.ReactNode = null
  if (foundedDate) {
    try {
      const op = calcYearsOfOperation(foundedDate)
      const score = calcMucIV5(op.years)
      const next = mucIV5NextThreshold(op.years)
      if (op.years > 0 || op.months > 0) {
        scoreHint = (
          <div className={`rounded-md px-3 py-2 text-xs ${score >= 4 ? 'bg-success/10 text-success' : 'bg-primary/5 text-primary'}`}>
            Hoạt động {op.displayText} → Mục IV.5: <strong>{score}/4 điểm</strong>
            {score >= 4 ? ' ✓ (mức cao nhất)' : next ? ` · ${next}` : ''}
          </div>
        )
      }
    } catch { /* ignore */ }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">Chỉ cần ngày thành lập. Các giấy tờ pháp lý có thể nhập sau.</p>

      <FormField control={form.control} name="foundedDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Ngày thành lập *</FormLabel>
          <FormControl><Input {...field} type="date" /></FormControl>
          <FormMessage />
          {scoreHint}
        </FormItem>
      )} />
    </>
  )
}

function CompletionScreen({ onNavigateDGV, onNavigateDashboard }: { onNavigateDGV: () => void; onNavigateDashboard: () => void }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-success" />
        </div>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold">✓ Đã hoàn thành Thông tin chung!</h2>
        <p className="text-sm text-muted-foreground">
          Tiếp theo, hãy thêm Đấu giá viên của công ty để tính điểm Mục IV.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={onNavigateDGV} className="gap-2">
          Tiếp tục với module Đấu giá viên
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onNavigateDashboard}>
          Quay về Dashboard
        </Button>
      </div>
    </div>
  )
}
