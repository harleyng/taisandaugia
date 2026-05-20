# KYC Onboarding — Handoff sang codebase `taisandaugia`

**Variant đã chốt**: `2-cột (twocol)` + `mật độ vừa (regular)` + `tìm kiếm typeahead`.
Đối chiếu visual: mở `KYC Onboarding.html`, panel Tweaks → Bố cục **2-cột**, Mật độ **Vừa**, Kiểu tìm kiếm **Typeahead**.

---

## 1. File cần sửa trong codebase

| File | Vai trò mới |
|------|-------------|
| `src/components/company-onboarding/M2KYC.tsx` | Đổi từ `max-w-lg mx-auto` (1 cột hẹp) → wrapper 2-cột `max-w-6xl` |
| `src/components/company-onboarding/M2/KYCForm.tsx` | Tách thành 4 section card (A/B/C/D) + 1 footer card. Không còn `<Separator>` giữa các section, mỗi section là `<Card>`. |
| **MỚI** `src/components/company-onboarding/M2/CompanyTypeahead.tsx` | Combobox typeahead thay cho luôn-hiện-list (dùng `Command` + `Popover` từ shadcn) |
| **MỚI** `src/components/company-onboarding/M2/ReviewPanel.tsx` | Sidebar phải sticky: progress ring + danh sách section + trust signals + "Liên hệ ngay" |
| **MỚI** `src/components/company-onboarding/M2/sectionStatus.ts` | Logic tính progress từng section + `progress` (0..1) |
| `src/components/company-onboarding/M2/Step2SelectTitle.tsx` *(nếu tách ra)* | 2 thẻ chọn role (legal / auth) với perks |

> shadcn đã có sẵn `Command`, `Popover`, `Progress`, `Card`, `Tabs` — tận dụng. Không cần thêm package.

---

## 2. Quy ước design system (giữ nguyên token cũ)

Lấy từ `src/index.css` — đã có:
- `--primary: 210 90% 30%` (navy) → dùng cho stepper, CTA chính, focus ring
- `--success: 142 76% 36%` → trạng thái "đã hoàn thành"
- `--warning: 38 92% 50%` → cảnh báo (công ty đã liên kết, mục thiếu)
- `--muted-foreground` → text phụ
- `--border` → đường viền card
- `--radius: 0.5rem` → bo góc input/button; card dùng `rounded-2xl`

**Quan trọng**: KHÔNG đổi token. Không thêm màu mới. Mọi thứ phải dùng class Tailwind đã map sẵn (`bg-primary`, `text-muted-foreground`, …).

---

## 3. Validation rules (final)

| Field | Rule |
|-------|------|
| Họ và tên | ≥ 3 ký tự |
| CCCD | 9–12 chữ số |
| Hộ chiếu | ≥ 6 ký tự |
| Số điện thoại | `/^0[0-9]{9}$/` — gửi OTP rồi mới được set `phoneVerified = true` |
| Email | Format hợp lệ — **KHÔNG còn rule "phải là domain công ty"** |
| Tất cả upload | PDF/JPG/PNG, ≤ 10MB |

---

## 4. Cấu trúc layout 2-cột

```tsx
<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <header className="mb-6">
    <h1 className="text-3xl font-bold tracking-tight">Đăng ký tổ chức đấu giá</h1>
    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
      Điền thông tin KYC để liên kết công ty với tài khoản. Bạn có thể lưu nháp và quay lại bất kỳ lúc nào.
    </p>
  </header>

  <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
    {/* Left: 4 SectionCard */}
    <div className="space-y-4 min-w-0">
      <SectionCard index="A" title="Công ty đấu giá" done={status.a.done}>
        <CompanyTypeahead value={form.company} onSelect={…} />
      </SectionCard>
      <SectionCard index="B" title="Chức danh của bạn" done={status.b.done}>
        <RoleSelector value={form.role} onChange={…} />
      </SectionCard>
      <SectionCard index="C" title="Định danh người đăng ký" done={status.c.done}>
        <IdentityFields form={form} update={update} />
      </SectionCard>
      <SectionCard index="D" title="Giấy tờ pháp lý" done={status.d.done}>
        <DocumentsList form={form} update={update} />
      </SectionCard>

      {/* Footer submit */}
      <Card className="p-5 flex items-center gap-4">
        <label className="flex items-start gap-2.5 flex-1 cursor-pointer">
          <Checkbox checked={form.acceptedTerms} … />
          <p className="text-xs text-muted-foreground">Tôi xác nhận …</p>
        </label>
        <Button size="lg" disabled={!status.all || !form.acceptedTerms}>
          Nộp hồ sơ KYC <ArrowRight />
        </Button>
      </Card>
    </div>

    {/* Right: sticky aside */}
    <aside className="space-y-4 lg:sticky lg:top-4">
      <Card className="p-5"><ReviewPanel form={form} status={status} /></Card>
      <Card className="p-5"><TrustSignals /></Card>
      <div className="px-1">
        <p className="text-xs text-muted-foreground mb-2">Cần hỗ trợ?</p>
        <Button variant="outline" size="sm"><Phone /> Liên hệ ngay</Button>
      </div>
    </aside>
  </div>
</div>
```

