import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VIETNAM_PROVINCE_NAMES } from "@/constants/vietnam-provinces";
import { useSaveOrgContact } from "@/hooks/useOrgContacts";
import { EMAIL_RE } from "@/lib/marketing/importClassify";
import { isVietnamPhone } from "@/lib/orgContacts/phone";
import type { OrgContact } from "@/types/org-contacts";

const NO_PROVINCE = "__none__";

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Nhập họ tên (ít nhất 2 ký tự)"),
    contact_type: z.enum(["individual", "company"]),
    company_name: z.string().trim(),
    phone: z.string().trim().refine((v) => v === "" || isVietnamPhone(v), "Số điện thoại không hợp lệ"),
    email: z.string().trim().refine((v) => v === "" || EMAIL_RE.test(v), "Email sai định dạng"),
    zalo: z.string().trim(),
    province: z.string(),
    status: z.enum(["active", "inactive"]),
    notifications_enabled: z.boolean(),
    note: z.string().trim(),
  })
  .refine((v) => v.phone || v.email || v.zalo, {
    message: "Cần ít nhất số điện thoại, email hoặc Zalo",
    path: ["phone"],
  });

type FormValues = z.infer<typeof schema>;

const toValues = (c: OrgContact | null): FormValues => ({
  full_name: c?.full_name ?? "",
  contact_type: c?.contact_type ?? "individual",
  company_name: c?.company_name ?? "",
  phone: c?.phone ?? "",
  email: c?.email ?? "",
  zalo: c?.zalo ?? "",
  province: c?.province ?? NO_PROVINCE,
  status: c?.status ?? "active",
  notifications_enabled: c?.notifications_enabled ?? false,
  note: c?.note ?? "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: OrgContact | null;
  onCreated?: (id: string) => void;
}

export function ContactFormDialog({ open, onOpenChange, editing, onCreated }: Props) {
  const save = useSaveOrgContact();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toValues(editing) });
  const { register, control, handleSubmit, reset, watch, formState } = form;
  const { errors } = formState;

  useEffect(() => {
    if (open) reset(toValues(editing));
  }, [open, editing, reset]);

  const submit = handleSubmit((v) => {
    const fields = {
      full_name: v.full_name,
      contact_type: v.contact_type,
      company_name: v.contact_type === "company" ? v.company_name || null : null,
      phone: v.phone || null,
      email: v.email.toLowerCase() || null,
      zalo: v.zalo || null,
      province: v.province === NO_PROVINCE ? null : v.province,
      status: v.status,
      notifications_enabled: v.notifications_enabled,
      note: v.note || null,
    };
    save.mutate(
      { id: editing?.id, fields },
      {
        onSuccess: ({ id, created }) => {
          onOpenChange(false);
          if (created) onCreated?.(id);
        },
      },
    );
  });

  const err = (msg?: string) => msg && <p className="text-xs text-destructive">{msg}</p>;
  const isCompany = watch("contact_type") === "company";
  const provinceOptions = [...VIETNAM_PROVINCE_NAMES];
  if (editing?.province && !provinceOptions.includes(editing.province)) provinceOptions.unshift(editing.province);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
          <DialogDescription>Khách do tổ chức tự thu thập. Sàn không cung cấp dữ liệu người mua.</DialogDescription>
        </DialogHeader>

        <form id="contact-form" onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>
                Họ tên <span className="text-destructive">*</span>
              </Label>
              <Input {...register("full_name")} placeholder="Người liên hệ" />
              {err(errors.full_name?.message)}
            </div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Controller
                control={control}
                name="contact_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Cá nhân</SelectItem>
                      <SelectItem value="company">Tổ chức</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Đang theo dõi</SelectItem>
                      <SelectItem value="inactive">Ngừng theo dõi</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {isCompany && (
              <div className="col-span-2 space-y-1.5">
                <Label>Tên công ty</Label>
                <Input {...register("company_name")} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input {...register("phone")} inputMode="tel" placeholder="0901234567" />
              {err(errors.phone?.message)}
            </div>
            <div className="space-y-1.5">
              <Label>Zalo</Label>
              <Input {...register("zalo")} placeholder="SĐT hoặc link Zalo" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register("email")} inputMode="email" />
              {err(errors.email?.message)}
            </div>
            <div className="space-y-1.5">
              <Label>Tỉnh/thành</Label>
              <Controller
                control={control}
                name="province"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NO_PROVINCE}>Chưa rõ</SelectItem>
                      {provinceOptions.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <Controller
            control={control}
            name="notifications_enabled"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium text-foreground">Khách đã đồng ý nhận thông tin tiếp thị</span>
                  <span className="block text-xs text-muted-foreground">
                    Chỉ khách đã đồng ý mới được đưa vào danh sách gửi khi tiếp thị phiên. Hệ thống ghi lại thời điểm
                    và người đánh dấu.
                  </span>
                </span>
              </label>
            )}
          />

          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea {...register("note")} rows={2} />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="contact-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Lưu" : "Thêm khách hàng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