---

## 5. Typeahead Section A — dùng `Command` + `Popover`

```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <div className="relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input placeholder="Tìm theo tên công ty, MST hoặc địa chỉ..." className="pl-9" />
    </div>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
    <Command>
      <CommandList>
        <CommandEmpty>Không có kết quả cho "{q}"</CommandEmpty>
        <CommandGroup>
          {results.map(c => (
            <CommandItem key={c.id} onSelect={() => onSelect(c)}>
              <CompanyAvatar company={c} />
              <div className="flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.address}, {c.city} · MST {c.taxCode}
                </p>
              </div>
              {c.linked && <Badge variant="outline" className="border-orange-300 text-orange-600">Đã có TK</Badge>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="border-t p-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Không tìm thấy công ty của bạn?</p>
        <Button variant="link" size="sm"><Plus className="h-3 w-3" />Yêu cầu bổ sung</Button>
      </div>
    </Command>
  </PopoverContent>
</Popover>
```

**Lưu ý**: Khi đã chọn công ty → ẩn typeahead, hiện 1 card chi tiết (tên, MST, địa chỉ, license, năm thành lập, số đấu giá viên) với badge `Sẵn sàng liên kết` (success) hoặc `Đã có tài khoản` (warning + CTA "Liên hệ hỗ trợ").

---

## 6. ReviewPanel (sidebar phải)

Component tự đứng riêng. Props:
```ts
interface ReviewPanelProps {
  form: KYCFormData;
  status: SectionStatus;          // tính từ sectionStatus(form)
  onJump?: (id: 'a'|'b'|'c'|'d') => void;
}
```

Render:
1. **Progress ring 56×56** ở góc trái + label "Hồ sơ KYC" + "Còn N mục" / "Sẵn sàng nộp" → dùng `<svg>` 2 circle, không cần lib.
2. 4 nhóm A/B/C/D, mỗi nhóm:
   - Heading nhỏ (uppercase, tracking-wider, text-muted-foreground)
   - Status check ✓ hoặc "cần điền" / "x/y"
   - List item: tick xanh khi xong + label gạch ngang, ô tròn trống + label đậm khi chưa.
3. Click vào 1 item → `onJump('c')` → scroll smooth tới section C trong form bên trái + flash ring `ring-2 ring-primary/40` 1.2s.

---

## 7. Section logic (`sectionStatus.ts`)

```ts
export function sectionStatus(form: KYCFormData) {
  const a = { done: !!form.company && !form.company.linked };
  const b = { done: !!form.role };

  const cFields = [
    { ok: form.fullName.trim().length >= 3 },
    { ok: form.idType === 'cccd' ? /^\d{9,12}$/.test(form.idNumber) : form.idNumber.trim().length >= 6 },
    { ok: !!form.idFront }, { ok: !!form.idBack }, { ok: !!form.selfie },
    { ok: form.phoneVerified },
    { ok: form.emailVerified },
  ];
  const c = { done: cFields.every(f => f.ok), fields: cFields };

  const dReq = ['doc_dkdn', 'doc_license', ...(form.role === 'auth' ? ['doc_auth'] : [])];
  const dRows = dReq.map(k => ({ k, ok: !!form[k] }));
  const d = { done: dRows.every(f => f.ok), fields: dRows };

  const progress = (
    (a.done ? 1 : 0) + (b.done ? 1 : 0)
    + cFields.filter(f => f.ok).length / cFields.length
    + dRows.filter(f => f.ok).length / dRows.length
  ) / 4;

  return { a, b, c, d, all: a.done && b.done && c.done && d.done, progress };
}
```

---

## 8. Acceptance criteria

- [ ] Form không còn 1 cột hẹp `max-w-lg`. Trên desktop ≥1024px chia 2 cột.
- [ ] Sidebar phải sticky khi scroll, không nhảy.
- [ ] Section A: input rỗng → không show list; focus/typing → dropdown hiện ra.
- [ ] Click vào item trong sidebar → smooth-scroll tới section tương ứng + flash ring.
- [ ] Email **không** còn validate domain.
- [ ] CCCD upload zone khi đã upload: **không còn** dashed border + green check (gây hiểu nhầm "rỗng"). Thay bằng ảnh preview thật hoặc placeholder có background fill.
- [ ] Badge "Bắt buộc" dùng `variant="outline"` neutral (xám), **không** đỏ.
- [ ] Submit bị disable cho đến khi `status.all && form.acceptedTerms`.
- [ ] Mobile <768px: sidebar fold xuống dưới form (dùng `lg:sticky` only).

---

## 9. Prompt cho Claude trong VS Code

> Copy nguyên đoạn dưới đây paste vào Claude chat của VS Code (đã mở project `taisandaugia`):

```
Tôi cần refactor KYC form theo design mới — bố cục 2 cột, mật độ vừa, search dạng typeahead.

Bối cảnh:
- File hiện tại: src/components/company-onboarding/M2/KYCForm.tsx (1 cột hẹp max-w-lg, dài và rối)
- File spec đầy đủ: HANDOFF-KYC.md (đã đính kèm trong project)
- shadcn components đã có sẵn: Command, Popover, Card, Progress, Checkbox, RadioGroup, Input, Button, Badge

Đọc HANDOFF-KYC.md trước. Sau đó làm theo thứ tự:

1. Tạo src/components/company-onboarding/M2/sectionStatus.ts theo section 7.
2. Tạo src/components/company-onboarding/M2/CompanyTypeahead.tsx — combobox dùng Command+Popover, theo section 5. Khi đã chọn công ty thì ẩn input, hiện card chi tiết.
3. Tạo src/components/company-onboarding/M2/ReviewPanel.tsx — sidebar progress + danh sách item có thể click jump, theo section 6.
4. Tạo src/components/company-onboarding/M2/TrustSignals.tsx — 3 dòng nhỏ: Mã hóa AES-256 / Tuân thủ NĐ 13 / Xét duyệt 24h.
5. Refactor M2KYC.tsx: bỏ max-w-lg, dùng layout grid 2 cột theo section 4.
6. Refactor KYCForm.tsx:
   - Bỏ <Separator>, mỗi section A/B/C/D bọc trong <Card>.
   - Section A: thay block "luôn hiện list" bằng <CompanyTypeahead>.
   - Section B: 2 thẻ to (không phải 2 radio item nhỏ) — mỗi thẻ có icon + title + desc + 2 perk.
   - Section C: validation theo section 3. Bỏ rule "phải email domain công ty". Email field rename "Email liên hệ".
   - Section D: badge "Bắt buộc" đổi sang variant outline neutral (không đỏ).
   - Doc upload row khi xong: hiện tên file + KB, nút "Xóa" / "Thay".
   - Photo tile khi xong: hiện ảnh preview thật hoặc 1 placeholder có fill — KHÔNG còn dashed border.
7. Thêm checkbox "Tôi xác nhận thông tin chính xác..." cạnh nút submit. Disable submit khi !status.all || !form.acceptedTerms.

Acceptance criteria xem section 8. Sau khi xong, chạy bun dev và test trên trang /company-onboarding (step M2).
```

---

## 10. Tài liệu tham khảo trong prototype

| Trong prototype | Tương đương khi port |
|----------------|----------------------|
| `Btn` | `<Button>` shadcn |
| `TextInput leading={…}` | `<Input>` + icon absolute |
| `Pill tone="success"` | `<Badge variant="outline" className="border-green-300 …">` |
| `Card` | `<Card>` shadcn |
| `Modal` | `<Dialog>` shadcn |
| `OtpInput` | `<InputOTP>` shadcn (đã có) |
| `Ic.*` | Lucide icons (`lucide-react` đã có) |

Khi không chắc style cụ thể, mở `KYC Onboarding.html` trong project Asset Auction này, chuyển Tweaks → Bố cục **2-cột**, Mật độ **Vừa**, Tìm kiếm **Typeahead** rồi xem trực tiếp.
